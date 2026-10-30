# Security Review

**Review date:** 2026-10-30
**Scope:** Repository source, Supabase database policies and Edge Functions,
backup tooling, and dependency audit output. This was a code review; no live
Supabase project or deployed environment was tested.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [scripts/backup-supabase.py](./scripts/backup-supabase.py) | 28-31 | Database backups accept `sslmode=require`, which encrypts the connection but does not verify the database server identity. An attacker able to intercept the connection could impersonate the host and capture database credentials and backup contents. | 9/10 |

### Recommended fix

Require `sslmode=verify-full` for backups, configure a trusted CA certificate
for libpq, and reject `require` and `verify-ca`. Keep the hostname in the
connection URL aligned with the certificate. Update the backup tests and
operations instructions to require hostname verification.

## Password storage

No plaintext password storage or custom password-hashing implementation was
found in the application. The client submits passwords to Supabase Auth for
signup and sign-in; password storage and verification are managed by Supabase
Auth. Do not store submitted passwords in application tables, logs, or backups
separately.

## Dependency audit note

At review time, `npm audit` reported three low-severity findings in `deepmerge`
through the `shadcn` / `@shadcn/registry` dependency chain. The audit suggested
a breaking `shadcn` upgrade, and the reviewed application code did not expose a
reachable vulnerable `deepmerge` operation. Recheck with `npm audit` during
routine dependency updates.

## Operational limitation

This review did not test a live deployment, Supabase project configuration,
database connection, or backup restore. Configure and verify production
security headers and backup connections at the hosting and database providers.
