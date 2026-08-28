//! Per-call `_mcpmux_context` attached by Cursor's `preToolUse` hook.
//!
//! The reserved argument is transport metadata: parse it, validate the root,
//! then strip it before meta-tool parsing or backend forwarding.

use rmcp::model::JsonObject;
use serde_json::Value;
use tracing::warn;

use crate::services::SessionRootsRegistry;
use mcpmux_core::normalize_workspace_root;

/// Reserved tool-argument key injected by the managed Cursor hook.
pub const MCPMUX_CONTEXT_KEY: &str = "_mcpmux_context";

/// Exact workspace identity carried on one `tools/call`.
#[derive(Debug, Clone)]
pub struct ExtractedCallContext {
    pub workspace_root: String,
    pub tool_use_id: Option<String>,
}

/// Remove `_mcpmux_context` from `arguments` and validate it when present.
///
/// `Ok(None)` means the call has no hook context and should use the session
/// ladder. Malformed objects are always errors.
///
/// `lenient_on_mismatch` controls what happens when the hook's guessed root
/// isn't a member of the session's candidate set. The hook only ever sees
/// Cursor's `workspace_roots`, a *different* signal than the header-derived
/// candidate set — the two can legitimately disagree (multi-root workspace,
/// stale header, shared `mcp-remote` session). For a normal backend tool
/// call that mismatch must hard-fail: trusting the wrong root would route
/// the call (and its credentials) to the wrong Space. For `mcpmux_*` meta
/// tools — which exist specifically to self-diagnose and recover session
/// state — hard-failing defeats the point: the escape hatch becomes
/// unreachable exactly when the hook's guess is the thing that's broken.
/// Callers pass `lenient_on_mismatch: true` for meta-tool calls to drop the
/// bad hook context and fall through to the session ladder / the tool's own
/// argument instead of erroring the whole call.
pub fn take_mcpmux_context(
    arguments: &mut JsonObject,
    session_id: Option<&str>,
    session_roots: &SessionRootsRegistry,
    lenient_on_mismatch: bool,
) -> Result<Option<ExtractedCallContext>, String> {
    let Some(raw) = arguments.remove(MCPMUX_CONTEXT_KEY) else {
        return Ok(None);
    };

    let obj = match raw {
        Value::Object(obj) => obj,
        _ => {
            return Err("invalid _mcpmux_context: expected an object".into());
        }
    };

    let raw_root = obj
        .get("workspace_root")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "invalid _mcpmux_context: workspace_root must be a non-empty string".to_string()
        })?;

    let workspace_root = normalize_workspace_root(raw_root);
    if workspace_root.is_empty() {
        return Err("invalid _mcpmux_context: workspace_root is empty after normalize".into());
    }

    if let Some(sid) = session_id {
        if !session_roots.is_candidate(sid, &workspace_root) {
            if lenient_on_mismatch {
                warn!(
                    session_id = sid,
                    hook_workspace_root = %workspace_root,
                    candidates = ?session_roots.get_candidates(sid),
                    "[mcpmux_context] hook root not in candidate set for meta-tool call; \
                     dropping hook context, falling back to session ladder"
                );
                return Ok(None);
            }
            warn!(
                session_id = sid,
                hook_workspace_root = %workspace_root,
                candidates = ?session_roots.get_candidates(sid),
                "[mcpmux_context] hook root not in candidate set for backend tool call; \
                 hard-failing (strict mode)"
            );
            return Err(
                "invalid _mcpmux_context: workspace_root is not in this session's candidate set"
                    .into(),
            );
        }
    }

    let tool_use_id = obj
        .get("tool_use_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    Ok(Some(ExtractedCallContext {
        workspace_root,
        tool_use_id,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rmcp::model::JsonObject;
    use serde_json::json;

    fn args_with_root(root: &str) -> JsonObject {
        json!({ "_mcpmux_context": { "workspace_root": root } })
            .as_object()
            .unwrap()
            .clone()
    }

    #[test]
    fn no_context_is_none() {
        let mut args = JsonObject::new();
        let session_roots = SessionRootsRegistry::new();
        let result = take_mcpmux_context(&mut args, Some("s1"), &session_roots, false).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn matching_candidate_passes_both_modes() {
        let session_roots = SessionRootsRegistry::new();
        session_roots.set_candidates("s1", "/repo/a");

        for lenient in [false, true] {
            let mut args = args_with_root("/repo/a");
            let result = take_mcpmux_context(&mut args, Some("s1"), &session_roots, lenient)
                .unwrap()
                .unwrap();
            assert_eq!(result.workspace_root, "/repo/a");
        }
    }

    #[test]
    fn mismatch_is_hard_error_when_strict() {
        let session_roots = SessionRootsRegistry::new();
        session_roots.set_candidates("s1", "/repo/a,/repo/b");

        let mut args = args_with_root("/repo/c");
        let err = take_mcpmux_context(&mut args, Some("s1"), &session_roots, false).unwrap_err();
        assert!(err.contains("candidate set"));
    }

    #[test]
    fn mismatch_falls_back_to_none_when_lenient() {
        // Regression: meta tools (search_tools, set_workspace_root, ...) must
        // stay reachable when the hook's guessed root disagrees with the
        // candidate set — otherwise the escape hatch is unreachable exactly
        // when it's needed (see generAIt dig, Aug 28 2026).
        let session_roots = SessionRootsRegistry::new();
        session_roots.set_candidates("s1", "/repo/a,/repo/b");

        let mut args = args_with_root("/repo/c");
        let result = take_mcpmux_context(&mut args, Some("s1"), &session_roots, true).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn malformed_object_errors_regardless_of_leniency() {
        for lenient in [false, true] {
            let mut args = JsonObject::new();
            args.insert(MCPMUX_CONTEXT_KEY.to_string(), json!("not an object"));
            let err =
                take_mcpmux_context(&mut args, Some("s1"), &SessionRootsRegistry::new(), lenient)
                    .unwrap_err();
            assert!(err.contains("expected an object"));
        }
    }
}
