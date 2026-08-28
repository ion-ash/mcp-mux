//! Best-effort git origin detection for workspace bindings.
//!
//! Both create-binding entrypoints (Tauri IPC and the admin HTTP bridge) call
//! [`apply_detected_git_remote`]. This file is the only place that shells `git`.

use std::path::Path;
use std::time::Duration;

use chrono::Utc;
use mcpmux_core::{
    normalize_git_remote, BindingType, WorkspaceBinding, WorkspaceBindingRepository,
};
use tracing::debug;

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

/// Persist `git_remote_url` for path bindings that live on this machine and
/// do not have one yet. Fail-open per row. Returns how many rows were written.
pub async fn backfill_missing_git_remotes(repo: &dyn WorkspaceBindingRepository) -> usize {
    let Ok(bindings) = repo.list().await else {
        return 0;
    };

    let mut updated = 0;
    for mut binding in bindings {
        if binding.binding_type != BindingType::Path || binding.git_remote_url.is_some() {
            continue;
        }
        let path = Path::new(&binding.workspace_root);
        if !path.is_dir() {
            continue;
        }
        let Some(remote) = detect_origin_remote(path).await else {
            continue;
        };
        binding.git_remote_url = Some(remote);
        binding.updated_at = Utc::now();
        match repo.update(&binding).await {
            Ok(()) => updated += 1,
            Err(error) => {
                debug!(
                    binding_id = %binding.id,
                    %error,
                    "[git_remote] backfill update failed"
                );
            }
        }
    }
    updated
}
