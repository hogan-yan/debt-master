# landing-assets — staged landing assets

Staged landing assets extracted from the development monorepo, 2026-11-13.
File names are flattened with `/` → `__`; no branch history, no checkout.

## What this is

The landing-page redesign work (real product UI scenes as the marketing
landing): landing / app-landing / docs routes, landing scene components,
their tests, i18n catalog updates, and sitemap-builder updates. The redesign
supersedes these files — 6 paths it deleted (old
`-app-landing-page.tsx`, `app.tsx`, `store-urls.ts`, `torn-edge.tsx`,
`scene-statics.tsx` and its test) are therefore absent here.

Skipped from the copy: one point-in-time internal audit doc
(`apps/web/responsiveness-check-20260913-1905.md`).

## Re-wiring

Restore original paths by reversing `__` → `/`:

- `messages__*.json` → `messages/` (merge the `landing` / scene-related keys
  into this repo's catalogs — these are full catalogs, not diffs)
- `src__components__landing__*` → `src/components/landing/`
- `src__routes__*` → `src/routes/` (TanStack route files; `routeTree.gen.ts`
  regenerates via `tanstack-router generate`)
- `scripts__sitemap-builders.*` → `scripts/`
- `tests__seo__sitemap-builders.test.ts` → `tests/seo/`
