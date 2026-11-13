import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

process.env.JWT_SECRET = 'test-secret';
process.env.TEST_ADMIN_ACCESS_CODE = 'admin-code-123';

// Mock createServerFn to return a chainable builder that runs validators
// before invoking the handler (mirrors the shared test helper).
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

const {
  mockVerify,
  mockSign,
  mockPrismaAccessCode,
  mockPrismaUser,
  mockCheckRateLimit,
  mockGetAuthFromCookie,
  mockRequireAdminFromCookie,
  mockSetAuthCookie,
  mockDeleteAuthCookie,
  mockLogAuditEvent,
  mockGetAuthAdapter,
  mockGetCookie,
  mockSetCookie,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockSign: vi.fn(),
  mockPrismaAccessCode: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaUser: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockCheckRateLimit: vi.fn(() => ({ allowed: true, remainingAttempts: 5 })),
  mockGetAuthFromCookie: vi.fn(),
  mockRequireAdminFromCookie: vi.fn(),
  mockSetAuthCookie: vi.fn(),
  mockDeleteAuthCookie: vi.fn(),
  mockLogAuditEvent: vi.fn().mockResolvedValue({}),
  mockGetAuthAdapter: vi.fn().mockResolvedValue({ signOut: vi.fn() }),
  mockGetCookie: vi.fn(),
  mockSetCookie: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: mockVerify,
    sign: mockSign,
  },
}));

// validateAccessCode dynamically imports the rate limiter from this server-only
// module; mock it so the hoisted mockCheckRateLimit drives the rate-limit branch.
vi.mock('@/server/infrastructure/auth/auth-rate-limit', () => ({
  checkAccessCodeRateLimit: mockCheckRateLimit,
}));

// OIDC state is carried in a short-lived httpOnly cookie; mock the cookie
// primitives so tests control the issued state per test.
vi.mock('@tanstack/start-server-core', () => ({
  getCookie: (...args: unknown[]) => mockGetCookie(...(args as [string])),
  setCookie: (...args: unknown[]) => mockSetCookie(...(args as [string, string])),
}));

const { mockInfraConfig, mockPrismaColleague } = vi.hoisted(() => ({
  mockInfraConfig: { authProvider: 'authentik' as string },
  mockPrismaColleague: { findUnique: vi.fn() },
}));
vi.mock('@/server/infrastructure/config', () => ({ infraConfig: mockInfraConfig }));

vi.mock('@/server/infrastructure/auth/auth-server-utils', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  return {
    validateTokenPayload: vi.fn((data: unknown) => data),
    getJwtExpiry: vi.fn(() => '30d'),
    getJwt: vi.fn(async () => jwt),
    getJwtSecret: vi.fn(() => 'test-secret'),
    hashIdentifier: vi.fn((identifier: string) => `hash:${identifier}`),
    verifyToken: vi.fn(async (token: string) => {
      try {
        return jwt.verify(token, 'test-secret');
      } catch {
        throw new Error('Invalid or expired token');
      }
    }),
  };
});

// Auth is now cookie-based: handlers resolve identity from the httpOnly cookie
// via these helpers, and set/delete the cookie server-side. Mock the module so
// tests drive auth state without a real request/cookie context.
vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: () => mockGetAuthFromCookie(),
  requireAdminFromCookie: () => mockRequireAdminFromCookie(),
  requireAuthFromCookie: () => mockRequireAdminFromCookie(),
  setAuthCookieServer: (token: string) => mockSetAuthCookie(token),
  deleteAuthCookieServer: () => mockDeleteAuthCookie(),
}));

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('@/server/infrastructure/auth/access-code-status', () => ({
  invalidateAccessCodeStatus: () => Promise.resolve(),
  isAccessCodeActive: () => Promise.resolve(true),
}));

vi.mock('@/server/infrastructure/auth', () => ({
  getAuthAdapter: () => mockGetAuthAdapter(),
}));

vi.mock('@/utils/errors', async () => {
  const { ErrorCode: EC } = await import('@/utils/errors');
  class MockAppError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'AppError';
      this.code = code;
    }
  }
  return {
    AppError: MockAppError,
    ErrorCode: EC,
    isAppError: vi.fn((error: unknown) => error instanceof MockAppError),
  };
});

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    accessCode: mockPrismaAccessCode,
    user: mockPrismaUser,
    colleague: mockPrismaColleague,
  },
}));

