# Targeted QA Plan — Brand Teal, Login Meta Copy, Pill Refactor

**Created:** 2026-09-07 · **Type:** Targeted regression (30–45 min) · **Trigger:** commits `8debedf`, `023f9d5`, `215fc07` on `develop` (docs commit `0eb9adb` has no runtime surface)
**Related:** [TEST-PLAN.md](./TEST-PLAN.md) · [REGRESSION-SUITE.md](./REGRESSION-SUITE.md) (targeted row "i18n / styling") · [design-system.md §10](../../../../docs/design-system.md)

**Scope assumption** (no explicit request accompanied the plan): this plan covers the 2026-09-07 unslop/brand-accent change set — the most recent unpushed work on `develop`. If a different target was intended, treat this as a template and re-scope.

## 1. What changed (test surface)

| Commit | Change | Risk |
|---|---|---|
| `8debedf` | `--primary`/`--ring` → brand teal in **both** light (`#017A6B`) and dark (`#2DB8A3`); dark set in **two places** (`.dark` block + `@media (prefers-color-scheme: dark)` fallback); `--radius` 0.5→0.625rem; Card `shadow-sm`→`shadow-card` (new Tailwind token → dark elevation rule now actually applies) | Visual, both modes; the duplicated dark block is the classic miss |
| `023f9d5` | `login_meta_description` rewritten plain in en/ja/zh-tw; **key added to zh.json** (zh previously silently fell back to English). Route-meta unit test updated | Rendered `<head>` meta per locale, esp. zh |
| `215fc07` | Pure refactor: pill/badge class strings hoisted to named constants (`PILL_LEADING`, `PILL_INLINE`, `BADGE_*`, grid constants); `unslop-ignore` markers added; dead `CARD_GRID_3` dropped. **Expected visual delta: zero** | Regression — any visual change here is a bug |

Not tested here (no runtime surface): `0eb9adb` doc amendment; comment-only edit in `routes/index.tsx`; test-fixture edit in `logger/index.test.ts`; paraglide output (gitignored, regenerates on build).

## 2. Preconditions

- **Build:** `develop` at `0eb9adb` or later. After `bun run build`, **restart `scripts/server.ts`** — the old process serves stale HTML pointing at dead hashed assets, so pages never hydrate (known trap).
- **Environment:** local self-host stack (compose Postgres + `apps/web/.env` + server on `:3000`) or staging. Turnstile off locally is fine — no auth flows are re-tested here beyond login page rendering.
- **Accounts:** admin (`admin@test.local`) per TEST-PLAN.md §3.
- **Seed data:** the standard seed (≥ 4 colleagues, expenses in every state, one pending claim, one payment with proof) — colleague/settlement/expense status pills and dashboard cards must be visible.
- **Theme control:** app theme toggle (Tailwind `darkMode: 'class'`) plus OS appearance for the media-query fallback test (BRND-003).
- **Tooling:** browser devtools for computed styles; view-source (not post-hydration DOM) for meta tags.

**Known false alarms — do not file:** teal "tint" on a CTA frame captured mid 200 ms color transition; "empty table" screenshots from stale headless captures (verify against DOM; prefer a fresh headless Playwright shot over a long-lived capture session).

## 3. Execution order

Brand tokens (both modes) → login meta per locale → pill regression sweep → cross-references. If BRND-001 or BRND-002 fails, stop — everything downstream renders on top of the primary token.

---

## TC-BRND-001: Light mode primary surfaces show the brand teal
**Priority:** P0  **Type:** UI

### Preconditions
- Light theme active (toggle off / no `dark` class), admin signed in.
- Dashboard with seeded data visible.

### Test Steps
1. Open `/` (dashboard). Inspect the primary CTA button(s) and any tab pill.
   **Expected:** fill is teal `rgb(1, 122, 107)` (`hsl(173 98% 24%)` / `#017A6B`) with white text — not the old near-black `#020617`.
2. Open the expenses list with at least one owed and one credit colleague.
   **Expected:** debt-chart bars / balance accents on primary surfaces are the same teal; the canvas, cards, and text stay neutral (no teal background wash anywhere — §2 "no brand accent washes" still holds per design-system §10).
