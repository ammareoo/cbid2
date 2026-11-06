# Production release checklist

Current status: **NOT READY**. Local preparation does not clear hosting release gates.

## Required before installation

- [ ] Resolve exact PostgreSQL role names, schema ownership, required extensions and supported server version with Verpex. cPanel's prefixed users are not currently interchangeable with `cbid_app`/`cbid_owner`.
- [x] Node 24.22.2 and npm 11.19.1 confirmed through account Terminal.
- [x] Terminal, PostgreSQL UI, cron UI, active SSL and resource limits observed.
- [ ] Confirm database connection quota, cron frequency/runtime limits, outbound SMTP and backup retention.
- [x] Local checks: 125 backend tests, 37 frontend unit tests, 23 browser tests, lint/typecheck and production builds passed. Production dependency audits returned zero advisories.
- [ ] Review the generated release archive manifest/checksum and verify installation on the target Linux runtime.

## Staging acceptance

- [ ] Use a dedicated staging database and private upload directory; never seed production.
- [ ] Install locked production dependencies under Node 24 and verify native Argon2 on Linux.
- [ ] Run additive migrations as owner; run the API only as the non-owner RLS role.
- [ ] Verify HTTPS, secure cookies, exact APP_ORIGIN, trusted proxy boundary and no direct public app port.
- [ ] Verify login/logout, invitations/recovery, account status changes and photo upload/replace/delete for all roles.
- [ ] Verify learner submission, trainer grading, released feedback, quiz autosave/expiry and certificate verification.
- [ ] Confirm cross-user/cross-course access is denied and private files require authorization.
- [ ] Verify nested-route refresh, static cache headers and no public source maps/secrets/backend source.
- [ ] Run cron `worker.js --once`; confirm heartbeat, successful email delivery and safe overlapping invocation.
- [ ] Restore database, uploads and protected configuration to a separate location and test access.
- [ ] Measure realistic workload memory/latency/connection usage within account limits.
- [ ] Keyboard/mobile/contrast and manual assistive-technology review.

## Launch and rollback

Take a coordinated pre-release backup, retain the previous verified archive, record migration versions and assign an operator. Switch only after the above gates pass. Check health, sign-in and worker heartbeat immediately after restart. Rollback instructions are in BACKUP_AND_RECOVERY.md. Do not declare readiness while a required box remains unverified.
