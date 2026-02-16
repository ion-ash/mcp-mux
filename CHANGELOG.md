# Changelog

## [0.1.1](https://github.com/mcpmux/mcp-mux/compare/v0.1.0...v0.1.1) (2026-02-16)


### Bug Fixes

* file-based keychain fallback for headless Linux/WSL ([#103](https://github.com/mcpmux/mcp-mux/issues/103)) ([9b60e0b](https://github.com/mcpmux/mcp-mux/commit/9b60e0bbe47a2318e7352efd3ba8b1888f393f38))
* stdio enable error UI state ([#104](https://github.com/mcpmux/mcp-mux/issues/104)) ([b4598e6](https://github.com/mcpmux/mcp-mux/commit/b4598e60e12d3389717fc2252bac8eb29e96f9c9))

## [0.1.0](https://github.com/mcpmux/mcp-mux/compare/v0.0.1...v0.1.0) (2026-02-16)

First public release of McpMux — the unified MCP gateway and manager for AI clients.

### Features

* Unified MCP gateway — configure servers once, connect every AI client through a single endpoint
* Encrypted credential storage via OS keychain (DPAPI, Keychain, Secret Service) with AES-256-GCM field-level encryption
* Spaces for organizing servers into workspaces with per-client access key authentication
* FeatureSet filtering — fine-grained control over tools, resources, and prompts per client
* OAuth 2.1 + PKCE with automatic token refresh for OAuth-enabled MCP servers
* Server discovery — browse and install from the community registry at mcpmux.com
* Streamable HTTP transport with SSE notifications
* Stdio transport with platform-specific process isolation
* Server connection logging with MCP protocol notifications and stderr capture
* Custom server configuration fields — environment variables, arguments, and headers
* Default values for server input definitions
* McpMux-branded OAuth authorization pages
* System tray with autostart on login
* Built-in auto-updater with signed releases
* Cross-platform installers — Windows (NSIS), macOS (DMG via Homebrew), Linux (APT + AppImage + .deb)
