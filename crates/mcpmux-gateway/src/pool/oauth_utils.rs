//! Shared OAuth utilities for metadata discovery with origin URL fallback.
//!
//! Some OAuth servers (like Atlassian) serve their metadata at the origin URL
//! (e.g., `https://mcp.atlassian.com`) rather than the endpoint path
//! (e.g., `https://mcp.atlassian.com/v1/sse`). This module provides utilities
//! to handle both cases.

use std::time::Duration;

use mcpmux_core::{CredentialRepository, OutboundOAuthRepository, StoredOAuthMetadata};
use rmcp::transport::auth::{AuthError, AuthorizationManager, AuthorizationMetadata};
use tracing::{info, warn};
use url::Url;
use uuid::Uuid;

/// Extract the origin (scheme + host + port) from a URL.
///
/// # Example
/// ```ignore
/// extract_origin("https://mcp.atlassian.com/v1/sse") // -> Some("https://mcp.atlassian.com")
/// extract_origin("http://localhost:8080/api") // -> Some("http://localhost:8080")
/// ```
pub fn extract_origin(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?;
    let mut origin = format!("{}://{}", parsed.scheme(), host);
    if let Some(port) = parsed.port() {
        origin = format!("{}:{}", origin, port);
    }
    Some(origin)
}

/// Discover OAuth metadata with fallback to origin URL.
///
/// This tries to discover metadata at the server URL first. If that fails with
/// `NoAuthorizationSupport`, it extracts the origin and tries there.
///
/// Returns the discovered metadata if successful, or an error if both attempts fail.
pub async fn discover_metadata_with_fallback(
    manager: &mut AuthorizationManager,
    server_url: &str,
) -> Result<AuthorizationMetadata, AuthError> {
    // First try the direct URL
    match manager.discover_metadata().await {
        Ok(metadata) => {
            info!("[OAuth] Metadata discovered at endpoint: {}", server_url);
            Ok(metadata)
        }
        Err(AuthError::NoAuthorizationSupport) => {
            // Try origin URL as fallback
            let origin_url = extract_origin(server_url).ok_or(AuthError::NoAuthorizationSupport)?;

            info!(
                "[OAuth] Metadata not at endpoint, trying origin: {}",
                origin_url
            );

            let origin_manager = AuthorizationManager::new(&origin_url)
                .await
                .map_err(|_| AuthError::NoAuthorizationSupport)?;

            let metadata = origin_manager.discover_metadata().await?;

            info!("[OAuth] Metadata discovered at origin: {}", origin_url);

            Ok(metadata)
        }
        Err(e) => Err(e),
    }
}

/// Discover metadata and return both the RMCP metadata (for setting on manager)
/// and our stored format (for persistence).
///
/// Use this when you need to both configure RMCP and save metadata for future reconnects.
pub async fn discover_and_convert_metadata(
    manager: &mut AuthorizationManager,
    server_url: &str,
) -> Result<(AuthorizationMetadata, StoredOAuthMetadata), AuthError> {
    let metadata = discover_metadata_with_fallback(manager, server_url).await?;
    let stored = convert_to_stored_metadata(&metadata);
    Ok((metadata, stored))
}

/// Convert RMCP's AuthorizationMetadata to our StoredOAuthMetadata format.
///
/// This allows us to persist discovered metadata and later use it to bypass
/// RMCP's metadata discovery (which can fail on non-spec-compliant servers).
pub fn convert_to_stored_metadata(metadata: &AuthorizationMetadata) -> StoredOAuthMetadata {
    StoredOAuthMetadata {
        authorization_endpoint: metadata.authorization_endpoint.clone(),
        token_endpoint: metadata.token_endpoint.clone(),
        registration_endpoint: metadata.registration_endpoint.clone(),
        issuer: metadata.issuer.clone(),
        jwks_uri: metadata.jwks_uri.clone(),
        scopes_supported: metadata.scopes_supported.clone(),
        response_types_supported: metadata.response_types_supported.clone(),
        additional_fields: metadata.additional_fields.clone(),
    }
}

/// True when an OAuth error means the cached DCR `client_id` is dead.
///
/// `invalid_client` (RFC 6749 / RFC 7591) is the standard signal to drop the
/// registration and POST `/register` again. Providers also spell this as
/// `invalid client_id` (Cloudflare) or "unrecognized client".
///
/// `invalid_client_metadata` is a DCR request problem, not a stale cache hit.
pub fn is_stale_oauth_client_error(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    if lower.contains("invalid_client") && !lower.contains("invalid_client_metadata") {
        return true;
    }
    const NEEDLES: &[&str] = &[
        "invalid client_id",
        "invalid client id",
        "unrecognized client",
        "unknown client",
        "client_id is not registered",
        "client id is not registered",
        "client not found",
        "no registered client",
    ];
    NEEDLES.iter().any(|needle| lower.contains(needle))
}

