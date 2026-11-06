# Architecture and hosting decision

The current stack is React 19/Vite, Fastify/Node, and PostgreSQL. Requests flow through route validation, session/role checks, service queries and database RLS. `cbid_app` is the non-owner API identity; `cbid_owner` is restricted to migrations and scheduled jobs. Technical model and endpoints: `docs/ARCHITECTURE.md`.

## Recommended deployment, conditional on database provisioning

Retain the current stack. The authenticated cPanel account offers Node 24.22.2, npm 11.19.1, PostgreSQL tools, working Terminal and cron. A PHP/MySQL rewrite would replace extensive PostgreSQL RLS, security-definer functions and transactional behavior without current evidence that it is necessary.

Serve the compiled SPA from the same Fastify application under Passenger with the supplied `deployment/app.cjs`. One origin simplifies cookies and CSRF. Keep application code, credentials, logs and uploads outside the public document root; only `web/` is public content. Use bounded cron invocations of `worker.js --once` instead of an unmanaged daemon. Redis is optional for one API instance; shared rate limiting is required before scaling to multiple processes.

The recommendation is not deployment approval. cPanel prefixes database users, while existing guards require exact role names. Server version, extensions (`citext`, `pgcrypto`, `pg_trgm`), schema ownership and least-privilege role creation need a provider-supported solution. Do not rename roles by search-and-replace, modify applied migrations or disable RLS to get a deployment running.

## Resource limits

Observed account RAM is 2 GB, entry processes 30 and total processes 100. Start with one API process and a small database pool, plus the two-connection scheduled worker. Measure latency, memory, database connection usage and queue age on a staging workload; there is no verified concurrency guarantee. Static bundles are built locally, so the host need not run Vite or a development server.

## Operational boundaries

SMTP is required for real invitations and password recovery. Local development mail files are not production delivery. Restore database, uploads and protected configuration together. Profile images live in PostgreSQL; course/assignment files live in private storage. See the deployment, backup and production-checklist runbooks for release gates and recovery steps.
