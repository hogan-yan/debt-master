# Architecture review — Debt Master web (apps/web)

This is the working content for the HTML deepening report (Phase 0 of the approved
roadmap). The HTML artifact itself is generated to the OS temp directory; this
file records the same findings in-repo for traceability with the committed QA
and architecture docs.

## Candidates

### C1 — Money seam via `@debtmaster/core` (Strong, L)
**Files:** `src/server/balance-calculator.ts` (296), `src/server/dashboard/workflows/colleagues-balance-workflow.ts`, `src/server/colleagues/workflows/colleague-detail-metrics-workflow.ts`, `src/server/payments/workflows/*`, `src/utils/formatters.ts`, `src/hooks/use-format-currency.ts`.
**Problem:** four independent balance computations; float sums compared against `MONETARY_THRESHOLD = 0.01`; `serializeDecimal` at 30+ sites; two currency formatters; zero `@debtmaster/core` imports in web while mobile integrates it in 60 files.
**Solution:** all money math through core `MoneyMinor` (`fromDecimal` → math → `toDecimalString`); one ledger-balance function; formatting unified on core `formatCurrency`; `withinThreshold` replaces float epsilon.
**Benefits:** rounding policy lives in one place; exact cent math; core's 96/90 coverage gate covers the seam; dashboard/colleagues/payments can no longer disagree.
**Before/After:** 4 boxes each containing its own float sum + threshold → 1 box `server/money` delegating to `@debtmaster/core`, consumers calling it.

### C2 — Structural client/server boundary (Strong, M)
**Files:** all `src/server/**` modules imported from client (20 distinct specifiers), `vite.config.ts` (`stubInjectedHeadScriptsOnClient` hack), `package.json` (`sideEffects: false`).
**Problem:** server-impl modules (prisma/ioredis/minio touchers) are top-level imports of client-reachable files — the BUG-001 Critical class. Current defenses are reactive (sideEffects flag, 9 lazy-import patches).
**Solution:** adopt TanStack Start's `.server.ts` convention: prisma/redis/minio-touching implementation modules become `*.server.ts` (stripped from the client bundle by the framework); client-safe files keep only `createServerFn` definitions; biome `noRestrictedImports` bans `*.server` imports from client dirs; CI canary fails if `dist/client` contains prisma/ioredis/minio markers.
**Benefits:** the whole bug class becomes unrepresentable; lazy-import patches can be reverted; bundle shrinks.

### C3 — One list-query seam (Strong, M)
**Files:** `routes/expenses.tsx` (converted), `routes/payments.tsx` + `-use-payment-list.ts`, `routes/colleagues.tsx` + `-hooks/*`, `routes/restaurants.tsx`, `-dashboard-page.tsx`, `hooks/use-payment-operations.ts`.
**Problem:** three refetch mechanisms coexist (`invalidateQueries`, `router.invalidate()`, `window.location.reload()` ×3); filter state resets; debounced auto-search duplicated in two components.
**Solution:** one `useListQuery(domain, params)` pattern (params → query key → useQuery with `keepPreviousData`), `invalidateQueries` as the only refetch trigger, shared debounce hook, URL-backed params.

### C4 — Colleagues domain split (Worth exploring, S–M)
**Files:** `src/server/colleagues.ts` (373, 12 handlers, 14 importers) vs `src/server/colleagues/` (workflows only).
**Problem:** legacy file shadows the dir; two homes for one domain.
**Solution:** move handlers onto the existing workflows; delete the legacy file.

### C5 — Cache invalidation seam (Worth exploring, M)
**Files:** `utils/create-domain-cache.ts`, `payments/cache.ts`, `expenses/cache.ts`.
**Problem:** invalidation is a manual per-mutation chore (the claims bug proved it); 300s staleness window.
**Solution:** deletion test favors removing stats caching entirely (stats are already single aggregate queries) over building an invalidation map.

### C6 — Error-handling wrapper (Speculative, S)
**Files:** ~40 server handlers repeating `catch { if (isAppError(e)) throw e; throw new AppError(INFRASTRUCTURE_ERROR, …) }`.
**Solution:** `withAppErrorMap(context, handler)` helper.

## Top recommendation
C2 first (mechanical, removes the Critical bug class permanently, and unlocks
trust in every later change), then C1 in phased slices. C3/C4/C5 follow once the
boundary is structural.
