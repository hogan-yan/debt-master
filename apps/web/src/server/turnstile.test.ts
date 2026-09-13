import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

const turnstile = await import('./turnstile');

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('isTurnstileConfigured', () => {
  it('returns true when both keys are set', () => {
    process.env.TURNSTILE_SITE_KEY = 'site-key';
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    expect(turnstile.isTurnstileConfigured()).toBe(true);
  });

  it('returns false when site key missing', () => {
    delete process.env.TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    expect(turnstile.isTurnstileConfigured()).toBe(false);
  });

  it('returns false when secret key missing', () => {
    process.env.TURNSTILE_SITE_KEY = 'site-key';
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(turnstile.isTurnstileConfigured()).toBe(false);
  });

  it('returns false when both keys missing', () => {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(turnstile.isTurnstileConfigured()).toBe(false);
  });
});

describe('validateTurnstileToken handler', () => {
  it('throws when secret key not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(
      turnstile.validateTurnstileToken({ data: { token: 'test-token' } })
    ).rejects.toThrow('Turnstile secret key not configured');
  });

  it('returns success when Cloudflare validation passes', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            'error-codes': [],
            hostname: 'example.com',
            challenge_ts: '2024-01-01T00:00:00Z',
          }),
      })
    );

    const result = await turnstile.validateTurnstileToken({
      data: { token: 'valid-turnstile-token' },
    });

    expect(result).toEqual({
      success: true,
      errorCodes: [],
      hostname: 'example.com',
      challenge_ts: '2024-01-01T00:00:00Z',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns failure when Cloudflare validation fails', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
      })
    );

    const result = await turnstile.validateTurnstileToken({ data: { token: 'bad-token' } });
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(['invalid-input-response']);
  });

  it('uses an empty error code list when Cloudflare omits it', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );

    await expect(
      turnstile.validateTurnstileToken({ data: { token: 'test-token' } })
    ).resolves.toMatchObject({
      errorCodes: [],
    });
  });

  it('throws when Cloudflare API returns non-200', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Internal Server Error'),
      })
    );

    await expect(turnstile.validateTurnstileToken({ data: { token: 'test' } })).rejects.toThrow(
      'Failed to validate Turnstile token'
    );
  });

  it('includes remoteip in request when provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, 'error-codes': [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await turnstile.validateTurnstileToken({ data: { token: 'test', remoteip: '1.2.3.4' } });

    const callBody = String(mockFetch.mock.calls[0]?.[1]?.body ?? '');
    expect(callBody).toContain('remoteip=1.2.3.4');
  });
});

describe('getTurnstileSiteKey handler', () => {
  it('throws when site key not configured', async () => {
    delete process.env.TURNSTILE_SITE_KEY;
    const fn = turnstile.getTurnstileSiteKey as unknown as (ctx: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    await expect(fn({ data: {} })).rejects.toThrow('Turnstile site key not configured');
  });

  it('returns site key and isConfigured flag', async () => {
    process.env.TURNSTILE_SITE_KEY = 'my-site-key';
    process.env.TURNSTILE_SECRET_KEY = 'my-secret';
    const fn = turnstile.getTurnstileSiteKey as unknown as (ctx: {
      data: Record<string, unknown>;
    }) => Promise<Record<string, unknown>>;
    const result = await fn({ data: {} });
    expect(result).toEqual({ siteKey: 'my-site-key', isConfigured: true });
  });

  it('returns isConfigured false when secret missing', async () => {
    process.env.TURNSTILE_SITE_KEY = 'my-site-key';
    delete process.env.TURNSTILE_SECRET_KEY;
    const fn = turnstile.getTurnstileSiteKey as unknown as (ctx: {
      data: Record<string, unknown>;
    }) => Promise<Record<string, unknown>>;
    const result = await fn({ data: {} });
    expect(result.isConfigured).toBe(false);
  });
});
