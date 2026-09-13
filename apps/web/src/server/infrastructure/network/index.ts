/**
 * Server-only network utilities.
 *
 * Separated from client code because request-header access
 * (`@tanstack/start-server-core`) is server-only and must never reach the
 * client bundle.
 */
/**
 * Resolve the originating client IP for the current request.
 *
 * Prefers the RIGHTMOST trusted hop of `X-Forwarded-For`, then `X-Real-Ip`,
 * then the socket peer address. Returns `null` only outside a request
 * context (unit tests, direct imports).
 *
 * Trust model: a client can inject arbitrary leftmost XFF entries, while each
 * trusted reverse proxy appends the address it saw, so the rightmost entry is
 * the only one the proxy chain attests. `TRUSTED_PROXY_HOPS` (default 1)
 * steps back past additional internal proxies. Note the residual caveat: a
 * DIRECT connection (no proxy) can still forge the header — only a proxy
 * that overwrites/appends XFF closes that, which is why the header is
 * trusted at all.
 */
export async function getRequestClientIp(): Promise<string | null> {
  // Server-only primitives (node:async_hooks) — lazy to keep them out of the
  // client bundle.
  let forwarded: string | undefined;
  let realIp: string | undefined;
  let socketIp: string | undefined;

  try {
    const { getRequestHeader, getRequestIP } = await import('@tanstack/start-server-core');
    forwarded = getRequestHeader('x-forwarded-for');
    realIp = getRequestHeader('x-real-ip');
    socketIp = getRequestIP() ?? undefined;
  } catch {
    // Outside the TanStack Start server runtime (e.g. unit tests or direct
    // imports) there is no request event. Fall back to null.
    return null;
  }

  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const proxyHops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '', 10) || 1;
    const trusted = hops[Math.max(0, hops.length - proxyHops)];
    if (trusted) return trusted;
  }
  if (realIp) return realIp.trim();
  if (socketIp && socketIp.length > 0) return socketIp;
  return null;
}

/**
 * Whether an IP address is loopback or private (RFC 1918 / ULA / link-local).
 * Used to gate first-run setup to local/private networks.
 *
 * Accepts IPv4, IPv6, and IPv4-mapped IPv6 (`::ffff:1.2.3.4`).
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  const raw = ip.trim().toLowerCase();
  if (raw.length === 0) return false;

  // IPv6 loopback
  if (raw === '::1' || raw === '0:0:0:0:0:0:0:1') return true;

  // Strip IPv4-mapped IPv6 prefix so IPv4 rules apply.
  const v4 = raw.startsWith('::ffff:') ? raw.slice(7) : raw;

  if (v4.includes(':')) {
    // IPv6 (non-loopback): treat link-local fe80::/10 and unique-local fc00::/7 as private.
    if (
      v4.startsWith('fe80') ||
      v4.startsWith('fe9') ||
      v4.startsWith('fea') ||
      v4.startsWith('feb')
    ) {
      return true;
    }
    if (v4.startsWith('fc') || v4.startsWith('fd')) return true;
    return false;
  }

  // IPv4
  const parts = v4.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number.parseInt(p, 10));
  if (octets.some((o) => Number.isNaN(o))) return false;
  const a = octets[0];
  const b = octets[1];
  if (a === undefined || b === undefined) return false;
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // private 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
  if (a === 192 && b === 168) return true; // private 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  return false;
}

/**
 * Whether the current request may perform first-run admin setup.
 *
 * Allowed when the resolved client IP (rightmost trusted XFF hop, else the
 * socket peer) is private/loopback — direct LAN access or a proxy reporting a
 * private client. Refused when a public client IP is resolved, which signals
 * the instance is reachable from the internet and setup must go through a
 * trusted path (`SETUP_TOKEN`, or the CLI).
 */
export async function isLocalSetupAllowed(): Promise<boolean> {
  const ip = await getRequestClientIp();
  if (ip === null) return true;
  return isPrivateOrLoopbackIp(ip);
}