3. Check secondary/success/warning/destructive elements on the same screens.
   **Expected:** unchanged from before the change (only `--primary`/`--ring` moved).

## TC-BRND-002: Dark mode primary shows the mobile dark-palette teal via both mechanisms
**Priority:** P0  **Type:** UI

### Preconditions
- Admin signed in; dashboard + expenses loaded.

### Test Steps
1. Toggle dark mode via the app theme toggle (adds `dark` class). Inspect the same primary CTA.
   **Expected:** fill is `rgb(45, 184, 163)` (`hsl(171 61% 45%)` / `#2DB8A3`) with dark ink text — not the old near-white `#e0e0e0`.
2. In devtools, confirm `--primary` on `:root`-scope under `.dark` reads `171 61% 45%`.
   **Expected:** value matches in the `.dark` block.
3. Fresh browser profile with OS appearance set to Dark and **no** in-app toggle interaction (no `dark` class on `<html>`), load `/login`.
   **Expected:** dark palette renders from the `@media (prefers-color-scheme: dark)` fallback with the same teal primary — proves the duplicated second dark block was updated too, not just `.dark`.

## TC-BRND-003: Focus ring carries the brand teal
**Priority:** P1  **Type:** UI (a11y-adjacent)

### Preconditions
- Any screen with a form control (login page is sufficient). Light, then dark.

### Test Steps
1. Keyboard-Tab to the email input, then to the primary submit button on `/login` (light mode).
   **Expected:** visible focus ring in brand teal (`--ring: 173 98% 24%`), clearly distinguishable from the fill.
2. Repeat in dark mode.
   **Expected:** ring is `#2DB8A3`, visible against the dark canvas.

## TC-BRND-004: Contrast claims hold in context
**Priority:** P1  **Type:** UI

### Preconditions
- Devtools contrast checker or equivalent.

### Test Steps
1. Light mode: sample white button label over the teal fill.
   **Expected:** ≥ 4.5:1 (documented 5.25:1).
2. Dark mode: sample `--primary-foreground` (ink) over `#2DB8A3` used as text/badge color on the dark canvas.
   **Expected:** ≥ 4.5:1 (documented 7.6:1). Also confirm teal used as small text on dark canvas passes where it appears.

## TC-BRND-005: Radius bump — one step softer, nothing clipped
**Priority:** P2  **Type:** UI

### Preconditions
- Dashboard, expenses list, expense detail, one dialog, in both modes.

### Test Steps
1. Inspect a Card container computed `border-radius`.
   **Expected:** 10px (`--radius: 0.625rem`); buttons/inputs 8px (`md` = radius − 2px), small controls 6px.
2. Visually sweep cards, dialogs, inputs, and image containers at 1920 and 375 widths.
   **Expected:** corners uniformly softer than the previous 8px/6px look; no clipped content, no mismatched radii between sibling elements; full-round pills (`rounded-full` badges, avatars, spinner) unchanged.

## TC-BRND-006: Card shadow token in both modes
**Priority:** P1  **Type:** UI

### Preconditions
- Dashboard with cards, expense detail info card, light then dark.

### Test Steps
1. Light mode: inspect a Card's computed `box-shadow`.
   **Expected:** `var(--shadow-card)` resolves (subtle elevation), not Tailwind's stock `shadow-sm`.
2. Dark mode: same card.
   **Expected:** the dark shadow redefinition applies (card visibly lifts from the canvas) — this rule was dead before the change; it must now be live.

## TC-BRND-007: Runtime theme switch updates every primary surface without reload
**Priority:** P1  **Type:** Functional

### Preconditions
- Dashboard open with data; theme toggle available.

### Test Steps
1. Toggle light → dark while watching the page.
   **Expected:** buttons, rings, card shadows, and status surfaces all switch with no full reload and no stuck elements (allow the ~200 ms color transition to finish before judging color).
2. Reload after toggling.
   **Expected:** chosen theme persists.

## TC-I18N-101: Login meta description is the new plain copy in every locale — zh no longer falls back
**Priority:** P1  **Type:** UI / Integration

### Preconditions
- Server running post-build. Locale switched via the app's locale mechanism (per XC-008 method). Meta is server-rendered — read **view-source**, not the hydrated DOM.

