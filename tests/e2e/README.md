# E2E Testing

Two E2E test suites for different purposes.

## 1. Web-only E2E (Playwright) - RECOMMENDED

Tests UI components without Tauri backend (mocked IPC). Works everywhere.

```bash
pnpm test:e2e:web
pnpm test:e2e:web:headed  # With browser visible
```

**Supported platforms**: All (Windows, Linux, macOS)  
**Use for**: UI layout, component rendering, navigation, most testing

**Test files**: `specs/*.spec.ts`

## 2. Tauri E2E (WebdriverIO) - Full Integration

Tests the actual built Tauri application with real backend. Complex setup.

### Prerequisites

```bash
# 1. Install tauri-driver
cargo install tauri-driver --locked

# 2. Platform-specific WebDriver:

# Windows: Download Edge WebDriver matching your Edge version
# https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
# Add msedgedriver.exe to PATH

# Linux: 
sudo apt-get install webkit2gtk-driver

# macOS: NOT SUPPORTED (no WKWebView driver)
```

### Running

```bash
# Build the app first
pnpm build

# Run tests
pnpm test:e2e
```

**Supported platforms**: Windows, Linux  
**NOT supported**: macOS

**Test files**: `specs/*.wdio.ts`

## When to Use Which

| Scenario | Suite |
|----------|-------|
| Test full user flows | WebdriverIO (`test:e2e`) |
| Test server connections | WebdriverIO |
| Test OAuth flows | WebdriverIO |
| Test UI components | Playwright (`test:e2e:web`) |
| Test responsive layout | Playwright |
| CI on macOS | Playwright only |

## CI Configuration

```yaml
# Linux/Windows: Full E2E
- run: pnpm build
- run: pnpm test:e2e

# macOS: Web-only
- run: pnpm test:e2e:web
```
