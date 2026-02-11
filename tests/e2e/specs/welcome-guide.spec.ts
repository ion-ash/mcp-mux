import { test, expect } from '@playwright/test';
import { WelcomeGuidePage, DashboardPage } from '../pages';

test.describe('Welcome Guide', () => {
  test.describe('first launch', () => {
    test.beforeEach(async ({ page }) => {
      // Clear localStorage to simulate first launch
      await page.goto('/');
      await page.evaluate(() => {
        const stored = localStorage.getItem('mcpmux-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, hasSeenWelcome: false };
          localStorage.setItem('mcpmux-storage', JSON.stringify(parsed));
        }
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should display welcome guide overlay on first launch', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await expect(welcome.overlay).toBeVisible();
      await expect(welcome.card).toBeVisible();
    });

    test('should show first step with Welcome to McpMux title', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await expect(welcome.title).toHaveText('Welcome to McpMux');
      await expect(welcome.stepCount).toHaveText('1 / 5');
    });

    test('should show step description and details', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await expect(welcome.description).toBeVisible();
      await expect(welcome.details).toBeVisible();
    });

    test('should show Skip and Next buttons on first step', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await expect(welcome.skipButton).toBeVisible();
      await expect(welcome.nextButton).toBeVisible();
      await expect(welcome.nextButton).toHaveText(/Next/);
    });
  });

  test.describe('navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const stored = localStorage.getItem('mcpmux-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, hasSeenWelcome: false };
          localStorage.setItem('mcpmux-storage', JSON.stringify(parsed));
        }
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should navigate to second step', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.nextButton.click();

      await expect(welcome.title).toHaveText('Discover & Install Servers');
      await expect(welcome.stepCount).toHaveText('2 / 5');
      await expect(welcome.backButton).toBeVisible();
    });

    test('should navigate back to first step', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.nextButton.click();
      await welcome.backButton.click();

      await expect(welcome.title).toHaveText('Welcome to McpMux');
      await expect(welcome.stepCount).toHaveText('1 / 5');
    });

    test('should show tip on steps that have one', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      // Step 2 has a tip
      await welcome.nextButton.click();
      await expect(welcome.tip).toBeVisible();
    });

    test('should navigate through all steps to the last', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);

      // Navigate to step 5
      await welcome.goToStep(5);

      await expect(welcome.title).toHaveText('Control with FeatureSets');
      await expect(welcome.stepCount).toHaveText('5 / 5');
      await expect(welcome.nextButton).toHaveText('Get Started');
    });

    test('should show correct titles for each step', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);

      const expectedTitles = [
        'Welcome to McpMux',
        'Discover & Install Servers',
        'Organize with Spaces',
        'Connect Your AI Clients',
        'Control with FeatureSets',
      ];

      for (let i = 0; i < expectedTitles.length; i++) {
        await expect(welcome.title).toHaveText(expectedTitles[i]);
        if (i < expectedTitles.length - 1) {
          await welcome.nextButton.click();
        }
      }
    });
  });

  test.describe('dismissal', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const stored = localStorage.getItem('mcpmux-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, hasSeenWelcome: false };
          localStorage.setItem('mcpmux-storage', JSON.stringify(parsed));
        }
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should dismiss when Skip is clicked', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.skipButton.click();

      await expect(welcome.overlay).not.toBeVisible();
    });

    test('should dismiss when Get Started is clicked on last step', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.completeAllSteps();

      await expect(welcome.overlay).not.toBeVisible();
    });

    test('should show dashboard after dismissal', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.skipButton.click();

      const dashboard = new DashboardPage(page);
      await expect(dashboard.heading).toBeVisible();
    });

    test('should persist dismissal across page reloads', async ({ page }) => {
      const welcome = new WelcomeGuidePage(page);
      await welcome.skipButton.click();

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Welcome guide should not appear again
      await expect(welcome.overlay).not.toBeVisible();
    });
  });

  test.describe('returning user', () => {
    test('should not show welcome guide when hasSeenWelcome is true', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const stored = localStorage.getItem('mcpmux-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, hasSeenWelcome: true };
          localStorage.setItem('mcpmux-storage', JSON.stringify(parsed));
        }
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      const welcome = new WelcomeGuidePage(page);
      await expect(welcome.overlay).not.toBeVisible();
    });
  });
});
