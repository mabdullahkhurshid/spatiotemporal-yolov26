const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startServer } = require('./helpers/harness');
const { createFixtures, PASSWORD, KNOWN_OTP } = require('./helpers/fixtures');
const { hashToken } = require('../utils/generateOTP');

const GRACE_MS = 1500;
let server;
let fx;

const refresh = (cookie) => fx.api('POST', '/api/auth/refresh', { cookies: { refreshToken: cookie } });
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = await startServer({ name: 'auth', port: 5611, env: { REFRESH_ROTATION_GRACE_MS: String(GRACE_MS) } });
  fx = createFixtures(server);
});

after(async () => {
  await server?.stop();
});

test('register → verify OTP → login issues an access token and an httpOnly refresh cookie', async () => {
  const email = await fx.registerVerifiedCustomer('alice');
  const res = await fx.api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.refreshToken, undefined, 'refresh token must not be readable by page scripts');

  const cookie = res.setCookies.refreshToken;
  assert.ok(cookie?.value);
  assert.equal(cookie.attributes.httponly, true);
  assert.equal(cookie.attributes.path, '/api/auth');
  assert.equal(String(cookie.attributes.samesite).toLowerCase(), 'strict');
  assert.equal(res.setCookies.accessToken?.value || '', '', 'access token is no longer set as a cookie');
});

test('login rejects wrong password, unknown email and unverified email', async () => {
  const email = await fx.registerVerifiedCustomer('bob');
  const wrong = await fx.api('POST', '/api/auth/login', { body: { email, password: 'nope-nope' } });
  assert.equal(wrong.status, 401);

  const unknown = await fx.api('POST', '/api/auth/login', { body: { email: 'ghost@audit.test', password: PASSWORD } });
  assert.equal(unknown.status, 401);

  await fx.api('POST', '/api/auth/register', { body: { name: 'Carol', email: 'carol@audit.test', password: PASSWORD } });
  const unverified = await fx.api('POST', '/api/auth/login', { body: { email: 'carol@audit.test', password: PASSWORD } });
  assert.equal(unverified.status, 401);
  assert.equal(unverified.body.code, 'EMAIL_NOT_VERIFIED');
});

test('duplicate registration is rejected', async () => {
  await fx.registerVerifiedCustomer('dave');
  const dup = await fx.api('POST', '/api/auth/register', {
    body: { name: 'Dave Again', email: 'dave@audit.test', password: PASSWORD },
  });
  assert.equal(dup.status, 400);
});

test('verification codes are stored hashed, never in plain text', async () => {
  await fx.api('POST', '/api/auth/register', { body: { name: 'Hash', email: 'hash@audit.test', password: PASSWORD } });
  const doc = await server.db.collection('users').findOne({ email: 'hash@audit.test' });
  assert.match(doc.emailVerificationToken, /^[0-9a-f]{64}$/);
});

test('verify-email rejects NoSQL operator payloads instead of verifying the account', async () => {
  await fx.api('POST', '/api/auth/register', { body: { name: 'Frank', email: 'frank@audit.test', password: PASSWORD } });
  const res = await fx.api('POST', '/api/auth/verify-email', {
    body: { email: 'frank@audit.test', otp: { $ne: null } },
  });
  assert.equal(res.status, 400);
  const doc = await server.db.collection('users').findOne({ email: 'frank@audit.test' });
  assert.equal(doc.isEmailVerified, false);
});

