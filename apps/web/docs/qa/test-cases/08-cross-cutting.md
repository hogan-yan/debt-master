# Test cases — Cross-cutting: security, i18n, a11y, performance, browsers, uploads

**Common preconditions:** admin + colleague (bound and unbound) sessions available; all four locales installed.

---

## XC-001: Route authorization matrix
**Priority:** P0 **Type:** Security
1. Signed in as COLLEAGUE, visit `/`, `/expenses`, `/payments`, `/colleagues`, `/restaurants`, `/settings`. **Expected:** colleague-appropriate access only; admin screens blocked (redirect or 403-style message), never a blank page or stack trace.
2. Signed out, visit each route. **Expected:** redirect to `/login` (or `/setup` on a fresh DB per AUTH-022).

## XC-002: Server-function authorization spot checks
**Priority:** P0 **Type:** Security
1. As colleague, replay an admin mutation request (e.g. deleteExpense) captured from an admin session (devtools). **Expected:** `Admin access required` — never executed.
2. As signed-out, replay any server function. **Expected:** `Authentication required`.

## XC-003: Receipt/proof enumeration (bound colleague)
**Priority:** P0 **Type:** Security
### Preconditions
- Colleague bound to colleague A; expense E1 (A participates) and E2 (A does not) both have receipts.
1. Request E1's receipt URL. **Expected:** 200, image renders.
2. Iterate receipt URLs for E2 and other colleagues' expenses (IDs are sequential). **Expected:** `You do not have access to this file` for every non-participating expense.

## XC-004: Storage serve route — signature enforcement
**Priority:** P0 **Type:** Security
1. Open a rendered storage URL, then strip `?expires=...&signature=...`. **Expected:** 403 with a valid session; 401 without.
2. Modify one character of the signature. **Expected:** 403.
3. Use a signature older than its expiry. **Expected:** 403.
4. Try `/api/storage/debt-master/..%2Fescape` style traversal keys. **Expected:** 404 (path refused), no filesystem access outside the bucket.

## XC-005: XSS — stored user content
**Priority:** P0 **Type:** Security
1. Create a restaurant named `<img src=x onerror=alert(1)>`; colleague named `<script>alert(1)</script>`; expense notes with the same payload. **Expected:** payloads render as TEXT everywhere they appear (list, detail, dashboard, tooltips); no alert fires.
2. Check the single HTML-injection surface (root head scripts) renders only static content.

## XC-006: Input abuse — long and unicode
**Priority:** P2 **Type:** Functional
1. Notes with 10,000 chars; emoji-only names; RTL text in names. **Expected:** stored/rendered safely; layout doesn't explode (truncate/scroll); sorting stable.

## XC-007: SQL injection probes
**Priority:** P1 **Type:** Security
1. Search box: `'; DROP TABLE expenses; --` and `%`; filter fields with quote payloads. **Expected:** treated as literal text (list shows no results / harmless), all tables intact.

## XC-008: i18n coverage across locales
**Priority:** P1 **Type:** UI
1. Switch locale to each of en/ja/zh/zh-tw; visit every route. **Expected:** no raw message keys (`expense_...`), no English leakage in tables/menus/dates for non-en locales (per repo i18n rule).
2. Locale choice persists across reload (cookie/URL strategy).

## XC-009: Locale-specific formatting
**Priority:** P2 **Type:** UI
1. In ja and zh-tw, check currency + dates on expenses/dashboard. **Expected:** locale formats; currency symbol policy respected (plain `$`, never `US$`).

## XC-010: Keyboard accessibility
**Priority:** P1 **Type:** UI
1. Tab through the expenses list: search → filters → rows → pagination. **Expected:** visible focus ring on every control; Enter/Space activate; no focus trapped.
2. Open a modal (receipt viewer, payment form). **Expected:** focus moves in; Tab cycles inside; Escape closes; focus returns to the opener.

## XC-011: Screen-reader labels spot check
**Priority:** P2 **Type:** UI
1. With a screen reader (VoiceOver/NVDA), traverse login, expenses list, payment form. **Expected:** every icon-only control announces a name; money amounts and statuses are announced; images (receipts, avatars) have alt text.

## XC-012: Responsive layout — expenses and payments
**Priority:** P2 **Type:** UI
1. At 1920 / 1280 / 768 / 375: tables collapse to cards/mobile view per component behavior; money columns never overlap timestamps; action buttons remain reachable.
2. Largest OS text scale (accessibility zoom). **Expected:** no clipped rows; wrapping acceptable.

## XC-013: Browser matrix sweep
**Priority:** P2 **Type:** UI
1. Run Smoke suite on Chrome, Firefox, Safari, Edge (last 2 majors). **Expected:** all pass; file upload works in Safari (HEIC conversion path) and all others.

## XC-014: Image upload processing
**Priority:** P2 **Type:** Functional
### Preconditions
- Real device media.
1. Upload a HEIC photo. **Expected:** converted client-side (heic2any) and stored as jpeg/png; renders in the viewer.
2. Upload an 8 MB JPEG. **Expected:** client-side compression runs (browser-image-compression); stored file is smaller; image quality acceptable.
3. Upload a phone photo with EXIF orientation 6 (rotated 90°). **Expected:** displays upright in the receipt viewer and everywhere it renders — never stored/shown sideways.

