const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/harness');
const { createFixtures, PASSWORD } = require('./helpers/fixtures');

let server; // small general API limit
let authServer; // small credential/contact limits, large general limit
let fx;
let afx;
let userA;
let userB;

before(async () => {
  server = await startServer({ name: 'ratelimit', port: 5617, env: { RATE_LIMIT_MAX_REQUESTS: '12' } });
  fx = createFixtures(server);
  // Users are created directly in the DB so setup does not consume the small budget.
  const User = server.db.model('User', require('../models/User').schema);
  for (const label of ['rl-a', 'rl-b']) {
    await User.create({ name: label, email: `${label}@audit.test`, password: PASSWORD, isEmailVerified: true });
  }
  userA = await fx.login('rl-a@audit.test');
  userB = await fx.login('rl-b@audit.test');

  authServer = await startServer({
    name: 'ratelimit-auth',
    port: 5621,
    env: { AUTH_RATE_LIMIT_MAX: '4', CONTACT_RATE_LIMIT_MAX: '2' },
  });
  afx = createFixtures(authServer);
  await afx.registerVerifiedCustomer('rl-b');
});

after(async () => {
  await server?.stop();
  await authServer?.stop();
});

test('signed-in users on the same IP have separate API budgets', async () => {
  const statusesA = [];
  for (let i = 0; i < 14; i += 1) {
    statusesA.push((await fx.api('GET', '/api/auth/me', { token: userA.accessToken })).status);
  }
  assert.ok(statusesA.slice(0, 12).every((s) => s === 200), statusesA.join(','));
  assert.equal(statusesA[13], 429);

  const b = await fx.api('GET', '/api/auth/me', { token: userB.accessToken });
  assert.equal(b.status, 200, 'user B must not be throttled by user A');
});

test('rate-limit responses are JSON the frontend can display', async () => {
  const res = await fx.api('GET', '/api/auth/me', { token: userA.accessToken });
  assert.equal(res.status, 429);
  assert.equal(typeof res.body.message, 'string');
  assert.ok(res.headers.get('ratelimit-limit') || res.headers.get('ratelimit'), 'standard RateLimit headers');
});

test('failed logins are throttled; successful logins are not counted', async () => {
  for (let i = 0; i < 6; i += 1) {
    const ok = await afx.api('POST', '/api/auth/login', { body: { email: 'rl-b@audit.test', password: PASSWORD } });
    assert.equal(ok.status, 200, `successful login ${i} was throttled`);
  }
  const statuses = [];
  for (let i = 0; i < 5; i += 1) {
    statuses.push((await afx.api('POST', '/api/auth/login', { body: { email: 'rl-b@audit.test', password: 'wrong-pass' } })).status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 429]);
});

test('contact form is limited separately', async () => {
  const body = { name: 'Visitor', email: 'visitor@audit.test', message: 'Hello, please contact me about pricing.' };
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    statuses.push((await afx.api('POST', '/api/public/contact', { body })).status);
  }
  assert.deepEqual(statuses, [201, 201, 429]);
});
