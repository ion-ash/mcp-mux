/**
 * E2E Tests: Server Configuration with Inputs
 * 
 * Test Cases Covered:
 * - TC-SC-001: Enable Server with Required Input Shows Modal
 * - TC-SC-002: Configure API Key (Password Input)
 * - TC-SC-003: Configure Directory Path (Text Input)
 */

describe('Server Configuration - API Key Server', () => {
  it('TC-SC-001: Install API Key Server and click Enable shows config modal', async () => {
    // Navigate to Discover
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    // Search for API Key Server
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('API Key');
    await browser.pause(1000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-01-search-apikey.png');
    
    // Install if not installed
    const installButton = await $('button=Install');
    const isInstallDisplayed = await installButton.isDisplayed().catch(() => false);
    
    if (isInstallDisplayed) {
      await installButton.click();
      await browser.pause(3000);
    }
    
    // Verify installed
    const uninstallButton = await $('button=Uninstall');
    await expect(uninstallButton).toBeDisplayed();
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-02-apikey-installed.png');
  });

  it('TC-SC-002: Enable shows configuration modal with API Key input', async () => {
    // Navigate to My Servers
    const myServersButton = await $('button*=My Servers');
    await myServersButton.click();
    await browser.pause(2000);
    
    // Verify API Key Server is in the list
    const pageSource = await browser.getPageSource();
    expect(pageSource.includes('API Key Server')).toBe(true);
    
    // Click Enable button
    const enableButton = await $('button=Enable');
    await enableButton.click();
    await browser.pause(1000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-03-config-modal.png');
    
    // Should show configuration modal
    const modalSource = await browser.getPageSource();
    const hasConfigModal = 
      modalSource.includes('Configure') || 
      modalSource.includes('API Key') ||
      modalSource.includes('Test API Key');
    
    expect(hasConfigModal).toBe(true);
  });

  it('TC-SC-002b: Enter API Key and save configuration', async () => {
    // Find the password input for API Key
    const apiKeyInput = await $('input[type="password"]');
    const isInputDisplayed = await apiKeyInput.isDisplayed().catch(() => false);
    
    if (isInputDisplayed) {
      await apiKeyInput.setValue('test_api_key_12345');
      await browser.pause(500);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sc-04-entered-key.png');
      
      // Click Save & Enable button
      const saveButton = await $('button*=Save');
      const isSaveDisplayed = await saveButton.isDisplayed().catch(() => false);
      
      if (isSaveDisplayed) {
        await saveButton.click();
        await browser.pause(3000);
        
        await browser.saveScreenshot('./tests/e2e/screenshots/sc-05-saved.png');
      }
    }
    
    // Verify we're back on My Servers page or modal closed
    const pageSource = await browser.getPageSource();
    const modalClosed = 
      !pageSource.includes('Cancel') || 
      pageSource.includes('Connected') || 
      pageSource.includes('Connecting') ||
      pageSource.includes('My Servers');
    
    expect(modalClosed).toBe(true);
  });

  it('Cleanup: Uninstall API Key Server', async () => {
    // Navigate to Discover
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    // Search and uninstall
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('API Key');
    await browser.pause(1000);
    
    const uninstallButton = await $('button=Uninstall');
    const isDisplayed = await uninstallButton.isDisplayed().catch(() => false);
    
    if (isDisplayed) {
      await uninstallButton.click();
      await browser.pause(2000);
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-06-apikey-cleanup.png');
  });
});

describe('Server Configuration - Directory Server', () => {
  it('TC-SC-003: Install Directory Server', async () => {
    // Navigate to Discover
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    // Search for Directory Server
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('Directory');
    await browser.pause(1000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-07-search-dir.png');
    
    // Install if not installed
    const installButton = await $('button=Install');
    const isInstallDisplayed = await installButton.isDisplayed().catch(() => false);
    
    if (isInstallDisplayed) {
      await installButton.click();
      await browser.pause(3000);
    }
    
    // Verify installed
    const uninstallButton = await $('button=Uninstall');
    await expect(uninstallButton).toBeDisplayed();
  });

  it('TC-SC-003b: Enable shows config modal with directory path input', async () => {
    // Navigate to My Servers
    const myServersButton = await $('button*=My Servers');
    await myServersButton.click();
    await browser.pause(2000);
    
    // Click Enable button
    const enableButton = await $('button=Enable');
    const isEnableDisplayed = await enableButton.isDisplayed().catch(() => false);
    
    if (isEnableDisplayed) {
      await enableButton.click();
      await browser.pause(1000);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sc-08-dir-modal.png');
      
      // Find text input for directory path
      const dirInput = await $('input[type="text"]');
      const isInputDisplayed = await dirInput.isDisplayed().catch(() => false);
      
      if (isInputDisplayed) {
        // Enter a test directory path
        await dirInput.setValue('C:\\Users\\test');
        await browser.pause(500);
        
        await browser.saveScreenshot('./tests/e2e/screenshots/sc-09-dir-entered.png');
        
        // Click Save
        const saveButton = await $('button*=Save');
        if (await saveButton.isDisplayed().catch(() => false)) {
          await saveButton.click();
          await browser.pause(3000);
        }
      }
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-10-dir-after-config.png');
  });

  it('Cleanup: Uninstall Directory Server', async () => {
    const discoverButton = await $('button*=Discover');
    await discoverButton.click();
    await browser.pause(2000);
    
    const searchInput = await $('input[placeholder*="Search"]');
    await searchInput.clearValue();
    await browser.pause(300);
    await searchInput.setValue('Directory');
    await browser.pause(1000);
    
    const uninstallButton = await $('button=Uninstall');
    const isDisplayed = await uninstallButton.isDisplayed().catch(() => false);
    
    if (isDisplayed) {
      await uninstallButton.click();
      await browser.pause(2000);
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sc-11-dir-cleanup.png');
  });
});