// Turnstile is enforced server-side when configured; mock the module so tests
// drive both states without calling Cloudflare.
const { mockIsTurnstileConfigured, mockValidateTurnstileToken } = vi.hoisted(() => ({
  mockIsTurnstileConfigured: vi.fn(() => false),
  mockValidateTurnstileToken: vi.fn(),
}));
vi.mock('./turnstile', () => ({
  isTurnstileConfigured: (...args: unknown[]) => mockIsTurnstileConfigured(...(args as [])),
  validateTurnstileToken: (...args: unknown[]) => mockValidateTurnstileToken(...(args as [never])),
}));

const { AppError, ErrorCode } = await import('@/utils/errors');

const adminPayload = {
  isAdmin: true,
  permissions: [],
  username: 'admin',
  accessCodeId: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true, remainingAttempts: 5 });
  mockSign.mockReturnValue('signed-jwt-token');
  // Default: Turnstile is not configured, so login skips verification.
  mockIsTurnstileConfigured.mockReturnValue(false);
  // Default: an admin is signed in via the httpOnly cookie.
  mockRequireAdminFromCookie.mockResolvedValue(adminPayload);
  mockGetAuthFromCookie.mockResolvedValue(adminPayload);
});

describe('isAccessCodeSuccess', () => {
  it('returns true for success result', async () => {
    const { isAccessCodeSuccess } = await import('./auth');
    expect(isAccessCodeSuccess({ valid: true, permissions: [], isAdmin: false })).toBe(true);
  });

  it('returns false for error result', async () => {
    const { isAccessCodeSuccess } = await import('./auth');
    expect(isAccessCodeSuccess({ valid: false, error: 'err' })).toBe(false);
  });
});

describe('isAuthentikCallbackSuccess', () => {
  it('returns true for success result', async () => {
    const { isAuthentikCallbackSuccess } = await import('./auth');
    expect(
      isAuthentikCallbackSuccess({
        valid: true,
        permissions: [],
        isAdmin: true,
        username: 'admin',
      })
    ).toBe(true);
  });

  it('returns false for error result', async () => {
    const { isAuthentikCallbackSuccess } = await import('./auth');
    expect(isAuthentikCallbackSuccess({ valid: false, error: 'err' })).toBe(false);
  });
});

describe('validateAccessCode', () => {
  it('returns error when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, blockedForMs: 120000 } as never);
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'test' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Too many failed attempts/);
  });

  it('returns error for singular minute message', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, blockedForMs: 60000 } as never);
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'test' } })) as Record<
      string,
      unknown
    >;
    expect(result.error).toMatch(/1 minute\b/);
  });

  it('returns error when rate limited without blockedForMs', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false } as never);
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'test' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/0 minutes/);
  });

  it('returns error for invalid access code', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue(null);
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'test' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid or inactive access code');
  });

  it('hashes the code in rate-limit audit details instead of logging it raw', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, blockedForMs: 60000 } as never);
    const { validateAccessCode } = await import('./auth');
    await validateAccessCode({ data: { code: 'secret-code' } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.failed',
        details: expect.objectContaining({ codeHash: 'hash:secret-code' }),
      })
    );
    const details = vi.mocked(mockLogAuditEvent).mock.calls[0]?.[0] as {
      details?: Record<string, unknown>;
    };
    expect(details.details).not.toHaveProperty('code');
  });

  it('sets the httpOnly cookie and returns admin identity for admin access code', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue({ id: 1, code: 'admin-code-123' });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 1 });
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'admin-code-123' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.permissions).toEqual(['view', 'create', 'edit', 'delete']);
    // Token is set server-side in the httpOnly cookie, never returned to client.
    expect(mockSetAuthCookie).toHaveBeenCalledWith('signed-jwt-token');
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lastUsed: expect.any(Date) },
    });
  });

  it('returns view-only permissions for regular code', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue({ id: 2, code: 'user-code' });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 2 });
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'user-code' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.permissions).toEqual(['view']);
    expect(mockSetAuthCookie).toHaveBeenCalledWith('signed-jwt-token');
  });

  it('returns generic error on exception', async () => {
    mockPrismaAccessCode.findFirst.mockRejectedValue(new Error('db error'));
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'any' } })) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Failed to validate access code');
  });
});

