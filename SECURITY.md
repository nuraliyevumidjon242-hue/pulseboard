# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private
vulnerability reporting ("Security" → "Report a vulnerability") on this repository, or
contact the maintainers privately.

Include:

- A description of the issue and its impact.
- Reproduction steps or a proof of concept.
- Affected version/commit and environment.
- Any suggested mitigation.

We aim to acknowledge reports within three business days and to publish a fix and advisory
once users have had a reasonable window to update.

## Supported versions

The `main` branch receives security fixes. Tagged releases are supported on a best-effort
basis; always deploy the latest patch.

## Security controls in PulseBoard

- Short-lived JWT access tokens kept in memory; rotating, hashed refresh tokens in httpOnly
  cookies with reuse detection.
- Bcrypt password hashing, password strength requirements and single-use reset tokens.
- Store-scoped RBAC enforced in middleware on every request, with tenant-safe 404s.
- Zod validation for bodies, queries and params; file upload size limits and CSV row limits.
- Helmet security headers, an explicit CORS allow-list, request body limits, compression and
  rate limiting (stricter on authentication and writes).
- Parameterised SQL through Drizzle; no string-concatenated queries.
- Structured logs with redaction of authorization headers, cookies, tokens and passwords.
- Production startup rejects placeholder or identical JWT secrets.
- Docker runtime uses a non-root user, `dumb-init`, health checks and no published database
  or API ports in the default compose topology.

## Operator responsibilities

- Serve over HTTPS and set `COOKIE_SECURE=true`.
- Generate unique, long secrets and store them in a secret manager.
- Keep `TRUST_PROXY` aligned with your actual proxy count.
- Restrict database network access and back up encrypted data.
- Configure SMTP credentials with a dedicated account and least privilege.
- Monitor dependencies; production audit is part of CI (`npm audit --omit=dev`).
