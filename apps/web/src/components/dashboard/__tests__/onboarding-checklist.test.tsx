import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the AdminOnly mock factory (which vi.mock hoists above imports) can read it.
const { adminState } = vi.hoisted(() => ({ adminState: { isAdmin: true } }));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key) => (params?: Record<string, unknown>) =>
        params ? `${String(key)}:${JSON.stringify(params)}` : String(key),
    }
  ),
}));

vi.mock('@/utils/auth-context', () => ({
  AdminOnly: ({ children }: { children: ReactNode }) => (adminState.isAdmin ? children : null),
}));

import { OnboardingChecklist, type OnboardingStep } from '../onboarding-checklist';

const restaurantStep = (done = false): OnboardingStep => ({
  id: 'restaurants',
  label: 'Add a restaurant',
  description: 'desc1',
  done,
  actionLabel: 'Add Restaurant',
  onAction: vi.fn(),
});

const colleagueStep = (done = false): OnboardingStep => ({
  id: 'colleagues',
  label: 'Add colleagues',
  description: 'desc2',
  done,
  actionLabel: 'Add Colleague',
  onAction: vi.fn(),
});

const lunchStep = (done = false): OnboardingStep => ({
  id: 'lunch',
  label: 'Log your first lunch',
  description: 'desc3',
  done,
  actionLabel: 'Log First Lunch',
  onAction: vi.fn(),
});

const allPending = (): OnboardingStep[] => [restaurantStep(), colleagueStep(), lunchStep()];

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    adminState.isAdmin = true;
  });

  it('renders title, subtitle, and all three step labels', () => {
    render(<OnboardingChecklist steps={allPending()} />);
    expect(screen.getByText('dashboard_onboarding_title')).toBeInTheDocument();
    expect(screen.getByText('dashboard_onboarding_subtitle')).toBeInTheDocument();
    expect(screen.getByText('Add a restaurant')).toBeInTheDocument();
    expect(screen.getByText('Add colleagues')).toBeInTheDocument();
    expect(screen.getByText('Log your first lunch')).toBeInTheDocument();
  });

  it('shows the action button on pending steps and a Done marker on completed steps', () => {
    render(<OnboardingChecklist steps={[restaurantStep(true), colleagueStep(), lunchStep()]} />);

    // Completed step -> Done marker, no button.
    expect(screen.getByText('dashboard_onboarding_done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Restaurant' })).not.toBeInTheDocument();
    // Pending steps -> buttons present.
    expect(screen.getByRole('button', { name: 'Add Colleague' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log First Lunch' })).toBeInTheDocument();
  });

  it('fires onAction when a step button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const steps: OnboardingStep[] = [
      {
        id: 'restaurants',
        label: 'Add a restaurant',
        description: 'desc1',
        done: false,
        actionLabel: 'Add Restaurant',
        onAction,
      },
      colleagueStep(),
      lunchStep(),
    ];

    render(<OnboardingChecklist steps={steps} />);
    await user.click(screen.getByRole('button', { name: 'Add Restaurant' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('marks the first incomplete step as the primary action and later steps as outline', () => {
    // restaurants done -> colleagues is the next (primary) step.
    render(<OnboardingChecklist steps={[restaurantStep(true), colleagueStep(), lunchStep()]} />);
    const nextButton = screen.getByRole('button', { name: 'Add Colleague' });
    const laterButton = screen.getByRole('button', { name: 'Log First Lunch' });

    expect(nextButton.className).toContain('bg-primary');
    expect(laterButton.className).not.toContain('bg-primary');
  });

  it('hides all action buttons for non-admins', () => {
    adminState.isAdmin = false;
    render(<OnboardingChecklist steps={allPending()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