describe('validateAccessCode turnstile enforcement', () => {
  it('rejects when configured and no token is provided', async () => {
    mockIsTurnstileConfigured.mockReturnValue(true);
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'test' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Security verification is required/);
    expect(mockValidateTurnstileToken).not.toHaveBeenCalled();
    expect(mockPrismaAccessCode.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when Cloudflare rejects the token', async () => {
    mockIsTurnstileConfigured.mockReturnValue(true);
    mockValidateTurnstileToken.mockResolvedValue({ success: false, errorCodes: ['bad'] });
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({
      data: { code: 'test', turnstileToken: 'bad-token' },
    })) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Security verification failed/);
    expect(mockPrismaAccessCode.findFirst).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ reason: 'turnstile_rejected' }),
      })
    );
  });

  it('proceeds to the code lookup when Cloudflare accepts the token', async () => {
    mockIsTurnstileConfigured.mockReturnValue(true);
    mockValidateTurnstileToken.mockResolvedValue({ success: true, errorCodes: [] });
    mockPrismaAccessCode.findFirst.mockResolvedValue({ id: 2, code: 'user-code' });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 2 });
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({
      data: { code: 'user-code', turnstileToken: 'good-token' },
    })) as Record<string, unknown>;
    expect(result.valid).toBe(true);
    expect(mockValidateTurnstileToken).toHaveBeenCalledWith({
      data: { token: 'good-token' },
    });
    expect(mockPrismaAccessCode.findFirst).toHaveBeenCalled();
  });

  it('fails closed when verification throws', async () => {
    mockIsTurnstileConfigured.mockReturnValue(true);
    mockValidateTurnstileToken.mockRejectedValue(new Error('cloudflare unreachable'));
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({
      data: { code: 'test', turnstileToken: 'token' },
    })) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Failed to validate access code');
  });

  it('skips verification when Turnstile is not configured', async () => {
    mockIsTurnstileConfigured.mockReturnValue(false);
    mockPrismaAccessCode.findFirst.mockResolvedValue({ id: 2, code: 'user-code' });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 2 });
    const { validateAccessCode } = await import('./auth');
    const result = (await validateAccessCode({ data: { code: 'user-code' } })) as Record<
      string,
      unknown
    >;
    expect(result.valid).toBe(true);
    expect(mockValidateTurnstileToken).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('clears the httpOnly auth cookie and returns success', async () => {
    const { logout } = await import('./auth');
    const result = (await logout({ data: undefined })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(mockDeleteAuthCookie).toHaveBeenCalledTimes(1);
  });
});

describe('getAuthentikAuthUrl', () => {
  it('returns auth URL with state stored in an httpOnly cookie', async () => {
    const { getAuthentikAuthUrl } = await import('./auth');
    const result = (await getAuthentikAuthUrl({ data: undefined })) as Record<string, unknown>;
    expect(result.authUrl).toContain('/application/o/authorize/');
    expect(result.state).toBeDefined();
    expect(typeof result.state).toBe('string');
    expect(mockSetCookie).toHaveBeenCalledWith(
      'debt-master-oidc-state',
      result.state,
      expect.objectContaining({ httpOnly: true })
    );
  });
});

