-- Migration 043: Cross-machine project linking.
--
-- git_remote_url is auto-captured at bind-create time from the local
-- filesystem's `git remote get-url origin` (best-effort; NULL for non-git
-- folders or when git isn't on PATH). project_link_id is an explicit manual
-- override the user sets via the binding panel: the same value on 2+
-- bindings forces a link, a value unique to one row (e.g. its own id)
-- forces isolation even against a matching git_remote_url.
--
-- Grouping key resolution (client-side, WorkspacesPage.tsx):
--   project_link_id ?? git_remote_url ?? null

ALTER TABLE workspace_bindings ADD COLUMN git_remote_url TEXT;
ALTER TABLE workspace_bindings ADD COLUMN project_link_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspace_bindings_git_remote
    ON workspace_bindings(git_remote_url) WHERE git_remote_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_bindings_project_link
    ON workspace_bindings(project_link_id) WHERE project_link_id IS NOT NULL;
