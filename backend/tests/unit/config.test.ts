import { expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

it.each(['CHANGE_ME', 'change_me', 'app_local_pw', '%43HANGE_ME', 'app_dev_pw'])('rejects production placeholder password %s', (password) => {
  expect(() => loadConfig({
    NODE_ENV: 'production', COOKIE_SECURE: 'true', APP_ORIGIN: 'https://lms.example.org',
    DATABASE_URL: `postgres://cbid_app:${password}@localhost/lms`,
  })).toThrow(/development database password/);
});

it('requires HTTPS and secure cookies in production', () => {
  expect(() => loadConfig({
    NODE_ENV: 'production', COOKIE_SECURE: 'false', APP_ORIGIN: 'https://lms.example.org',
    DATABASE_URL: 'postgres://cbid_app:secure-test-secret@localhost/lms',
  })).toThrow(/COOKIE_SECURE/);
});
