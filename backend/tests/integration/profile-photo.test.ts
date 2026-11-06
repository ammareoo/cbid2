import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { as, asDbUser, ORIGIN, SEED_EMAILS, sessions, setupContext, teardown, testConfig, type Ctx, type Session } from '../helpers.js';

let ctx: Ctx;
let session: ReturnType<typeof sessions>;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kH8AAAAASUVORK5CYII=', 'base64');
beforeAll(async () => { ctx = await setupContext(); session = sessions(ctx.app); });
afterAll(async () => { await teardown(ctx); });

function upload(s: Session, image = PNG) {
  const boundary = 'photo-test-boundary';
  return ctx.app.inject({
    method: 'POST', url: '/api/me/profile/photo',
    headers: { origin: ORIGIN, cookie: s.cookie, 'x-csrf-token': s.csrf, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`),
      image, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
}

it.each([SEED_EMAILS.admin, SEED_EMAILS.teachers.sana, SEED_EMAILS.students.amina])('uploads, replaces and removes the own photo for %s', async (email) => {
  const s = await session(email);
  expect((await upload(s)).statusCode).toBe(200);
  const api = as(ctx.app, s);
  expect((await api.get('/api/me/profile')).json().photoUpdatedAt).toBeTruthy();
  const image = await api.get('/api/me/profile/photo');
  expect(image.headers['content-type']).toBe('image/png');
  expect(image.rawPayload).toEqual(PNG);
  const replacement = Buffer.concat([PNG, Buffer.from('replacement')]);
  expect((await upload(s, replacement)).statusCode).toBe(200);
  expect((await api.get('/api/me/profile/photo')).rawPayload).toEqual(replacement);
  expect((await api.del('/api/me/profile/photo')).statusCode).toBe(204);
  expect((await api.get('/api/me/profile/photo')).statusCode).toBe(404);
  expect((await api.get('/api/me/profile')).json().photoUpdatedAt).toBeNull();
});

it('rejects forged and oversized photos without replacing the current photo', async () => {
  const s = await session(SEED_EMAILS.students.amina);
  expect((await upload(s)).statusCode).toBe(200);
  expect((await upload(s, Buffer.from('<script>alert(1)</script>'))).statusCode).toBe(415);
  expect((await upload(s, Buffer.alloc(2097153))).statusCode).toBe(413);
  expect((await as(ctx.app, s).get('/api/me/profile/photo')).rawPayload).toEqual(PNG);
});

it('enforces photo ownership in PostgreSQL independently of HTTP', async () => {
  const other = ctx.ids.students.bilal;
  expect(await asDbUser(ctx.appPool, other, 'SELECT user_id FROM user_profile_photos')).toEqual([]);
  expect(await asDbUser(ctx.appPool, other, 'DELETE FROM user_profile_photos RETURNING user_id')).toEqual([]);
  await expect(asDbUser(ctx.appPool, other, 'INSERT INTO user_profile_photos (user_id, image, mime_type) VALUES ($1, $2, $3)',
    [ctx.ids.students.amina, PNG, 'image/png'])).rejects.toThrow(/row-level security/);
  expect((await as(ctx.app, null).get('/api/me/profile/photo')).statusCode).toBe(401);
});

it('refuses a production API using owner privileges and accepts the restricted login', async () => {
  const config = { ...testConfig(), NODE_ENV: 'production' as const, COOKIE_SECURE: true, APP_ORIGIN: 'https://lms.example.org' };
  await expect(buildApp(config, { pool: ctx.owner, redis: null, logger: false })).rejects.toThrow(/restricted cbid_app/);
  const app = await buildApp(config, { pool: ctx.appPool, redis: null, logger: false });
  await app.ready();
  await app.close();
});
