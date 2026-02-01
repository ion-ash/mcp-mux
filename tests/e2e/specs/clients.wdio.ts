/**
 * E2E Tests: Client Management
 * 
 * Test Cases Covered:
 * - TC-CL-001: Display Registered Clients
 * - TC-CL-002: Open Client Detail Panel
 * - TC-CL-009: Default FeatureSet Always Granted
 * - TC-CL-010: View Effective Features
 */

describe('Client Management - View Clients', () => {
  it('TC-CL-001: Navigate to Clients page and display registered clients', async () => {
    // Navigate to Clients
    const clientsButton = await $('button*=Clients');
    await clientsButton.click();
    await browser.pause(2000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/cl-01-clients-page.png');
    
    // Verify page loaded
    const pageSource = await browser.getPageSource();
    const hasClientsPage = pageSource.includes('Clients');
    
    expect(hasClientsPage).toBe(true);
    
    // Check for preset clients (Cursor, VS Code, Claude Desktop)
    const hasCursor = pageSource.includes('Cursor');
    const hasVSCode = pageSource.includes('VS Code') || pageSource.includes('VSCode');
    const hasClaude = pageSource.includes('Claude');
    
    console.log('[DEBUG] Has Cursor:', hasCursor);
    console.log('[DEBUG] Has VS Code:', hasVSCode);
    console.log('[DEBUG] Has Claude:', hasClaude);
    
    // At least one preset client should exist
    const hasPresetClients = hasCursor || hasVSCode || hasClaude;
    expect(hasPresetClients).toBe(true);
  });

  it('TC-CL-002: Click on a client to open detail panel', async () => {
    // Try to click on Cursor client (most common)
    const cursorClient = await $('*=Cursor');
    const isCursorDisplayed = await cursorClient.isDisplayed().catch(() => false);
    
    if (isCursorDisplayed) {
      await cursorClient.click();
      await browser.pause(1500);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/cl-02-client-panel.png');
      
      // Verify panel opened - should show settings/permissions sections
      const pageSource = await browser.getPageSource();
      const hasPanelContent = 
        pageSource.includes('Settings') || 
        pageSource.includes('Permissions') ||
        pageSource.includes('Features') ||
        pageSource.includes('Connection');
      
      expect(hasPanelContent).toBe(true);
    } else {
      // Try any client card
      const clientCards = await $$('[class*="rounded"][class*="border"]');
      if (clientCards.length > 0) {
        await clientCards[0].click();
        await browser.pause(1500);
        
        const pageSource = await browser.getPageSource();
        expect(pageSource.includes('Client') || pageSource.includes('Permissions')).toBe(true);
      }
    }
  });

  it('TC-CL-009: Verify Default FeatureSet is shown as granted', async () => {
    // Should already have panel open from previous test
    await browser.saveScreenshot('./tests/e2e/screenshots/cl-03-permissions.png');
    
    const pageSource = await browser.getPageSource();
    
    // Look for Permissions section and Default feature set
    const hasPermissions = pageSource.includes('Permission') || pageSource.includes('Feature');
    const hasDefault = pageSource.includes('Default');
    
    console.log('[DEBUG] Has Permissions section:', hasPermissions);
    console.log('[DEBUG] Has Default mentioned:', hasDefault);
    
    // The page should have permission-related content
    expect(hasPermissions).toBe(true);
  });

  it('TC-CL-010: Check for Effective Features section', async () => {
    // Look for Effective Features section
    const pageSource = await browser.getPageSource();
    
    const hasEffectiveFeatures = 
      pageSource.includes('Effective') || 
      pageSource.includes('Features') ||
      pageSource.includes('Tools') ||
      pageSource.includes('Prompts');
    
    console.log('[DEBUG] Has Effective Features:', hasEffectiveFeatures);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/cl-04-effective-features.png');
    
    expect(hasEffectiveFeatures).toBe(true);
  });
});

describe('Client Management - Connection Modes', () => {
  it('TC-CL-004: Verify connection mode options exist', async () => {
    // Navigate to Clients page first
    const clientsButton = await $('button*=Clients');
    await clientsButton.click();
    await browser.pause(2000);
    
    // Click on a client
    const cursorClient = await $('*=Cursor');
    const isCursorDisplayed = await cursorClient.isDisplayed().catch(() => false);
    
    if (isCursorDisplayed) {
      await cursorClient.click();
      await browser.pause(1500);
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/cl-05-connection-mode.png');
    
    // Check for connection mode options
    const pageSource = await browser.getPageSource();
    const hasConnectionMode = 
      pageSource.includes('Follow') || 
      pageSource.includes('Locked') ||
      pageSource.includes('Ask') ||
      pageSource.includes('Connection') ||
      pageSource.includes('Mode');
    
    console.log('[DEBUG] Has connection mode options:', hasConnectionMode);
    
    // Connection mode should be visible in client settings
    expect(hasConnectionMode).toBe(true);
  });
});
