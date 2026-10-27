# Contributing to PulseBoard

Thanks for taking the time to improve PulseBoard. This guide covers the local workflow and
the quality bar expected in pull requests.

## Setup

```bash
npm install
npm run seed
npm run dev
```

Use Node.js 22 LTS or newer. The default configuration uses PGlite, so no database server is
needed. Stop the dev servers before reseeding (one process per PGlite directory).

## Before opening a pull request

```bash
npm run verify
```

This runs Prettier checks, TypeScript, ESLint, both test suites and the production build.
`npm run format` fixes formatting automatically.

For schema changes:

```bash
npm run db:generate   # generate SQL after editing apps/api/src/db/schema.ts
npm run db:migrate    # apply locally
```

Commit the generated migration and snapshot. Do not edit an already-applied migration; add a
new one.

## Coding conventions

- TypeScript strict mode; no `any` unless the boundary is genuinely untyped and documented.
- Validate every external input with Zod at the route boundary.
- Put business logic in services; routes handle HTTP concerns only.
- Re-check store membership and permissions server-side for every store-scoped endpoint.
- Keep money in cents for arithmetic; serialise decimal strings at the API edge.
- Add accessible labels to controls and keep keyboard behaviour intact.
- Prefer small, focused components and typed query hooks over ad-hoc `fetch` calls.

## Tests

- API changes need an integration test that exercises the real route and database.
- Security-sensitive changes need a negative test (wrong role, wrong tenant, replay, etc.).
- UI primitives and permissions need unit/component tests.
- Keep the API coverage thresholds in `apps/api/vitest.config.ts` green.

## Commit messages

Use short imperative subjects with a conventional prefix:

```
feat: add per-store receipt prefixes
fix: preserve stock on partial product updates
test: cover refresh-token reuse detection
docs: document TLS termination
chore: bump React Router
```

## Pull request checklist

- [ ] `npm run verify` passes.
- [ ] New behaviour is covered by tests.
- [ ] Migrations are committed and reversible/documented.
- [ ] Screenshots or a short recording are attached for visible UI changes.
- [ ] No secrets, `.env` files or generated build output are included.
- [ ] Accessibility and mobile layout were checked for UI changes.