### Test Steps
1. Sign out. Open `/login` view-source with locale en.
   **Expected:** `<meta name="description">`, `og:description`, and `twitter:description` all read exactly "Split shared expenses with friends. Log costs, see who owes whom, and settle up once both sides confirm."
2. Repeat for ja.
   **Expected:** "共通の支出を記録し、誰が誰にいくら払うか一目で確認。双方の確認で精算が完了します。" in all three tags.
3. Repeat for zh-tw.
   **Expected:** "記錄共同開銷，誰欠誰一目瞭然，雙方確認後即完成還款。" in all three tags.
4. Repeat for **zh** — the regression target.
   **Expected:** "记录共同开销，谁欠谁一目了然，双方确认后即完成还款。" (simplified). Before the fix this key was missing and zh silently rendered the English string.

## TC-I18N-102: No template-hype phrasing remains in login meta
**Priority:** P2  **Type:** UI

### Preconditions
- Same as I18N-101.

### Test Steps
1. In view-source of `/login` (all four locales), search the three description tags for "effortless", "简单", "簡單", "簡単", "轻松", "輕鬆".
   **Expected:** zero hits; copy is a literal product description in every locale.

## TC-PILL-201: Pill/badge refactor is visually inert
**Priority:** P1  **Type:** Regression

### Preconditions
- Seeded data showing: colleague status pills (owes/credit/balanced), split-type badges, settlement status badges, expense list status pills, unpaid pill, participant status pill, admin pill, restaurant cuisine pills, auth navbar, avatars, spinner.

### Test Steps
1. Visit colleagues detail (status pills), expense detail (split-type + settlement badges), expenses list (status + unpaid pills), payments/claims (participant + status pills), restaurants list + detail (cuisine pills), any loading state (spinner), any avatar.
   **Expected:** every pill renders exactly as before the refactor — same shape (`rounded-full`), padding, font weight/size, and colors; icons on split/settlement badges intact.
2. Repeat the sweep in dark mode.
   **Expected:** identical to pre-refactor dark rendering; nothing lost in the constant hoisting.

## TC-PILL-202: Dark-mode status glows survive the refactor
**Priority:** P2  **Type:** Regression

### Preconditions
- Dark mode; seeded destructive/success/warning badges and a destructive button visible (e.g. expense with failed status, settle flows).

### Test Steps
1. In dark mode, inspect destructive / success / warning badges and the destructive button.
   **Expected:** each keeps its soft status glow (`0 0 8px…` / `0 0 12px…` shadows) — these are documented deliberate choices, and the refactor must not have dropped them.
2. Keyboard-focus a badge.
   **Expected:** focus ring uses the new teal `--ring` (BRND-003) without breaking pill shape.

## TC-PILL-203: Grid constants — info/summary layouts unchanged
**Priority:** P2  **Type:** Regression

### Preconditions
- Expense detail (info card), payment summary, restaurant detail open.

### Test Steps
1. Compare the expense info card grid, payment summary grid, and restaurant detail grid against their pre-change layout (screenshots from before `215fc07` if available, else structural sanity).
   **Expected:** 3-column grids gap-4/gap-6 render identically; no collapsed or overflowing cells.

## 4. Cross-references (run after the cases above)

- [XC-008](./test-cases/08-cross-cutting.md) i18n coverage sweep (the meta fix is one key; the full sweep guards the rest).
- [XC-009](./test-cases/08-cross-cutting.md) locale formatting (untouched by this change set — quick spot check only).
- [XC-012](./test-cases/08-cross-cutting.md) responsive pass at 1920/1280/768/375 for the radius + shadow change on cards/tables.
- Smoke items AUTH-001 (login page now teal-accented) and DSH-001 (dashboard cards/shadow) as sanity anchors.

## 5. Exit criteria

- BRND-001, BRND-002, PILL-201 pass in both modes (release-blocking — the whole point of the change set).
- No P1 case failed; P2 failures get individual bug reports with screenshots and computed-style evidence.
- Contrast measured, not eyeballed (BRND-004), since 4.5:1 is the a11y floor the commit messages claim.
