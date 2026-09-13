/**
 * Server-only audit logging.
 *
 * Writes structured auth and security events to the `AuditLog` table.
 * Failures are logged but never thrown, so audit logging cannot break user flows.
 */

import { Prisma } from '@prisma/client';
import { createServerLogger } from '@/server/infrastructure/logger';
import { getRequestClientIp } from '@/server/infrastructure/network';
import { prisma } from '@/server/infrastructure/prisma';

const logger = createServerLogger('audit', process.env.NODE_ENV === 'development');

export type AuditAction =
  | 'admin.setup_completed'
  | 'admin.setup_denied'
  | 'admin.setup_authorized'
  | 'admin.login'
  | 'admin.login_refused'
  | 'admin.logout'
  | 'admin.password_changed'
  | 'admin.password_reset_requested'
  | 'admin.password_reset_completed'
  | 'admin.session_revoked'
  | 'admin.2fa_enabled'
  | 'admin.2fa_disabled'
  | 'admin.audit_log_viewed'
  | 'access_code.created'
  | 'access_code.colleague_assigned'
  | 'access_code.deactivated'
  | 'access_code.reactivated'
  | 'access_code.deleted'
  | 'access_code.failed';

export interface AuditEventDetails {
  readonly [key: string]: Prisma.InputJsonValue;
}

export interface LogAuditEventInput {
  readonly action: AuditAction;
  readonly userId: string;
  readonly details?: AuditEventDetails | undefined;
  readonly ipAddress?: string | null | undefined;
}

/**
 * Persist an audit event. Falls back to console logging on DB errors so a
 * logging outage cannot lock users out.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  const ipAddress = input.ipAddress ?? (await getRequestClientIp());

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId,
        details: input.details ?? Prisma.JsonNull,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit event', { input, error });
  }
}
