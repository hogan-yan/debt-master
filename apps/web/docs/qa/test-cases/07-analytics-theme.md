# Test cases — Analytics telemetry, theme (dark mode)

**Common preconditions:** admin + colleague sessions available; devtools for network/localStorage inspection.

---

## ANL-001: Umami tracker active when configured
**Priority:** P2 **Type:** Integration
### Preconditions
- `UMAMI_URL` + `UMAMI_WEBSITE_ID` set; devtools network tab open.
1. Load `/login`, sign in, navigate across every route (dashboard tabs, expenses, payments, colleagues, restaurants, settings). **Expected:** the Umami script loads once from the configured URL; a pageview beacon fires on initial load and on each SPA navigation — no duplicate beacons per view, no beacon storms.
2. Inspect beacon payloads. **Expected:** URLs/titles only — no email, user id, colleague names, or money amounts anywhere in the analytics payload.
3. Block the analytics config server function (devtools) and reload. **Expected:** no script injected, app fully functional — analytics is best-effort and never breaks the page (tracker renders nothing).

## ANL-002: Umami absent when unconfigured
**Priority:** P2 **Type:** Functional
### Preconditions
- `UMAMI_URL` / `UMAMI_WEBSITE_ID` unset; app restarted.
1. Load `/login`, sign in, navigate several routes. **Expected:** no third-party script tag, zero beacon requests, zero console errors from the tracker.

## THM-001: Dark mode — sweep, persistence, pre-paint correctness
**Priority:** P1 **Type:** UI
### Preconditions
- Seeded data; theme toggle on the auth navbar; theme stored in `localStorage['debt-master-theme']` (`light` / `dark` / `system`).
1. On `/login`, toggle dark. **Expected:** `dark` class lands on `<html>` immediately (no white flash — the inline head script applies the stored theme before first paint); login renders dark with the brand-teal primary `#2DB8A3` (token details: [TARGETED-2026-09-07 plan](../TARGETED-2026-09-07-brand-teal-i18n.md), BRND-002/003).
2. Sign in and visit every route: dashboard (all 4 tabs), expenses list + detail + form dialogs, payments, colleagues list + detail, restaurants list + detail, settings, receipt viewer, payment/claim modals. **Expected:** every surface switches — cards, tables, forms, badges, dialogs, toasts, dropdowns all dark and legible; no white/cream blocks, no unreadable text, table hover/selected states visible.
3. Charts (debt distribution, participation, restaurant charts, spending charts) in dark. **Expected:** axis labels, legends, and tooltips legible; bars/segments visible against the dark canvas.
4. Reload. **Expected:** `dark` persists (localStorage), still no flash of light theme on load.
5. Switch to light on the navbar; reload. **Expected:** light restores everywhere.
6. Set `localStorage['debt-master-theme']` to `system`; flip the OS appearance; reload after each flip. **Expected:** app follows the OS (media-query + class path both carry the dark tokens — see BRND-002 step 3).
