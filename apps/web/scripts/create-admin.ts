/**
 * Bootstrap the first Better Auth admin (DEBTCOM-2).
 *
 * Creates a Better Auth user (admin login) via the server-side signUp API. No
 * backdoor access code is involved — run this once after migrating the BA
 * tables to establish the first admin.
 *
 * Usage:
 *   bun run scripts/create-admin.ts --email admin@example.com --password 'Str0ng!Passw0rd' --name "Admin"
 *
 * Requires AUTH_PROVIDER=better-auth, a reachable Postgres, and the
 * better_auth_* tables migrated (`bunx prisma migrate deploy`).
 */
import process from 'node:process';

import { getAuth } from '../src/server/infrastructure/auth/better-auth-instance';
import { validatePassword } from '../src/utils/password-policy';

function loadEnvFile(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Env may be provided by the host; continue either way.
  }
}

interface AdminArgs {
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

function parseArgs(argv: readonly string[]): AdminArgs {
  const get = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const email = get('email');
  const password = get('password');
  const name = get('name');
  if (!email || !password || !name) {
    throw new Error('Usage: create-admin.ts --email <email> --password <password> --name <name>');
  }
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(`Password does not meet the policy: ${validation.errors.join(', ')}.`);
  }
  return { email, password, name };
}

async function main(): Promise<void> {
  loadEnvFile();
  const { email, password, name } = parseArgs(process.argv.slice(2));
  const auth = getAuth();
  await auth.api.signUpEmail({
    body: { email, password, name },
  });
  console.log(`Created admin: ${email}`);
}

main().catch((err: unknown) => {
  // biome-ignore lint/suspicious/noConsole: CLI bootstrap script — stderr is the intended error channel.
  console.error('Failed to create admin:', err instanceof Error ? err.message : err);
  process.exit(1);
});
