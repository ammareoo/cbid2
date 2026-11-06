# Production readiness audit

Updated 6 November 2026. Status: **NOT READY for production deployment** while the database provisioning blocker remains. Existing UI/profile changes are preserved on `codex/production-readiness`.

## Findings and remediation

| Priority | Finding | Status / evidence |
|---|---|---|
| P1 | cPanel forces `cbidinstitute_` database/user prefixes; security functions and grants require literal `cbid_app` and `cbid_owner` | OPEN: provider must provision compatible isolated roles/extensions or a separately reviewed role migration is required. Never run requests as owner to bypass this. |
| P1 | Quiz autosave debounce/racing writes can lose the latest answer at submission | Fixed: ordered writes, revision-aware completion, immediate pending status, retry and submit blocking. Three regression tests pass. |
| P1 | Unsafe owner/superuser API credentials bypass database authorization | Production startup role verification added; backend regression coverage. |
| P2 | Worker assumes permanent background process and unbounded retention work | Bounded batches, advisory lock and `--once` cron mode with deadline added. |
| P2 | Profile uploads need streaming size enforcement and role/ownership coverage | Early 2 MB limit plus lifecycle/invalid-file regressions added. |
| P2 | Failed logout hides session state; network/HTML responses lack actionable handling | Auth/API handling and unit regressions added. |
| P2 | Browser test launcher assumes Bash on Windows; selectors reference removed UI | Cross-platform launcher and current-interface selectors verified by the full browser suite. |
| P2 | Automated accessibility failures in existing pages | Fixed completed-lesson/avatar contrast, verification link target size, calendar semantics and keyboard access to activity scrolling. Automated checks pass on tested pages; no full WCAG compliance claim. |
| P3 | Unused visual dependency breaks type/build; custom select loses native required behavior | Dead component removed; accessible native select restored. |
| P3 | README contains conflict markers and broken deployment link | Corrected in this release work. |

## Scope and security model

Reviewed frontend role pages, route modules, database migrations, authentication/CSRF/RLS, file storage, worker, configuration and deployment scripts. Feature inventory: `docs/FEATURES.md`; API and data model: `docs/ARCHITECTURE.md`; authorization matrix: `docs/SECURITY.md`. These documents describe implemented behavior; automated workflow results below determine what has been verified.

Retain parameterized SQL, strict request validation, Argon2 passwords, server sessions, CSRF, resource authorization, private uploads and RLS. Profile photos are authenticated resources stored in PostgreSQL, including backups. No production data was changed, seeded or deployed.

## Verification record

- Backend final run: **125/125 tests passed**, 11 files; lint/typecheck/build passed on 6 November.
- Frontend: **37/37 unit tests passed**, 5 files; lint/typecheck/build passed, including rechecks after accessibility changes.
- Both `npm audit --omit=dev` checks report **zero production dependency advisories**. Development toolchain advisories remain; no forced breaking upgrades were applied.
- Browser suite: **23/23 passed** (2.8 minutes) against the production frontend build and real API/PostgreSQL. Includes accessibility checks, permission/CSRF denials, assignment/grading/feedback, timed quiz, user/course creation, certificates, profile photos for all roles and mobile navigation for all roles. Desktop calendar/admin and mobile navigation screenshots were captured for visual review.
- Account inspection: Node 24.22.2/npm 11.19.1 available; Terminal works; PostgreSQL client 13.23 installed; database server version and extensions not verified. See `DEPLOYMENT_REQUIREMENTS.md`.
- PostgreSQL 18 synthetic restore: owner `pg_dump -Fc` and `pg_restore --exit-on-error` to fresh `cbid_restore_20261106_test` succeeded; all **33 table counts matched**, 61 RLS policies present, unauthenticated-identity API user query returned zero rows and password-hash column access was denied. Dump SHA-256: `9B72C5C74B37D6882CFF018F8ADF42A9CC340DE19F93BBE8EAEC7F0A2E8E9622`. This fixture had no stored profile photos or upload files; live file/config restoration remains a staging gate.
- A second synthetic dump/restore into `cbid_restore_photo_20261106_test` verified the profile-photo row and exact binary payload. Dump SHA-256: `3919548B47B885C84DA116DF587E2B5B3FEB027DC4F99F934008533CDFAECAB7`.
- SMTP delivery, live Passenger behavior, host backup restoration, resource/load capacity and manual assistive-technology testing remain unverified.

## Resume checkpoint

The runtime-only archive was built and inspected: no secrets, seed scripts, source maps, dev dependencies or Git history. Fresh production installation and native Argon2 verification passed. Extracted-package startup, health, nested-route fallback, asset serving, private endpoint denial and secret-path denial passed locally. Final visual review found and fixed a mobile dashboard column issue. The refreshed candidate is `deployment/dist/cbid-lms-7f1d460509097c2c.tar.gz`, with an adjacent SHA-256 file. It passed the same extracted-package startup checks. This is a staging candidate, not approval to deploy to the current cPanel database setup.

Hosting role provisioning remains a release gate; prepared questions are in `deployment/HOSTING_SUPPORT_REQUEST.md` (not sent). Real SMTP, host staging/restore and capacity validation must follow provider confirmation.
