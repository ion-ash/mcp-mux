---
"@mcpmux/desktop": patch
---

Fix release workflow to properly create GitHub releases with changelog and binaries. The workflow now:
- Creates GitHub releases with proper release notes from changesets
- Uploads MSI, DEB, DMG, and AppImage packages to the release
- Generates updater JSON with signatures for auto-updates
- Uses @changesets/changelog-github for better changelog formatting with PR/author links
