/**
 * Admin audit log queries.
 *
 * Returns recent security and auth events for the current admin. Used by the
 * security panel to show a self-service activity trail.
 */
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';

const getAdminAuditLogSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.number().int().min(0).optional(),
});

export interface AuditLogEntry {
  readonly id: number;
  readonly action: string;
  readonly details: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}

export interface GetAdminAuditLogResult {
  readonly entries: readonly AuditLogEntry[];
  readonly nextCursor: number | null;
}

/**
 * Return the most recent audit events for the current admin, oldest first.
 */
export const getAdminAuditLog = createServerFn({ method: 'POST' })
  .validator(getAdminAuditLogSchema)
  .handler(async ({ data }): Promise<GetAdminAuditLogResult> => {
    const admin = await requireAdminFromCookie();

    const entries = await prisma.auditLog.findMany({
      where: { userId: admin.username ?? '' },
      orderBy: { createdAt: 'desc' },
      take: data.limit,
      skip: data.cursor ? data.cursor : 0,
    });

    await logAuditEvent({
      action: 'admin.audit_log_viewed',
      userId: admin.username ?? 'unknown',
      details: { limit: data.limit, ...(data.cursor !== undefined ? { cursor: data.cursor } : {}) },
    });

    const nextCursor = entries.length === data.limit ? (data.cursor ?? 0) + entries.length : null;

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        createdAt: entry.createdAt,
      })),
      nextCursor,
    };
  });
