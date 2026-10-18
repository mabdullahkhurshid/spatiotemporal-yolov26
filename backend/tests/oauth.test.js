// Google sign-in through the real passport flow, against a local mock of Google's OAuth endpoints.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startServer, parseSetCookies } = require('./helpers/harness');
const { createFixtures, PASSWORD } = require('./helpers/fixtures');

const MOCK_PORT = 5621;
const FRONTEND = 'http://localhost:5173';
let server;
let fx;
let mockGoogle;

// The profile the mock returns for the next sign-in, and how many token exchanges it served.
const google = { profile: null, tokenCalls: 0, failToken: false, lastTokenBody: '' };

function startMockGoogle() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const json = (status, data) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        };
        if (req.method === 'POST' && req.url === '/token') {
          google.tokenCalls += 1;
          google.lastTokenBody = body;
          if (google.failToken) return json(400, { error: 'invalid_grant', error_description: 'Bad code' });
          return json(200, { access_token: 'mock-access-token', token_type: 'Bearer', expires_in: 3600 });
        }
        const url = new URL(req.url, 'http://mock');
        if (req.method === 'GET' && url.pathname === '/userinfo') {
          // passport-oauth2 sends the token as ?access_token= (Google accepts that or a Bearer header).
          const token = url.searchParams.get('access_token') || req.headers.authorization?.replace(/^Bearer /, '');
          if (token !== 'mock-access-token') return json(401, { error: 'unauthorized' });
          return json(200, google.profile);
        }
        return json(404, { error: 'not_found' });
      });
    });
    srv.listen(MOCK_PORT, '127.0.0.1', () => resolve(srv));
  });
}

before(async () => {
  mockGoogle = await startMockGoogle();
  server = await startServer({
    name: 'oauth',
    port: 5620,
    env: { GOOGLE_TEST_OAUTH_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, GOOGLE_CALLBACK_URL: 'http://127.0.0.1:5620/api/auth/google/callback' },
  });
  fx = createFixtures(server);
});

after(async () => {
  await server?.stop();
  await new Promise((r) => (mockGoogle ? mockGoogle.close(r) : r()));
});

const get = (path, cookie) =>
  fetch(`${server.baseUrl}${path}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });

/** Start sign-in, then come back to the callback as Google would. Returns the final redirect URL. */
async function googleSignIn(profile, { tamperState = false, dropCookie = false } = {}) {
  google.profile = profile;
  const start = await get('/api/auth/google');
  assert.equal(start.status, 302);
  const authUrl = new URL(start.headers.get('location'));
  const stateCookie = parseSetCookies(start.headers).oauthState;
  const state = tamperState ? `${authUrl.searchParams.get('state')}x` : authUrl.searchParams.get('state');
  const cookie = dropCookie ? undefined : `oauthState=${stateCookie.value}`;
  const callback = await get(`/api/auth/google/callback?code=google-code&state=${state}`, cookie);
  assert.equal(callback.status, 302);
  return { start, authUrl, stateCookie, callback, redirect: new URL(callback.headers.get('location')) };
}

const exchange = (code) => fx.api('POST', '/api/auth/oauth/exchange', { body: { code } });

const profileFor = (email, extra = {}) => ({
  sub: `google-${email}`,
  name: 'Google Person',
  email,
  email_verified: true,
  ...extra,
});

test('sign-in start sends state bound to an httpOnly Lax cookie', async () => {
  const start = await get('/api/auth/google');
  assert.equal(start.status, 302);
  const url = new URL(start.headers.get('location'));
  assert.equal(url.origin + url.pathname, `http://127.0.0.1:${MOCK_PORT}/auth`);
  assert.equal(url.searchParams.get('client_id'), 'test-google-client');
  assert.equal(url.searchParams.get('scope'), 'profile email');
  assert.equal(url.searchParams.get('prompt'), 'select_account');
  const state = url.searchParams.get('state');
  assert.match(state, /^[a-f0-9]{48}$/);

  const cookie = parseSetCookies(start.headers).oauthState;
  assert.equal(cookie.value, state);
  assert.equal(cookie.attributes.httponly, true);
  assert.equal(String(cookie.attributes.samesite).toLowerCase(), 'lax');
  assert.equal(cookie.attributes.path, '/api/auth/google');
});

test('new Google user: customer created, one-time code exchanged for a session, password setup requested', async () => {
  const { redirect } = await googleSignIn(profileFor('new.person@example.com'));
  assert.equal(redirect.origin + redirect.pathname, `${FRONTEND}/auth/callback`);
  assert.equal(redirect.searchParams.get('needsPassword'), '1');
  const code = redirect.searchParams.get('code');
  assert.ok(code);
  assert.ok(!redirect.search.includes('accessToken'), 'tokens never travel in the URL');
  assert.match(google.lastTokenBody, /code=google-code/);

  const res = await exchange(code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.accessToken);
  assert.ok(res.setCookies.refreshToken?.value, 'refresh cookie set');
  assert.equal(res.body.user.role, 'customer');

  const again = await exchange(code);
  assert.equal(again.status, 400, 'the code is single use');

  const me = await fx.api('GET', '/api/auth/me', { token: res.body.accessToken });
  assert.equal(me.body.data.email, 'new.person@example.com');
  assert.equal(me.body.data.isEmailVerified, true);
  assert.equal(me.body.data.needsPasswordSetup, true);

  const setPw = await fx.api('POST', '/api/auth/set-password', { token: res.body.accessToken, body: { password: PASSWORD } });
  assert.equal(setPw.status, 200);
  const pwLogin = await fx.api('POST', '/api/auth/login', { body: { email: 'new.person@example.com', password: PASSWORD } });
  assert.equal(pwLogin.status, 200, 'password works after setup');
});

