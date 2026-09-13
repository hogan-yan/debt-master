import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAuthFromCookie,
  mockPrismaAccessCode,
  mockPrismaExpenseParticipant,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockGetAuthFromCookie: vi.fn(),
  mockPrismaAccessCode: { findUnique: vi.fn() },
  mockPrismaExpenseParticipant: { findFirst: vi.fn() },
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: (...args: unknown[]) => mockGetAuthFromCookie(...(args as [])),
}));
vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    accessCode: mockPrismaAccessCode,
    expenseParticipant: mockPrismaExpenseParticipant,
  },
}));
vi.mock('@/server/infrastructure/logger', () => ({
  createServerLogger: () => ({ warn: mockLoggerWarn }),
}));

import { AppError } from '@/utils/errors';
import {
  assertExpenseObjectAccess,
  assertParticipantObjectAccess,
  assertPaymentObjectAccess,
  STORAGE_ACCESS_DENIED,
} from './storage-authz';

const adminSession = { isAdmin: true, accessCodeId: undefined };
const colleagueSession = (accessCodeId: number) => ({ isAdmin: false, accessCodeId });

beforeEach(() => {
  vi.clearAllMocks();
  mockPrismaExpenseParticipant.findFirst.mockResolvedValue(null);
});

describe('resolveBoundColleagueId', () => {
  it('throws AUTH_REQUIRED when no session exists', async () => {
    mockGetAuthFromCookie.mockResolvedValue(null);

    await expect(assertExpenseObjectAccess(1)).rejects.toThrow(AppError);
  });

  it('allows admins without touching the access-code table', async () => {
    mockGetAuthFromCookie.mockResolvedValue(adminSession);

    await expect(assertExpenseObjectAccess(1)).resolves.toBeUndefined();
    expect(mockPrismaAccessCode.findUnique).not.toHaveBeenCalled();
  });

  it('allows better-auth sessions without an access code', async () => {
    mockGetAuthFromCookie.mockResolvedValue({ isAdmin: false, accessCodeId: undefined });

    await expect(assertExpenseObjectAccess(1)).resolves.toBeUndefined();
    expect(mockPrismaAccessCode.findUnique).not.toHaveBeenCalled();
  });

  it('throws AUTH_REQUIRED when the code is missing, inactive, or deleted', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue(null);

    await expect(assertExpenseObjectAccess(1)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
    expect(mockGetAuthFromCookie).toHaveBeenCalled();
  });

  it('allows unbound codes but logs a legacy-access warning', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: null,
      isActive: true,
      deletedAt: null,
    });

    await expect(assertExpenseObjectAccess(1)).resolves.toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('unbound access code'),
      expect.objectContaining({ accessCodeId: 7 })
    );
  });

  it('denies unbound codes when ALLOW_UNBOUND_CODE_READ=false even outside production', async () => {
    const original = process.env.ALLOW_UNBOUND_CODE_READ;
    process.env.ALLOW_UNBOUND_CODE_READ = 'false';
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: null,
      isActive: true,
      deletedAt: null,
    });

    try {
      await expect(assertExpenseObjectAccess(1)).rejects.toMatchObject({
        code: 'STORAGE_ACCESS_DENIED',
        message: STORAGE_ACCESS_DENIED,
      });
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('legacy full read disabled'),
        expect.objectContaining({ accessCodeId: 7 })
      );
    } finally {
      if (original === undefined) delete process.env.ALLOW_UNBOUND_CODE_READ;
      else process.env.ALLOW_UNBOUND_CODE_READ = original;
    }
  });

  it('honours an explicit ALLOW_UNBOUND_CODE_READ=true even in production', async () => {
    const original = process.env.ALLOW_UNBOUND_CODE_READ;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_UNBOUND_CODE_READ = 'true';
    process.env.NODE_ENV = 'production';
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: null,
      isActive: true,
      deletedAt: null,
    });

    try {
      await expect(assertExpenseObjectAccess(1)).resolves.toBeUndefined();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('legacy full read'),
        expect.objectContaining({ accessCodeId: 7 })
      );
    } finally {
      if (original === undefined) delete process.env.ALLOW_UNBOUND_CODE_READ;
      else process.env.ALLOW_UNBOUND_CODE_READ = original;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

describe('assertExpenseObjectAccess', () => {
  it('allows a bound colleague who participates in the expense', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });
    mockPrismaExpenseParticipant.findFirst.mockResolvedValue({ id: 1 });

    await expect(assertExpenseObjectAccess(11)).resolves.toBeUndefined();
    expect(mockPrismaExpenseParticipant.findFirst).toHaveBeenCalledWith({
      where: { expenseId: 11, colleagueId: 3 },
      select: { id: true },
    });
  });

  it('denies a bound colleague who is not a participant', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });
    mockPrismaExpenseParticipant.findFirst.mockResolvedValue(null);

    await expect(assertExpenseObjectAccess(11)).rejects.toMatchObject({
      code: 'STORAGE_ACCESS_DENIED',
      message: STORAGE_ACCESS_DENIED,
    });
  });
});

describe('assertPaymentObjectAccess', () => {
  it('allows a bound colleague who owns the payment', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });

    await expect(assertPaymentObjectAccess({ colleagueId: 3 })).resolves.toBeUndefined();
  });

  it('denies a bound colleague who does not own the payment', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });

    await expect(assertPaymentObjectAccess({ colleagueId: 9 })).rejects.toMatchObject({
      code: 'STORAGE_ACCESS_DENIED',
    });
  });
});

describe('assertParticipantObjectAccess', () => {
  it('allows a bound colleague matching the participant', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });

    await expect(assertParticipantObjectAccess({ colleagueId: 3 })).resolves.toBeUndefined();
  });

  it('denies a bound colleague who is a different participant', async () => {
    mockGetAuthFromCookie.mockResolvedValue(colleagueSession(7));
    mockPrismaAccessCode.findUnique.mockResolvedValue({
      colleagueId: 3,
      isActive: true,
      deletedAt: null,
    });

    await expect(assertParticipantObjectAccess({ colleagueId: 9 })).rejects.toMatchObject({
      code: 'STORAGE_ACCESS_DENIED',
    });
  });
});
