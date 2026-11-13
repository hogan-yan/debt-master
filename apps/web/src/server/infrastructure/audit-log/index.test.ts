import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());
const mockGetRequestClientIp = vi.hoisted(() => vi.fn());

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('@/server/infrastructure/network', () => ({
  getRequestClientIp: () => mockGetRequestClientIp(),
}));

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: vi.fn(),
}));

import { Prisma } from '@prisma/client';

import { logAuditEvent } from '@/server/infrastructure/audit-log';

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockGetRequestClientIp.mockReturnValue('127.0.0.1');
  });

  it('persists an audit event with the resolved IP', async () => {
    await logAuditEvent({
      action: 'admin.login',
      userId: 'admin@example.com',
      details: { method: 'email' },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'admin.login',
        userId: 'admin@example.com',
        details: { method: 'email' },
        ipAddress: '127.0.0.1',
      },
    });
  });

  it('uses the provided IP when given', async () => {
    await logAuditEvent({
      action: 'admin.logout',
      userId: 'admin@example.com',
      ipAddress: '10.0.0.1',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ipAddress: '10.0.0.1' }),
      })
    );
  });

  it('uses null details and IP when neither are provided', async () => {
    mockGetRequestClientIp.mockReturnValue(null);

    await logAuditEvent({ action: 'admin.login', userId: 'admin@example.com' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'admin.login',
        userId: 'admin@example.com',
        details: Prisma.JsonNull,
        ipAddress: null,
      },
    });
  });

  it('does not throw when the database write fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAuditEvent({ action: 'admin.login', userId: 'admin@example.com' })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
