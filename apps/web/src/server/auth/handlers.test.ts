import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/infrastructure/prisma';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

// Handlers resolve identity from the httpOnly auth cookie (no client token).
// Stub the cookie layer so handlers run their real logic without a request
// context; setAuthCookieServer/deleteAuthCookieServer become no-ops because
// setCookie/getCookie are not exported by the tanstack mock above.
vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAdminFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
  setAuthCookieServer: vi.fn(),
  deleteAuthCookieServer: vi.fn(),
}));

// Admin payload returned by requireAdminFromCookie when the cookie resolves an
// admin session. Handlers trust this (the real check lives in the cookie util).
const adminPayload = {
  isAdmin: true,
  permissions: ['view', 'create', 'edit', 'delete'],
  username: 'adminuser',
};

const itIfEnabled = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

beforeAll(() => {
  // validateAccessCode signs the JWT using getJwtSecret(), which reads this env.
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  vi.resetAllMocks();
});

async function cleanupDatabase() {
  await prisma.paymentApplication.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.expenseParticipant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.colleague.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.accessCode.deleteMany();
  await prisma.user.deleteMany();
}

describe('auth handlers integration', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  itIfEnabled('validateAccessCode returns success for valid code', async () => {
    const { validateAccessCode } = await import('../auth');

    await prisma.accessCode.create({
      data: { code: 'test1234' },
    });

    const result = await validateAccessCode({ data: { code: 'test1234' } });

    // Token is now set in the httpOnly cookie (setAuthCookieServer), not
    // returned in the response body.
    expect(result).toMatchObject({
      valid: true,
      permissions: expect.any(Array),
      isAdmin: false,
    });
  });

  itIfEnabled('validateAccessCode returns error for invalid code', async () => {
    const { validateAccessCode } = await import('../auth');

    const result = await validateAccessCode({ data: { code: 'nonexistent' } });

    expect(result).toEqual({
      valid: false,
      error: 'Invalid or inactive access code',
    });
  });

  itIfEnabled('logout returns success', async () => {
    const { logout } = await import('../auth');

    const result = await logout({ data: undefined });

    expect(result).toEqual({ success: true });
  });

  itIfEnabled('createAccessCode creates access code with admin session', async () => {
    const { createAccessCode } = await import('../auth');
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAdminFromCookie).mockResolvedValue(adminPayload);

    const result = await createAccessCode({
      data: { code: 'newcode' },
    });

    expect(result).toMatchObject({
      success: true,
      accessCode: {
        code: 'newcode',
        isActive: true,
      },
    });

    const dbRecord = await prisma.accessCode.findFirst({
      where: { code: 'newcode' },
    });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.code).toBe('newcode');
    expect(dbRecord?.createdBy).toBe('adminuser');
  });
});
