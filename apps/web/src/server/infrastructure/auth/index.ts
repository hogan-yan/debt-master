/**
 * Auth-adapter factory.
 *
 * Returns the single active {@link AuthAdapter} based on `AUTH_PROVIDER`.
 * Callers should never import a concrete adapter directly — go through
 * {@link getAuthAdapter} so the provider is swappable via configuration.
 *
 * The factory is async so the Better Auth adapter (and its `better-auth` +
 * prisma-adapter deps) is dynamically imported only when the deploy selects the
 * `better-auth` provider. Authentik deploys never load that code path.
 */
import { AppError, ErrorCode } from '@/utils/errors';

import { infraConfig } from '../config';
import type { AuthAdapter } from './auth-adapter';
import { authentikAdapter } from './authentik-adapter';

let cached: AuthAdapter | null = null;

export async function getAuthAdapter(): Promise<AuthAdapter> {
  if (cached) return cached;
  const provider = infraConfig.authProvider;
  let adapter: AuthAdapter;
  if (provider === 'better-auth') {
    const mod = await import('./better-auth-adapter');
    adapter = mod.betterAuthAdapter;
  } else if (provider === 'authentik') {
    adapter = authentikAdapter;
  } else {
    throw new AppError(
      ErrorCode.INFRASTRUCTURE_ERROR,
      `Unsupported auth provider: "${provider}". Set AUTH_PROVIDER to one of: authentik, better-auth.`
    );
  }
  cached = adapter;
  return adapter;
}

/**
 * Test-only: reset the cached adapter. Used by adapter unit tests that vary
 * `AUTH_PROVIDER` per case.
 */
export function __resetAuthAdapterCacheForTests(): void {
  cached = null;
}
