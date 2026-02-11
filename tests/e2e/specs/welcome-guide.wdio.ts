/**
 * E2E Tests: Welcome Guide (Desktop)
 * Tests the first-launch welcome onboarding flow in the Tauri desktop app.
 * Uses data-testid only (ADR-003).
 */

import { byTestId, TIMEOUT, safeClick } from '../helpers/selectors';

describe('Welcome Guide - First Launch', () => {
  it('should display welcome guide overlay on first launch', async () => {
    const overlay = await byTestId('welcome-guide-overlay');
    await overlay.waitForDisplayed({ timeout: TIMEOUT.medium });
    await expect(overlay).toBeDisplayed();
  });

  it('should show first step with Welcome to McpMux title', async () => {
    const title = await byTestId('welcome-guide-title');
    await expect(title).toBeDisplayed();
    const titleText = await title.getText();
    expect(titleText).toBe('Welcome to McpMux');
  });

  it('should show step count as 1 / 5', async () => {
    const stepCount = await byTestId('welcome-guide-step-count');
    const text = await stepCount.getText();
    expect(text).toBe('1 / 5');
  });

  it('should show step description', async () => {
    const description = await byTestId('welcome-guide-description');
    await expect(description).toBeDisplayed();
  });

  it('should show step details list', async () => {
    const details = await byTestId('welcome-guide-details');
    await expect(details).toBeDisplayed();
  });

  it('should show icon', async () => {
    const icon = await byTestId('welcome-guide-icon');
    await expect(icon).toBeDisplayed();
  });

  it('should show Skip button on first step', async () => {
    const skipBtn = await byTestId('welcome-guide-skip-btn');
    await expect(skipBtn).toBeDisplayed();
  });

  it('should show Next button on first step', async () => {
    const nextBtn = await byTestId('welcome-guide-next-btn');
    await expect(nextBtn).toBeDisplayed();
    const text = await nextBtn.getText();
    expect(text).toContain('Next');
  });
});

describe('Welcome Guide - Navigation', () => {
  it('should navigate to second step when Next is clicked', async () => {
    const nextBtn = await byTestId('welcome-guide-next-btn');
    await safeClick(nextBtn);
    await browser.pause(500);

    const title = await byTestId('welcome-guide-title');
    const titleText = await title.getText();
    expect(titleText).toBe('Discover & Install Servers');

    const stepCount = await byTestId('welcome-guide-step-count');
    const countText = await stepCount.getText();
    expect(countText).toBe('2 / 5');
  });

  it('should show Back button on second step', async () => {
    const backBtn = await byTestId('welcome-guide-back-btn');
    await expect(backBtn).toBeDisplayed();
  });

  it('should show tip on step with tip', async () => {
    const tip = await byTestId('welcome-guide-tip');
    await expect(tip).toBeDisplayed();
  });

  it('should navigate back to first step', async () => {
    const backBtn = await byTestId('welcome-guide-back-btn');
    await safeClick(backBtn);
    await browser.pause(500);

    const title = await byTestId('welcome-guide-title');
    const titleText = await title.getText();
    expect(titleText).toBe('Welcome to McpMux');

    const stepCount = await byTestId('welcome-guide-step-count');
    const countText = await stepCount.getText();
    expect(countText).toBe('1 / 5');
  });

  it('should navigate through all steps to the last', async () => {
    const expectedTitles = [
      'Welcome to McpMux',
      'Discover & Install Servers',
      'Organize with Spaces',
      'Connect Your AI Clients',
      'Control with FeatureSets',
    ];

    for (let i = 0; i < expectedTitles.length; i++) {
      const title = await byTestId('welcome-guide-title');
      const titleText = await title.getText();
      expect(titleText).toBe(expectedTitles[i]);

      if (i < expectedTitles.length - 1) {
        const nextBtn = await byTestId('welcome-guide-next-btn');
        await safeClick(nextBtn);
        await browser.pause(300);
      }
    }
  });

  it('should show Get Started on last step', async () => {
    const nextBtn = await byTestId('welcome-guide-next-btn');
    const text = await nextBtn.getText();
    expect(text).toContain('Get Started');
  });

  it('should show step count as 5 / 5 on last step', async () => {
    const stepCount = await byTestId('welcome-guide-step-count');
    const countText = await stepCount.getText();
    expect(countText).toBe('5 / 5');
  });
});

describe('Welcome Guide - Dismissal', () => {
  it('should dismiss when Get Started is clicked on last step', async () => {
    // We should be on the last step from previous describe block
    const nextBtn = await byTestId('welcome-guide-next-btn');
    await safeClick(nextBtn);
    await browser.pause(500);

    // Overlay should be gone
    const overlay = await byTestId('welcome-guide-overlay');
    const isDisplayed = await overlay.isDisplayed().catch(() => false);
    expect(isDisplayed).toBe(false);
  });

  it('should show dashboard after dismissal', async () => {
    const pageSource = await browser.getPageSource();
    expect(pageSource.includes('Dashboard')).toBe(true);
  });

  it('should not show welcome guide after dismissal', async () => {
    const overlay = await byTestId('welcome-guide-overlay');
    const isDisplayed = await overlay.isDisplayed().catch(() => false);
    expect(isDisplayed).toBe(false);
  });
});
