import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Welcome Guide overlay page object
 */
export class WelcomeGuidePage extends BasePage {
  readonly overlay: Locator;
  readonly card: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly stepCount: Locator;
  readonly stepIndicator: Locator;
  readonly details: Locator;
  readonly tip: Locator;
  readonly icon: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly skipButton: Locator;

  constructor(page: Page) {
    super(page);
    this.overlay = page.getByTestId('welcome-guide-overlay');
    this.card = page.getByTestId('welcome-guide-card');
    this.title = page.getByTestId('welcome-guide-title');
    this.description = page.getByTestId('welcome-guide-description');
    this.stepCount = page.getByTestId('welcome-guide-step-count');
    this.stepIndicator = page.getByTestId('welcome-guide-step-indicator');
    this.details = page.getByTestId('welcome-guide-details');
    this.tip = page.getByTestId('welcome-guide-tip');
    this.icon = page.getByTestId('welcome-guide-icon');
    this.nextButton = page.getByTestId('welcome-guide-next-btn');
    this.backButton = page.getByTestId('welcome-guide-back-btn');
    this.skipButton = page.getByTestId('welcome-guide-skip-btn');
  }

  async navigate() {
    await this.goto('/');
    await this.waitForLoad();
  }

  async goToStep(stepNumber: number) {
    for (let i = 0; i < stepNumber - 1; i++) {
      await this.nextButton.click();
    }
  }

  async dismiss() {
    await this.skipButton.click();
  }

  async completeAllSteps() {
    // Navigate through all 5 steps and click Get Started
    for (let i = 0; i < 5; i++) {
      await this.nextButton.click();
    }
  }
}
