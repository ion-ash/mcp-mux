import { useState } from 'react';
import {
  Globe,
  Server,
  Monitor,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Rocket,
} from 'lucide-react';
import { Button, Card } from '@mcpmux/ui';
import { useAppStore, useHasSeenWelcome } from '@/stores';

interface WelcomeStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
  tip: string | null;
}

const WELCOME_STEPS: WelcomeStep[] = [
  {
    id: 'welcome',
    icon: <Rocket className="h-8 w-8" />,
    title: 'Welcome to McpMux',
    description:
      'Your centralized MCP server manager. Configure your MCP servers once, connect every AI client through a single gateway.',
    details: [
      'No more duplicating server configs across Cursor, Claude Desktop, VS Code, and others',
      'Credentials are encrypted in your OS keychain — not stored in plain-text JSON',
      'One local gateway endpoint for all your AI clients',
    ],
    tip: null,
  },
  {
    id: 'discover',
    icon: <Globe className="h-8 w-8" />,
    title: 'Discover & Install Servers',
    description:
      'Browse the curated registry and install MCP servers with one click. Search by category, auth type, or name.',
    details: [
      'Open the Discover page from the sidebar to browse available servers',
      'Click Install on any server to add it to your active space',
      'Servers requiring API keys or OAuth will prompt you for credentials',
    ],
    tip: 'Servers are cached locally so you can browse even when offline.',
  },
  {
    id: 'spaces',
    icon: <Server className="h-8 w-8" />,
    title: 'Organize with Spaces',
    description:
      'Spaces are isolated workspaces with their own servers and credentials. Use them to separate work, personal, and project contexts.',
    details: [
      'Create spaces from the Spaces page — each gets its own server set',
      'Switch the active space from the sidebar dropdown',
      'Your AI clients automatically follow the active space',
    ],
    tip: 'A default space is created for you on first launch.',
  },
  {
    id: 'connect',
    icon: <Monitor className="h-8 w-8" />,
    title: 'Connect Your AI Clients',
    description:
      'Add one config snippet to each AI client. All installed servers become available through the McpMux gateway.',
    details: [
      'Copy the gateway config from the Dashboard page',
      'Paste it into your client\'s MCP settings (inside mcpServers)',
      'Clients like Cursor, Claude Desktop, VS Code, and Windsurf are all supported',
    ],
    tip: 'The gateway runs locally — your data never leaves your machine.',
  },
  {
    id: 'featuresets',
    icon: <Wrench className="h-8 w-8" />,
    title: 'Control with FeatureSets',
    description:
      'FeatureSets let you control which tools, prompts, and resources each client can access. Create permission bundles for fine-grained control.',
    details: [
      'Go to FeatureSets to create bundles like "Read Only" or "Dev Tools"',
      'Assign specific server features to each bundle',
      'Grant bundles to individual clients from the Clients page',
    ],
    tip: 'A "Default" FeatureSet is auto-created for each space.',
  },
];

export function WelcomeGuide() {
  const hasSeenWelcome = useHasSeenWelcome();
  const setHasSeenWelcome = useAppStore((state) => state.setHasSeenWelcome);
  const [currentStep, setCurrentStep] = useState(0);

  if (hasSeenWelcome) {
    return null;
  }

  const step = WELCOME_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WELCOME_STEPS.length - 1;
  const totalSteps = WELCOME_STEPS.length;

  const handleNext = () => {
    if (isLastStep) {
      setHasSeenWelcome(true);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    setHasSeenWelcome(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      data-testid="welcome-guide-overlay"
    >
      <Card
        className="w-full max-w-lg mx-4 animate-fade-in"
        data-testid="welcome-guide-card"
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6" data-testid="welcome-guide-step-indicator">
          <div className="flex gap-1.5">
            {WELCOME_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-6 bg-[rgb(var(--primary))]'
                    : index < currentStep
                      ? 'w-1.5 bg-[rgb(var(--primary))]/60'
                      : 'w-1.5 bg-[rgb(var(--border))]'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-[rgb(var(--muted))]" data-testid="welcome-guide-step-count">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <div
            className="h-16 w-16 rounded-2xl bg-[rgb(var(--primary))]/10 flex items-center justify-center text-[rgb(var(--primary))]"
            data-testid="welcome-guide-icon"
          >
            {step.icon}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2
            className="text-xl font-bold mb-2"
            data-testid="welcome-guide-title"
          >
            {step.title}
          </h2>
          <p
            className="text-sm text-[rgb(var(--muted))]"
            data-testid="welcome-guide-description"
          >
            {step.description}
          </p>
        </div>

        {/* Details */}
        <ul className="space-y-3 mb-6" data-testid="welcome-guide-details">
          {step.details.map((detail, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <ChevronRight className="h-4 w-4 mt-0.5 text-[rgb(var(--primary))] shrink-0" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>

        {/* Tip */}
        {step.tip && (
          <div
            className="rounded-lg bg-[rgb(var(--surface-dim))] px-4 py-3 text-xs text-[rgb(var(--muted))] mb-6"
            data-testid="welcome-guide-tip"
          >
            <span className="font-medium text-[rgb(var(--foreground))]">Tip: </span>
            {step.tip}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {isFirstStep ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                data-testid="welcome-guide-skip-btn"
              >
                Skip
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                data-testid="welcome-guide-back-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNext}
            data-testid="welcome-guide-next-btn"
          >
            {isLastStep ? 'Get Started' : 'Next'}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Re-export the steps data for testing */
export { WELCOME_STEPS };
export type { WelcomeStep };
