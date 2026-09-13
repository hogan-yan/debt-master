/**
 * @debtmaster/core — the only place money + split math may live.
 *
 * Boundary policy (enforced by biome noRestrictedImports):
 * - apps may import this package; this package imports neither app.
 * - do NOT re-create `src/lib/money` or `src/lib/splits` inside an app — the
 *   lint rule bans those paths. If a platform needs app-specific money
 *   behavior, extend this package (or add a sibling package that depends on it).
 *
 * Web's float-based balance math is legacy and intentionally NOT here — this
 * package is the integer-minor-unit source of truth; new money code on any
 * platform must go through these types.
 */
export * from './money';
export * from './splits';