describe('createAccessCode', () => {
  it('creates code for admin user', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue(null);
    mockPrismaAccessCode.create.mockResolvedValue({
      id: 10,
      code: 'new-code',
      isActive: true,
      createdAt: new Date(),
    });
    const { createAccessCode } = await import('./auth');
    const result = (await createAccessCode({
      data: { code: 'new-code' },
    })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'new-code', createdBy: 'admin' },
      })
    );
  });

  it('creates code with unknown creator when admin username is missing', async () => {
    mockRequireAdminFromCookie.mockResolvedValueOnce({
      isAdmin: true,
      permissions: [],
      username: undefined,
    });
    mockPrismaAccessCode.findFirst.mockResolvedValue(null);
    mockPrismaAccessCode.create.mockResolvedValue({
      id: 11,
      code: 'no-name-code',
      isActive: true,
      createdAt: new Date(),
    });

    const { createAccessCode } = await import('./auth');
    await createAccessCode({ data: { code: 'no-name-code' } });

    expect(mockPrismaAccessCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'no-name-code', createdBy: 'unknown' },
      })
    );
  });

  it('throws on duplicate code', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue({ id: 5, code: 'existing' });
    const { createAccessCode } = await import('./auth');
    await expect(createAccessCode({ data: { code: 'existing' } })).rejects.toThrow(
      'Access code already exists'
    );
  });

  it('throws for non-admin user', async () => {
    mockRequireAdminFromCookie.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );
    const { createAccessCode } = await import('./auth');
    await expect(createAccessCode({ data: { code: 'code' } })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('getAccessCodes', () => {
  it('returns list for admin', async () => {
    mockPrismaAccessCode.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'A',
        isActive: true,
        createdAt: new Date(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ]);
    const { getAccessCodes } = await import('./auth');
    const result = (await getAccessCodes()) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('A');
  });

  it('falls back to null when createdBy is missing', async () => {
    mockPrismaAccessCode.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'A',
        isActive: true,
        createdAt: new Date(),
        lastUsed: null,
        createdBy: undefined,
      },
    ]);
    const { getAccessCodes } = await import('./auth');
    const result = (await getAccessCodes()) as Record<string, unknown>[];
    expect(result[0]!.createdBy).toBeNull();
  });

  it('throws for non-admin', async () => {
    mockRequireAdminFromCookie.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );
    const { getAccessCodes } = await import('./auth');
    await expect(getAccessCodes()).rejects.toThrow();
  });
});

describe('deactivateAccessCode', () => {
  it('deactivates for admin', async () => {
    mockPrismaAccessCode.update.mockResolvedValue({ id: 1, code: 'A', isActive: false });
    const { deactivateAccessCode } = await import('./auth');
    const result = (await deactivateAccessCode({
      data: { id: 1 },
    })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
  });

  it('logs unknown userId when admin username is missing', async () => {
    mockRequireAdminFromCookie.mockResolvedValueOnce({
      isAdmin: true,
      permissions: [],
      username: undefined,
    });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 1, code: 'A', isActive: false });

    const { deactivateAccessCode } = await import('./auth');
    await deactivateAccessCode({ data: { id: 1 } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.deactivated',
        userId: 'unknown',
      })
    );
  });

  it('throws for non-admin', async () => {
    mockRequireAdminFromCookie.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );
    const { deactivateAccessCode } = await import('./auth');
    await expect(deactivateAccessCode({ data: { id: 1 } })).rejects.toThrow();
  });
});

describe('reactivateAccessCode', () => {
  it('reactivates for admin', async () => {
    mockPrismaAccessCode.update.mockResolvedValue({ id: 1, code: 'A', isActive: true });
    const { reactivateAccessCode } = await import('./auth');
    const result = (await reactivateAccessCode({
      data: { id: 1 },
    })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    });
  });

  it('logs unknown userId when admin username is missing', async () => {
    mockRequireAdminFromCookie.mockResolvedValueOnce({
      isAdmin: true,
      permissions: [],
      username: undefined,
    });
    mockPrismaAccessCode.update.mockResolvedValue({ id: 1, code: 'A', isActive: true });

    const { reactivateAccessCode } = await import('./auth');
    await reactivateAccessCode({ data: { id: 1 } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.reactivated',
        userId: 'unknown',
      })
    );
  });
});

describe('deleteAccessCode', () => {
  it('soft-deletes for admin', async () => {
    mockPrismaAccessCode.update.mockResolvedValue({
      id: 1,
      code: 'A',
      isActive: false,
    });
    const { deleteAccessCode } = await import('./auth');
    const result = (await deleteAccessCode({
      data: { id: 1 },
    })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false, deletedAt: expect.any(Date) },
    });
  });

  it('logs unknown userId when admin username is missing', async () => {
    mockRequireAdminFromCookie.mockResolvedValueOnce({
      isAdmin: true,
      permissions: [],
      username: undefined,
    });
    mockPrismaAccessCode.update.mockResolvedValue({
      id: 1,
      code: 'A',
      isActive: false,
    });

    const { deleteAccessCode } = await import('./auth');
    await deleteAccessCode({ data: { id: 1 } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.deleted',
        userId: 'unknown',
      })
    );
  });

  it('throws for non-admin', async () => {
    mockRequireAdminFromCookie.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );
    const { deleteAccessCode } = await import('./auth');
    await expect(deleteAccessCode({ data: { id: 1 } })).rejects.toThrow();
  });
});

