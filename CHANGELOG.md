# Changelog

## [0.0.13](https://github.com/mcpmux/mcp-mux/compare/v0.0.1...v0.0.13) (2026-02-16)

First public release of McpMux — the unified MCP gateway and manager for AI clients.

### Features

* Unified MCP gateway — configure servers once, connect every AI client through a single endpoint
* Encrypted credential storage via OS keychain (DPAPI, Keychain, Secret Service) with AES-256-GCM field-level encryption
* Spaces for organizing servers into workspaces with per-client access key authentication
* FeatureSet filtering — fine-grained control over tools, resources, and prompts per client
* OAuth 2.1 + PKCE with automatic token refresh for OAuth-enabled MCP servers
* Server discovery — browse and install from the community registry at mcpmux.com
* Streamable HTTP transport with SSE notifications ([#61](https://github.com/mcpmux/mcp-mux/issues/61))
* Stdio transport with platform-specific process isolation
* Server connection logging with MCP protocol notifications and stderr capture ([#63](https://github.com/mcpmux/mcp-mux/issues/63), [#76](https://github.com/mcpmux/mcp-mux/issues/76))
* Custom server configuration fields — environment variables, arguments, and headers ([#54](https://github.com/mcpmux/mcp-mux/issues/54))
* Default values for server input definitions ([#70](https://github.com/mcpmux/mcp-mux/issues/70))
* McpMux-branded OAuth authorization pages ([#74](https://github.com/mcpmux/mcp-mux/issues/74))
* System tray with autostart on login ([#38](https://github.com/mcpmux/mcp-mux/issues/38))
* Built-in auto-updater with signed releases ([#36](https://github.com/mcpmux/mcp-mux/issues/36))
* Cross-platform installers — Windows (NSIS), macOS (DMG via Homebrew), Linux (APT + AppImage + .deb) ([#79](https://github.com/mcpmux/mcp-mux/issues/79), [#85](https://github.com/mcpmux/mcp-mux/issues/85))
