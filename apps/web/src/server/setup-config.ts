/**
 * First-run setup configuration.
 *
 * Exposes whether the setup wizard is required and whether a setup token is
 * configured, so the UI can render the token field conditionally.
 */
import { createServerFn } from '@tanstack/react-start';
import { infraConfig } from '@/server/infrastructure/config';
import { createServerLogger } from '@/server/infrastructure/logger';
import { prisma } from '@/server/infrastructure/prisma';

const logger = createServerLogger('setup', process.env.NODE_ENV === 'development');

export interface SetupConfig {
  readonly setupRequired: boolean;
  readonly tokenRequired: boolean;
}

/**
 * Resolve the setup configuration for the current instance.
 */
export const getSetupConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SetupConfig> => {
    const setupRequired =
      infraConfig.authProvider === 'better-auth' && (await prisma.betterAuthUser.count()) === 0;
    const tokenRequired = Boolean(process.env.SETUP_TOKEN && process.env.SETUP_TOKEN.length > 0);

    if (
      process.env.NODE_ENV === 'production' &&
      infraConfig.authProvider === 'better-auth' &&
      setupRequired &&
      !tokenRequired
    ) {
      logger.warn(
        'SETUP_TOKEN is not set. First-run setup is protected only by the local-network check; set SETUP_TOKEN to also require a shared secret.'
      );
    }

    return { setupRequired, tokenRequired };
  }
);
