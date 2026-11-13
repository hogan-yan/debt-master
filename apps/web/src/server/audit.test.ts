import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import type { GetAdminAuditLogResult } from './audit';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    let schema: z.ZodType<unknown> | undefined;
    const builder = {
      validator: (validator: z.ZodType<unknown>) => {
        schema = validator;
        return builder;
      },
      inputValidator: (validator: z.ZodType<unknown>) => {
        schema = validator;
        return builder;
      },
      handler: (fn: (ctx?: { data: unknown }) => Promise<unknown>) => {
        const currentSchema = schema;
        if (!currentSchema) return fn;
        return async (ctx: { data: unknown }) => {
          const validated = currentSchema.parse(ctx.data);
          return fn({ data: validated });
        };
      },
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const { mockFindMany, mockRequireAdminFromCookie, mockLogAuditEvent } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRequireAdminFromCookie: vi.fn(),
  mockLogAuditEvent: vi.fn(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: () => mockRequireAdminFromCookie(),
}));

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

const { getAdminAuditLog } = await import('@/server/audit');

function isAuditResult(value: unknown): value is GetAdminAuditLogResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'entries' in value &&
    Array.isArray(value.entries) &&
    'nextCursor' in value
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireAdminFromCookie.mockResolvedValue({ username: 'admin-user' });
  mockLogAuditEvent.mockResolvedValue(undefined);
});

describe('getAdminAuditLog', () => {
  it('returns audit entries for the current admin', async () => {
    const entries = [
      {
        id: 1,
        action: 'admin.login',
        details: { provider: 'better-auth' },
        ipAddress: '127.0.0.1',
        createdAt: new Date('2026-06-28T00:00:00Z'),
      },
      {
        id: 2,
        action: 'admin.password_changed',
        details: {},
        ipAddress: null,
        createdAt: new Date('2026-06-28T01:00:00Z'),
      },
    ];
    mockFindMany.mockResolvedValue(entries);

    const raw = await getAdminAuditLog({ data: { limit: 10 } });
    if (!isAuditResult(raw)) throw new Error('invalid result');
    const result = raw;
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.action).toBe('admin.login');
    expect(result.entries[0]?.details).toBe('{"provider":"better-auth"}');
    expect(result.entries[1]?.action).toBe('admin.password_changed');
    expect(result.entries[1]?.details).toBe('{}');
    expect(result.nextCursor).toBeNull();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'admin-user' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 0,
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.audit_log_viewed',
      userId: 'admin-user',
      details: { limit: 10 },
    });
  });

  it('returns nextCursor when the result is full', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      action: 'admin.login',
      details: null,
      ipAddress: null,
      createdAt: new Date(),
    }));
    mockFindMany.mockResolvedValue(entries);

    const raw = await getAdminAuditLog({ data: { limit: 10, cursor: 5 } });
    if (!isAuditResult(raw)) throw new Error('invalid result');
    const result = raw;
    expect(result.entries).toHaveLength(10);
    expect(result.nextCursor).toBe(15);
  });

  it('starts nextCursor at zero when a full first page has no cursor', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, id) => ({
        id,
        action: 'admin.login',
        details: null,
        ipAddress: null,
        createdAt: new Date(),
      }))
    );

    const raw = await getAdminAuditLog({ data: { limit: 10 } });
    if (!isAuditResult(raw)) throw new Error('invalid result');

    expect(raw.nextCursor).toBe(10);
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it('validates the input schema', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(getAdminAuditLog({ data: { limit: 101 } })).rejects.toThrow();
    await expect(getAdminAuditLog({ data: { limit: 10, cursor: -1 } })).rejects.toThrow();
  });

  it('falls back to empty user id when admin username is missing', async () => {
    mockRequireAdminFromCookie.mockResolvedValue({ username: null });
    mockFindMany.mockResolvedValue([]);

    await getAdminAuditLog({ data: { limit: 10 } });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: '' } }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'unknown' }));
  });
});
