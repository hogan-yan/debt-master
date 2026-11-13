# @debtmaster/core

> **Fork provenance:** twin copy of the core money/split package in the private
> DebtMaster repo. Forked 2026-11-13. Sync is maintainer-driven (private → here);
> please file issues instead of PRs for `packages/core`.

Shared money + split math for Debt Master: amounts are bigint minor units (zero float), with split helpers (equal, percent, shares, itemized, exact) and formatting/parse/convert utilities. Framework-free, zero runtime dependencies — usable from the web app, edge functions, and any future consumer.

Import as `@debtmaster/core` (a Bun workspace package — see the root `package.json`).
