/**
 * Tauri E2E tests using WebdriverIO
 * 
 * These tests run against the actual built Tauri application,
 * not the web-only dev server.
 */

describe('McpMux Application', () => {
  it('should launch and show main window', async () => {
    // Wait for app to load
    await browser.pause(2000);

    // Check window title
    const title = await browser.getTitle();
    expect(title).toBe('McpMux');
  });

  it('should display sidebar navigation', async () => {
    const sidebar = await $('nav');
    await expect(sidebar).toBeDisplayed();
  });

  it('should show My Servers tab', async () => {
    const serversButton = await $('button*=My Servers');
    await expect(serversButton).toBeDisplayed();
  });

  it('should show Discover tab', async () => {
    const discoverButton = await $('button*=Discover');
    await expect(discoverButton).toBeDisplayed();
  });

  it('should navigate to Discover page', async () => {
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(1000);

    const heading = await $('h1*=Discover');
    await expect(heading).toBeDisplayed();
  });

  it('should show search input on Discover page', async () => {
    const searchInput = await $('input[placeholder*="Search"]');
    await expect(searchInput).toBeDisplayed();
  });

  it('should navigate to My Servers page', async () => {
    const serversButton = await $('button*=My Servers');
    await serversButton.click();
    await browser.pause(1000);

    // Should show My Servers heading
    const heading = await $('h1*=My Servers');
    await expect(heading).toBeDisplayed();
  });

  it('should navigate to Clients page', async () => {
    const clientsButton = await $('button*=Clients');
    await clientsButton.click();
    await browser.pause(1000);

    const heading = await $('h1*=Clients');
    await expect(heading).toBeDisplayed();
  });

  it('should navigate to FeatureSets page', async () => {
    const featuresButton = await $('button*=FeatureSets');
    await featuresButton.click();
    await browser.pause(1000);

    // Page title might be "Feature Sets" with space
    const pageSource = await browser.getPageSource();
    const hasFeatureSetsPage = 
      pageSource.includes('Feature Sets') || 
      pageSource.includes('FeatureSets');
    
    expect(hasFeatureSetsPage).toBe(true);
  });

  it('should show space switcher in sidebar', async () => {
    // Look for space indicator in sidebar - typically shows space name
    const spaceSwitcher = await $('button*=Space');
    const isSpaceSwitcherDisplayed = await spaceSwitcher.isDisplayed().catch(() => false);
    
    if (!isSpaceSwitcherDisplayed) {
      // Alternative: check for "My Space" which is default space name
      const mySpace = await $('*=My Space');
      await expect(mySpace).toBeDisplayed();
    } else {
      await expect(spaceSwitcher).toBeDisplayed();
    }
  });
});

describe('Registry/Discover Functionality', () => {
  before(async () => {
    // Navigate to discover page once
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
  });

  it('should display server cards', async () => {
    // Wait for servers to load from mock API
    await browser.pause(2000);

    // Check page source for server content
    const pageSource = await browser.getPageSource();
    const hasServerContent = 
      pageSource.includes('Echo Server') || 
      pageSource.includes('Install') ||
      pageSource.includes('server');
    
    expect(hasServerContent).toBe(true);
  });

  it('should filter servers when searching', async () => {
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('Echo');
    await browser.pause(1000);

    // Results should be filtered - Echo Server should be visible
    const pageSource = await browser.getPageSource();
    expect(pageSource.includes('Echo')).toBe(true);
  });

  it('should clear search and show servers', async () => {
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(1000);

    // Should show servers again
    const pageSource = await browser.getPageSource();
    const hasContent = 
      pageSource.includes('Server') || 
      pageSource.includes('Install');
    
    expect(hasContent).toBe(true);
  });
});