test('mixed-case dotted Gmail address can verify (same normalization as registration)', async () => {
  const raw = 'Mixed.Case.User@Gmail.com';
  const reg = await fx.api('POST', '/api/auth/register', { body: { name: 'Gmail', email: raw, password: PASSWORD } });
  assert.equal(reg.status, 201);
  await fx.plantVerificationCode(reg.body.user.email);
  const res = await fx.api('POST', '/api/auth/verify-email', { body: { email: raw, otp: KNOWN_OTP } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('five wrong codes lock the code; a resent code then verifies', async () => {
  const email = 'locked@audit.test';
  await fx.api('POST', '/api/auth/register', { body: { name: 'Locked', email, password: PASSWORD } });
  await fx.plantVerificationCode(email);

  const statuses = [];
  for (let i = 0; i < 5; i += 1) {
    statuses.push((await fx.api('POST', '/api/auth/verify-email', { body: { email, otp: '111111' } })).status);
  }
  assert.deepEqual(statuses, [400, 400, 400, 400, 429]);
  const afterLock = await fx.api('POST', '/api/auth/verify-email', { body: { email, otp: KNOWN_OTP } });
  assert.equal(afterLock.status, 400, 'the locked code must no longer work');

  const resend = await fx.api('POST', '/api/auth/resend-verification', { body: { email } });
  assert.equal(resend.status, 200);
  const doc = await server.db.collection('users').findOne({ email });
  assert.ok(doc.emailVerificationToken, 'resend issued a new code');
  await fx.plantVerificationCode(email, '135790');
  const ok = await fx.api('POST', '/api/auth/verify-email', { body: { email, otp: '135790' } });
  assert.equal(ok.status, 200);
});

test('resend-verification answers the same for unknown, verified and pending accounts', async () => {
  const verified = await fx.registerVerifiedCustomer('resend-verified');
  const a = await fx.api('POST', '/api/auth/resend-verification', { body: { email: 'nobody@audit.test' } });
  const b = await fx.api('POST', '/api/auth/resend-verification', { body: { email: verified } });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
});

test('forgot password does not reveal whether an account exists', async () => {
  const email = await fx.registerVerifiedCustomer('known-forgot');
  const known = await fx.api('POST', '/api/auth/forgotpassword', { body: { email } });
  const unknown = await fx.api('POST', '/api/auth/forgotpassword', { body: { email: 'missing@audit.test' } });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(known.body, unknown.body);
  const doc = await server.db.collection('users').findOne({ email });
  assert.match(doc.passwordResetToken, /^[0-9a-f]{64}$/, 'reset token stored hashed');
});

test('reset password works with the real token and ends every existing session', async () => {
  const email = await fx.registerVerifiedCustomer('grace');
  const deviceA = await fx.login(email);
  const token = await fx.plantResetToken(email);
  const reset = await fx.api('PUT', '/api/auth/resetpassword', { body: { token, password: 'NewPassw0rd!' } });
  assert.equal(reset.status, 200);
  assert.ok(reset.setCookies.refreshToken?.value, 'reset starts a fresh session');
  assert.equal((await refresh(deviceA.refreshCookie)).status, 401, 'old device session revoked');
  await fx.login(email, 'NewPassw0rd!');
});

test('reset password rejects NoSQL operator token (account takeover attempt)', async () => {
  const victim = await fx.registerVerifiedCustomer('victim');
  await fx.plantResetToken(victim);
  const attack = await fx.api('PUT', '/api/auth/resetpassword', {
    body: { token: { $ne: null }, password: 'Attacker123' },
  });
  assert.equal(attack.status, 400, `takeover response: ${JSON.stringify(attack.body)}`);
  await fx.login(victim, PASSWORD);
});

test('signing in on a second device keeps the first device signed in', async () => {
  const email = await fx.registerVerifiedCustomer('multi');
  const laptop = await fx.login(email);
  const phone = await fx.login(email);

  const laptopRefresh = await refresh(laptop.refreshCookie);
  const phoneRefresh = await refresh(phone.refreshCookie);
  assert.equal(laptopRefresh.status, 200);
  assert.equal(phoneRefresh.status, 200);
  assert.equal(laptopRefresh.body.refreshToken, undefined, 'cookie refresh does not echo the token');
  assert.notEqual(laptopRefresh.setCookies.refreshToken.value, laptop.refreshCookie, 'token rotated');
});

test('logout ends only this device; logout-all ends every device', async () => {
  const email = await fx.registerVerifiedCustomer('logout');
  const a = await fx.login(email);
  const b = await fx.login(email);
  const c = await fx.login(email);

  const out = await fx.api('POST', '/api/auth/logout', { cookies: { refreshToken: a.refreshCookie } });
  assert.equal(out.status, 200);
  assert.equal(out.setCookies.refreshToken?.value || '', '', 'cookie cleared');
  assert.equal((await refresh(a.refreshCookie)).status, 401);
  const bRefresh = await refresh(b.refreshCookie);
  assert.equal(bRefresh.status, 200);

  const all = await fx.api('POST', '/api/auth/logout-all', { token: bRefresh.body.accessToken });
  assert.equal(all.status, 200);
  assert.equal((await refresh(bRefresh.setCookies.refreshToken.value)).status, 401);
  assert.equal((await refresh(c.refreshCookie)).status, 401);
});

test('parallel refreshes with the same cookie all succeed; a stale token fails after the grace window', async () => {
  const email = await fx.registerVerifiedCustomer('parallel');
  const session = await fx.login(email);
  const results = await Promise.all([1, 2, 3].map(() => refresh(session.refreshCookie)));
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  const rotated = results.filter((r) => r.setCookies.refreshToken?.value);
  assert.equal(rotated.length, 1, 'exactly one response rotates the cookie');

  await settle(GRACE_MS + 300);
  assert.equal((await refresh(session.refreshCookie)).status, 401, 'old token rejected after grace');
  assert.equal((await refresh(rotated[0].setCookies.refreshToken.value)).status, 200, 'new token still valid');
});

test('legacy single refresh tokens are migrated once', async () => {
  const email = await fx.registerVerifiedCustomer('legacy');
  const doc = await server.db.collection('users').findOne({ email });
  const legacy = jwt.sign({ id: String(doc._id) }, 'test-jwt-refresh-secret', { expiresIn: '1d' });
  await server.db.collection('users').updateOne({ _id: doc._id }, { $set: { refreshToken: legacy } });

  const first = await fx.api('POST', '/api/auth/refresh', { body: { refreshToken: legacy } });
  assert.equal(first.status, 200);
  assert.ok(first.body.refreshToken, 'body clients receive the new token in the body');
  const reuse = await fx.api('POST', '/api/auth/refresh', { body: { refreshToken: legacy } });
  assert.equal(reuse.status, 401);
  const next = await fx.api('POST', '/api/auth/refresh', { body: { refreshToken: first.body.refreshToken } });
  assert.equal(next.status, 200);
});

test('refresh token is refused for a suspended user', async () => {
  const email = await fx.registerVerifiedCustomer('henry');
  const session = await fx.login(email);
  await server.db.collection('users').updateOne({ email }, { $set: { isActive: false } });
  assert.equal((await refresh(session.refreshCookie)).status, 401);
});

test('auth responses never expose stored secrets', async () => {
  const email = await fx.registerVerifiedCustomer('secrets');
  const session = await fx.login(email);
  await fx.plantResetToken(email);
  const me = await fx.api('GET', '/api/auth/me', { token: session.accessToken });
  for (const field of ['refreshToken', 'refreshSessions', 'passwordResetToken', 'emailVerificationToken', 'oauthLoginCodeHash']) {
    assert.equal(me.body.data[field], undefined, `${field} leaked`);
  }
});

test('Google sign-in code is single use and expires', async () => {
  const email = await fx.registerVerifiedCustomer('oauth');
  const code = 'a'.repeat(64);
  const plant = (expiresInMs) =>
    server.db.collection('users').updateOne(
      { email },
      { $set: { oauthLoginCodeHash: hashToken(code), oauthLoginCodeExpires: new Date(Date.now() + expiresInMs) } }
    );

  await plant(60_000);
  const ok = await fx.api('POST', '/api/auth/oauth/exchange', { body: { code } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.accessToken);
  assert.ok(ok.setCookies.refreshToken?.value);
  assert.equal((await fx.api('POST', '/api/auth/oauth/exchange', { body: { code } })).status, 400, 'reuse rejected');

  await plant(-1000);
  assert.equal((await fx.api('POST', '/api/auth/oauth/exchange', { body: { code } })).status, 400, 'expired rejected');
});
