//! OAuth Middleware for rmcp Integration
//!
//! This middleware extracts OAuth Bearer tokens, verifies JWTs, resolves spaces,
//! and injects OAuthContext into request extensions for use by ServerHandler.
//!
//! Uses TraceContext from logging_middleware for request correlation.

use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{header, Request, Response, StatusCode},
    middleware::Next,
    response::IntoResponse,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::auth::validate_token;
use crate::logging::TraceContext;
use crate::server::ServiceContainer;
use crate::services::{resolve_window_key, PinSource, SessionRootsRegistry};

/// Synthetic client identity used when system-wide inbound auth is disabled and
/// a connection arrives without a (valid) Bearer token. Routing still prefers
/// the `X-Mcpmux-Workspace` header → binding; this id only feeds the rootless
/// `client_grants` fallback (which finds none) → Space default.
const ANONYMOUS_CLIENT_ID: &str = "mcpmux-anonymous";

/// OAuth middleware for MCP endpoints using rmcp
///
/// Extracts Bearer token → Verifies JWT → Resolves space → Injects OAuthContext
pub async fn mcp_oauth_middleware(
    axum::extract::State(services): axum::extract::State<Arc<ServiceContainer>>,
    mut request: Request<Body>,
    next: Next,
) -> Response<Body> {
    // Skip auth for OPTIONS (CORS preflight)
    if request.method() == axum::http::Method::OPTIONS {
        return next.run(request).await;
    }

    // Get or create trace context from upstream middleware
    let trace_id = request
        .extensions()
        .get::<TraceContext>()
        .map(|ctx| ctx.trace_id.clone())
        .unwrap_or_else(|| "??????".to_string());

    // Advertise the address the client actually reached us on (or the configured
    // public base URL) so a gateway bound to 0.0.0.0 returns a resource-metadata
    // URL the remote client can resolve — see `effective_base_url`.
    let base_url = {
        let state = services.gateway_state.read().await;
        let host = request
            .headers()
            .get(header::HOST)
            .and_then(|v| v.to_str().ok());
        crate::server::effective_base_url(
            state.public_base_url.as_deref(),
            state.network_bind,
            host,
            &state.base_url,
        )
    };

    // System-wide inbound auth can be disabled (localhost-only convenience):
    // when off, a connection is accepted without a Bearer token and routed by
    // the workspace header / default space. A valid token is still honored when
    // present, so flipping the setting never breaks an already-configured
    // client. Default is auth-required.
    let require_auth = !services.gateway_state.read().await.auth_disabled();

    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let token = auth_header
        .as_deref()
        .and_then(|v| v.strip_prefix("Bearer "));

    // Verify the Bearer token whenever one is present.
    let claims = match token {
        Some(token) => {
            let jwt_secret = {
                let state = services.gateway_state.read().await;
                state.get_jwt_secret().map(|s| s.to_vec())
            };
            match jwt_secret {
                Some(secret) => validate_token(token, &secret),
                None => {
                    warn!(trace_id = %trace_id, "JWT secret not configured");
                    None
                }
            }
        }
        None => None,
    };

    // If there's no valid JWT, a presented Bearer may instead be a long-lived
    // API key (host-issued, for headless/remote clients) — validate it directly
    // to a client_id so a remote client can authenticate with no interactive
    // consent (the OAuth consent deep link only works on the host).
    let api_key_client_id = if claims.is_none() {
        match token {
            Some(tok) => match services
                .dependencies
                .inbound_client_repo
                .validate_api_key(tok)
                .await
            {
                Ok(result) => result.map(|auth| auth.client_id),
                Err(e) => {
                    warn!(trace_id = %trace_id, "API key validation error: {}", e);
                    None
                }
            },
            None => None,
        }
    } else {
        None
    };

    // Resolve (client_id, space_id) from the authenticated identity (JWT or API
    // key); when auth is disabled, fall back to an anonymous identity on the
    // default space.
    let authed_client_id = claims.map(|c| c.client_id).or(api_key_client_id);

    // Revocation check: a JWT access token is a stateless, self-contained
    // credential that stays cryptographically valid until it expires —
    // deleting the client in the UI doesn't invalidate tokens it already
    // issued. Confirm the client row still exists on every request so a
    // revoked client is rejected on its very next call instead of continuing
    // to work until natural token expiry.
    let authed_client_id = match authed_client_id {
        Some(cid) => match services
            .dependencies
            .inbound_client_repo
            .get_client(&cid)
            .await
        {
            Ok(Some(_)) => {
                // `last_seen` otherwise only gets stamped by the /oauth/token
                // grant handlers, which API-key clients (static `mcpk_`
                // bearer, no OAuth dance) never hit — leaving their
                // Connections-page status dot permanently "never seen"
                // regardless of how active they are. Stamp it here instead,
                // from the identity every request already resolves.
                //
                // ponytail: writes unconditionally on every request (no
                // throttling) — fine for local single-user SQLite; if this
                // ever shows up in profiling, bucket it to e.g. 10s windows
                // using the just-fetched `client.last_seen` instead of
                // writing every time.
                if let Err(e) = services
                    .dependencies
                    .inbound_client_repo
                    .update_client_last_seen(&cid)
                    .await
                {
                    warn!(trace_id = %trace_id, client_id = %cid, "Failed to update last_seen: {}", e);
                }
                Some(cid)
            }
            Ok(None) => {
                warn!(trace_id = %trace_id, client_id = %cid, "Client no longer registered (revoked) — rejecting");
                None
            }
            Err(e) => {
                warn!(trace_id = %trace_id, client_id = %cid, "Client lookup failed: {}", e);
                None
            }
        },
        None => None,
    };

    let (client_id, space_id) = if let Some(cid) = authed_client_id {
        match services
            .space_resolver_service
            .resolve_space_for_client(&cid)
            .await
        {
            Ok(id) => (cid, id),
            Err(e) => {
                warn!(
                    trace_id = %trace_id,
                    client_id = %cid,
                    "Failed to resolve space: {}", e
                );
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to resolve space: {}", e),
                )
                    .into_response();
            }
        }
    } else if require_auth {
        // No valid token and auth is required → 401 with the specific reason.
        let msg = match auth_header.as_deref() {
            None => "Missing Authorization header",
            Some(v) if !v.starts_with("Bearer ") => "Authorization header must use Bearer scheme",
            // A token still carrying `${...}` was never issued by anyone — the
            // client's env substitution didn't run. Observed after a Cursor MCP
            // respawn, where `mcp-remote` sends the literal `${MCPMUX_API_KEY}`
            // and Cursor then reports only a connection timeout. Naming it makes
            // that one grep instead of an investigation.
            Some(v) if v.contains("${") => {
                "Authorization header contains an unexpanded ${...} template"
            }
            _ => "Invalid token",
        };
        warn!(trace_id = %trace_id, "{}", msg);
        return unauthorized_response(&base_url, msg);
    } else {
        // Auth disabled → accept anonymously on the default space. Routing
        // still prefers the workspace header (pinned below) → binding.
        match services.dependencies.space_repo.get_default().await {
            Ok(Some(space)) => (ANONYMOUS_CLIENT_ID.to_string(), space.id),
            Ok(None) => {
                warn!(trace_id = %trace_id, "Auth disabled but no default space configured");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "No default space configured",
                )
                    .into_response();
            }
            Err(e) => {
                warn!(trace_id = %trace_id, "Failed to resolve default space: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to resolve default space: {}", e),
                )
                    .into_response();
            }
        }
    };

    // Inject OAuth context via custom headers (rmcp will preserve these)
    request.headers_mut().insert(
        "x-mcpmux-client-id",
        client_id.parse().expect("valid header value"),
    );
    request.headers_mut().insert(
        "x-mcpmux-space-id",
        space_id.to_string().parse().expect("valid header value"),
    );

    // Pin an explicit workspace root advertised by the client via the
    // `X-Mcpmux-Workspace` header (injected by McpMux's per-workspace client
    // configs). It shadows the client's MCP-reported roots in the resolver, so
    // a connection routes to its workspace binding even when the client never
    // reports `roots` or reports a stale one (e.g. Cursor sharing one MCP host
    // across windows). Unlike client/space id above, this header is
    // client-asserted — the same trust model as MCP roots: any approved local
    // client can claim any binding (see FeatureSetResolver trust model). Keyed
    // by the `mcp-session-id` the client echoes on every post-initialize
    // request (the same key the handler stores reported roots under).
    let peer_addr = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0);
    let (session_id_header, workspace_header, workspace_set_header) = {
        let headers = request.headers();
        let sid = headers
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let ws = headers
            .get("x-mcpmux-workspace")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let ws_set = headers
            .get("x-mcpmux-workspace-set")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        (sid, ws, ws_set)
    };
    if let Some(sid) = session_id_header.as_deref() {
        attach_window_identity(&services, sid, peer_addr);
    }
    let mut empty_workspace_header = false;
    match (&session_id_header, &workspace_header) {
        // Neither the editor nor mcp-remote expanded the template, so the
        // literal reached us. Distinct from the empty case below: it means
        // mcp-remote's own `${ENV}` substitution changed behavior, since today
        // it rewrites an unknown variable to an empty string.
        (_, Some(ws)) if ws.contains("${") => {
            warn!(
                trace_id = %trace_id,
                session_id = session_id_header.as_deref().unwrap_or("<none>"),
                workspace_header = %ws,
                "[SessionRoots] X-Mcpmux-Workspace arrived as an unexpanded template — \
                 pin skipped rather than pinning a literal",
            );
        }
        (_, Some(ws)) if ws.trim().is_empty() => {
            empty_workspace_header = true;
        }
        (Some(sid), Some(ws)) => {
            services
                .session_roots
                .set_pinned(sid, ws, PinSource::WorkspaceHeader);
        }
        (None, Some(ws)) => {
            info!(
                trace_id = %trace_id,
                workspace_header = %ws,
                "[SessionRoots] X-Mcpmux-Workspace held until mcp-session-id exists",
            );
            services
                .session_roots
                .remember_pending_workspace(&client_id, ws);
        }
        (Some(sid), None) => {
            services.session_roots.apply_pending_workspace(
                &client_id,
                sid,
                workspace_set_header.as_deref(),
            );
        }
        _ => {}
    }

    // The calling window's full folder set (`X-Mcpmux-Workspace-Set`, carrying
    // Cursor's `WORKSPACE_FOLDER_PATHS`). Recorded as a constraint on which
    // roots this session may claim, and as the candidate list shown when the
    // workspace header above failed to resolve. A set of one also pins,
    // because one candidate cannot be ambiguous. Held across initialize like
    // the workspace header, since both arrive before `mcp-session-id`.
    match (&session_id_header, &workspace_set_header) {
        // The bridge config assumes Cursor leaves `${WORKSPACE_FOLDER_PATHS}`
        // alone (it isn't a Cursor variable) so mcp-remote expands it from the
        // child environment. This warn is how that assumption reports failure:
        // the set is dropped rather than parsed, so routing degrades to the
        // pre-set-header behavior instead of misrouting.
        (_, Some(set)) if set.contains("${") => {
            warn!(
                trace_id = %trace_id,
                session_id = session_id_header.as_deref().unwrap_or("<none>"),
                workspace_set_header = %set,
                "[SessionRoots] X-Mcpmux-Workspace-Set arrived unexpanded — no candidate \
                 set for this session; check that WORKSPACE_FOLDER_PATHS is present in \
                 the mcp-remote child environment",
            );
        }
        (_, Some(set)) if set.trim().is_empty() => {}
        (Some(sid), Some(set)) => {
            services.session_roots.set_candidates(sid, set);
        }
        (None, Some(set)) => {
            services
                .session_roots
                .remember_pending_candidates(&client_id, set);
        }
        (Some(sid), None) => {
            services
                .session_roots
                .apply_pending_candidates(&client_id, sid);
        }
        _ => {}
    }

    if let Some(sid) = session_id_header.as_deref() {
        resolve_window_pin(
            &services,
            sid,
            empty_workspace_header,
            workspace_set_header.as_deref(),
            &trace_id,
        );
    }

    // Captured before `request` is consumed below — needed to recognize the
    // spec-correct GET shapes (pre-init SSE, post-timeout reconnect) when
    // deciding whether to warn on the response status.
    let http_method = request.method().clone();

    // Extract MCP method from body if POST
    let mcp_method = if request.method() == axum::http::Method::POST {
        use axum::body::to_bytes;

        let (parts, body) = request.into_parts();

        match to_bytes(body, usize::MAX).await {
            Ok(body_bytes) => {
                let method = crate::server::logging_middleware::extract_mcp_method(&body_bytes);

                // Log single consolidated entry line
                info!(
                    trace_id = %trace_id,
                    client = %&client_id[..client_id.len().min(12)],
                    space = %&space_id.to_string()[..8],
                    session_id = session_id_header.as_deref().unwrap_or("<none>"),
                    workspace_header = workspace_header.as_deref().unwrap_or("<absent>"),
                    window_key = session_id_header
                        .as_deref()
                        .and_then(|sid| services.session_roots.window_key_for(sid))
                        .map(|key| key.to_string())
                        .as_deref()
                        .unwrap_or("<none>"),
                    method = method.as_deref().unwrap_or("-"),
                    "→ MCP"
                );

                // Reconstruct the request
                request = axum::http::Request::from_parts(parts, Body::from(body_bytes));
                method
            }
            Err(e) => {
                warn!(trace_id = %trace_id, "Failed to read body: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to read request body: {}", e),
                )
                    .into_response();
            }
        }
    } else {
        // GET request (SSE stream)
        debug!(trace_id = %trace_id, "SSE stream request");
        None
    };

    let response = next.run(request).await;

    if let Some(sid) = response
        .headers()
        .get("mcp-session-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
    {
        attach_window_identity(&services, sid, peer_addr);
        if let Some(ws) = workspace_header
            .as_deref()
            .filter(|value| !value.trim().is_empty() && !value.contains("${"))
        {
            services
                .session_roots
                .set_pinned(sid, ws, PinSource::WorkspaceHeader);
        }
        resolve_window_pin(
            &services,
            sid,
            empty_workspace_header,
            workspace_set_header.as_deref(),
            &trace_id,
        );
    }

    // Log errors only — except two rmcp spec-correct shapes that are not
    // gateway problems: a GET without Mcp-Session-Id (client opening the SSE
    // stream before initialize) and any request against a session rmcp has
    // already closed (idle keep-alive timeout or explicit termination). Both
    // are expected client reconnect behavior. See
    // docs/planning/aug14-gateway-ops-bugs.md Decision 4.
    let status = response.status();
    let is_expected_session_noise = (http_method == axum::http::Method::GET
        && status == StatusCode::BAD_REQUEST)
        || status == StatusCode::NOT_FOUND;
    if (status.is_server_error() || status.is_client_error()) && !is_expected_session_noise {
        warn!(
            trace_id = %trace_id,
            status = %status,
            client = %client_id,
            method = mcp_method.as_deref().unwrap_or("-"),
            "← MCP error"
        );
    }

    response
}