## XC-015: Performance baselines (production-like volume)
**Priority:** P1 **Type:** Performance
### Preconditions
- Seed gives 80 expenses only; volume rows need a one-shot insert, e.g. `INSERT INTO "Expense" (…columns…) SELECT … FROM generate_series(1, 5000);` (mirror the seed's column shape from `prisma/seed.ts`), then restart the server.
| Check | Target | Acceptable |
|---|---|---|
| `/expenses` first load (5k rows seeded) | < 2 s interactive | < 4 s |
| Search keystroke → results | < 800 ms after debounce | < 1.5 s |
| `/payments` filter change | < 1 s | < 2 s |
| `/` dashboard | < 3 s | < 5 s |
| Receipt URL fetch → image visible | < 1.5 s | < 3 s |
**Steps:** 1. Seed volume data. 2. Measure each in devtools (network + CPU throttle ×4). **Expected:** meets targets; status filter changes do not trigger full-table refetch storms (check request payloads stay paginated).

## XC-016: Error and offline states
**Priority:** P2 **Type:** Functional
1. Stop the backend; use the app. **Expected:** friendly error states/toasts; no silent dead UI; recovery works when backend returns.
2. Force a 500 on a list fetch (breakpoint/proxy). **Expected:** error boundary, not white screen.
3. Visit an unknown URL (e.g. `/nope`). **Expected:** branded not-found page with working navigation out — never a blank screen or stack trace.
4. Let the admin session expire (or clear the session cookie) with a form open, then submit. **Expected:** explicit auth-required error — no silent failure, no crash, no fake success; after re-login the retry works.

## XC-021: zh (简体) partial-locale fallback audit
**Priority:** P1 **Type:** Regression
### Preconditions
- TWO automated guards skip zh — the parity unit test (`src/i18n/__tests__/message-parity.test.ts`) and `bun run i18n:check` (`scripts/validate-translations.ts`) both read the locale list from `project.inlang/settings.json`, which declares en/zh-tw/ja only. `zh.json` is a partial locale with SILENT English fallback and no automated guard. This exact class shipped: `login_meta_description` was missing from zh until 2026-09-07.
1. Diff key sets (repo root): `jq -r 'keys[]' apps/web/messages/en.json | sort` vs the same for `apps/web/messages/zh.json`, then `comm -23`. **Expected:** the list = every string silently rendering English in the zh UI; each entry is a bug (or evidence zh must be added to the parity guard).
2. In zh, walk login, dashboard, expenses (list + form + modals), payments, colleagues, restaurants, settings. **Expected:** no English remnants in tables/menus/dialogs; anything found maps to a missing key from step 1.
3. Disposition: file each missing key, and if zh is a maintained locale, raise adding it to the parity test + `project.inlang/settings.json` locales (currently declares en/zh-tw/ja only).

## XC-022: Unbound (legacy) access-code session scoping — characterization
**Priority:** P1 **Type:** Security
### Preconditions
- Unbound access code in active state (the SET-004 step-3 state). This case **pins the accepted open security finding** "unbound-code legacy read" — if the product closes the hole, flip the expectations here.
1. Sign in with the unbound code; open `/expenses` and `/payments`. **Expected:** CURRENT behavior = legacy full-read — the colleague session sees workspace-wide data including other colleagues' expenses/payments.
2. Open a receipt/proof file URL from any expense. **Expected:** currently renders (legacy read) — contrast with the bound-colleague refusals in XC-003/PAY-022.
3. Attempt an admin mutation (e.g. create expense) from the same session. **Expected:** still rejected — legacy read never includes admin writes.

## XC-017: Double-submit guards
**Priority:** P1 **Type:** Functional
1. Double-click Save on: expense form, payment form, colleague form. **Expected:** exactly one record per action (buttons disable or requests dedupe).
2. Double-click Delete confirmations. **Expected:** single deletion, single toast.

## XC-018: Concurrent colleague + admin money operations
**Priority:** P1 **Type:** Functional
### Preconditions
- Colleague A claims while an admin records a payment for the same debt.
1. Execute both nearly simultaneously. **Expected:** one path wins cleanly (claim-pending guard or lock); totals reconcile to the penny afterwards; no negative balances.

## XC-019: Data reconciliation sweep (money integrity)
**Priority:** P0 **Type:** Regression
1. After a full pass of EXP/PAY cases, run the reconciliation queries: per-expense sum of applications ≤ expense amount; per-colleague balance equals computed history; payments applications sum equals applied amount. **Expected:** every invariant holds to 0.00 drift.

## XC-020: Cold-boot render canary (BUG-001 regression)
**Priority:** P0 **Type:** Regression
### Preconditions
- Freshly built bundle running; devtools console open (see EXECUTION-REPORT-2026-09-05 BUG-001).
1. Cold-load `/login`; sign in; cold-load `/`, `/expenses`, `/payments`, `/settings`. **Expected:** every entry page renders content — never blank — and the console is free of module-externalization / SSR / hydration errors (the BUG-001 crash class: server-only modules leaking into the client bundle).
2. Hard-reload each route directly (no SPA navigation). **Expected:** same result — page shell renders, hydration completes with no console errors.
