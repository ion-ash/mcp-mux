# McpMux

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/MCP-Mux/mcp-mux)](https://github.com/MCP-Mux/mcp-mux/releases)

### Configure your MCP servers once. Connect every AI client.

McpMux is a desktop app that gives you **one place** to manage all your MCP servers — so you never have to copy-paste server configs across Cursor, Claude Desktop, VS Code, or any other AI client again.

---

## Why McpMux?

### The problem: MCP config is per-client

Every AI client that supports MCP has its own configuration file. Want to use a GitHub server, a database server, and a Slack server? You configure all three **separately** in every single client.

```
Cursor          → config.json    → github, slack, db servers + credentials
Claude Desktop  → config.json    → github, slack, db servers + credentials  (again)
VS Code         → settings.json  → github, slack, db servers + credentials  (again)
Windsurf        → config.json    → github, slack, db servers + credentials  (again)
```

Add a new server? Update **every client**. Rotate an API key? Update **every client**. Start a new project with different servers? Reconfigure **everything**.

### The other problem: credentials in plain text

MCP configs store API keys and tokens in **plain JSON files on disk**. No encryption, no access control — just raw secrets sitting in your home directory.

### The fix: configure once, connect everywhere

McpMux runs a local gateway on your machine. You configure your servers and credentials **once** inside McpMux, then point all your AI clients to a single local URL. That's it.

```
Cursor          ─┐
Claude Desktop  ─┤──→  McpMux (localhost:9315)  ──→  github, slack, db servers
VS Code         ─┤      manages all credentials
Windsurf        ─┘      one config, one place
```

Add a server in McpMux → every client has it instantly. No files to edit. No credentials to copy.

---

## How It Works

**1. Install servers** — Browse the built-in registry or add servers manually.

**2. Copy one config** — McpMux gives you a single JSON snippet to paste into any AI client:

```json
{
  "mcpServers": {
    "mcpmux": {
      "url": "http://localhost:9315/mcp"
    }
  }
}
```

**3. Done** — Every tool, prompt, and resource from all your servers is now available in every connected client.

When an AI client calls a tool, McpMux routes the request to the right server automatically. OAuth tokens refresh in the background. Credentials stay encrypted in your OS keychain. You don't think about it.

---

## Features

### One Dashboard for Everything
See all your servers, their connection status, available tools, and connected clients in one place. Install new servers from the registry with a click. View logs when something goes wrong.

### Spaces — Switch Contexts Instantly
Working on multiple projects that need different servers? Create **Spaces** like "Work", "Personal", or "Client Project". Each Space has its own servers, credentials, and permissions. Switch between them in the sidebar — your AI clients follow automatically.

### Credentials That Aren't in Plain Text
McpMux stores credentials in your **OS keychain** (macOS Keychain, Windows Credential Manager, Linux Secret Service). Database fields are encrypted with AES-256-GCM. No more API keys sitting in plain JSON files.

### OAuth That Just Works
Remote MCP servers that require OAuth? McpMux handles the entire flow — browser-based login, token storage, and **automatic refresh** when tokens expire. You authenticate once and forget about it.

### Server Registry
Browse, search, and install MCP servers from the built-in registry. Filter by category, see what tools each server provides, and install with one click. Servers you've used before are cached for offline access.

### Control What Each Client Can Access
Not every AI client should have access to every tool. Create **Feature Sets** — permission bundles that control which tools, prompts, and resources a client can see. Give Cursor full access but limit VS Code to read-only tools. It's up to you.

### Runs in the Background
McpMux sits in your system tray and starts automatically with your OS. The gateway is always running, so your AI clients always have their tools available.

---

## Security

MCP's default approach is plain-text JSON config files with raw credentials. McpMux replaces that with proper security:

- **OS Keychain** — Encryption keys and secrets stored in your platform's native keychain, not on disk
- **AES-256-GCM Encryption** — Sensitive database fields are encrypted with authenticated encryption
- **Memory Zeroization** — Secrets are wiped from memory after use
- **OAuth 2.1 + PKCE** — Industry-standard auth flow for remote servers with automatic token refresh
- **Local-Only Gateway** — Binds to `127.0.0.1` only — nothing is exposed to the network
- **Per-Client Permissions** — Access keys and Feature Sets control what each client can do
- **Sanitized Logs** — Tokens and secrets never appear in log files

All MCP traffic stays on your machine. McpMux never routes tool calls through external services. Cloud sync (optional) only covers configuration metadata — never credentials or MCP payloads.

---

## Getting Started

### 1. Download McpMux

Grab the latest release for your platform from the [Releases page](https://github.com/MCP-Mux/mcp-mux/releases):

| Platform | Format |
|----------|--------|
| Windows | MSI installer |
| macOS | DMG |
| Linux | DEB, RPM, AppImage |

### 2. Add Your Servers

Open McpMux and head to the **Discover** tab to browse the registry, or add servers manually via **My Servers → Add Server Manually**.

### 3. Connect Your AI Clients

Copy the gateway config from the Dashboard and paste it into your AI client's MCP settings:

```json
{
  "mcpServers": {
    "mcpmux": {
      "url": "http://localhost:9315/mcp"
    }
  }
}
```

That's the last config file you'll need to touch.

---

## Development

### Prerequisites

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+

Linux also needs: `gnome-keyring libsecret-1-dev librsvg2-dev pkg-config`

### Setup

```bash
pnpm setup    # First-time: installs all dependencies
pnpm dev      # Start development
pnpm build    # Build for production
```

### Testing

```bash
pnpm test              # All tests
pnpm test:rust:unit    # Rust unit tests
pnpm test:ts           # TypeScript tests
pnpm test:e2e:web      # E2E tests (all platforms)
```

### Project Structure

```
mcp-mux/
├── apps/desktop/          # Tauri desktop app (React + Rust)
├── crates/
│   ├── mcpmux-core/       # Domain logic
│   ├── mcpmux-gateway/    # Local HTTP gateway, OAuth, routing
│   ├── mcpmux-storage/    # SQLite + encryption + OS keychain
│   └── mcpmux-mcp/        # MCP protocol
├── packages/ui/           # Shared UI components
└── tests/                 # Unit, integration, and E2E tests
```

Built with **Tauri 2** (Rust + React 19), using **Axum** for the gateway, **ring** for encryption, and **rmcp** for the MCP protocol.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[GNU General Public License v3.0](LICENSE)
