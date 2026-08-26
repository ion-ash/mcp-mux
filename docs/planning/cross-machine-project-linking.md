# Cross-Machine Project Linking

**Last Updated:** Aug 25, 2026
**Status:** In progress
**Branch:** `random-fixes`
**Depends on:** `workspace-machine-binding.md` (machine CRUD, `machine_id` scoping), `projects-grouped-machine-cards.md` (`Entry.bindings[]`, `EntryCard` machine rows), `workspace-binding-project-adopt.md` (folder-name adopt step this feature does NOT replace)
**Unblocks:** The Projects page showing one card for "the same project" even when its absolute path differs on every machine — sync2hire on Gondor (`/Users/joe/Desktop/Repos/sync2hire/platform`), Rohan (`/home/joe/repos/s2h-platform`), and a laptop clone (`/home/joe/dev/s2h`) currently render as three unrelated, un-groupable cards

---

## Problem

`projects-grouped-machine-cards.md` solved grouping when the path is identical across machines — one `Entry` per `workspace_root`, multiple bindings in `Entry.bindings[]`. `workspace-binding-project-adopt.md` solved the one-time "copy config to a new machine" moment by matching on folder name at bind-creation time.

Neither solves the actual cross-machine reality: the same project rarely lives at the same absolute path, and often not even under the same folder name (`s2h-platform` vs `s2h` vs `sync2hire-platform`). Once a folder-name adopt happens, the two bindings are independent rows with *different* `workspace_root` values — they never merge back into one card. The Projects page keeps growing duplicate-looking cards for what is, to the user, one project, with no way to see or manage that relationship after the fact.

"Group them together regardless of where they live" needs an identity signal that survives a different absolute path AND a different folder name. Git remotes are that signal for the overwhelming majority of these folders — they're clones of the same repo. Folders that aren't git repos (a shared Dropbox folder, a scratch directory) or that use unrelated remotes for the same logical project (a private GitLab mirror vs a GitHub fork) need an explicit escape hatch.

---

## Decisions

