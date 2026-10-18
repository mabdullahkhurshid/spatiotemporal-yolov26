// Loads the real frontend modules (Redux store, socketService, api.js) through Vite SSR and drives
// them against a test backend, covering client behaviour without a browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { startServer, ROOT } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');
const { settle } = require('./helpers/sockets');

const PORT = 5616;
let server;
let fx;
let vite;
let mods;
let admin;
let cam;

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = { location: { href: '' }, history: { replaceState() {} } };

// Minimal cookie jar standing in for the browser (Node's axios does not keep cookies).
const jar = new Map();
const installCookieJar = (instance) => {
  const capture = (headers) => {
    for (const raw of headers?.['set-cookie'] || []) {
      const [pair, ...attrs] = raw.split(';').map((p) => p.trim());
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const expired = attrs.some((a) => /^expires=/i.test(a) && new Date(a.slice(8)) < new Date());
      if (!value || expired) jar.delete(name);
      else jar.set(name, value);
    }
  };
  instance.interceptors.request.use((config) => {
    if (jar.size) config.headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    return config;
  });
  // Registered first so it runs before the app's refresh interceptor sees the response.
  instance.interceptors.response.handlers.unshift({
    fulfilled: (response) => {
      capture(response.headers);
      return response;
    },
    rejected: (error) => {
      capture(error.response?.headers);
      return Promise.reject(error);
    },
    synchronous: false,
    runWhen: null,
  });
};

before(async () => {
  server = await startServer({ name: 'client', port: PORT });
  fx = createFixtures(server);
  const plan = await fx.seedPlan();
  admin = await fx.createOrgAdmin('client-admin', plan._id);
  cam = await fx.createCamera(admin, 'Client cam');

  process.env.VITE_API_URL = `${server.baseUrl}/api`;
  process.env.VITE_SOCKET_URL = server.baseUrl;
  const { createServer } = await import(
    pathToFileURL(path.join(ROOT, 'frontend', 'node_modules', 'vite', 'dist', 'node', 'index.js')).href
  );
  vite = await createServer({
    root: path.join(ROOT, 'frontend'),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  const load = (p) => vite.ssrLoadModule(p);
  mods = {
    store: (await load('/src/store/store.js')).store,
    auth: await load('/src/store/slices/authSlice.js'),
    socketService: (await load('/src/services/socketService.js')).socketService,
    api: (await load('/src/services/api.js')).default,
    tokens: await load('/src/services/tokenStore.js'),
  };
  installCookieJar(mods.api);
});

after(async () => {
  mods?.socketService.disconnect();
  await vite?.close();
  await server?.stop();
});

test('failed login surfaces the server error instead of reloading the page', async () => {
  window.location.href = '';
  const result = await mods.store.dispatch(mods.auth.login({ email: admin.email, password: 'wrong-password' }));
  assert.equal(result.type, 'auth/login/rejected');
  assert.equal(result.payload.message, 'Invalid credentials');
  assert.equal(window.location.href, '', 'interceptor redirected on a failed login');
});

test('login keeps the access token in memory only; the refresh token is an httpOnly cookie', async () => {
  const result = await mods.store.dispatch(mods.auth.login({ email: admin.email, password: fx.PASSWORD }));
  assert.equal(result.type, 'auth/login/fulfilled');
  assert.ok(mods.tokens.getAccessToken());
  assert.equal(localStorage.getItem('accessToken'), null);
  assert.equal(localStorage.getItem('refreshToken'), null);
  assert.ok(jar.get('refreshToken'), 'refresh cookie was not set');
});

test('socket joins the org room once and alerts arrive exactly once', async () => {
  assert.equal(typeof mods.store.getState().auth.user.organizationId, 'object', 'login returns populated org');

  // App.jsx calls connect() from two effects on startup before the first connection completes.
  mods.socketService.connect(mods.tokens.getAccessToken());
  mods.socketService.connect(mods.tokens.getAccessToken());
  await settle(800);

  const res = await fx.ingest({
    cameraId: cam,
    streamStatus: 'ok',
    detections: [{ className: 'fire', confidence: 90, x: 0.1, y: 0.1, w: 0.1, h: 0.1 }],
    metrics: { incidentActive: true, createAlert: true, fireConfidence: 90, smokeConfidence: 0 },
  });
  assert.equal(res.status, 200);
  await settle(800);

  const { alerts } = mods.store.getState().alerts;
  assert.equal(alerts.length, 1, `expected one alert in Redux, got ${alerts.length}`);
  assert.ok(mods.store.getState().cameras.liveDetectionById[cam], 'detection:live not stored');
});

test('acknowledgement from another session updates this client in real time', async () => {
  const id = mods.store.getState().alerts.alerts[0]._id;
  // A second device signing in no longer invalidates this client's session.
  const other = await fx.login(admin.email);
  await fx.api('PUT', `/api/alerts/${id}/acknowledge`, { token: other.accessToken, body: {} });
  await settle(800);
  assert.equal(mods.store.getState().alerts.alerts[0].status, 'acknowledged');
});

test('expired access token: parallel requests share one cookie refresh and rotate the cookie', async () => {
  await settle(1100); // JWTs minted within the same second share iat; make rotation observable
  const before = jar.get('refreshToken');
  mods.tokens.setAccessToken('expired.or.invalid');
  const results = await Promise.all([
    mods.api.get('/auth/me'),
    mods.api.get('/alerts'),
    mods.api.get('/cameras'),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.ok(jar.get('refreshToken') && jar.get('refreshToken') !== before, 'refresh cookie was not rotated');

  mods.tokens.setAccessToken('expired.again');
  const again = await mods.api.get('/auth/me');
  assert.equal(again.status, 200);
  assert.equal(window.location.href, '');
});

test('page reload restores the session from the cookie alone', async () => {
  mods.tokens.clearAccessToken(); // memory is gone after a reload
  const result = await mods.store.dispatch(mods.auth.restoreSession());
  assert.equal(result.type, 'auth/restoreSession/fulfilled');
  assert.equal(mods.store.getState().auth.isAuthenticated, true);
  assert.ok(mods.tokens.getAccessToken());
});

test('live view requests a camera-scoped stream token, never puts the access token in the URL', async () => {
  const { getCameraPlaybackSource } = await vite.ssrLoadModule('/src/utils/cameraPlayback.js');
  const res = await mods.api.get(`/cameras/${cam}/stream-token`);
  const source = getCameraPlaybackSource({ _id: cam, streamUrl: 'rtsp://192.0.2.10/live', cameraType: 'ip_rtsp' }, res.data.data.token);
  assert.equal(source.mode, 'mjpeg');
  assert.match(source.url, /streamToken=/);
  assert.ok(!source.url.includes(mods.tokens.getAccessToken()));
});

test('logout ends this device session; a reload then requires sign-in', async () => {
  await mods.store.dispatch(mods.auth.logout());
  assert.equal(mods.tokens.getAccessToken(), null);
  assert.equal(jar.get('refreshToken'), undefined, 'refresh cookie not cleared');
  const restored = await mods.store.dispatch(mods.auth.restoreSession());
  assert.equal(restored.type, 'auth/restoreSession/rejected');
});
