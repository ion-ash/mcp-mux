# @mcpmux/desktop

## 0.1.2

### Patch Changes

- [#5](https://github.com/MCP-Mux/mcp-mux/pull/5) [`513fbee`](https://github.com/MCP-Mux/mcp-mux/commit/513fbeeab2ca3c57f6601887b5500cb3d7b7aa92) Thanks [@its-mash](https://github.com/its-mash)! - Fix release workflow to properly create GitHub releases with changelog and binaries. The workflow now:
  - Creates GitHub releases with proper release notes from changesets
  - Uploads MSI, DEB, DMG, and AppImage packages to the release
  - Generates updater JSON with signatures for auto-updates
  - Uses @changesets/changelog-github for better changelog formatting with PR/author links

## 0.1.1

### Patch Changes

- b2ae1d5: Release test
