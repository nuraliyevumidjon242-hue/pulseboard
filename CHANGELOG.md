# Changelog

All notable changes to PulseBoard are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-27

First public release. PulseBoard is a full-stack, real-time analytics dashboard for
independent retailers and small café chains.

### Added

- **Live dashboard** — revenue, transactions, average basket and items sold with
  period-over-period deltas, revenue area chart, peak-hour distribution, payment-method
  donut, top products, recent sales and low-stock panel, all refreshed over Socket.io.
- **Point of sale** — keyboard-friendly sale creation with product search by name, SKU or
  barcode, quantity stepping, fixed discounts, four payment methods, atomic stock deduction,
  printable receipts and a sale detail drawer.
- **Inventory** — product CRUD, manual stock adjustments with an audit trail, low-stock and
  out-of-stock views, inventory valuation, CSV import with per-row errors and a downloadable
  template.
- **Analytics** — revenue trends by day/week/month, product performance and margins,
  customer retention and top customers, multi-store comparison, and server-rendered PDF/CSV
  exports.
- **Team and stores** — expiring invitations, role changes per store, member removal,
  multiple stores under one owner, per-store currency/timezone and owner-only store deletion.
- **Settings** — profile editing, password change, sign out everywhere, theme and language
  preferences persisted to the user profile.
- **Trilingual interface** — complete English, German and Uzbek (Latin) UI including
  validation errors, server messages, formatting of numbers, currency, dates and relative
  time, plus first-visit language detection and a language switcher on the auth pages.
- **API** — versioned REST API with Zod validation, OpenAPI document, Swagger UI,
  role-based access control enforced per store, rate limiting, Helmet, structured Pino logs
  and a health endpoint.
- **Authentication** — short-lived JWT access tokens kept in memory, rotating httpOnly
  refresh tokens with reuse detection, password reset and invitation flows.
- **Delivery** — multi-stage Docker builds, Nginx with SPA fallback and security headers,
  Docker Compose stack with health checks and a one-off seed job, GitHub Actions CI.
- **Quality** — 90 API tests and 54 web tests, coverage thresholds, strict TypeScript,
  ESLint 9 flat config and Prettier.
- **Documentation** — architecture and deployment guides, security policy, contribution
  guide, issue and pull-request templates, and presentations in English, German and Uzbek.

### Security

- Access tokens never touch `localStorage`; refresh tokens are hashed at rest, rotated on
  every use and revoked across all sessions when an old token is replayed.
- Tenant membership and permissions are resolved in middleware before any store-scoped
  service runs.
- Production startup refuses placeholder or development JWT secrets.

[1.0.0]: https://github.com/nuraliyevumidjon242-hue/pulseboard-/releases/tag/v1.0.0
