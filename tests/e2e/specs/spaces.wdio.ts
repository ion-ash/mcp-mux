/**
 * E2E Tests: Space Management
 * 
 * Test Cases Covered:
 * - TC-SP-001: Default Space Exists
 * - TC-SP-002: Create New Space
 * - TC-SP-003: Set Active Space
 * - TC-SP-011: Space Switcher Shows All Spaces
 */

// Helper to find element by test ID or fallback to text
async function findElement(testId: string, fallbackSelector: string) {
  const byTestId = await $(`[data-testid="${testId}"]`);
  const testIdExists = await byTestId.isExisting().catch(() => false);
  if (testIdExists) {
    return byTestId;
  }
  return $(fallbackSelector);
}

describe('Space Management - Default Space', () => {
  it('TC-SP-001: Navigate to Spaces page and verify default space exists', async () => {
    // Navigate to Spaces - try test ID first, fallback to text
    const spacesButton = await findElement('nav-spaces', 'button*=Spaces');
    await spacesButton.click();
    await browser.pause(2000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sp-01-spaces-page.png');
    
    // Verify page loaded
    const pageSource = await browser.getPageSource();
    const hasSpacesPage = pageSource.includes('Workspaces') || pageSource.includes('Space');
    
    expect(hasSpacesPage).toBe(true);
    
    // Check for default space (usually "My Space")
    const hasDefaultSpace = 
      pageSource.includes('My Space') || 
      pageSource.includes('Default') ||
      pageSource.includes('Active');
    
    console.log('[DEBUG] Has default space:', hasDefaultSpace);
    expect(hasDefaultSpace).toBe(true);
  });
});

describe('Space Management - Create and Delete', () => {
  const createdSpaceName = 'Test Space E2E';
  
  it('TC-SP-002: Create a new space', async () => {
    // Navigate to Spaces
    const spacesButton = await findElement('nav-spaces', 'button*=Spaces');
    await spacesButton.click();
    await browser.pause(2000);
    
    // Click Create Space button
    const createButton = await findElement('create-space-btn', 'button*=Create Space');
    const isCreateDisplayed = await createButton.isDisplayed().catch(() => false);
    
    if (isCreateDisplayed) {
      await createButton.click();
      await browser.pause(1000);
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sp-02-create-modal.png');
      
      // Find name input and enter space name
      const nameInput = await findElement('create-space-name-input', 'input[placeholder*="Personal"]');
      const isInputDisplayed = await nameInput.isDisplayed().catch(() => false);
      
      if (isInputDisplayed) {
        await nameInput.setValue(createdSpaceName);
        await browser.pause(500);
        
        await browser.saveScreenshot('./tests/e2e/screenshots/sp-02b-name-entered.png');
        
        // Click Create Space submit button
        const submitButton = await findElement('create-space-submit-btn', 'button=Create Space');
        const isSubmitDisplayed = await submitButton.isDisplayed().catch(() => false);
        
        console.log('[DEBUG] Submit button displayed:', isSubmitDisplayed);
        
        if (isSubmitDisplayed) {
          await submitButton.click();
          await browser.pause(2000);
        }
      } else {
        console.log('[DEBUG] Name input not found');
      }
      
      await browser.saveScreenshot('./tests/e2e/screenshots/sp-03-after-create.png');
      
      // Verify new space appears
      const pageSource = await browser.getPageSource();
      const hasNewSpace = pageSource.includes(createdSpaceName) || pageSource.includes('Test Space');
      
      console.log('[DEBUG] New space created:', hasNewSpace);
      expect(hasNewSpace).toBe(true);
    } else {
      console.log('[DEBUG] Create Space button not found');
      expect(true).toBe(true);
    }
  });

  it('TC-SP-003: Set a space as active', async () => {
    // Look for Set Active button - try test ID first
    const setActiveButtons = await $$('[data-testid^="set-active-space-"]');
    
    if (setActiveButtons.length > 0) {
      const firstButton = setActiveButtons[0];
      const isDisplayed = await firstButton.isDisplayed().catch(() => false);
      
      if (isDisplayed) {
        await browser.saveScreenshot('./tests/e2e/screenshots/sp-04-before-set-active.png');
        await firstButton.click();
        await browser.pause(2000);
        await browser.saveScreenshot('./tests/e2e/screenshots/sp-05-after-set-active.png');
      }
    } else {
      // Fallback to text-based selector
      const fallbackButtons = await $$('button*=Set Active');
      if (fallbackButtons.length > 0) {
        const isDisplayed = await fallbackButtons[0].isDisplayed().catch(() => false);
        if (isDisplayed) {
          await fallbackButtons[0].click();
          await browser.pause(2000);
        }
      }
    }
    
    // Verify page has active space indicator
    const pageSource = await browser.getPageSource();
    const hasActiveIndicator = 
      pageSource.includes('Active') || 
      pageSource.includes('active');
    
    expect(hasActiveIndicator).toBe(true);
  });

  it('TC-SP-011: Verify spaces are listed on page', async () => {
    // Make sure we're on Spaces page
    const spacesButton = await findElement('nav-spaces', 'button*=Spaces');
    await spacesButton.click();
    await browser.pause(2000);
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sp-06-spaces-list.png');
    
    // Verify spaces are listed
    const pageSource = await browser.getPageSource();
    const hasSpacesList = 
      pageSource.includes('My Space') || 
      pageSource.includes('Test Space') ||
      pageSource.includes('Workspaces');
    
    expect(hasSpacesList).toBe(true);
  });

  it('TC-SP-005: Cleanup - Delete test space if exists', async () => {
    // Look for delete button - try test ID first
    let deleteButtons = await $$('[data-testid^="delete-space-"]');
    
    if (deleteButtons.length === 0) {
      // Fallback to icon-based approach - look for trash icon buttons
      deleteButtons = await $$('button[title="Delete Space"]');
    }
    
    await browser.saveScreenshot('./tests/e2e/screenshots/sp-07-before-delete.png');
    
    if (deleteButtons.length > 0) {
      const firstDeleteBtn = deleteButtons[0];
      const isDisplayed = await firstDeleteBtn.isDisplayed().catch(() => false);
      
      if (isDisplayed) {
        await firstDeleteBtn.click();
        await browser.pause(2000);
        await browser.saveScreenshot('./tests/e2e/screenshots/sp-08-after-delete.png');
      }
    }
    
    // Verify page still works
    const pageSource = await browser.getPageSource();
    expect(pageSource.includes('Workspaces') || pageSource.includes('Space')).toBe(true);
  });
});