describe('handleAuthentikCallback', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    // The callback verifies the OAuth state against the cookie issued with
    // the authorization URL; default to a matching state.
    mockGetCookie.mockReturnValue('state');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success after token exchange and user creation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'authentik-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferred_username: 'newadmin' }),
      });

    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockPrismaUser.create.mockResolvedValue({ id: 1, username: 'newadmin', isAdmin: true });
    mockPrismaUser.update.mockResolvedValue({ id: 1, username: 'newadmin', isAdmin: true });
    mockSign.mockReturnValue('internal-jwt');

    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(true);
    expect(result.username).toBe('newadmin');
    // Token is set in the httpOnly cookie server-side, not returned to the client.
    expect(mockSetAuthCookie).toHaveBeenCalledWith('internal-jwt');
    expect(mockPrismaUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'newadmin', isAdmin: true }),
      })
    );
  });

  it('refuses to escalate an existing non-admin user to admin', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'authentik-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferred_username: 'existing' }),
      });

    mockPrismaUser.findUnique.mockResolvedValue({ id: 2, username: 'existing', isAdmin: false });
    mockSign.mockReturnValue('internal-jwt');

    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/does not have admin access/);
    // The colleague row must not be promoted, and no admin session is issued.
    expect(mockPrismaUser.update).not.toHaveBeenCalled();
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login_refused' })
    );
  });

  it('rejects the callback when the state does not match the issued cookie', async () => {
    mockGetCookie.mockReturnValue('issued-state');
    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'forged-state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid or expired login attempt/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects the callback when AUTH_PROVIDER is not authentik', async () => {
    mockInfraConfig.authProvider = 'better-auth';
    try {
      const { handleAuthentikCallback } = await import('./auth');
      const result = (await handleAuthentikCallback({
        data: { code: 'auth-code', state: 'state' },
      })) as Record<string, unknown>;

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not enabled/);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      mockInfraConfig.authProvider = 'authentik';
    }
  });

  it('returns error when token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Failed to authenticate with Authentik/);
  });

  it('returns error when userinfo fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'authentik-token' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(false);
  });

  it('returns error when an exception is thrown', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const { handleAuthentikCallback } = await import('./auth');
    const result = (await handleAuthentikCallback({
      data: { code: 'auth-code', state: 'state' },
    })) as Record<string, unknown>;

    expect(result.valid).toBe(false);
  });
});

describe('createAccessCode error branch', () => {
  it('returns infrastructure error on unexpected exception', async () => {
    mockPrismaAccessCode.findFirst.mockRejectedValue(new Error('db down'));

    const { createAccessCode } = await import('./auth');
    await expect(createAccessCode({ data: { code: 'code' } })).rejects.toThrow(
      'Failed to create access code'
    );
  });
});

describe('getAccessCodes error branch', () => {
  it('returns infrastructure error on unexpected exception', async () => {
    mockPrismaAccessCode.findMany.mockRejectedValue(new Error('db down'));

    const { getAccessCodes } = await import('./auth');
    await expect(getAccessCodes()).rejects.toThrow('Failed to fetch access codes');
  });
});

describe('deactivateAccessCode error branch', () => {
  it('returns infrastructure error on unexpected exception', async () => {
    mockPrismaAccessCode.update.mockRejectedValue(new Error('db down'));

    const { deactivateAccessCode } = await import('./auth');
    await expect(deactivateAccessCode({ data: { id: 1 } })).rejects.toThrow(
      'Failed to deactivate access code'
    );
  });
});

describe('reactivateAccessCode error branch', () => {
  it('returns infrastructure error on unexpected exception', async () => {
    mockPrismaAccessCode.update.mockRejectedValue(new Error('db down'));

    const { reactivateAccessCode } = await import('./auth');
    await expect(reactivateAccessCode({ data: { id: 1 } })).rejects.toThrow(
      'Failed to reactivate access code'
    );
  });
});

