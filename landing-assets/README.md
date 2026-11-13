# landing-assets — staged from `feat/landing-real-ui-scenes`

**Source branch:** `feat/landing-real-ui-scenes` (DebtMaster monorepo, NOT pushed / NOT checked out)
**Staged on:** 2026-11-13 (repo-split Task 3)
**Method:** `git show feat/landing-real-ui-scenes:<path>` for every file in
`git diff --name-only develop...feat/landing-real-ui-scenes -- apps/web`
(paths flattened with `/` → `__`). No branch history, no checkout.

## What this is

The landing-page redesign work (real product UI scenes as the marketing
landing): landing / app-landing / docs routes, landing scene components,
their tests, i18n catalog updates, and sitemap-builder updates. The branch
supersedes these files — 6 paths deleted on the branch (old
`-app-landing-page.tsx`, `app.tsx`, `store-urls.ts`, `torn-edge.tsx`,
`scene-statics.tsx` and its test) are therefore absent here.

Skipped from the copy: `apps/web/responsiveness-check-20260913-1905.md`
(point-in-time internal audit doc — red-lined from the OSS repo).

## Re-wiring (future OSS work — frozen-maintenance product facade)

File names are flattened; restore original paths by reversing `__` → `/`:

- `messages__*.json` → `messages/` (merge the `landing` / scene-related keys
  into the OSS repo's catalogs — these are full catalogs from the branch, not
  diffs)
- `src__components__landing__*` → `src/components/landing/`
- `src__routes__*` → `src/routes/` (TanStack route files; `routeTree.gen.ts`
  regenerates via `tanstack-router generate`)
- `scripts__sitemap-builders.*` → `scripts/`
- `tests__seo__sitemap-builders.test.ts` → `tests/seo/`

`git diff develop...feat/landing-real-ui-scenes -- apps/web` in the monorepo
is the authoritative reference for what changed and why.
