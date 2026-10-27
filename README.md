# PulseBoard

**Real-time sales, inventory and customer analytics for small businesses.**

PulseBoard is a production-minded full-stack dashboard that turns a café or small retail
chain's point-of-sale data into live revenue, product and staffing insight. It ships with a
real API, a real database, role-based access control and WebSocket updates — no mock data
layer and no UI-only demos.

[![CI](https://github.com/nuraliyevumidjon242-hue/pulseboard/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](apps/api/tsconfig.json)

---

## Why PulseBoard

Small businesses usually see yesterday's numbers in a spreadsheet. PulseBoard gives the
whole team one live operational picture:

- **Owners** compare stores, watch margins and export board-ready reports.
- **Managers** restock, correct stock and keep an eye on the floor.
- **Cashiers** ring up sales in a fast, keyboard-friendly till.
- **Viewers** follow performance without touching operational data.

Every number on screen comes from PostgreSQL through a validated REST API; every completed
sale pushes a WebSocket event to open dashboards.

## Feature highlights

### Live dashboard
- Today's revenue, transactions, average basket and items sold with period-over-period deltas.
- Revenue area chart, hourly traffic bars, payment-method mix donut and top-product ranking.
- Recent sales and low-stock panel that refresh automatically after a sale.
- Milestone celebrations and toast notifications delivered over Socket.io.
- Store switcher with per-store currency and timezone.

### Sales / point of sale
- Product search by name, SKU or barcode, quantity stepping and live basket totals.
- Fixed-amount discounts, customer name, notes and four payment methods.
- Atomic stock deduction; a sale can never oversell inventory.
- Generated transaction IDs (`NWC-20261026-FE75A0`), printable receipts and a detail drawer.
- Filterable, paginated sales history with CSV export.

### Inventory
- CRUD for products with SKU, category, cost, price, stock thresholds, unit and expiry date.
- Manual adjustments with an audit trail (purchase, loss, damage, correction, return).
- Low-stock and out-of-stock views, inventory valuation and potential revenue.
- CSV import with per-row error reporting and a downloadable template.
- Automatic low-stock email alerts (when SMTP is configured) and in-app notifications.

### Analytics
- Revenue trends by day/week/month, peak-hour heatmap data, product performance and margins.
- Customer analytics: repeat rate, average spend and top customers.
- Store comparison for multi-location owners.
- PDF and CSV export generated server-side.

### Team, stores and settings
- Invitations with expiring tokens, role changes and member removal.
- Role matrix: admin, manager, cashier and viewer, scoped per store.
- Multiple stores under one business owner, with per-store settings.
- Profile editing, password change, sign-out-everywhere and account preferences.
- Store identity, location, receipt prefix, low-stock alerts, retention and owner-only deletion.
- Light/dark/system theme persisted to the user profile.

### Three languages, everything translated
The whole interface works in **English**, **German** and **Uzbek (Latin)** — not just the
navigation. That includes:

- Every screen, modal, drawer, empty state and toast.
- Form validation and server-side errors (for example *"E-Mail oder Passwort ist falsch"*
  and *"Elektron pochta yoki parol noto'g'ri"*).
- Number grouping, compact notation (`12,4 Tsd.` / `12,4 ming`), currency symbols, month and
  weekday names, and relative timestamps.
- Per-store currency and timezone, independent of the interface language.
- A language switcher in the topbar **and** on the auth pages, so visitors can change the
  language before signing in.
- First-visit language detection from the browser, then persisted to both `localStorage` and
  the user's profile.

The i18n layer has no runtime dependency: English source strings are the keys, German and
Uzbek dictionaries are typed, and Uzbek formatting is implemented in-house because browser
ICU support for Latin Uzbek is inconsistent. See
[`apps/web/src/lib/i18n.ts`](apps/web/src/lib/i18n.ts) and
[`apps/web/src/lib/translations`](apps/web/src/lib/translations).

## Tech stack

| Layer | Choices |
| --- | --- |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS, Recharts, TanStack Query, React Hook Form + Zod, Zustand |
| Backend | Node.js, Express, TypeScript (strict), Drizzle ORM, Zod, Socket.io, Pino |
| Database | PostgreSQL 16 in production; embedded **PGlite** for zero-setup local development and tests |
| Auth | Short-lived JWT access tokens (memory only) + rotating httpOnly refresh tokens with reuse detection |
| Delivery | Docker multi-stage builds, Nginx, Docker Compose, GitHub Actions |
| Quality | Vitest + Supertest + Testing Library, ESLint 9 flat config, Prettier, coverage thresholds |

## Architecture at a glance

```
Browser (React SPA)
  │  REST /api/v1  +  WebSocket /socket.io
  ▼
Nginx (static assets, SPA fallback, reverse proxy)
  ▼
Express API ── Zod validation ── services ── Drizzle ── PostgreSQL
  │                                               └─ PGlite (dev/test)
  ├── JWT access + rotating refresh cookies
  ├── Socket.io rooms per store and per user
  └── Pino structured logs, rate limits, helmet
```

Deeper notes live in [docs/architecture.md](docs/architecture.md), and production guidance
in [docs/deployment.md](docs/deployment.md).

## Quick start (no database server required)

**Prerequisites:** Node.js ≥ 20.19 (22 LTS recommended) and npm ≥ 10.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # optional — sensible defaults are built in
npm run seed                             # creates the demo business, stores and 90 days of sales
npm run dev
```

Windows PowerShell:

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
npm run seed
npm run dev
```

Stop the dev servers before running `npm run seed`: PGlite allows only one process to open
the local data directory at a time.

| Service | URL |
| --- | --- |
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/health |
| Interactive API docs (Swagger UI) | http://localhost:4000/api/docs |

### Demo accounts

All demo accounts use the password **`PulseDemo2026!`**.

| Email | Role | Scope |
| --- | --- | --- |
| `owner@demo.dev` | Business owner / store admin | Nordwind Café + Kiez Markt |
| `manager@demo.dev` | Manager | Nordwind Café |
| `cashier@demo.dev` | Cashier | Nordwind Café |
| `alex@demo.dev` | Viewer | Nordwind Café |

The seed includes 90 days of realistic sales, intentional low-stock products and activity
history so every screen has something to show.

## Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API (`:4000`) and web (`:5173`) together |
| `npm run dev:api` / `npm run dev:web` | Run one side only |
| `npm run seed` | Seed demo data (use `-- --force` to reset demo records) |
| `npm run typecheck` | TypeScript for both workspaces |
| `npm run lint` | ESLint flat config, zero warnings allowed |
| `npm test` | API (Vitest + Supertest) and web (Testing Library) suites |
| `npm run test:coverage` | API coverage report with enforced thresholds |
| `npm run build` | Compile the API and build the web bundle |
| `npm run verify` | Format check, typecheck, lint, tests and build |
| `npm run format` | Prettier across the repository |
| `npm run db:generate` | Generate a Drizzle migration after schema changes |
| `npm run db:migrate` | Apply pending migrations |

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Production with Docker Compose

The compose stack runs PostgreSQL, the API and an Nginx-served web client with health
checks and a one-off seed job.

```bash
npm run docker:env    # creates .env with random database and JWT secrets
npm run docker:up     # builds images and starts db + api + web
npm run docker:seed   # optional: load demo data
```

Open http://localhost:8080. Useful lifecycle commands:

```bash
npm run docker:logs
npm run docker:down          # stop containers, keep the database volume
docker compose down -v       # stop and delete the database volume
```

The API **refuses to start in production** with placeholder or development JWT secrets, so
generate real values (or let `docker:env` do it) before deploying. Set `COOKIE_SECURE=true`
and `APP_URL` to your HTTPS origin when terminating TLS in front of the stack.

See [docs/deployment.md](docs/deployment.md) for TLS, backups, SMTP and scaling guidance.

## Presentations

Portfolio-ready slide decks live in the repository as static HTML — no build step and no
external assets:

| Language | Deck |
| --- | --- |
| English | [`presentations/en/index.html`](presentations/en/index.html) |
| Deutsch | [`presentations/de/index.html`](presentations/de/index.html) |
| O'zbekcha | [`presentations/uz/index.html`](presentations/uz/index.html) |

Open [`presentations/index.html`](presentations/index.html) for a language chooser, or open a
deck directly in a browser. Navigate with `←` / `→`, `Space`, or the on-screen controls; press
`F` for fullscreen. The decks cover the problem, the product, the architecture, security,
quality and the roadmap, using the same design language as the app.

## Configuration

The API validates every variable at boot with Zod and exits with a readable error if a value
is missing or invalid. See [`apps/api/.env.example`](apps/api/.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `4000` | API port |
| `APP_URL` | `http://localhost:5173` | Public web origin used in emails and links |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `DATABASE_URL` | — | PostgreSQL URL; empty means embedded PGlite |
| `PGLITE_DATA_DIR` | `.data/pglite` | Local PGlite directory |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev values | ≥ 24 characters, distinct in production |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh session lifetime |
| `COOKIE_SECURE` | `true` in production | Require HTTPS for the refresh cookie |
| `COOKIE_DOMAIN` | — | Optional custom cookie domain |
| `RATE_LIMIT_*` | see example | Global and auth rate limits |
| `TRUST_PROXY` | `false` | Enable behind Nginx/load balancer |
| `LOG_LEVEL` | `info` | Pino log level |
| `MAIL_FROM` | PulseBoard sender | Transactional email sender |
| `SMTP_*` | — | SMTP delivery; without it emails are logged locally |

## API overview

- Base path: `/api/v1`
- Success envelope: `{ "data": ..., "meta": ... }`
- Error envelope: `{ "error": { "code", "message", "details", "requestId" } }`
- Auth: `Authorization: Bearer <accessToken>`; refresh via the httpOnly `pb_refresh` cookie
- Docs: Swagger UI at `/api/docs`, raw OpenAPI at `/api/openapi.json`
- Health: `/health` (used by Docker and load balancers)

Main resource groups: `auth`, `stores`, `products`, `inventory`, `sales`, `analytics`,
`team`, `activity-log`, `notifications` and `user/preferences`.

Realtime events: `sale:created`, `inventory:updated`, `notification:new`,
`milestone:reached`. Sockets authenticate with the access token and join only stores the
user may access.

## Roles and permissions

Permissions are resolved per store on the server; the UI hides actions a role cannot perform,
and every endpoint re-checks access.

| Capability | Admin | Manager | Cashier | Viewer |
| --- | :---: | :---: | :---: | :---: |
| View dashboard, sales, analytics | ✅ | ✅ | ✅ | ✅ |
| Create sales | ✅ | ✅ | ✅ | — |
| Manage products / stock | ✅ | ✅ | — | — |
| Export reports | ✅ | ✅ | — | — |
| Manage team | ✅ | — | — | — |
| Change store settings | ✅ | — | — | — |
| Delete store (owner only) | ✅ | — | — | — |

## Testing

```bash
npm test                 # 90 API + 54 web tests
npm run test:coverage    # API coverage with thresholds
npm run verify           # everything CI runs (format, types, lint, tests, build)
```

The API suite boots an isolated in-memory PostgreSQL (PGlite), runs real migrations and
exercises authentication, tenant isolation, RBAC, sales, inventory, analytics, team
invitations and security edge cases through Supertest. The web suite covers formatting,
permission resolution, guards, the UI kit and modal behaviour with Testing Library.

## Project structure

```
.
├── apps/
│   ├── api/
│   │   ├── drizzle/               SQL migrations
│   │   ├── src/
│   │   │   ├── config/            validated environment
│   │   │   ├── db/                schema, migrations, seed
│   │   │   ├── middleware/        auth, validation, errors, rate limits
│   │   │   ├── modules/           auth, stores, products, sales, analytics, team…
│   │   │   ├── realtime/          Socket.io server and event bus
│   │   │   └── docs/              OpenAPI document
│   │   └── Dockerfile
│   └── web/
│       ├── src/
│       │   ├── app/               providers, error boundary
│       │   ├── components/        layout, charts, UI kit, guards
│       │   ├── features/          sale, product, store and team flows
│       │   ├── pages/             route-level screens
│       │   ├── hooks/             API, store context, socket bridge
│       │   ├── stores/            auth, UI and toast state
│       │   └── lib/               API client, permissions, formatting
│       ├── Dockerfile
│       └── nginx.conf
├── docs/                          architecture and deployment notes
├── presentations/                 self-contained slide decks (EN / DE / UZ)
├── scripts/                       environment bootstrap and i18n tooling
├── CHANGELOG.md
├── docker-compose.yml
└── .github/                       CI, issue templates, pull-request template
```

## Engineering decisions

- **PGlite by default, PostgreSQL in production.** A reviewer can clone and run the full
  stack without installing a database, while migrations and queries target real PostgreSQL.
- **Money is integer-adjacent.** Amounts are calculated in cents and stored as
  `NUMERIC(12,2)`; the API serialises decimal strings so no floating-point drift reaches the
  client.
- **Access tokens never persist.** They live in memory; the refresh token is hashed in the
  database, rotated on every use and revoked across all sessions if an old token is replayed.
- **Tenant checks live in middleware.** Every store-scoped route resolves membership and
  permissions before the service runs.
- **Realtime is additive.** Pages work from REST alone; Socket.io invalidates queries and
  raises toasts, so a dropped socket degrades freshness, not correctness.
- **Server-side exports.** PDFs and CSVs are generated by the API from the same aggregates
  used on screen, avoiding duplicated reporting logic.

## Known limitations

- Single-region deployment; Socket.io scaling would need a Redis adapter for multiple API
  replicas.
- Email delivery requires SMTP; without it, reset and invitation links are written to the API
  logs.
- The demo seed is intentionally deterministic; use `--force` to rebuild it after schema or
  seed changes.
- The Docker Compose stack was built and smoke-tested locally (db, api and web all report
  `healthy`) and is also exercised by CI.

## License

[MIT](LICENSE) © 2026 PulseBoard contributors