/// Map the peer socket to a window key once per session and remember it.
fn attach_window_identity(services: &ServiceContainer, session_id: &str, peer: Option<SocketAddr>) {
    if services.session_roots.window_key_for(session_id).is_some() {
        return;
    }
    let Some(peer) = peer else {
        return;
    };
    let Some(key) = resolve_window_key(peer) else {
        return;
    };
    info!(
        %session_id,
        window_key = %key,
        peer = %peer,
        "[SessionRoots] window identity from peer socket",
    );
    services.session_roots.attach_window(session_id, key);
}

/// Promote an explicit session pin to the window, or inherit a remembered one.
///
/// An empty header is a failed substitution, not "reuse the last pin." Drop
/// the session claim and skip window inherit so a sibling window on the
/// shared `mcp-session-id` cannot keep resolving through the previous root.
/// A one-member set on *this* request is a stronger claim than the empty
/// active-folder header and must keep the SingleCandidate pin.
fn resolve_window_pin(
    services: &ServiceContainer,
    session_id: &str,
    empty_workspace_header: bool,
    workspace_set_header: Option<&str>,
    trace_id: &str,
) {
    let same_request_single_set =
        workspace_set_header.is_some_and(SessionRootsRegistry::set_header_is_single_folder);
    if empty_workspace_header && !same_request_single_set {
        services.session_roots.forget_empty_header_claim(session_id);
        warn!(
            trace_id = %trace_id,
            session_id,
            "[SessionRoots] X-Mcpmux-Workspace present but empty — pin cleared \
             (Cursor did not substitute ${{workspaceFolder}} before spawning \
             mcp-remote, which then expanded the unresolved literal to empty). \
             Affects editor and Agents windows alike; recover with \
             mcpmux_set_workspace_root, or install a per-repo static header to \
             avoid substitution entirely — \
             see docs/manual/cursor-workspace-bridge.md Fallback",
        );
        return;
    }
    if services.session_roots.session_pin(session_id).is_some() {
        services.session_roots.promote_pin_to_window(session_id);
        return;
    }
    services.session_roots.inherit_window_pin(session_id);
}

/// Generate unauthorized response with RFC 9728 protected-resource discovery.
fn unauthorized_response(base_url: &str, message: &str) -> Response<Body> {
    let resource_metadata_url = format!(
        "{}/.well-known/oauth-protected-resource/mcp",
        base_url.trim_end_matches('/')
    );
    let www_authenticate = format!(
        r#"Bearer realm="McpMux Gateway", error="invalid_token", error_description="{}", resource_metadata="{}""#,
        message, resource_metadata_url
    );
    let body = serde_json::json!({
        "error": "invalid_token",
        "error_description": message,
        "resource_metadata": resource_metadata_url,
    });

    (
        StatusCode::UNAUTHORIZED,
        [(header::WWW_AUTHENTICATE, www_authenticate)],
        axum::Json(body),
    )
        .into_response()
}
