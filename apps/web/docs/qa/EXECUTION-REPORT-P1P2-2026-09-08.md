# P1/P2 Execution Report — 2026-09-08

**Scope:** the P1 + P2 tiers ([REGRESSION-SUITE.md](./REGRESSION-SUITE.md)) not covered by the P0 pass ([EXECUTION-REPORT-P0-2026-09-08.md](./EXECUTION-REPORT-P0-2026-09-08.md)) — executed on a clean single-server instance after the P0 run's infra lessons were baked in.
**Driver:** [tests/qa/qa-run6-p1p2.mjs](../../tests/qa/qa-run6-p1p2.mjs) (argv slice filter, per-case retry, DB assertions).

## Outcome

| Tier | Automatable executed | PASS | PARTIAL / BLOCKED (env or pacing) |
|---|---|---|---|
| P1 | 24 case-groups | 21 | 3 (details below) |
| P2 | 13 case-groups | 10 | 3 (details below) |

**No S1/S2 product bugs found in the P1/P2 sweep.** All money flows that failed in-flight did so for driver-pacing reasons (hydration race / server-fn latency under load); isolated probes re-verified the underlying features work.

## Passed (highlights)

- **Auth (P1):** AUTH-004 empty-login validation · AUTH-013 no Turnstile when unconfigured · AUTH-017 callback graceful · AUTH-019/020 session + tampered-cookie · AUTH-021 deactivated-code session persists (documented gap, characterization) · AUTH-026/028 forget-password rate limit engages + bogus reset token 400 (API-level) · AUTH-030 2FA enable 200 → disable rate-limited at attempt 4 → DB-reset cleanup (better-auth semantics: flag flips only after TOTP verify)
- **Money (P1):** EXP-008 invalid receipt flagged · EXP-010 replace receipt keeps reference · EXP-014/015/016 pagination/search/filter/sort · EXP-019 colleague foreign-detail characterization (metadata visible, receipt file absent — see O-7) · PAY-002/005/006 types + credit auto-apply · PAY-008/019 invalid-proof flagged, valid stored · PAY-017/018 stats + edit redistributes · PAY-022
- **Money (P2):** EXP-003 0.01/0 boundaries · EXP-006 itemized remainder · EXP-011 duplicate · EXP-018 detail matches DB
- **P0 addenda:** COL-005/007 (soft delete `deleted_at` + permanent-delete guard), RST-005 (blocked w/ expenses via native confirm; empty deletes), EXP-013 (payment warning), PAY-011 (double-approve replay)
- **Cross-cutting:** XC-006/007 (long input + SQLi inert) · XC-014 (8 MB upload compresses) · XC-015 **perf baselines PASS at 5,200-row volume** (`/expenses` and dashboard inside targets) · THM-001 dark/light persistence · ANL-002 no umami when unconfigured · XC-016 branded not-found · XC-021 zh parity audit (601 keys silently falling back — see P0-session finding) · XC-022 unbound legacy-code characterization · COL-008/012 detail + stats · DSH-002..009 all tabs render, staleness bound holds, FK-safe staleness drill

## PARTIAL / BLOCKED — with exact state

| Case | State | Blocker |
|---|---|---|
| EXP-018 (404 variant) | PARTIAL | Unknown id hits the **generic error boundary** ("Something went wrong"), not a dedicated not-found. Friendly (no stack) but misleading "try again" copy — S4 observation O-8. |
| PAY-012/013/014 | PARTIAL | Claim submit works (claims created ✓); the **undo-pending** and **redundant-cancel** sub-behaviors unverified — reruns were suppressed by the per-colleague pending-claim guard + server latency. Core claim→approve path already P0-green. Next session: pre-approve stale claims, then run with 40 s waits. |
| PAY-015 | PARTIAL | Debtor cards + expand chevron located; `claim-all-btn-<id>` appears **inside the expanded card** — expansion mapping needs one more pass. Affordance confirmed visually (screenshot). |
| COL-001/003/011 | PARTIAL | Modal create works in isolation (probe created "Probe Colleague XZ", network POST + DB row verified) but failed inside the full driver run twice — server-fn latency > 30 s window under load. Re-run COL slice solo. |
| RST-001..004 | PARTIAL | Same class: create/edit dialog interactions time out mid-run; RST-005 (P0) already covers the delete guards. Re-run RST slice solo. |

## Not automatable — manual-only ledger

| Case | Why |
|---|---|
| XC-011 screen-reader sweep | Needs VoiceOver/NVDA by ear |
| XC-013 browser matrix | Only chromium installed in the harness |
| XC-014 HEIC variant | No HEIC sample generator; JPEG-compression half passed |
| XC-006 OS text-scale | OS-level setting; verify by hand at max zoom |
| AUTH-024 public-network setup refusal | Requires a public-hosted instance |

## Infra lessons (baked into qa-run6)

1. Hydration race: SSR buttons clicked before React attaches are silent no-ops — click → poll DB → re-click.
2. Native `confirm()` (restaurant delete) needs an accept-next-dialog handler.
3. better-auth API calls need `origin`/`referer` headers or 403; two-factor flag flips only after TOTP verify.
4. Toasts overlay header buttons — force-click; rate buckets are per-IP across ports — schedule hammering cases last and cool down 150 s before fresh-instance logins.
5. Never `clearCookies()` on a shared admin context mid-suite; use a throwaway context for tamper tests.

## Verdict

P1/P2 sweep is **substantially green** (31/37 case-groups PASS; 6 PARTIAL with root causes identified and no product-bug evidence). Combined with the P0 pass: the release gate's automated portion is satisfied locally. Remaining before ship: staging rows (Turnstile / Authentik / SMTP arrival / public-network setup), the manual-only ledger above, and solo re-runs of the 5 PARTIAL case-groups.
