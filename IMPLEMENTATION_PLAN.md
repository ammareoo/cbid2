# Implementation and verification plan

1. Preserve existing UI/profile changes and audit on `codex/production-readiness` — done.
2. Verify actual account capabilities — Node/npm/Terminal, cPanel database tools, cron and limits observed; database provisioning unresolved.
3. Fix security/reliability defects — implemented; 125 backend and 37 frontend tests pass, including photo and cron overlap regressions.
4. Fix quiz save ordering and submission race — complete; delayed-network, immediate-submit and failed-save retry regressions pass.
5. Repair browser tests for current navigation/settings/grading and fix actual accessibility defects — complete; 23 browser tests pass, including all-role photos and mobile navigation.
6. Run lint, typecheck, unit/integration tests, browser workflows and production builds — complete locally; exact results in PROJECT_AUDIT.md.
7. Restore a synthetic database dump into a fresh database and compare records/security metadata — complete locally (33 matching table counts, 61 policies). Verify host storage restoration separately before launch.
8. Build and inspect a clean runtime-only archive and checksum — complete; final candidate and startup verification recorded in PROJECT_AUDIT.md.
9. Independent diff/security review — ensure original work retained, migrations additive, no credentials/seed/source maps included.
10. Release only after provider resolves prefixed role provisioning and host staging verifies Passenger, SMTP, cron, backup/restore and resource behavior.

No production data replacement, public launch or account provisioning has been performed. Tests use dedicated `_test` and `_e2e` databases, never the working `cbid_lms` database.
