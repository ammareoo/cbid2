import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = process.argv[2] ?? '4100';
const database = new URL(process.env.E2E_DATABASE_URL ?? 'postgres://cbid_app:app_dev_pw@localhost:5432/cbid_lms_e2e');
const owner = new URL(process.env.E2E_DATABASE_OWNER_URL ?? 'postgres://cbid_owner:owner_dev_pw@localhost:5432/cbid_lms_e2e');
if (!database.pathname.endsWith('_e2e') || database.host !== owner.host || database.pathname !== owner.pathname) {
  throw new Error('Both E2E connections must point to the same dedicated _e2e database');
}
const uploads = await mkdtemp(path.join(tmpdir(), 'cbid-e2e-'));
Object.assign(process.env, {
  NODE_ENV: 'test', PORT: port, HOST: '127.0.0.1', LOG_LEVEL: 'warn',
  DATABASE_URL: database.href, DATABASE_OWNER_URL: owner.href,
  APP_ORIGIN: 'http://localhost:' + port, COOKIE_SECURE: 'false',
  SERVE_STATIC_DIR: path.join(root, 'frontend/dist'), UPLOAD_DIR: uploads,
  AUTH_RATE_LIMIT_PER_MINUTE: '100', REDIS_URL: '',
});
process.chdir(path.join(root, 'backend'));
const { tsImport } = createRequire(new URL('../backend/package.json', import.meta.url))('tsx/esm/api');
try {
  const { buildApp } = await tsImport('../backend/src/app.ts', import.meta.url);
  const { loadConfig } = await tsImport('../backend/src/config.ts', import.meta.url);
  const app = await buildApp(loadConfig());
  const close = async () => { await app.close(); await rm(uploads, { recursive: true, force: true }); };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  await app.listen({ host: '127.0.0.1', port: Number(port) });
} catch (error) {
  await rm(uploads, { recursive: true, force: true });
  throw error;
}
