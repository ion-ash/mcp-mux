/**
 * E2E Test Selectors - data-testid only (ADR-003)
 * Use $('[data-testid="x"]') for all element selection.
 */

// CI-friendly timeouts (Windows CI is slower)
export const TIMEOUT = {
  short: 5000,
  medium: 15000,  // Default for waitForDisplayed/Clickable
  long: 30000,    // For slow operations like MCP connections
  veryLong: 60000,
};

/** Get element by data-testid */
export const byTestId = (testId: string) => $(`[data-testid="${testId}"]`);

/**
 * Wait for any modal overlay to close (backdrop with blur).
 * This is a best-effort function - it won't fail the test if the modal doesn't close.
 * It will try to dismiss it by pressing Escape if it's still open.
 */
export async function waitForModalClose(timeout = TIMEOUT.short): Promise<void> {
  try {
    const overlay = await $('.fixed.inset-0.bg-black\\/20');
    const exists = await overlay.isExisting().catch(() => false);
    
    if (!exists) {
      return; // No modal, nothing to wait for
    }
    
    // Try to wait for it to close naturally
    const closed = await overlay.waitForDisplayed({ timeout, reverse: true }).then(() => true).catch(() => false);
    
    if (!closed) {
      // Modal still open - try to dismiss it with Escape key
      console.log('[waitForModalClose] Modal still displayed, trying Escape key');
      await browser.keys('Escape');
      await browser.pause(500);
    }
  } catch {
    // Silently continue - modal handling shouldn't fail tests
  }
}

/** Click element after ensuring no modal overlay is blocking */
export async function safeClick(element: WebdriverIO.Element, timeout = TIMEOUT.medium): Promise<void> {
  await waitForModalClose(TIMEOUT.short);
  await element.waitForClickable({ timeout });
  await element.click();
}
