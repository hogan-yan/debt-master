import type { ComponentType } from 'react';
import type { AppUiTokens } from '@/components/landing/app-ui/pieces';
import {
  BalancesScene,
  BalancesStatic,
  ConfirmScene,
  ConfirmStatic,
  LogExpenseScene,
  LogExpenseStatic,
} from '@/components/landing/app-ui/step-scenes';
import type { SceneTokenProps } from '@/components/landing/ledger-scenes';

/**
 * The real-app replica scenes for the how-it-works steps (indexes 1/2/3).
 * The page feeds these into StepSceneCard, which now requires a scene —
 * every landing scene is a replica.
 */

export interface AppUiScenePair {
  readonly Scene: ComponentType<{ readonly tokens: SceneTokenProps }>;
  readonly Static: ComponentType<{ readonly tokens: AppUiTokens }>;
  readonly durationInFrames: number;
  readonly compositionHeight: number;
}

export const APP_UI_SCENES: Record<1 | 2 | 3, AppUiScenePair> = {
  1: {
    Scene: LogExpenseScene,
    Static: LogExpenseStatic,
    durationInFrames: 150,
    compositionHeight: 220,
  },
  2: {
    Scene: BalancesScene,
    Static: BalancesStatic,
    durationInFrames: 110,
    compositionHeight: 220,
  },
  3: { Scene: ConfirmScene, Static: ConfirmStatic, durationInFrames: 110, compositionHeight: 220 },
};

export type { AppUiTokens } from '@/components/landing/app-ui/pieces';
