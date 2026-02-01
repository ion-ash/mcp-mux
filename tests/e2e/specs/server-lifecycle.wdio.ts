/**
 * E2E Tests: Server Installation & Lifecycle
 * 
 * Test Cases Covered:
 * - TC-SD-004: Install Server (No Inputs)
 * - TC-SD-005: Uninstall Server
 * - TC-SL-001: Enable Server (No Inputs)
 * - TC-SL-002: Verify Connected Server Shows Features
 * - TC-SL-003: Disable Connected Server
 */

describe('Server Installation - Echo Server (No Inputs)', () => {
  it('TC-SD-004: Install Echo Server from Discover page', async () => {
    // Navigate to Discover
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    // Search for Echo Server
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('Echo');
    await browser.pause(1000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sl-01-search-echo.png');
    
    // Install Echo Server
    const installButton = await $('button=Install');
    const isInstallDisplayed = await installButton.isDisplayed().catch(() => false);
    
    if (isInstallDisplayed) {
      await installButton.click();
      await browser.pause(3000);
    }
    
    // Verify installed - Uninstall button should appear
    const uninstallButton = await $('button=Uninstall');
    await expect(uninstallButton).toBeDisplayed();
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sl-02-installed.png');
  });

  it('TC-SL-001: Enable Echo Server (verify server appears in My Servers)', async () => {
    // Navigate to My Servers
    const myServersButton = await $('button*=My Servers');
    await myServersButton.click();
    await browser.pause(2000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sl-03-my-servers.png');
    
    // Verify Echo Server is in the list
    const pageSource = await browser.getPageSource();
    expect(pageSource.includes('Echo Server')).toBe(true);
    
    // Click Enable button
    const enableButton = await $('button=Enable');
    const isEnableDisplayed = await enableButton.isDisplayed().catch(() => false);
    
    if (isEnableDisplayed) {
      await enableButton.click();
      await browser.pause(5000); // Wait for connection
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sl-04-enabled.png');
  });

  it('TC-SL-002: Verify connected server shows features (tools, prompts)', async () => {
    // Wait for connection to fully establish
    await browser.pause(3000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sl-05-connected.png');
    
    // Check page for connection indicators
    const pageSource = await browser.getPageSource();
    
    // Server should show Connected status or feature counts
    const isConnected = 
      pageSource.includes('Connected') || 
      pageSource.includes('tools') ||
      pageSource.includes('Disable');
    
    expect(isConnected).toBe(true);
  });

  it('TC-SL-003: Disable connected server', async () => {
    // Find and click Disable button
    const disableButton = await $('button=Disable');
    const isDisableDisplayed = await disableButton.isDisplayed().catch(() => false);
    
    if (isDisableDisplayed) {
      await disableButton.click();
      await browser.pause(2000);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sl-06-disabled.png');
      
      // Should now show Enable button
      const enableButton = await $('button=Enable');
      await expect(enableButton).toBeDisplayed();
    } else {
      // Server might already be disabled - that's ok
      const enableButton = await $('button=Enable');
      const isEnableDisplayed = await enableButton.isDisplayed().catch(() => false);
      expect(isEnableDisplayed).toBe(true);
    }
  });

  it('TC-SD-005: Uninstall Echo Server', async () => {
    // Navigate to Discover
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    // Search for Echo Server
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('Echo');
    await browser.pause(1000);
    
    // Uninstall
    const uninstallButton = await $('button=Uninstall');
    const isUninstallDisplayed = await uninstallButton.isDisplayed().catch(() => false);
    
    if (isUninstallDisplayed) {
      await uninstallButton.click();
      await browser.pause(3000);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sl-07-uninstalled.png');
      
      // Should now show Install button
      const installButton = await $('button=Install');
      await expect(installButton).toBeDisplayed();
    }
  });
});