/// Drop a cached outbound DCR row and its tokens so the next flow re-registers.
pub async fn invalidate_stale_outbound_dcr(
    credential_repo: &dyn CredentialRepository,
    backend_oauth_repo: &dyn OutboundOAuthRepository,
    space_id: &Uuid,
    server_id: &str,
) {
    if let Err(e) = backend_oauth_repo.delete(space_id, server_id).await {
        warn!(
            "[OAuth] Failed to delete stale DCR for {}/{}: {}",
            space_id, server_id, e
        );
    }
    if let Err(e) = credential_repo.clear_tokens(space_id, server_id).await {
        warn!(
            "[OAuth] Failed to clear tokens after stale DCR for {}/{}: {}",
            space_id, server_id, e
        );
    }
    info!(
        "[OAuth] Dropped stale DCR client_id for {}/{}; will re-register",
        space_id, server_id
    );
}

/// GET the authorize URL (no loopback follow) and report an explicit client rejection.
///
/// Network failures and generic 4xx pages return `false` so a flaky probe does not
/// force a needless re-register. Cloudflare renders `invalid client_id` as HTML
/// on 200, which this still catches.
pub async fn authorize_url_rejects_cached_client(auth_url: &str) -> bool {
    let client = match reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            match attempt.url().host_str() {
                Some("127.0.0.1") | Some("localhost") | Some("[::1]") => attempt.stop(),
                _ if attempt.previous().len() >= 5 => attempt.stop(),
                _ => attempt.follow(),
            }
        }))
        .timeout(Duration::from_secs(8))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let response = match client.get(auth_url).send().await {
        Ok(r) => r,
        Err(_) => return false,
    };

    if let Some(location) = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
    {
        if location_rejects_cached_client(location) {
            return true;
        }
    }

    let body = response.text().await.unwrap_or_default();
    is_stale_oauth_client_error(&body)
}

/// True when a redirect `Location` carries an invalid-client OAuth error.
fn location_rejects_cached_client(location: &str) -> bool {
    if is_stale_oauth_client_error(location) {
        return true;
    }
    let Ok(url) = Url::parse(location) else {
        return false;
    };
    url.query_pairs().any(|(key, value)| {
        matches!(key.as_ref(), "error" | "error_description")
            && is_stale_oauth_client_error(value.as_ref())
    })
}

/// Convert our StoredOAuthMetadata back to RMCP's AuthorizationMetadata format.
///
/// This is used when loading saved metadata and setting it on the RMCP manager
/// to bypass discovery.
pub fn convert_from_stored_metadata(stored: &StoredOAuthMetadata) -> AuthorizationMetadata {
    let mut metadata = AuthorizationMetadata::default();
    metadata.authorization_endpoint = stored.authorization_endpoint.clone();
    metadata.token_endpoint = stored.token_endpoint.clone();
    metadata.registration_endpoint = stored.registration_endpoint.clone();
    metadata.issuer = stored.issuer.clone();
    metadata.jwks_uri = stored.jwks_uri.clone();
    metadata.scopes_supported = stored.scopes_supported.clone();
    metadata.response_types_supported = stored.response_types_supported.clone();
    metadata.additional_fields = stored.additional_fields.clone();
    metadata
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_origin_with_path() {
        assert_eq!(
            extract_origin("https://mcp.atlassian.com/v1/sse"),
            Some("https://mcp.atlassian.com".to_string())
        );
    }

    #[test]
    fn test_extract_origin_with_port() {
        assert_eq!(
            extract_origin("http://localhost:8080/api/v1"),
            Some("http://localhost:8080".to_string())
        );
    }

    #[test]
    fn test_extract_origin_no_path() {
        assert_eq!(
            extract_origin("https://example.com"),
            Some("https://example.com".to_string())
        );
    }

    #[test]
    fn test_extract_origin_invalid_url() {
        assert_eq!(extract_origin("not a url"), None);
    }

    #[test]
    fn stale_client_matches_rfc_and_cloudflare() {
        assert!(is_stale_oauth_client_error("invalid_client"));
        assert!(is_stale_oauth_client_error(
            "OAuth token refresh failed: invalid_client"
        ));
        assert!(is_stale_oauth_client_error(
            "Invalid Request\ninvalid client_id"
        ));
        assert!(is_stale_oauth_client_error("Unrecognized client_id"));
        assert!(is_stale_oauth_client_error(
            "error=invalid_client&error_description=unknown+client"
        ));
    }

    #[test]
    fn stale_client_ignores_unrelated_errors() {
        assert!(!is_stale_oauth_client_error("invalid_client_metadata"));
        assert!(!is_stale_oauth_client_error("invalid_grant"));
        assert!(!is_stale_oauth_client_error("access_denied"));
        assert!(!is_stale_oauth_client_error("redirect_uri mismatch"));
    }

    #[test]
    fn location_header_rejects_invalid_client_query() {
        assert!(location_rejects_cached_client(
            "http://127.0.0.1:33418/oauth2redirect?error=invalid_client"
        ));
        assert!(!location_rejects_cached_client(
            "https://dash.cloudflare.com/login?state=abc"
        ));
    }
}
