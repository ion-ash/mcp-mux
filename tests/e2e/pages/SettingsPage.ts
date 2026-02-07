import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Settings page object
 */
export class SettingsPage extends BasePage {
  readonly heading: Locator;
  readonly lightThemeButton: Locator;
  readonly darkThemeButton: Locator;
  readonly systemThemeButton: Locator;
  readonly openLogsButton: Locator;
  readonly logsPath: Locator;
  readonly autoLaunchSwitch: Locator;
  readonly startMinimizedSwitch: Locator;
  readonly closeToTraySwitch: Locator;
  readonly toastContainer: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Settings' });
    this.lightThemeButton = page.getByRole('button', { name: 'Light', exact: true });
    this.darkThemeButton = page.getByRole('button', { name: 'Dark', exact: true });
    this.systemThemeButton = page.getByRole('button', { name: 'System', exact: true });
    this.openLogsButton = page.getByRole('button', { name: /Open Logs/i });
    this.logsPath = page.locator('.font-mono').filter({ hasText: /logs|mcpmux/i });
    this.autoLaunchSwitch = page.getByTestId('auto-launch-switch');
    this.startMinimizedSwitch = page.getByTestId('start-minimized-switch');
    this.closeToTraySwitch = page.getByTestId('close-to-tray-switch');
    this.toastContainer = page.getByRole('main').getByTestId('toast-container');
  }

  async selectTheme(theme: 'light' | 'dark' | 'system') {
    switch (theme) {
      case 'light':
        await this.lightThemeButton.click();
        break;
      case 'dark':
        await this.darkThemeButton.click();
        break;
      case 'system':
        await this.systemThemeButton.click();
        break;
    }
  }

  async getActiveTheme(): Promise<string> {
    // Check which button has the primary variant
    if (await this.lightThemeButton.getAttribute('class').then(c => c?.includes('primary'))) {
      return 'light';
    }
    if (await this.darkThemeButton.getAttribute('class').then(c => c?.includes('primary'))) {
      return 'dark';
    }
    return 'system';
  }

  async waitForToast(type: 'success' | 'error' | 'warning' | 'info', timeout = 5000) {
    await this.page.getByTestId(`toast-${type}`).waitFor({ timeout });
  }

  async getToastText() {
    const toast = this.page.getByRole('main').getByTestId('toast-container').locator('[role="alert"]').first();
    return toast.textContent();
  }

  async closeToast() {
    await this.page.getByTestId('toast-close').first().click();
  }
}
