# Backup, recovery and maintenance

Database roles/provisioning must be resolved before executing these procedures on cPanel. Use the account's verified client tools only after checking client/server compatibility. Never place backups or connection secrets under public_html or web/.

## Back up a consistent release

1. Put the app into a maintenance window that stops writes; pause scheduled work. A banner alone does not block writes.
2. Record release checksum and applied `schema_migrations` filenames/checksums.
3. Use a protected PostgreSQL service/password file (permissions 0600); do not put passwords on the command line. Example: `pg_dump --dbname=service=cbid_backup --format=custom --file=/home/cbidinstitute/backups/lms-YYYYMMDD.dump`.
4. Back up the private upload directory and protected environment/configuration, preserving ownership and permissions. Profile photos are included in the database dump.
5. Encrypt off-host copies and restrict restore access. Check archive checksums and backup exit codes before resuming writes/cron.

Proposed starting retention: daily backups for 14 days and weekly copies for 8 weeks, subject to company recovery/privacy policy and measured capacity. This is a recommendation, not a verified Verpex retention guarantee. Choose recovery point/time targets with the operator and rehearse them.

## Restore rehearsal / disaster recovery

1. Provision an empty isolated database with the required trusted roles/extensions. Never restore over a live database first.
2. Restore with `pg_restore --exit-on-error --dbname=service=cbid_restore /private/path/lms.dump`. Preserve ownership, grants and RLS; do not use `--no-owner` as an unreviewed workaround.
3. Restore matching uploads and configuration into private staging locations. Compare counts, migration checksums, file hashes and ownership. Check RLS policies and API role restrictions.
4. Start the matching archived application release against restored resources; verify sign-in, authorized/denied downloads, submissions, grades and certificate records. Disable outbound mail during rehearsal to avoid duplicate messages.
5. Record elapsed time and losses against agreed targets. Only switch the live application after validation. Keep the old data until the recovery is accepted.

On 6 November 2026, a PostgreSQL 18 owner-created custom dump of the synthetic integration database restored successfully into a fresh database with `--exit-on-error`. All 33 table counts matched; 61 RLS policies remained present, the restricted API login saw zero users without a request identity and could not read password hashes. A second dump/restore included a synthetic profile image and verified its bytes exactly. Evidence and dump checksums are in PROJECT_AUDIT.md. Private upload-file/config recovery and host restore remain unverified release gates.

## Migration and application rollback

Migrations are additive and checksum protected. Do not edit applied SQL or assume an older application understands a newer schema. Prefer a tested forward fix. If a schema rollback is required, restore the coordinated pre-release database/uploads/configuration into fresh locations, start the matching previous release, validate it, then switch traffic. Writes after that backup need a reconciliation plan; do not silently discard them.

## Routine maintenance

- Check `/api/health`, cron exit status/heartbeat, failed email queue age and storage daily. Health alone does not prove SMTP or worker functionality.
- Rotate application/cron logs with the hosting mechanism; retain only what is needed for operations. Do not log passwords, session cookies, reset links or database connection strings.
- Monitor disk/inodes, memory/CPU faults and database connections before capacity is exhausted.
- Keep locked dependencies patched and rerun affected tests. Keep previous release archive/checksum for rollback.
- Rotate secrets through the hosting secret configuration and restart affected processes. Invalidate compromised sessions/reset tokens and verify new credentials; do not keep secrets in source control or public directories.
