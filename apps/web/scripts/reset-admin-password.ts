/**
 * Emergency admin password reset CLI.
 *
 * Use when the admin has lost access to email and cannot use the forgot-password
 * flow. Requires direct database access (the app must be stopped or the DB
 * reachable). Validates the new password against the shared admin policy.
 *
 * Usage:
 *   bun run scripts/reset-admin-password.ts --email admin@example.com --new-password 'Str0ng!Pass'
 */
import process from 'node:process';

import { hashPassword } from 'better-auth/crypto';

import { logAuditEvent } from '../src/server/infrastructure/audit-log/index';
import { prisma } from '../src/server/infrastructure/prisma/index';
import { validatePassword } from '../src/utils/password-policy';

function loadEnvFile(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Env may be provided by the host; continue either way.
  }
}

interface ResetArgs {
  readonly email: string;
  readonly newPassword: string;
}

function parseArgs(argv: readonly string[]): ResetArgs {
  const get = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const email = get('email');
  const newPassword = get('new-password');
  if (!email || !newPassword) {
    throw new Error('Usage: reset-admin-password.ts --email <email> --new-password <password>');
  }
  return { email, newPassword };
}

async function main(): Promise<void> {
  loadEnvFile();
  const { email, newPassword } = parseArgs(process.argv.slice(2));

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new Error(`Password does not meet the policy: ${validation.errors.join(', ')}.`);
  }

  const user = await prisma.betterAuthUser.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No admin found with email ${email}`);
  }

  const credentialAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  });
  if (!credentialAccount) {
    throw new Error(`No credential account found for ${email}`);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: hashedPassword },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await logAuditEvent({
    action: 'admin.password_changed',
    userId: user.id,
    details: { source: 'cli_reset' },
  });

  process.stdout.write(`Password reset for admin: ${email}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Failed to reset admin password: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
