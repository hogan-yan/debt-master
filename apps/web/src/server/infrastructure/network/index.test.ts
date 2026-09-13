import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestHeader = vi.hoisted(() => vi.fn());
const mockGetRequestIP = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: (name: string) => mockGetRequestHeader(name),
  getRequestIP: () => mockGetRequestIP(),
}));

const { getRequestClientIp, isLocalSetupAllowed, isPrivateOrLoopbackIp } = await import('./index');

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe('isPrivateOrLoopbackIp', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.0.0.5', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['0.0.0.0', true],
    ['::1', true],
    ['fe80::1', true],
    ['fd12:3456::1', true],
    ['2001:4860:4860::8888', false],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['::ffff:192.168.0.1', true],
    ['', false],
    ['not-an-ip', false],
  ])('classifies %s as %s', (ip, expected) => {
    expect(isPrivateOrLoopbackIp(ip)).toBe(expected);
  });
});

describe('getRequestClientIp', () => {
  it('returns null when request headers are unavailable outside the server runtime', async () => {
    mockGetRequestHeader.mockImplementation(() => {
      throw new Error('No request event');
    });

    expect(await getRequestClientIp()).toBeNull();
  });

  it('takes the rightmost x-forwarded-for hop (proxy-attested), ignoring spoofed leftmost entries', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7, 10.0.0.1' : null
    );
    expect(await getRequestClientIp()).toBe('10.0.0.1');
  });

  it('steps back TRUSTED_PROXY_HOPS when several internal proxies append', async () => {
    // 4 entries, last 2 added by trusted internal proxies → the client is
    // the entry just before them.
    process.env.TRUSTED_PROXY_HOPS = '2';
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7, 198.51.100.9, 10.0.0.1, 10.0.0.2' : null
    );
    expect(await getRequestClientIp()).toBe('10.0.0.1');
  });

  it('trusts the whole header when fewer entries than trusted proxy hops (proxy-built header)', async () => {
    process.env.TRUSTED_PROXY_HOPS = '3';
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7' : null
    );
    expect(await getRequestClientIp()).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-real-ip' ? '198.51.100.4' : null
    );
    expect(await getRequestClientIp()).toBe('198.51.100.4');
  });

  it('uses the rightmost non-empty x-forwarded-for entry even with a leading blank hop', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? ' , 203.0.113.7' : '198.51.100.4'
    );
    // Under the rightmost-hop trust model the only non-empty entry is
    // proxy-attested, so XFF wins over x-real-ip.
    expect(await getRequestClientIp()).toBe('203.0.113.7');
  });

  it('ignores an x-forwarded-for header made only of blank hops and falls through', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? ' , ' : null
    );
    mockGetRequestIP.mockReturnValue('192.168.1.9');

    // Every XFF hop is blank, so the header yields no trusted entry and the
    // resolver falls back to the socket peer.
    expect(await getRequestClientIp()).toBe('192.168.1.9');
  });

  it('falls back to the socket peer IP when no proxy header is present (direct access)', async () => {
    mockGetRequestHeader.mockReturnValue(null);
    mockGetRequestIP.mockReturnValue('192.168.1.5');
    expect(await getRequestClientIp()).toBe('192.168.1.5');
  });

  it('returns null when no proxy header and no socket IP are available', async () => {
    mockGetRequestHeader.mockReturnValue(null);
    mockGetRequestIP.mockReturnValue(undefined);
    expect(await getRequestClientIp()).toBeNull();
  });
});

describe('isPrivateOrLoopbackIp defensive IPv4 parsing', () => {
  it('rejects a malformed IPv4 address with a non-numeric octet', () => {
    expect(isPrivateOrLoopbackIp('1.foo.1.1')).toBe(false);
  });

  it('rejects an IPv4 result without its first octet', () => {
    const originalSplit = String.prototype.split;
    const split = vi.spyOn(String.prototype, 'split').mockImplementation(function (
      this: string,
      splitter: { [Symbol.split](value: string, limit?: number): string[] },
      limit?: number
    ) {
      if (this.valueOf() === '1.1.1.1' && String(splitter) === '.') {
        return [undefined, '1', '1', '1'] as unknown as string[];
      }
      return originalSplit.call(this, splitter, limit);
    });
    const originalParseInteger = Number.parseInt;
    const parseInteger = vi
      .spyOn(Number, 'parseInt')
      .mockImplementation((value, radix) =>
        value === undefined ? (undefined as never) : originalParseInteger(value, radix)
      );

    expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);

    parseInteger.mockRestore();
    split.mockRestore();
  });

  it('rejects an IPv4 result without its second octet', () => {
    const originalSplit = String.prototype.split;
    const split = vi.spyOn(String.prototype, 'split').mockImplementation(function (
      this: string,
      splitter: { [Symbol.split](value: string, limit?: number): string[] },
      limit?: number
    ) {
      if (this.valueOf() === '1.1.1.1' && String(splitter) === '.') {
        return ['1', undefined, '1', '1'] as unknown as string[];
      }
      return originalSplit.call(this, splitter, limit);
    });

    expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);

    split.mockRestore();
  });

  it('rejects an IPv4 result without its second octet after a defined first octet', () => {
    const originalSplit = String.prototype.split;
    const split = vi.spyOn(String.prototype, 'split').mockImplementation(function (
      this: string,
      splitter: { [Symbol.split](value: string, limit?: number): string[] },
      limit?: number
    ) {
      if (this.valueOf() === '1.1.1.1' && String(splitter) === '.') {
        return ['1', undefined, '1', '1'] as unknown as string[];
      }
      return originalSplit.call(this, splitter, limit);
    });
    const originalParseInteger = Number.parseInt;
    const parseInteger = vi
      .spyOn(Number, 'parseInt')
      .mockImplementation((value, radix) =>
        value === undefined ? 1 : originalParseInteger(value, radix)
      );

    expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);

    parseInteger.mockRestore();
    split.mockRestore();
  });
});

describe('isLocalSetupAllowed', () => {
  it('allows when no proxy header is present (direct local/LAN)', async () => {
    mockGetRequestHeader.mockReturnValue(null);
    expect(await isLocalSetupAllowed()).toBe(true);
  });

  it('allows a loopback client behind a proxy', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '127.0.0.1' : null
    );
    expect(await isLocalSetupAllowed()).toBe(true);
  });

  it('refuses a public client behind a proxy', async () => {
    mockGetRequestHeader.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7' : null
    );
    expect(await isLocalSetupAllowed()).toBe(false);
  });
});
