# Deploying the LMS to a Verpex cPanel account

This runbook targets a dedicated LMS subdomain on a reseller **client** account. Use a staging subdomain and an isolated staging database first. The existing release requires Node and PostgreSQL. Record the account evidence in [DEPLOYMENT_REQUIREMENTS.md](DEPLOYMENT_REQUIREMENTS.md) before choosing this route. MariaDB alone is a deployment blocker.

## 1. Build the candidate off-host

Use a trusted build machine running Node 24.22.0, npm and tar. In a clean checkout, run the following after the quality gates in [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

~~~sh
npm --prefix backend ci
npm --prefix frontend ci
node deployment/package.mjs
~~~

The packager rebuilds both applications, derives a runtime-only manifest and lock, checks a fresh production dependency installation and Argon2 hash/verify on the build machine, then removes the installed modules from the staging directory. It prints the archive path under `deployment/dist` and writes an adjacent SHA-256 checksum. Upload both to a private staging directory. The package contains a compiled API and management CLIs, runtime installation manifest and lock, public assets, SQL migrations, a production environment template and these deployment runbooks. Install dependencies on Linux so Argon2 loads the binary for that platform. Keep the original source checkout, lockfiles, archive and checksum with the release record.

## 2. Prepare the site and private paths

In **cPanel → Domains**, create the staging subdomain with its own empty document root. In **SSL/TLS Status**, enable the certificate and confirm renewal and HTTP-to-HTTPS redirection. Resolve the real account home path from cPanel. Example paths below use the placeholder account name ACCOUNT.

| Path | Contents |
|---|---|
| /home/ACCOUNT/public_html/lms | Dedicated domain document root, containing only the provider's application mapping files |
| /home/ACCOUNT/lms/releases/RELEASE/backend | Application root, app.cjs, dist, npm package and lock |
| /home/ACCOUNT/lms/releases/RELEASE/web | Only directory the application serves as static content |
| /home/ACCOUNT/lms/releases/RELEASE/database | Private SQL outside both public roots |
| /home/ACCOUNT/lms/shared/uploads | Persistent user files, separate from the release |
| /home/ACCOUNT/lms/shared/logs and /home/ACCOUNT/lms/shared/config | Logs, job and migration configuration. Restrict directory access to the service account, secret files to 0600. |

From the private upload directory set umask 077, verify the checksum, inspect the archive listing, then extract into a **new** release directory. Substitute the real filename, account and a unique release ID.

~~~sh
umask 077
sha256sum -c cbid-lms-HASH.tar.gz.sha256
tar -tzf cbid-lms-HASH.tar.gz
mkdir -p /home/ACCOUNT/lms/releases /home/ACCOUNT/lms/shared/{uploads,logs,config}
mkdir /home/ACCOUNT/lms/releases/RELEASE
tar -xzf cbid-lms-HASH.tar.gz -C /home/ACCOUNT/lms/releases/RELEASE
~~~

## 3. Provision the database and verify separation

On a host offering PostgreSQL, open **cPanel → PostgreSQL Database Wizard**, create a new LMS database and two unique login users, then record their actual names including any prefix. Stop before migrations unless the provider confirms the following setup. A wizard can create names and grant database access, but the DBA must provide the exact SQL security identities this release uses.

1. The application must connect **as cbid_app itself**. The role must be isolated for this installation with LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE and NOBYPASSRLS, and no membership in the schema owner or other privileged roles. A globally shared cbid_app login across different customers is unacceptable. Ask for a private database cluster or use an approved isolated external service when names collide.
2. Use a separate owner for the database, tables, functions and public schema. Have the provider DBA provision the database and privileges equivalent to the packaged `database/bootstrap.sql` in the intended isolated cluster. The provider should supply roles/passwords securely. Run the wizard and equivalent DBA provisioning as one coordinated setup to avoid conflicting ownership. Never hand the API the system database administrator or schema owner URL.
3. In the target database, the DBA creates citext, pgcrypto and pg_trgm, revokes public CREATE on schema public and grants schema USAGE to cbid_app. The owner must be able to apply migrations and create the app schema, tables, policies and security-definer functions. A PostgreSQL endpoint that permits only a single owner login is unsuitable.
4. With psql or the provider's SQL console, run the checks below **as the application role**. The first row must report cbid_app and false in all privilege columns, the next must list the three extensions. After migration, the final query must return false. Also review inherited memberships with the DBA. For a remote database use certificate-verifying TLS (for example sslmode=verify-full with a trusted CA) and restrict allowed source addresses.

~~~sql
SELECT current_user, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
FROM pg_roles WHERE rolname = current_user;
SELECT extname FROM pg_extension WHERE extname IN ('citext','pgcrypto','pg_trgm');
SELECT has_table_privilege(current_user, 'sessions', 'SELECT');
~~~

## 4. Configure Node in cPanel

Open **Software → Setup Node.js App → Create Application**. If the host exposes **Application Manager** instead, first verify its equivalent startup file, ESM compatibility and application root mapping with support.

| Field | Set to |
|---|---|
| Node version | Account offers 24.22.2 with npm 11.19.1; validate the release on this patch in staging |
| Mode | Production |
| Application root | lms/releases/RELEASE/backend relative to the account home |
| URL | Dedicated HTTPS domain, mounted at / |
| Application startup file | app.cjs, which loads the compiled ESM server and resolves the sibling web directory |

The one managed application answers /api and serves the static bundle on the same origin. Confirm with Verpex that this application's maximum process count is one when Redis is unset. Automatic process scaling would multiply the database pool and split per-client rate limits across processes. If the account cannot enforce this limit, revisit rate-limit storage and connection sizing before release. Deep links resolve through the Fastify HTML fallback. Preserve cPanel's generated handler and .htaccess directives. No custom rewrite, proxy module, separate Vite server or public port forwarding is required for this mode. If the manager cannot map the domain root or route nested URLs this way, stop and have Verpex correct the mapping. Disable LSCache/CDN caching for /api/* regardless of query parameters or cookies. Cache hashed /assets files according to origin response headers.

Use the Node environment activation command printed by the selector in Terminal. Check `node -v` and `npm -v`, change to the private backend root, then run `npm ci --omit=dev` and `node -e "require('@node-rs/argon2')"`. If the selector uses a managed node_modules symlink, confirm with support that lockfile installation is supported and the native module resolves from this app root. Retain the installation output with secrets redacted. A missing platform package or an unreachable registry blocks startup.

Set the following in the **web application** environment, then save:

| Variable | Production value |
|---|---|
| NODE_ENV, LOG_LEVEL | production, info |
| APP_ORIGIN, COOKIE_SECURE | Exact HTTPS origin, without trailing slash; true |
| DATABASE_URL | Restricted cbid_app URL supplied by DBA; percent-encode password characters |
| DB_POOL_MAX, DB_STATEMENT_TIMEOUT_MS | Initially 3 and 10000; verify total DB connection budget |
| UPLOAD_DIR, MAX_UPLOAD_MB | Absolute shared/uploads path and a value 1–50 compatible with host body size and disk quotas |
| TRUST_PROXY | false unless the only path to the app is through a trusted proxy that overwrites forwarded headers; test real client IP and spoofed X-Forwarded-For |
| HOST, PORT | Use the manager's routing configuration. The entry point calls listen once. Test the actual manager's port/socket integration. |

The startup adapter fixes SERVE_STATIC_DIR to the release's web directory. Leave REDIS_URL unset on the qualified single-process setup. Keep DATABASE_OWNER_URL, SMTP credentials and bootstrap administrator password out of the web process. The packaged backend/.env.example contains production placeholders. Replace every placeholder before use and choose session, lockout and retention settings after review. Job configuration belongs in its separate private file.

## 5. Migrate and provision the first coordinator

Create a private dotenv file `/home/ACCOUNT/lms/shared/config/owner.env` readable only by the maintenance operator with DATABASE_OWNER_URL and NODE_ENV=production. Keep this file outside the application root and configure operator access independently where supported. The app and maintenance CLI share one OS account on many reseller plans, so isolation of database credentials from a compromised OS account remains limited.

Back up existing data and stop traffic and jobs before an upgrade affecting schema compatibility. In the activated Node environment, run these from the release's backend folder. Migrations run in order, one transaction per file, with history and checksums. A failed run must be inspected before retry. Do not edit an already-applied SQL file or run seed on this database.

~~~sh
node --env-file=/home/ACCOUNT/lms/shared/config/owner.env dist/scripts/migrate.js
node --env-file=/home/ACCOUNT/lms/shared/config/owner.env dist/scripts/migrate.js
~~~

Verify the second run applied zero migrations. On a **new production installation**, provision the first administrator once with its actual approved email and name. In a private bash terminal, read its password without echo or a history entry.

~~~sh
read -rsp 'Initial coordinator password: ' ADMIN_PASSWORD && printf '\n'
export ADMIN_PASSWORD
node --env-file=/home/ACCOUNT/lms/shared/config/owner.env dist/scripts/create-admin.js --email registrar@YOUR-DOMAIN --name 'Programme Coordinator'
unset ADMIN_PASSWORD
~~~

## 6. Schedule bounded jobs and restart

Create `shared/config/job.env` with NODE_ENV=production, APP_ORIGIN, COOKIE_SECURE=true, DATABASE_URL, DATABASE_OWNER_URL, UPLOAD_DIR, SMTP_URL and MAIL_FROM, plus the approved retention settings. Set restrictive permissions, URL-encode credentials, use a verified sender and TLS-protected SMTP. Check actual quota and retries. Test in staging with a controlled mailbox.

In **Advanced → Cron Jobs**, select a five-minute schedule if permitted. The inspected account's Node 24 executable is `/opt/alt/alt-nodejs24/root/usr/bin/node`; verify it again when selecting the runtime for the release. Substitute it, real directories and release ID below. Use only one schedule for the active release. This worker mode takes the database advisory lock, performs a bounded pass and exits. Check heartbeat, backlog and age in administrator status. If an interval permitted by Verpex misses quiz or password-reset delivery targets, escalate before rollout.

~~~sh
cd /home/ACCOUNT/lms/releases/RELEASE/backend && /ABSOLUTE/NODE --env-file=/home/ACCOUNT/lms/shared/config/job.env dist/worker.js --once >> /home/ACCOUNT/lms/shared/logs/cron.log 2>&1
~~~

Restart via **Setup Node.js App → Restart** after each release or environment change. In a verified Passenger manager use its supported restart action. Check the manager application error log, cPanel Errors and cron.log. Record paths and arrange size/time rotation with the operator, inspect failed/excessively old queued email, check disk/inodes and schedule regular restores.

## 7. Verify in staging, promote and roll back

1. Run the checks on [the production checklist](PRODUCTION_CHECKLIST.md). Confirm /api/health returns JSON 200 over HTTPS, /login and a refreshed nested route load the proper frontend, a missing /assets file returns 404, and the browser console is clear of resource/CSP failures.
2. Inspect the secure session cookie and API cache headers. Try two separate browser sessions as different learners. Private responses, grades and files must stay with their own account. Test an unauthorized URL and ensure /.env, /database/bootstrap.sql, /backend/package.json and uploaded storage paths never serve their contents.
3. Test a real invite/reset to a controlled inbox, learner submission, trainer grading/release and administrator audit. Check timeouts and CPU/RAM/IO while concurrent users are active; keep the measurements, SMTP result and restore evidence.
4. Rehearse the same archive and migrations against a staging copy, then schedule production maintenance. Take a matched database/upload/config backup before switching. Point the application's private root and job path to the chosen release and restart; retain the previous archive.
5. If the schema remains compatible, stop writes/jobs and point both app and job paths back to the previous release, restart and repeat health/role checks. For incompatible schemas, restore the matching snapshot into a **new** isolated database and uploads directory and validate before switching both URLs and upload path. Record any writes since the snapshot and reconcile them under the company's recovery policy. See [backup and recovery](BACKUP_AND_RECOVERY.md).
