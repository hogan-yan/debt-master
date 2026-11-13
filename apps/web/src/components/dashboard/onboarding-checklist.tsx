/**
 * OnboardingChecklist — 3-step setup progress shown on the dashboard when no
 * lunches have been logged yet. Surfaces the real prerequisites (restaurant,
 * colleagues, first lunch) instead of a single CTA, so new accounts don't
 * dead-end on the expense form (which requires a restaurantId).
 *
 * Per-step action buttons are admin-only: adding colleagues/restaurants is an
 * admin action on those pages, so non-admins see status but no CTAs.
 */

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Circle, Receipt, Users, Utensils } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { AdminOnly } from '@/utils/auth-context';

export type OnboardingStepId = 'restaurants' | 'colleagues' | 'lunch';

const STEP_ICONS: Record<OnboardingStepId, LucideIcon> = {
  restaurants: Utensils,
  colleagues: Users,
  lunch: Receipt,
};

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
}

export interface OnboardingChecklistProps {
  steps: OnboardingStep[];
}

export function OnboardingChecklist({ steps }: OnboardingChecklistProps): React.ReactElement {
  const total = steps.length;
  const completed = steps.filter((step) => step.done).length;
  const firstIncompleteIndex = steps.findIndex((step) => !step.done);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.dashboard_onboarding_title()}</CardTitle>
        <p className="text-sm text-muted-foreground">{m.dashboard_onboarding_subtitle()}</p>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={completed} max={total} className="h-2" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {m.dashboard_onboarding_progress({ completed, total })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, index) => {
          const StatusIcon = step.done ? CheckCircle2 : Circle;
          const StepIcon = STEP_ICONS[step.id];
          const isNext = index === firstIncompleteIndex;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                step.done ? 'border-transparent bg-muted/40' : 'bg-card'
              )}
            >
              <StatusIcon
                className={cn(
                  'size-5 shrink-0',
                  step.done ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-hidden="true"
              />
              <StepIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="truncate text-xs text-muted-foreground">{step.description}</p>
              </div>
              {step.done ? (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {m.dashboard_onboarding_done()}
                </span>
              ) : (
                <AdminOnly>
                  <Button
                    variant={isNext ? 'default' : 'outline'}
                    size="sm"
                    onClick={step.onAction}
                  >
                    {step.actionLabel}
                  </Button>
                </AdminOnly>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