test('Google account links to an existing account even when Gmail dots and case differ', async () => {
  const reg = await fx.api('POST', '/api/auth/register', {
    body: { name: 'Dotted', email: 'First.Last@gmail.com', password: PASSWORD },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'firstlast@gmail.com');

  const { redirect } = await googleSignIn(profileFor('First.Last@Gmail.com'));
  assert.equal(redirect.pathname, '/auth/callback');
  assert.equal(redirect.searchParams.get('needsPassword'), null, 'existing password account needs no setup');
  const res = await exchange(redirect.searchParams.get('code'));
  assert.equal(res.status, 200);

  const User = server.db.collection('users');
  const matches = await User.find({ email: { $regex: /^first\.?last@gmail\.com$/i } }).toArray();
  assert.equal(matches.length, 1, 'no duplicate account');
  assert.equal(matches[0].googleId, 'google-First.Last@Gmail.com');
  assert.equal(matches[0].isEmailVerified, true, 'linking verifies the email');
});

test('returning Google user signs in to the same account', async () => {
  const profile = profileFor('returning@example.com');
  const first = await googleSignIn(profile);
  await exchange(first.redirect.searchParams.get('code'));
  const second = await googleSignIn({ ...profile, email: 'changed-at-google@example.com' });
  const res = await exchange(second.redirect.searchParams.get('code'));
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'returning@example.com', 'matched by Google id, not email');
});

test('tampered or missing state is refused before the code is redeemed', async () => {
  const before = google.tokenCalls;
  const tampered = await googleSignIn(profileFor('csrf@example.com'), { tamperState: true });
  assert.equal(tampered.redirect.href, `${FRONTEND}/login?error=invalid_state`);
  const noCookie = await googleSignIn(profileFor('csrf@example.com'), { dropCookie: true });
  assert.equal(noCookie.redirect.href, `${FRONTEND}/login?error=invalid_state`);
  assert.equal(google.tokenCalls, before, 'Google token endpoint never called');
  assert.equal(await server.db.collection('users').countDocuments({ email: 'csrf@example.com' }), 0);
});

test('cancel on the Google consent screen returns to login with a friendly reason', async () => {
  const res = await get('/api/auth/google/callback?error=access_denied&state=whatever');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), `${FRONTEND}/login?error=google_cancelled`);
});

test('unverified Google email is refused and does not take over an account', async () => {
  const reg = await fx.api('POST', '/api/auth/register', {
    body: { name: 'Victim', email: 'victim@example.com', password: PASSWORD },
  });
  assert.equal(reg.status, 201);
  const { redirect } = await googleSignIn(profileFor('victim@example.com', { sub: 'attacker', email_verified: false }));
  assert.equal(redirect.href, `${FRONTEND}/login?error=email_unverified`);
  const victim = await server.db.collection('users').findOne({ email: 'victim@example.com' });
  assert.equal(victim.googleId, undefined);
});

test('token endpoint failure returns to login instead of a raw error', async () => {
  google.failToken = true;
  try {
    const { redirect } = await googleSignIn(profileFor('broken@example.com'));
    assert.equal(redirect.href, `${FRONTEND}/login?error=authentication_failed`);
  } finally {
    google.failToken = false;
  }
});

test('suspended user and suspended organization cannot sign in with Google', async () => {
  const profile = profileFor('suspended@example.com');
  const first = await googleSignIn(profile);
  await exchange(first.redirect.searchParams.get('code'));
  await server.db.collection('users').updateOne({ email: 'suspended@example.com' }, { $set: { isActive: false } });
  const { redirect } = await googleSignIn(profile);
  assert.equal(redirect.href, `${FRONTEND}/login?error=account_suspended`);

  // Org admin whose organization a super admin suspended.
  const plan = await fx.seedPlan();
  const admin = await fx.createOrgAdmin('oauth-org', plan._id);
  const root = await fx.seedSuperAdmin();
  const suspend = await fx.api('PUT', `/api/organizations/${admin.orgId}/suspend`, { token: root.token });
  assert.equal(suspend.status, 200);
  const signIn = await googleSignIn(profileFor(admin.email));
  const res = await exchange(signIn.redirect.searchParams.get('code'));
  assert.equal(res.status, 403);
  assert.match(res.body.message, /organization is not active/);
});
