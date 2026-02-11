import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeGuide, WELCOME_STEPS } from '../../../apps/desktop/src/components/WelcomeGuide';
import { useAppStore } from '../../../apps/desktop/src/stores/appStore';

describe('WelcomeGuide', () => {
  beforeEach(() => {
    useAppStore.setState({
      spaces: [],
      activeSpaceId: null,
      viewSpaceId: null,
      sidebarCollapsed: false,
      theme: 'system',
      hasSeenWelcome: false,
      loading: { spaces: false, servers: false },
    });
  });

  describe('visibility', () => {
    it('should render when hasSeenWelcome is false', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-overlay')).toBeInTheDocument();
    });

    it('should not render when hasSeenWelcome is true', () => {
      useAppStore.setState({ hasSeenWelcome: true });
      render(<WelcomeGuide />);
      expect(screen.queryByTestId('welcome-guide-overlay')).toBeNull();
    });
  });

  describe('first step rendering', () => {
    it('should show the first step title', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-title')).toHaveTextContent(WELCOME_STEPS[0].title);
    });

    it('should show the first step description', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-description')).toHaveTextContent(WELCOME_STEPS[0].description);
    });

    it('should display step count as 1 / 5', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-step-count')).toHaveTextContent('1 / 5');
    });

    it('should show step details', () => {
      render(<WelcomeGuide />);
      const details = screen.getByTestId('welcome-guide-details');
      const items = within(details).getAllByRole('listitem');
      expect(items).toHaveLength(WELCOME_STEPS[0].details.length);
    });

    it('should show Skip button on first step', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-skip-btn')).toBeInTheDocument();
    });

    it('should not show Back button on first step', () => {
      render(<WelcomeGuide />);
      expect(screen.queryByTestId('welcome-guide-back-btn')).toBeNull();
    });

    it('should show Next button', () => {
      render(<WelcomeGuide />);
      expect(screen.getByTestId('welcome-guide-next-btn')).toHaveTextContent('Next');
    });

    it('should not show tip when step has no tip', () => {
      render(<WelcomeGuide />);
      // First step has no tip
      expect(screen.queryByTestId('welcome-guide-tip')).toBeNull();
    });
  });

  describe('navigation', () => {
    it('should advance to next step when Next is clicked', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      await user.click(screen.getByTestId('welcome-guide-next-btn'));

      expect(screen.getByTestId('welcome-guide-title')).toHaveTextContent(WELCOME_STEPS[1].title);
      expect(screen.getByTestId('welcome-guide-step-count')).toHaveTextContent('2 / 5');
    });

    it('should show Back button on second step', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      await user.click(screen.getByTestId('welcome-guide-next-btn'));

      expect(screen.getByTestId('welcome-guide-back-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('welcome-guide-skip-btn')).toBeNull();
    });

    it('should go back to previous step when Back is clicked', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      await user.click(screen.getByTestId('welcome-guide-next-btn'));
      await user.click(screen.getByTestId('welcome-guide-back-btn'));

      expect(screen.getByTestId('welcome-guide-title')).toHaveTextContent(WELCOME_STEPS[0].title);
      expect(screen.getByTestId('welcome-guide-step-count')).toHaveTextContent('1 / 5');
    });

    it('should show tip on steps that have one', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      // Navigate to step 2 (Discover), which has a tip
      await user.click(screen.getByTestId('welcome-guide-next-btn'));

      expect(screen.getByTestId('welcome-guide-tip')).toBeInTheDocument();
      expect(screen.getByTestId('welcome-guide-tip')).toHaveTextContent(WELCOME_STEPS[1].tip!);
    });

    it('should navigate through all steps', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      for (let i = 0; i < WELCOME_STEPS.length - 1; i++) {
        expect(screen.getByTestId('welcome-guide-title')).toHaveTextContent(WELCOME_STEPS[i].title);
        await user.click(screen.getByTestId('welcome-guide-next-btn'));
      }

      // Should now be on the last step
      expect(screen.getByTestId('welcome-guide-title')).toHaveTextContent(
        WELCOME_STEPS[WELCOME_STEPS.length - 1].title
      );
    });

    it('should show Get Started on last step', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      // Navigate to the last step
      for (let i = 0; i < WELCOME_STEPS.length - 1; i++) {
        await user.click(screen.getByTestId('welcome-guide-next-btn'));
      }

      expect(screen.getByTestId('welcome-guide-next-btn')).toHaveTextContent('Get Started');
    });
  });

  describe('dismissal', () => {
    it('should set hasSeenWelcome to true when Skip is clicked', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      await user.click(screen.getByTestId('welcome-guide-skip-btn'));

      expect(useAppStore.getState().hasSeenWelcome).toBe(true);
    });

    it('should set hasSeenWelcome to true when Get Started is clicked on last step', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      // Navigate to the last step
      for (let i = 0; i < WELCOME_STEPS.length - 1; i++) {
        await user.click(screen.getByTestId('welcome-guide-next-btn'));
      }

      await user.click(screen.getByTestId('welcome-guide-next-btn'));

      expect(useAppStore.getState().hasSeenWelcome).toBe(true);
    });

    it('should hide the guide after Skip is clicked', async () => {
      const user = userEvent.setup();
      render(<WelcomeGuide />);

      await user.click(screen.getByTestId('welcome-guide-skip-btn'));

      expect(screen.queryByTestId('welcome-guide-overlay')).toBeNull();
    });
  });

  describe('step data integrity', () => {
    it('should have exactly 5 steps', () => {
      expect(WELCOME_STEPS).toHaveLength(5);
    });

    it('should have unique step IDs', () => {
      const ids = WELCOME_STEPS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each step should have title, description, and details', () => {
      for (const step of WELCOME_STEPS) {
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.details.length).toBeGreaterThan(0);
      }
    });
  });
});
