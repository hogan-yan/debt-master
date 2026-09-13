import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const {
  mockGetSession,
  mockChangePassword,
  mockListSessions,
  mockRevokeSession,
  mockLogAuditEvent,
  mockRequireAdminFromCookie,
  mockGetRequestHeader,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockChangePassword: vi.fn(),
  mockListSessions: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockRequireAdminFromCookie: vi.fn(),
  mockGetRequestHeader: vi.fn(),
}));

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: (name: string) => mockGetRequestHeader(name),
}));

vi.mock('@/server/infrastructure/auth/better-auth-instance', () => {
  const instance = {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      changePassword: (...args: unknown[]) => mockChangePassword(...args),
      listSessions: (...args: unknown[]) => mockListSessions(...args),
      revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
    },
  };
  return { getAuth: () => instance };
});

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: () => mockRequireAdminFromCookie(),
}));

const { changeAdminPassword, getAdminSessions, revokeAdminSession } = await import(
  '@/server/admin-security'
);

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireAdminFromCookie.mockResolvedValue({
    isAdmin: true,
    username: 'admin-user-1',
    permissions: [],
  });
  mockGetRequestHeader.mockReturnValue('debt-master-auth=token; better-auth-session=sess');
  mockGetSession.mockResolvedValue({
    user: { id: 'admin-user-1' },
    session: { token: 'current-token' },
  });
  mockChangePassword.mockResolvedValue(undefined);
  mockListSessions.mockResolvedValue([]);
  mockRevokeSession.mockResolvedValue(undefined);
  mockLogAuditEvent.mockResolvedValue(undefined);
});

describe('changeAdminPassword', () => {
  const validInput = {
    currentPassword: 'OldStr0ng!Pass',
    newPassword: 'NewStr0ng!Pass',
  };

  it('changes password and logs the event', async () => {
    const result = await changeAdminPassword({ data: validInput });

    expect(result).toEqual({ success: true });
    expect(mockChangePassword).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: {
        currentPassword: validInput.currentPassword,
        newPassword: validInput.newPassword,
        revokeOtherSessions: false,
      },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.password_changed',
      userId: 'admin-user-1',
      details: { source: 'security_panel' },
    });
  });

  it('rejects a weak new password', async () => {
    await expect(
      changeAdminPassword({ data: { currentPassword: 'old', newPassword: 'weak' } })
    ).rejects.toThrow(/Password does not meet the policy/i);

    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('falls back to unknown username when admin has no username', async () => {
    mockRequireAdminFromCookie.mockResolvedValue({
      isAdmin: true,
      username: undefined,
      permissions: [],
    });

    const result = await changeAdminPassword({ data: validInput });

    expect(result).toEqual({ success: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.password_changed',
      userId: 'unknown',
      details: { source: 'security_panel' },
    });
  });

  it('works when the request has no cookie header', async () => {
    mockGetRequestHeader.mockReturnValue(undefined);

    const result = await changeAdminPassword({ data: validInput });

    expect(result).toEqual({ success: true });
    expect(mockChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({}) })
    );
  });

  it('surfaces Better Auth errors', async () => {
    mockChangePassword.mockRejectedValue(new Error('current password is incorrect'));

    await expect(changeAdminPassword({ data: validInput })).rejects.toThrow(
      'current password is incorrect'
    );
  });
});

describe('getAdminSessions', () => {
  it('returns parsed sessions with current flag on first entry', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    mockListSessions.mockResolvedValue([
      {
        token: 'current-token',
        id: 'session-1',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        createdAt: now,
        expiresAt: later,
      },
      {
        token: 'other-token',
        id: 'session-2',
        userAgent: 'Chrome/1.0',
        ipAddress: '10.0.0.1',
        createdAt: now,
        expiresAt: later,
      },
    ]);

    const result = await getAdminSessions();

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]).toMatchObject({
      token: 'current-token',
      isCurrent: true,
    });
    expect(result.sessions[1]).toMatchObject({
      token: 'other-token',
      isCurrent: false,
    });
  });

  it('returns empty array when Better Auth has no sessions', async () => {
    mockListSessions.mockResolvedValue([]);

    const result = await getAdminSessions();

    expect(result.sessions).toEqual([]);
  });

  it('filters out malformed session entries', async () => {
    mockListSessions.mockResolvedValue([{ token: 123 }, null, { token: 'valid-token' }]);

    const result = await getAdminSessions();

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.token).toBe('valid-token');
  });

  it('falls back to no current token when getSession returns null', async () => {
    mockGetSession.mockResolvedValue(null);
    mockListSessions.mockResolvedValue([
      {
        token: 'only-token',
        id: 'session-1',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    const result = await getAdminSessions();

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ token: 'only-token', isCurrent: false });
  });

  it('extracts the current token from a direct session object', async () => {
    mockGetSession.mockResolvedValue({ token: 'direct-token' });
    mockListSessions.mockResolvedValue([{ token: 'direct-token' }]);

    await expect(getAdminSessions()).resolves.toEqual({
      sessions: [
        {
          token: 'direct-token',
          id: '',
          userAgent: null,
          ipAddress: null,
          createdAt: '',
          expiresAt: '',
          isCurrent: true,
        },
      ],
    });
  });

  it('does not mark sessions current when the returned token is not a string', async () => {
    mockGetSession.mockResolvedValue({ session: { token: 42 } });
    mockListSessions.mockResolvedValue([{ token: 'session-token' }]);

    await expect(getAdminSessions()).resolves.toEqual({
      sessions: [
        {
          token: 'session-token',
          id: '',
          userAgent: null,
          ipAddress: null,
          createdAt: '',
          expiresAt: '',
          isCurrent: false,
        },
      ],
    });
  });

  it('parses nested current sessions and malformed session values', async () => {
    mockGetSession.mockResolvedValue({ session: { token: 'nested-token' } });
    mockListSessions.mockResolvedValue([
      {
        token: 'nested-token',
        id: 123,
        userAgent: null,
        ipAddress: null,
        createdAt: '2026-01-01',
        expiresAt: undefined,
      },
      'invalid',
    ]);

    const result = await getAdminSessions();

    expect(result.sessions).toEqual([
      {
        token: 'nested-token',
        id: '',
        userAgent: null,
        ipAddress: null,
        createdAt: '2026-01-01',
        expiresAt: '',
        isCurrent: true,
      },
    ]);
  });

  it('returns no sessions when Better Auth returns a non-array value', async () => {
    mockListSessions.mockResolvedValue({ sessions: [] });

    await expect(getAdminSessions()).resolves.toEqual({ sessions: [] });
  });
});

describe('revokeAdminSession', () => {
  it('revokes the session and logs the event', async () => {
    const result = await revokeAdminSession({ data: { sessionToken: 'other-token' } });

    expect(result).toEqual({ success: true });
    expect(mockRevokeSession).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: { token: 'other-token' },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.session_revoked',
      userId: 'admin-user-1',
      details: { sessionToken: 'other-token' },
    });
  });

  it('falls back to unknown username when admin has no username', async () => {
    mockRequireAdminFromCookie.mockResolvedValue({
      isAdmin: true,
      username: undefined,
      permissions: [],
    });

    const result = await revokeAdminSession({ data: { sessionToken: 'other-token' } });

    expect(result).toEqual({ success: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.session_revoked',
      userId: 'unknown',
      details: { sessionToken: 'other-token' },
    });
  });
});
