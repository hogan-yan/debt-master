# Contributing

Thanks for your interest in contributing to Debt Master.

## Development setup

Prerequisites: [Bun](https://bun.sh) 1.4+ and a local Postgres (or `docker compose -f docker-compose.dev.yml up postgres`).

```sh
bun install
cp apps/web/.env.example apps/web/.env   # set DATABASE_URL at minimum
bun run prisma:generate                  # from apps/web (or: cd apps/web && bun run prisma:generate)
bun run dev                              # dev server on http://localhost:3000
```

This is a Bun workspace monorepo:

```
apps/web/           # TanStack Start web app (@debtmaster/web)
packages/core/      # Shared money + split math (@debtmaster/core)
```

## Quality gates

Every change must pass the gates before review:

```sh
bun run typecheck   # TypeScript, zero errors
bun run lint        # Biome, zero warnings
bun run test        # web unit/component suite (vitest)
bun run test:core   # shared money/split package (vitest, coverage-gated)
```

`packages/core` is the single home for money and split math (bigint minor units, zero float). Never recreate money/split helpers inside an app; new shared code belongs in a `packages/*` workspace.

## Fork policy for `packages/core`

> **`packages/core` is an upstream fork.** The source repository is not public.
> Please **file an issue** (do not open PRs) for changes to `packages/core`;
> the maintainer fixes it upstream and ports the change here. PRs touching
> `packages/core` will be redirected to an issue.

## Pull requests

- Keep PRs focused; one logical change per PR.
- CI runs typecheck, lint, the unit suite, integration tests, type-coverage, dead-code (knip), and a Playwright smoke — all must be green.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).

## Reporting vulnerabilities

See [SECURITY.md](./SECURITY.md) — please do not open public issues for security reports.