describe('logout', () => {
  it('logs admin.logout and clears cookie for admin identity', async () => {
    mockGetAuthFromCookie.mockResolvedValue({
      isAdmin: true,
      username: 'admin',
      permissions: ['view'],
    });
    const signOut = vi.fn();
    mockGetAuthAdapter.mockResolvedValue({ signOut });

    const { logout } = await import('./auth');
    const result = (await logout({ data: undefined })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(signOut).toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.logout',
      userId: 'admin',
      details: {},
    });
    expect(mockDeleteAuthCookie).toHaveBeenCalled();
  });

  it('does not log admin.logout when identity is null', async () => {
    mockGetAuthFromCookie.mockResolvedValue(null);

    const { logout } = await import('./auth');
    await logout({ data: undefined });

    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockDeleteAuthCookie).toHaveBeenCalled();
  });

  it('does not log admin.logout for non-admin identity', async () => {
    mockGetAuthFromCookie.mockResolvedValue({
      isAdmin: false,
      username: 'user',
      permissions: ['view'],
      accessCodeId: 1,
    });

    const { logout } = await import('./auth');
    await logout({ data: undefined });

    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('does not log admin.logout when admin username is missing', async () => {
    mockGetAuthFromCookie.mockResolvedValue({
      isAdmin: true,
      username: undefined,
      permissions: ['view'],
    });

    const { logout } = await import('./auth');
    await logout({ data: undefined });

    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockDeleteAuthCookie).toHaveBeenCalled();
  });

  it('still clears cookie when signOut throws', async () => {
    mockGetAuthFromCookie.mockResolvedValue({
      isAdmin: true,
      username: 'admin',
      permissions: ['view'],
    });
    mockGetAuthAdapter.mockResolvedValue({
      signOut: vi.fn().mockRejectedValue(new Error('sign out failed')),
    });

    const { logout } = await import('./auth');
    const result = (await logout({ data: undefined })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(mockDeleteAuthCookie).toHaveBeenCalled();
  });
});

describe('getCurrentUserFromCookie', () => {
  it('returns null when no cookie identity', async () => {
    mockGetAuthFromCookie.mockResolvedValue(null);

    const { getCurrentUserFromCookie } = await import('./auth');
    const result = await getCurrentUserFromCookie({ data: undefined });

    expect(result).toBeNull();
  });

  it('maps username and accessCodeId with defaults', async () => {
    mockGetAuthFromCookie.mockResolvedValue({
      isAdmin: false,
      permissions: ['view'],
      username: undefined,
      accessCodeId: undefined,
    });

    const { getCurrentUserFromCookie } = await import('./auth');
    const result = await getCurrentUserFromCookie({ data: undefined });

    expect(result).toEqual({
      isAdmin: false,
      permissions: ['view'],
      username: null,
      accessCodeId: null,
    });
  });
});

describe('handleAuthentikCallback audit details', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockGetCookie.mockReturnValue('state');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes email in audit details when provided', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'authentik-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferred_username: 'admin-email',
          email: 'admin@example.com',
        }),
      });

    mockPrismaUser.findUnique.mockResolvedValue({
      id: 1,
      username: 'admin-email',
      isAdmin: true,
    });
    mockSign.mockReturnValue('internal-jwt');

    const { handleAuthentikCallback } = await import('./auth');
    await handleAuthentikCallback({ data: { code: 'auth-code', state: 'state' } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login',
        details: expect.objectContaining({ provider: 'authentik', email: 'admin@example.com' }),
      })
    );
  });
});

describe('createAccessCode audit logging', () => {
  it('logs access_code.created with admin and code details', async () => {
    mockPrismaAccessCode.findFirst.mockResolvedValue(null);
    mockPrismaAccessCode.create.mockResolvedValue({
      id: 10,
      code: 'new-code',
      isActive: true,
      createdAt: new Date(),
    });

    const { createAccessCode } = await import('./auth');
    await createAccessCode({ data: { code: 'new-code' } });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.created',
        userId: 'admin',
        // The raw code is deliberately not logged; the id identifies the row.
        details: { codeId: 10 },
      })
    );
  });
});

