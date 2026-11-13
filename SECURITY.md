# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately — do not open a public issue.

Report by email to the maintainer. TODO(owner email): confirm before Task 8 — fill in the reporting address before this file goes live.

Include what you can of: the affected component or endpoint, steps to reproduce or a proof of concept, impact, and any suggested fix. You will get an acknowledgement, and we will work with you on a coordinated disclosure timeline.

## Scope

- The web application in this repository (`apps/web`, `packages/core`), including its Docker packaging.
- Issues in third-party dependencies should be reported upstream; let us know too so we can track the fix.

## Hardening notes

Security-relevant knobs (trusted proxies, HSTS, body-size caps, setup-token gating, signed storage URL TTL) are documented in [.env.example](./.env.example) and validated at boot. Baseline security headers ship on every response by default.
