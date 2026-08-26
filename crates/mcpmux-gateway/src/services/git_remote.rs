//! Best-effort git origin detection for workspace bindings.
//!
//! Both create-binding entrypoints (Tauri IPC and the admin HTTP bridge) call
//! [`apply_detected_git_remote`]. This file is the only place that shells `git`.

use std::path::Path;
use std::time::Duration;

use mcpmux_core::{normalize_git_remote, BindingType, WorkspaceBinding};

use crate::pool::transport::configure_child_process_platform;

const DETECT_TIMEOUT: Duration = Duration::from_millis(750);

/// Read `origin` from `path` and return a normalized `host/owner/repo`.
///
/// Fail-open: timeout, spawn error, non-git folder, and unparseable URLs
/// all return `None`.
pub async fn detect_origin_remote(path: impl AsRef<Path>) -> Option<String> {
    let path = path.as_ref();
    if !path.is_absolute() {
        return None;
    }

    let mut cmd = tokio::process::Command::new("git");
    cmd.args(["-C", &path.to_string_lossy(), "remote", "get-url", "origin"]);
    configure_child_process_platform(&mut cmd);

    let output = tokio::time::timeout(DETECT_TIMEOUT, cmd.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8(output.stdout).ok()?;
    normalize_git_remote(raw.trim())
}

/// Fill `git_remote_url` on a path-type binding when the caller left it unset.
pub async fn apply_detected_git_remote(binding: &mut WorkspaceBinding) {
    if binding.binding_type != BindingType::Path || binding.git_remote_url.is_some() {
        return;
    }
    binding.git_remote_url = detect_origin_remote(Path::new(&binding.workspace_root)).await;
}
