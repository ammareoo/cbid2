# Provider questions before LMS staging

Prepared for the account owner to send to Verpex. This has not been sent.

Our cPanel account offers Node 24.22.2 and PostgreSQL tools, but the database wizard prefixes users and databases with `cbidinstitute_`. The existing LMS requires isolated PostgreSQL roles `cbid_owner` (schema/migration owner) and `cbid_app` (restricted API login), RLS, security-definer functions and citext/pgcrypto/pg_trgm extensions. The installed psql client reports 13.23; server version is unknown.

Please confirm:

1. Actual PostgreSQL server version and extension availability, database connection quota, and whether an isolated database environment can support these exact roles without sharing a login with another customer. The API must have no superuser, BYPASSRLS, role-creation, schema-owner membership or password-hash read privileges.
2. If exact isolated roles cannot be supported, whether this account permits certificate-verified outbound PostgreSQL connections to a separate managed database. Please provide applicable egress restrictions.
3. Passenger/Node app process limit: can this application be capped at one process? What are its port/socket mapping, timeout and restart behavior?
4. Permitted cron frequency and maximum runtime, SMTP outbound ports/limits, and database/upload backup retention and restore facilities.

No database migration or public launch should take place before the role/extension requirements are resolved and tested.
