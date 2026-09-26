import { afterEach, describe, expect, it } from 'vitest';
import { withSecurityHeaders } from '../../../../scripts/security-headers';

const REQUIRED_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

describe('withSecurityHeaders', () => {
  afterEach(() => {
    delete process.env.ENABLE_HSTS;
  });

  it('sets the baseline headers without touching status or body', async () => {
    const res = withSecurityHeaders(new Response('hello', { status: 201 }));

    expect(res.status).toBe(201);
    await expect(res.text()).resolves.toBe('hello');
    // All four baseline headers present together on one response.
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it('preserves existing headers like Content-Type and Cache-Control', () => {
    const res = withSecurityHeaders(
      new Response(null, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=900' },
      })
    );

    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
  });

  it('does not set HSTS by default', () => {
    const res = withSecurityHeaders(new Response(null));
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('sets HSTS when ENABLE_HSTS=true', () => {
    process.env.ENABLE_HSTS = 'true';
    const res = withSecurityHeaders(new Response(null));
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=15552000');
  });

  it.each(['false', '1', 'TRUE'])(
    'does not set HSTS when ENABLE_HSTS=%s (exact-string gate)',
    (value) => {
      process.env.ENABLE_HSTS = value;
      const res = withSecurityHeaders(new Response(null));
      expect(res.headers.get('Strict-Transport-Security')).toBeNull();
    }
  );

  it('baseline wins: pre-existing baseline headers are overridden with the exact values', () => {
    const res = withSecurityHeaders(
      new Response(null, {
        headers: {
          'X-Content-Type-Options': 'sniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(self), microphone=(self)',
        },
      })
    );

    // Override resistance plus the exact Permissions-Policy grammar, all on
    // one response.
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('preserves statusText on a non-zero status alongside existing headers', () => {
    const res = withSecurityHeaders(
      new Response(null, {
        status: 418,
        statusText: "I'm a teapot",
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    expect(res.status).toBe(418);
    expect(res.statusText).toBe("I'm a teapot");
    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('passes a null body through unchanged on empty-body responses', () => {
    const res = withSecurityHeaders(new Response(null));

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