| # | Decision | Choice | Rationale |
| - | -------- | ------ | --------- |
| 1 | Default grouping signal | Normalized git `origin` remote URL, captured automatically at bind-create time | Zero user action for the common case. Every cross-machine example in the current inventory (sync2hire, GAIT, generAIt) is a git clone — the remote is stable even when the path and folder name aren't. |
| 2 | Manual override storage | Single nullable `project_link_id` column; when set it wins over `git_remote_url` for grouping | One column covers both directions — force-link (same value written to 2+ bindings) and force-isolate (a value unique to this row, e.g. the binding's own id) — without a separate boolean/enum to keep in sync. |
| 3 | Where detection runs | One shared `apply_detected_git_remote()` in `mcpmux-gateway`. Both create entrypoints call it. Never copy the spawn. | `create_workspace_binding` is implemented twice today — Tauri IPC in `apps/desktop/src-tauri` and the admin HTTP bridge in `command_bridge/write.rs`. They already drift (id-type bindings, conflict messages, appearance cleanup). Wiring `git remote get-url` into each copy independently would recreate the bug this feature exists to prevent: bindings created via `pnpm dev:web:admin` silently never link. One helper, two callers. Shell-out via `configure_child_process_platform()`, no `git2` crate. |
| 4 | Refresh trigger | Manual "Refresh git link" button in the binding panel; no filesystem watcher or periodic re-scan | A remote is added/changed on an existing folder rarely enough that a background watcher is unjustified complexity. One click covers the rare case. |
| 5 | Grouping granularity | Merge at the `Entry` (card) display level only — linked bindings keep independent `space_id` / `feature_set_ids` / `label` rows | Matches decision 4 in `workspace-binding-project-adopt.md`: bindings stay independent after any grouping action. This feature is identity + display; config *sync* across linked bindings ("push this FS to every linked machine") is a different, bigger feature — see Out. |
| 6 | Non-git / mismatched-remote projects | `project_link_id` (manual link) is the only path to grouping — no secondary auto-heuristic | A second guesser (folder name, disk serial, content hash) multiplies the false-positive/negative surface for one more edge case each. One deterministic auto-signal (git remote) plus one deterministic manual override covers every case in the inventory. |

---

## Scope

**In:**
- Migration adding `git_remote_url` and `project_link_id` (both nullable `TEXT`) to `workspace_bindings`
- `normalize_git_remote()` in `mcpmux-core` — collapses `git@host:owner/repo.git`, `https://host/owner/repo.git`, and `ssh://git@host/owner/repo` to one canonical string, with unit tests alongside the existing `normalize_workspace_root` suite
- `detect_origin_remote()` service in `mcpmux-gateway` — shells `git remote get-url origin`, fixed timeout, fails open to `None`
- Shared `apply_detected_git_remote()` used by both `create_workspace_binding` copies (Tauri + admin bridge). Path-type only. Update paths preserve the new columns unless the caller sets them.
- `detect_workspace_git_remote` on both the Tauri command list and `GET /api/v1/workspaces/detect-git-remote` so the panel refresh works in desktop and web-admin
- `WorkspacesPage.tsx`: `Entry.roots: string[]`, a project-key merge pass over the existing root-level entries, routing rows showing the per-binding path once an entry spans more than one root, search/filter across all roots in a merged entry
- `workspace-binding-panel.component.tsx`: a "Project" section showing the auto-detected remote (or "not a git folder"), a "Link to another binding" picker, and an "Unlink" action
- i18n keys for the above in `apps/desktop/src/locales/en/workspaces.json`

**Out:**

| Item | Reason |
| ---- | ------ |
| Config sync / "sync now" propagation across linked bindings | Decision 5. Linking is identity + display only. Per-binding independence matches the existing adopt model; auto-propagating a FeatureSet or Space change across machines is a surprising, higher-risk feature that needs its own scoping if ever requested. |
| First-class `Project` entity / table | YAGNI (Option 5 from the earlier brainstorm). `project_link_id` on the existing flat `workspace_bindings` rows is enough; a real entity only earns its keep if a group needs metadata (name, icon, notes) independent of any single binding. |
| Passive "these look related, link them?" drift audit | Deferred (Option 4 from the brainstorm). Worth adding if the manual picker in Phase 4 turns out to be too undiscoverable on its own — ship it first, see if anyone asks. |
| Non-`origin` remotes, multiple remotes, SSH host-key probing | `origin` is the overwhelming convention. A repo whose sole remote is named something else falls back to manual link — no worse than today. |
| Git-remote detection for `binding_type: 'id'` (rootless OAuth/API client) bindings | These route by client id, not a folder path — there is no `.git/config` to read. Manual link only, if ever needed. |
| Retry/backoff on slow network-mount git reads | Decision 4's fixed timeout + fail-open-to-`null` is the entire mitigation. A binding save must never hang on a flaky mount. |
| Auto-merging a project when a manual link's target binding is later deleted | The remaining binding(s) just keep their `project_link_id`; if it's now an orphan value, grouping quietly degrades to "no group" for that row (only one binding left with that key = no merge partner). No cleanup pass needed — nothing is corrupted, it just stops mattering. |

---

## Architecture

### Grouping key resolution

```ts
function projectKey(b: WorkspaceBinding): string | null {
  return b.project_link_id || b.git_remote_url || null;
}
```

`project_link_id` always wins when set — that's what makes it usable both to force a link (write the same value to two bindings with different or absent remotes) and to force an isolation (write a value unique to one binding, e.g. its own `id`, so it never merges even when `git_remote_url` matches a sibling).

### Entry merge pass (extends `projects-grouped-machine-cards.md`)

Today's `entries` useMemo groups strictly by exact `workspace_root`. This adds a second pass on top, folding same-project-key entries from *different* roots into one:

```ts
interface Entry {
  id: string;
  kind: EntryKind;
  root: string;          // primary root — search/sort/id, unchanged meaning
  roots: string[];        // NEW — every distinct root folded into this entry
  bindings: WorkspaceBinding[];
  isLive: boolean;
  isClientMapping?: boolean;
}

function mergeByProjectKey(rootEntries: Entry[]): Entry[] {
  const byKey = new Map<string, Entry[]>();
  const standalone: Entry[] = [];
  for (const e of rootEntries) {
    const key = e.bindings.map(projectKey).find((k) => k != null) ?? null;
    if (key == null) {
      standalone.push({ ...e, roots: [e.root] });
      continue;
    }
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const merged = [...byKey.values()].map((group) => {
    const primary = group.find((e) => e.bindings.some((b) => b.machine_id == null)) ?? group[0];
    return {
      ...primary,
      roots: group.map((e) => e.root),
      bindings: group.flatMap((e) => e.bindings),
      isLive: group.some((e) => e.isLive),
      kind: bestKind(group.map((e) => e.kind)), // lowest EntryKind rank wins, same rank table as today
    };
  });
  return [...standalone, ...merged];
}
```

Run `mergeByProjectKey` on the output of the existing `entries` useMemo, before the `filtered` useMemo. Groups of size 1 (a project key set but no other binding shares it — e.g. right after a git-remote auto-detect on a brand-new project) behave exactly like a standalone entry.

### Routing row path display

`buildEntryRoutingRows` (`WorkspacesPage.tsx`) gains an optional `root` field, populated only when `entry.roots.length > 1`:

```ts
interface EntryCardRoutingRow {
  // ...existing fields...
  root?: string; // shown only when the parent entry spans more than one path
}
```

Single-root entries (today's common case — same path, multiple machines) render unchanged: machine name + FS + Space, no path repeated per row. Multi-root linked entries add the path so `Gondor → /Users/joe/…/platform` and `Rohan → /home/joe/repos/s2h-platform` are distinguishable.

### `detect_origin_remote` (new: `crates/mcpmux-gateway/src/services/git_remote.rs`)

```rust
pub async fn detect_origin_remote(path: &Path) -> Option<String> {
    let mut cmd = tokio::process::Command::new("git");
    cmd.args(["-C", &path.to_string_lossy(), "remote", "get-url", "origin"]);
    configure_child_process_platform(&mut cmd);
    let output = tokio::time::timeout(Duration::from_millis(750), cmd.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8(output.stdout).ok()?;
    normalize_git_remote(raw.trim())
}
```

Both create handlers call this wrapper, not `detect_origin_remote` directly:

```rust
pub async fn apply_detected_git_remote(binding: &mut WorkspaceBinding) {
    if binding.binding_type != BindingType::Path || binding.git_remote_url.is_some() {
        return;
    }
    binding.git_remote_url = detect_origin_remote(Path::new(&binding.workspace_root)).await;
}
```

Fail-open at every step (timeout, spawn error, non-git folder, non-UTF8, unparseable URL) — a `None` here is a normal, silent outcome, not a logged error. `normalize_git_remote` lives in `mcpmux-core::domain::workspace_binding` next to `normalize_workspace_root`, same "pure function, exhaustively unit tested" pattern:

```rust
pub fn normalize_git_remote(url: &str) -> Option<String> {
    // git@host:owner/repo.git | https://host/owner/repo(.git) | ssh://git@host/owner/repo(.git)
    // -> "host/owner/repo", lower-cased, .git suffix stripped
}
```

### Migration 043

```sql
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
```

### Panel "Project" section (`workspace-binding-panel.component.tsx`)

```
┌ Project ──────────────────────────────────────────┐
│ Linked via git remote: github.com/mcpmux/mcp-mux   │
│ [Unlink]                                           │
└─────────────────────────────────────────────────────┘

┌ Project ──────────────────────────────────────────┐
│ Not linked to any other binding.                   │
│ [Link to another binding…]                         │
└─────────────────────────────────────────────────────┘

┌ Project ──────────────────────────────────────────┐
│ Manually linked · 2 other bindings                 │
│  • Rohan   /home/joe/repos/s2h-platform            │
│  • Laptop  /home/joe/dev/s2h                       │
│ [Unlink all]                                       │
└─────────────────────────────────────────────────────┘
```

"Link to another binding…" opens a search-by-path/label list (visually mirrors the existing adopt table in the same file, not extracted as a shared component — same "mirror the style, don't share the code" call as `workspace-binding-project-adopt.md` decision 5). Picking a target:
- If the target already has a `project_link_id`, adopt that value for the current binding (joins its existing group).
- Otherwise generate a fresh id and write it to both.

"Unlink" / "Unlink all" writes `project_link_id = <this binding's own id>` — guaranteed unique, so it drops out of any group (auto or manual) without touching the other bindings' rows.

---

## Files to create / modify

| File | Change |
| ---- | ------ |
| `crates/mcpmux-storage/src/migrations/043_workspace_binding_project_link.sql` | Create — `git_remote_url`, `project_link_id` columns + partial indexes |
| [`crates/mcpmux-core/src/domain/workspace_binding.rs`](../../crates/mcpmux-core/src/domain/workspace_binding.rs) | Modify — `git_remote_url` / `project_link_id` fields on `WorkspaceBinding`; `normalize_git_remote()` + unit tests |
| `crates/mcpmux-gateway/src/services/git_remote.rs` | Create — `detect_origin_remote()` + `apply_detected_git_remote()`. Spawn via `configure_child_process_platform()`, fixed timeout. This is the only place that runs `git`. |
| [`crates/mcpmux-storage/src/repositories/workspace_binding_repository.rs`](../../crates/mcpmux-storage/src/repositories/workspace_binding_repository.rs) | Modify — read/write the two new columns on `create` / `update` / row-mapping |
| [`apps/desktop/src-tauri/src/commands/workspace_binding.rs`](../../apps/desktop/src-tauri/src/commands/workspace_binding.rs) | Modify — DTO/input gain both fields; create calls `apply_detected_git_remote`; update preserves omitted link fields; new `detect_workspace_git_remote` command |
| [`crates/mcpmux-gateway/src/admin/command_bridge/write.rs`](../../crates/mcpmux-gateway/src/admin/command_bridge/write.rs) | Modify — create calls the same `apply_detected_git_remote`; update preserves omitted link fields. Do not reimplement the spawn here. |
| [`crates/mcpmux-gateway/src/admin/command_bridge/read.rs`](../../crates/mcpmux-gateway/src/admin/command_bridge/read.rs) + router/handlers | Modify — `GET /api/v1/workspaces/detect-git-remote` so web-admin refresh hits the same helper |
| [`apps/desktop/src/lib/api/workspaceBindings.ts`](../../apps/desktop/src/lib/api/workspaceBindings.ts) | Modify — `WorkspaceBinding` / `WorkspaceBindingInput` interfaces gain `git_remote_url` / `project_link_id`; new `detectWorkspaceGitRemote()` call |
| [`apps/desktop/src/features/workspaces/WorkspacesPage.tsx`](../../apps/desktop/src/features/workspaces/WorkspacesPage.tsx) | Modify — `Entry.roots`, `projectKey()`, `mergeByProjectKey()`, `buildEntryRoutingRows` path column, `filtered` search across all roots |
| [`apps/desktop/src/features/workspaces/workspace-binding-panel.component.tsx`](../../apps/desktop/src/features/workspaces/workspace-binding-panel.component.tsx) | Modify — "Project" section: auto-link display, link picker, unlink action |
| [`apps/desktop/src/features/workspaces/workspace-binding-form.helpers.ts`](../../apps/desktop/src/features/workspaces/workspace-binding-form.helpers.ts) | Modify — `findLinkableBindings()` helper alongside the existing `findAdoptableSiblingBindings` |
| [`apps/desktop/src/locales/en/workspaces.json`](../../apps/desktop/src/locales/en/workspaces.json) | Modify — `panel.project*` keys |

---

## Phases

### Phase 1 — Schema + domain plumbing (~half day)

- Migration 043: `git_remote_url`, `project_link_id` on `workspace_bindings`, partial indexes
- `WorkspaceBinding` entity gains both fields (default `None`)
- `normalize_git_remote()` in `mcpmux-core` with a unit test suite covering `git@host:owner/repo.git`, `https://host/owner/repo`, `https://host/owner/repo.git`, `ssh://git@host/owner/repo.git`, mixed case host, and unparseable input (→ `None`)
- Repository read/write for both columns; DTOs on the Tauri command file and the admin bridge gain the two fields (plumbed through, unused by any UI yet)
- TS `WorkspaceBinding` / `WorkspaceBindingInput` interfaces gain the two optional fields

**Outcome:** `cargo test -p mcpmux-core` passes with the new `normalize_git_remote` cases. Creating/updating/listing a binding round-trips `git_remote_url` and `project_link_id` end to end (verifiable by passing them through `createWorkspaceBinding` from a scratch script or the browser console) even though nothing sets them automatically yet.

### Phase 2 — Shared detect helper, both create paths (~half day)

- `detect_origin_remote()` + `apply_detected_git_remote()` in `mcpmux-gateway::services::git_remote`, using `configure_child_process_platform()` and a 750ms timeout, fail-open to `None`
- Tauri `create_workspace_binding` and admin `command_bridge::create_workspace_binding` both call `apply_detected_git_remote` after the binding is built and before persist. Path-type only. Neither file shells `git` itself.
- Both update handlers preserve `git_remote_url` / `project_link_id` when the input omits them (`""` clears, a value sets)
- `detect_workspace_git_remote` Tauri command **and** `GET /api/v1/workspaces/detect-git-remote` (same helper) for the panel refresh in desktop and web-admin

**Outcome:** Binding a folder that is a git clone with an `origin` remote persists a normalized `git_remote_url` whether the save came from the desktop window or the `:1420` admin UI. A non-git folder, or a machine with no `git` on PATH, still saves and leaves the column `null`. `pnpm test:rust:unit` stays green.

### Phase 3 — Cross-root grouping on the Projects page (~1 day)

- `Entry.roots: string[]`, `projectKey()`, `mergeByProjectKey()` merge pass over the existing root-grouped entries
- `buildEntryRoutingRows` shows the per-binding path once `entry.roots.length > 1`
- `filtered` search matches against every root in a merged entry, not just `entry.root`
- Card subtitle: single-root entries unchanged; multi-root entries show a "N locations" affordance instead of one path (exact copy TBD at implementation time)

**Outcome:** Two bindings with the same `git_remote_url` but different roots (e.g. bound from two different machines pointed at clones of the same repo) render as one card with two machine rows, each showing its own path. Bindings with no shared project key remain separate cards exactly as today. `pnpm typecheck && pnpm lint` pass clean.

### Phase 4 — Manual link / unlink in the side panel (~half day)

- "Project" section in `workspace-binding-panel.component.tsx`: shows auto-detected remote (or "not a git folder") with a "Refresh git link" button calling `detect_workspace_git_remote`
- "Link to another binding…" — search list (path/label) excluding self; on pick, either joins the target's existing `project_link_id` or mints a fresh one for both
- "Unlink" / "Unlink all" — sets `project_link_id` to the binding's own id, forcing isolation even against a matching `git_remote_url`
- `findLinkableBindings()` helper in `workspace-binding-form.helpers.ts`
- i18n keys

**Outcome:** A user can force-link two bindings that share no git remote (e.g. a non-git shared folder, or a GitHub origin vs a GitLab mirror of the same project), and can force-unlink two bindings that auto-grouped via a shared template repo remote but aren't actually the same project. Both actions persist and survive a refresh. `pnpm typecheck && pnpm lint` pass clean.

---

## Key files referenced

| File | Notes |
| ---- | ----- |
| [`crates/mcpmux-core/src/domain/workspace_binding.rs`](../../crates/mcpmux-core/src/domain/workspace_binding.rs) | `WorkspaceBinding` entity, `normalize_workspace_root` — pattern to mirror for `normalize_git_remote` |
| [`crates/mcpmux-gateway/src/pool/transport/mod.rs`](../../crates/mcpmux-gateway/src/pool/transport/mod.rs) | `configure_child_process_platform()` — mandatory for any new child-process spawn, per `AGENTS.md` |
| [`apps/desktop/src-tauri/src/commands/workspace_binding.rs`](../../apps/desktop/src-tauri/src/commands/workspace_binding.rs) | Existing `create_workspace_binding` / `update_workspace_binding` — detection hooks into this path |
| `crates/mcpmux-gateway/src/admin/command_bridge/write.rs` | Independent (duplicated, not shared) `create_workspace_binding` for the admin HTTP bridge — both entrypoints need the detection call |
| [`apps/desktop/src/features/workspaces/WorkspacesPage.tsx`](../../apps/desktop/src/features/workspaces/WorkspacesPage.tsx) | `Entry`, `bindingsByRoot`, `entries` useMemo, `EntryCard`, `buildEntryRoutingRows` — all Phase 3 changes live here |
| [`apps/desktop/src/features/workspaces/workspace-binding-panel.component.tsx`](../../apps/desktop/src/features/workspaces/workspace-binding-panel.component.tsx) | Existing adopt-step implementation (`siblingBindings`, `adoptBindingSeed`) — Phase 4's link picker mirrors this pattern |
| [`apps/desktop/src/features/workspaces/workspace-binding-form.helpers.ts`](../../apps/desktop/src/features/workspaces/workspace-binding-form.helpers.ts) | `folderName()`, `findAdoptableSiblingBindings()` — sibling pattern `findLinkableBindings()` follows |
| [`docs/planning/workspace-machine-binding.md`](./workspace-machine-binding.md) | `machine_id` scoping and the 3-tier resolver this feature's data model builds on |
| [`docs/planning/projects-grouped-machine-cards.md`](./projects-grouped-machine-cards.md) | `Entry.bindings[]`, `primaryBinding()`, `EntryKind` — the single-root grouping this feature extends to cross-root |
| [`docs/planning/workspace-binding-project-adopt.md`](./workspace-binding-project-adopt.md) | Folder-name adopt step — stays as-is; this feature is the "and now group them after the fact" follow-through it explicitly deferred |

---

## Related documentation

- [`workspace-machine-binding.md`](./workspace-machine-binding.md) — machine CRUD, `machine_id` scoping, 3-tier resolver
- [`projects-grouped-machine-cards.md`](./projects-grouped-machine-cards.md) — same-root multi-machine card grouping this feature extends to cross-root
- [`workspace-binding-project-adopt.md`](./workspace-binding-project-adopt.md) — folder-name-based one-time config copy; independent of, and unaffected by, this feature
