import { hostname } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import pino from 'pino';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { finalizeExpiredAttempts, heartbeat, purgeExpired, sendPendingEmails } from './jobs/jobs.js';
import { createMailer } from './mail/mailer.js';

const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL });
if (!config.DATABASE_OWNER_URL) throw new Error('DATABASE_OWNER_URL is required for the worker');
const pool = createPool(config.DATABASE_OWNER_URL, { max: 2, appName: 'cbid-lms-worker' });
const mailer = createMailer({ smtpUrl: config.SMTP_URL, from: config.MAIL_FROM, env: config.NODE_ENV });
const name = `worker@${hostname()}`.slice(0, 64);
const once = process.argv.includes('--once');
let lastPurge = 0;

async function tick() {
  const lock = await pool.connect();
  try {
    const { rows } = await lock.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(727275) AS locked');
    if (!rows[0]?.locked) {
      log.info('another worker is processing jobs');
      return;
    }
    const result: Record<string, unknown> = {};
    result.expiredAttemptsClosed = await finalizeExpiredAttempts(pool);
    result.email = await sendPendingEmails(pool, mailer, once ? 5 : 20);
    if (once || Date.now() - lastPurge > 3600000) {
      result.purged = await purgeExpired(pool, {
        notificationDays: config.RETENTION_NOTIFICATIONS_DAYS,
        auditDays: config.RETENTION_AUDIT_DAYS,
        emailDays: config.RETENTION_EMAIL_DAYS,
      });
      lastPurge = Date.now();
    }
    await heartbeat(pool, name, result);
    log.debug(result, 'tick');
  } finally {
    // Close the actual lock-holding connection, including on errors.
    lock.release(true);
  }
}

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop.abort());
const timeout = once ? setTimeout(() => {
  log.fatal('scheduled worker exceeded 120 seconds');
  process.exit(1);
}, 120000) : undefined;
try {
  do {
    try {
      await tick();
    } catch (err) {
      log.error({ err }, 'worker tick failed');
      if (once) process.exitCode = 1;
    }
    if (once || stop.signal.aborted) break;
    try {
      await delay(15000, undefined, { signal: stop.signal });
    } catch (err) {
      if (!stop.signal.aborted) throw err;
    }
  } while (!stop.signal.aborted);
} finally {
  await pool.end();
  clearTimeout(timeout);
}