describe('assignAccessCodeColleague', () => {
  it('binds a colleague and audits the assignment', async () => {
    mockPrismaColleague.findUnique.mockResolvedValue({ id: 3 });
    mockPrismaAccessCode.update.mockResolvedValue({
      id: 10,
      code: 'new-code',
      isActive: true,
      colleagueId: 3,
    });
    const { assignAccessCodeColleague } = await import('./auth');

    const result = (await assignAccessCodeColleague({
      data: { id: 10, colleagueId: 3 },
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { colleagueId: 3 },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.colleague_assigned',
        details: { codeId: 10, colleagueId: 3 },
      })
    );
  });

  it('refuses an unknown colleague id', async () => {
    mockPrismaColleague.findUnique.mockResolvedValue(null);
    const { assignAccessCodeColleague } = await import('./auth');

    await expect(
      assignAccessCodeColleague({ data: { id: 10, colleagueId: 99 } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND_COLLEAGUE' });
    expect(mockPrismaAccessCode.update).not.toHaveBeenCalled();
  });

  it('unbinding writes null and audits the unbound flag', async () => {
    mockPrismaAccessCode.update.mockResolvedValue({
      id: 10,
      code: 'new-code',
      isActive: true,
      colleagueId: null,
    });
    const { assignAccessCodeColleague } = await import('./auth');

    const result = (await assignAccessCodeColleague({
      data: { id: 10, colleagueId: null },
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(mockPrismaAccessCode.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { colleagueId: null },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ unbound: true }),
      })
    );
  });

  it('falls back to an unknown actor when the admin payload has no username', async () => {
    mockRequireAdminFromCookie.mockResolvedValue({
      isAdmin: true,
      permissions: [],
      username: undefined,
    });
    mockPrismaColleague.findUnique.mockResolvedValue({ id: 3 });
    mockPrismaAccessCode.update.mockResolvedValue({
      id: 10,
      code: 'new-code',
      isActive: true,
      colleagueId: 3,
    });
    const { assignAccessCodeColleague } = await import('./auth');

    const result = (await assignAccessCodeColleague({
      data: { id: 10, colleagueId: 3 },
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_code.colleague_assigned',
        userId: 'unknown',
      })
    );
  });

  it('wraps unexpected database failures in an infrastructure error', async () => {
    mockPrismaColleague.findUnique.mockResolvedValue({ id: 3 });
    mockPrismaAccessCode.update.mockRejectedValue(new Error('db down'));
    const { assignAccessCodeColleague } = await import('./auth');

    await expect(assignAccessCodeColleague({ data: { id: 10, colleagueId: 3 } })).rejects.toThrow(
      'Failed to assign colleague to access code'
    );
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});

describe('getAuthProvider', () => {
  it('returns the configured auth provider', async () => {
    const { getAuthProvider } = await import('./auth');
    const result = await getAuthProvider({ data: undefined });

    expect(['authentik', 'better-auth']).toContain(result);
  });
});

describe('deleteAccessCode error branch', () => {
  it('returns infrastructure error on unexpected exception', async () => {
    mockPrismaAccessCode.update.mockRejectedValue(new Error('db down'));

    const { deleteAccessCode } = await import('./auth');
    await expect(deleteAccessCode({ data: { id: 1 } })).rejects.toThrow(
      'Failed to delete access code'
    );
  });
});

describe('reactivateAccessCode non-admin rejection', () => {
  it('throws for non-admin user', async () => {
    mockRequireAdminFromCookie.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );

    const { reactivateAccessCode } = await import('./auth');
    await expect(reactivateAccessCode({ data: { id: 1 } })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('shouldAuditAdminLogout', () => {
  it('returns true for admin with username', async () => {
    const { shouldAuditAdminLogout } = await import('./auth');
    expect(shouldAuditAdminLogout({ isAdmin: true, username: 'admin' })).toBe(true);
  });

  it('returns false when identity is null', async () => {
    const { shouldAuditAdminLogout } = await import('./auth');
    expect(shouldAuditAdminLogout(null)).toBe(false);
  });

  it('returns false for non-admin', async () => {
    const { shouldAuditAdminLogout } = await import('./auth');
    expect(shouldAuditAdminLogout({ isAdmin: false, username: 'user' })).toBe(false);
  });

  it('returns false when admin username is missing', async () => {
    const { shouldAuditAdminLogout } = await import('./auth');
    expect(shouldAuditAdminLogout({ isAdmin: true, username: undefined })).toBe(false);
  });
});

describe('maybeLogAdminLogout', () => {
  it('logs for admin identity', async () => {
    const { maybeLogAdminLogout } = await import('./auth');
    await maybeLogAdminLogout({ isAdmin: true, username: 'admin' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.logout',
      userId: 'admin',
      details: {},
    });
  });

  it('skips logging for non-admin identity', async () => {
    mockLogAuditEvent.mockClear();
    const { maybeLogAdminLogout } = await import('./auth');
    await maybeLogAdminLogout({ isAdmin: false, username: 'user' });
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
