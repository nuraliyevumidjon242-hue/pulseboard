# Deployment

This guide covers the Docker Compose topology and the production concerns around it. The
compose file runs PostgreSQL 16, the API and an Nginx front end with health checks.

## Topology

```
Internet / TLS terminator
        │
        ▼ :8080 (or your reverse proxy)
   ┌─────────┐      /api, /socket.io      ┌─────────┐
   │  web    │ ─────────────────────────▶ │   api   │
   │ Nginx   │                            │ Express │
   └─────────┘                            └────┬────┘
                                               │
                                          ┌────▼────┐
                                          │   db    │
                                          │ Postgres│
                                          └─────────┘
```

Only the web container publishes a port. The API and database stay on the internal Docker
network.

## 1. Prepare configuration

```bash
npm run docker:env
```

This copies `.env.docker.example` to `.env` (mode `0600` on Unix) and replaces the three
placeholders with cryptographic random values. It never overwrites an existing `.env`.

Review the file:

| Variable | Notes |
| --- | --- |
| `APP_URL` | Public origin, e.g. `https://pulse.example.com`. Used in emails and CORS. |
| `WEB_PORT` | Host port for Nginx, default `8080`. |
| `POSTGRES_PASSWORD` | Database password; generated. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 96 hex characters each; generated and must differ. |
| `COOKIE_SECURE` | `false` for plain-HTTP localhost; `true` behind HTTPS. |
| `SMTP_*` / `MAIL_FROM` | Optional real email delivery. Without SMTP, messages are logged. |

The API validates configuration at boot. In production it refuses to start when JWT secrets
are development defaults, placeholders, identical, or when `DATABASE_URL` is missing.

## 2. Start the stack

```bash
npm run docker:up
```

This builds both images and waits for the database health check before starting the API. The
web container is only started once the API reports healthy. First boot applies migrations
automatically.

Check status and logs:

```bash
docker compose ps
npm run docker:logs
```

The app is at `http://localhost:8080` by default. Seed demo data once:

```bash
npm run docker:seed
```

`docker:seed` runs the compiled seed CLI in a one-off container. It skips existing demo data;
add `--force` to reset it:

```bash
docker compose run --rm seed --force
```

## 3. Put it behind TLS

Terminate TLS at a reverse proxy or load balancer, forward to `127.0.0.1:8080`, and set:

```env
APP_URL=https://pulse.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
```

Example Caddy site:

```caddyfile
pulse.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

Example Nginx TLS server:

```nginx
server {
    listen 443 ssl http2;
    server_name pulse.example.com;

    ssl_certificate     /etc/letsencrypt/live/pulse.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pulse.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

The outer proxy must forward WebSocket upgrades for `/socket.io/`; the bundled Nginx already
does.

## Secrets

- Keep `.env` out of version control (the repository ignores it).
- Rotate JWT secrets by generating new values and restarting the API. All access tokens and
  refresh sessions become invalid, which is the intended global sign-out.
- Rotate the database password by changing it in PostgreSQL first, then `.env`, then
  restarting the API.
- Store production secrets in your platform's secret manager instead of a file when possible.

## Database lifecycle

Migrations live in `apps/api/drizzle/*.sql` and are applied by the API on startup, in filename
order, exactly once per database (tracked in `_migrations`).

- Generate a new migration after schema edits: `npm run db:generate`.
- Apply migrations manually: `npm run db:migrate`.
- Migrations are additive by convention. For destructive changes, deploy in expand/migrate/
  contract steps rather than dropping columns used by the running version.
- With multiple API replicas, run migrations once (a release job) before rolling out.

### Backup and restore

```bash
# Backup
docker compose exec -T db pg_dump -U pulseboard -d pulseboard -Fc > pulseboard.dump

# Restore into an empty database
docker compose exec -T db pg_restore -U pulseboard -d pulseboard --clean --if-exists < pulseboard.dump
```

Schedule backups outside the host, test restores regularly, and keep the volume on durable
storage.

## Scaling notes

The current design targets a single API instance:

- In-process TTL cache for analytics.
- Socket.io rooms in process memory.
- Refresh sessions in PostgreSQL, so auth survives restarts.

Before running multiple API replicas:

1. Add the Socket.io Redis adapter and publish events through Redis.
2. Replace `lib/cache.ts` with Redis or remove it.
3. Run migrations as a separate release step.
4. Set `TRUST_PROXY` appropriately and rate-limit at the edge if you also rate-limit inside.
5. Point `/health` checks at every replica.

PostgreSQL connection pooling is handled by `pg` (max 10 per API process). Increase the pool
and the database's `max_connections` together.

## Manual (non-Docker) deployment

```bash
npm ci
npm run build
NODE_ENV=production \
DATABASE_URL=postgresql://user:pass@host:5432/pulseboard \
JWT_ACCESS_SECRET=... \
JWT_REFRESH_SECRET=... \
COOKIE_SECURE=true \
TRUST_PROXY=true \
node apps/api/dist/index.js
```

Serve `apps/web/dist` with any static host that supports SPA fallback, and proxy `/api` and
`/socket.io` to the API. Do not serve the SPA from a different origin unless you also set
`CORS_ORIGIN` and handle third-party cookie rules.

## Operational checks

| Check | Expected |
| --- | --- |
| `GET /health` via the web proxy | `200`, `checks.database.status = "up"` |
| `GET /api/docs` | Swagger UI loads |
| Login and reload | Session restores without re-entering credentials |
| Complete a sale in one tab | Dashboard and toasts update in another tab |
| `docker compose ps` | `db`, `api`, `web` healthy |
| Logs | JSON in production, no tokens or cookies |

## Troubleshooting

**Login succeeds but the session does not survive a reload.**
`COOKIE_SECURE=true` over plain HTTP prevents the browser from storing the refresh cookie.
Set it to `false` for local HTTP, or use HTTPS.

**CORS error.**
`APP_URL`/`CORS_ORIGIN` must exactly match the browser origin, including scheme and port.

**API exits at boot with "Invalid environment configuration".**
Read the printed field errors. Production also rejects placeholder JWT secrets.

**PGlite "database is locked" locally.**
Only one process may open `.data/pglite`. Stop `npm run dev` before seeding, or use
PostgreSQL via `DATABASE_URL`.

**WebSocket falls back to polling or disconnects.**
Ensure the outer proxy forwards `Upgrade`/`Connection` headers and does not buffer
`/socket.io/`. Increase read timeouts for long-lived connections.

**Docker build cannot find workspace packages.**
Build from the repository root; both Dockerfiles expect the root lockfile and workspace
manifests.
