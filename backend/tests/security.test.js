// Security hardening: protected media, socket revocation, account/org rules, internal API throttling,
// startup configuration checks and the DNS-aware camera URL check.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Types } = require('mongoose');
const { startServer, ROOT } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');
const { connectSocket, settle } = require('./helpers/sockets');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');

let server;
let fx;
let root;
let orgA;
let orgB;
let operator;
let camAssigned;
let camOther;
let snapshotAssigned; // /uploads/snapshots/<orgA>/<camAssigned>-<ts>.jpg
let snapshotOther;
let heatmapAssigned; // /uploads/explanations/<orgA>/<alertId>-<hex>.jpg

const alertFrame = (cameraId, overrides = {}) => ({
  cameraId,
  streamStatus: 'ok',
  detections: [{ className: 'fire', confidence: 90, x: 0.2, y: 0.2, w: 0.3, h: 0.3 }],
  metrics: { incidentActive: true, createAlert: true, fireConfidence: 90, smokeConfidence: 0, averageConfidence: 90 },
  snapshotBase64: JPEG,
  ...overrides,
});

async function alertFor(cameraId, overrides) {
  const res = await fx.ingest(alertFrame(cameraId, overrides));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return server.db.collection('alerts').findOne({ _id: new Types.ObjectId(res.body.data.alertId) });
}

before(async () => {
  server = await startServer({ name: 'security', port: 5640 });
  fx = createFixtures(server);
  root = await fx.seedSuperAdmin();
  const plan = await fx.seedPlan({ maxCameras: 5, maxOperators: 3 });
  orgA = await fx.createOrgAdmin('sec-a', plan._id);
  orgB = await fx.createOrgAdmin('sec-b', plan._id);
  operator = await fx.createOperator(orgA, 'sec-op');
  camAssigned = await fx.createCamera(orgA, 'Assigned');
  camOther = await fx.createCamera(orgA, 'Other');
  await fx.assign(orgA, operator.id, [camAssigned]);

  const assignedAlert = await alertFor(camAssigned);
  snapshotAssigned = assignedAlert.frameSnapshotURL;
  snapshotOther = (await alertFor(camOther)).frameSnapshotURL;

  heatmapAssigned = `/uploads/explanations/${orgA.orgId}/${assignedAlert._id}-0123456789abcdef.jpg`;
  const heatmapPath = path.join(ROOT, heatmapAssigned);
  fs.mkdirSync(path.dirname(heatmapPath), { recursive: true });
  fs.writeFileSync(heatmapPath, Buffer.from(JPEG, 'base64'));
});

after(async () => {
  for (const dir of ['snapshots', 'explanations']) {
    if (orgA) fs.rmSync(path.join(ROOT, 'uploads', dir, orgA.orgId), { recursive: true, force: true });
  }
  await server?.stop();
});

const get = (urlPath, opts = {}) => fx.api('GET', urlPath, opts);

test('alert snapshots require sign-in and follow alert access rules', async () => {
  assert.match(snapshotAssigned, new RegExp(`^/uploads/snapshots/${orgA.orgId}/${camAssigned}-\\d+\\.jpg$`));

  assert.equal((await get(snapshotAssigned)).status, 401, 'anonymous');
  assert.equal((await get(snapshotAssigned, { token: orgB.token })).status, 403, 'other tenant');
  assert.equal((await get(snapshotOther, { token: operator.token })).status, 403, 'operator, unassigned camera');

  const owner = await get(snapshotAssigned, { token: orgA.token });
  assert.equal(owner.status, 200);
  assert.match(owner.headers.get('content-type'), /image\/jpeg/);
  assert.match(owner.headers.get('cache-control'), /private/);
  assert.equal((await get(snapshotAssigned, { token: operator.token })).status, 200, 'operator, assigned camera');
  assert.equal((await get(snapshotOther, { token: root.token })).status, 200, 'super admin');
  assert.equal(
    (await get(snapshotAssigned, { headers: { 'X-Inference-Api-Key': 'test-inference-key' } })).status,
    200,
    'explainer with the service key'
  );
  assert.equal((await get(snapshotAssigned, { headers: { 'X-Inference-Api-Key': 'wrong' } })).status, 401);
});

test('explanation heatmaps check the operator assignment through the alert', async () => {
  assert.equal((await get(heatmapAssigned)).status, 401);
  assert.equal((await get(heatmapAssigned, { token: operator.token })).status, 200);
  assert.equal((await get(heatmapAssigned, { token: orgB.token })).status, 403);
});

test('media paths are validated and missing files are 404', async () => {
  const base = `/uploads/snapshots/${orgA.orgId}`;
  assert.equal((await get(`${base}/..%2F..%2F.env`, { token: root.token })).status, 400);
  assert.equal((await get(`${base}/photo.png`, { token: root.token })).status, 400);
  assert.equal((await get(`/uploads/snapshots/not-an-id/x.jpg`, { token: root.token })).status, 400);
  assert.equal((await get(`${base}/${camAssigned}-1.jpg`, { token: orgA.token })).status, 404);
  assert.equal((await get(`/uploads/other/${orgA.orgId}/x.jpg`, { token: root.token })).status, 404);
});

test('an invalid snapshot is skipped but the alert is still created', async () => {
  const cam = await fx.createCamera(orgA, 'Bad snapshot');
  const notJpeg = await alertFor(cam, { snapshotBase64: Buffer.from('not a jpeg').toString('base64') });
  assert.ok(notJpeg, 'alert exists');
  assert.ok(!notJpeg.frameSnapshotURL, 'no snapshot stored');
});

test('suspending a user disconnects their live socket', async () => {
  const op = await fx.createOperator(orgA, 'sec-op-suspend');
  const socket = await connectSocket(server.baseUrl, op.token);
  const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

  const res = await fx.api('PUT', `/api/users/${op.id}/suspend`, { token: orgA.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const reason = await Promise.race([disconnected, settle(3000).then(() => 'timeout')]);
  assert.equal(reason, 'io server disconnect');
  socket.close();
});

test('camera:status only accepts online/offline', async () => {
  const socket = await connectSocket(server.baseUrl, orgA.token);
  socket.emit('camera:status', { cameraId: camOther, status: 'paused' });
  await settle();
  let camera = await server.db.collection('cameras').findOne({ _id: new Types.ObjectId(camOther) });
  assert.notEqual(camera.status, 'paused');

  socket.emit('camera:status', { cameraId: camOther, status: 'online' });
  await settle();
  camera = await server.db.collection('cameras').findOne({ _id: new Types.ObjectId(camOther) });
  assert.equal(camera.status, 'ONLINE');
  socket.close();
});

test('your own password cannot be changed through the profile update', async () => {
  const self = await fx.api('PUT', `/api/users/${orgA.user._id || orgA.user.id}`, {
    token: orgA.token,
    body: { password: 'N3wPassw0rd!' },
  });
  assert.equal(self.status, 400);
  await fx.login(orgA.email); // old password still works

  const rename = await fx.api('PUT', `/api/users/${orgA.user._id || orgA.user.id}`, {
    token: orgA.token,
    body: { name: 'Renamed Admin' },
  });
  assert.equal(rename.status, 200, 'profile edits without a password still work');
});

test('org admins can read and edit their own organization, not another', async () => {
  const own = await get(`/api/organizations/${orgA.orgId}`, { token: orgA.token });
  assert.equal(own.status, 200, JSON.stringify(own.body));
  const edit = await fx.api('PUT', `/api/organizations/${orgA.orgId}`, {
    token: orgA.token,
    body: { name: 'Org A renamed', subscriptionStatus: 'active' },
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(edit.body.data.name, 'Org A renamed');

  assert.equal((await get(`/api/organizations/${orgB.orgId}`, { token: orgA.token })).status, 403);
  assert.equal(
    (await fx.api('PUT', `/api/organizations/${orgB.orgId}`, { token: orgA.token, body: { name: 'x' } })).status,
    403
  );
});

test('a suspended account is only revealed after the correct password', async () => {
  const op = await fx.createOperator(orgA, 'sec-op-login');
  await fx.api('PUT', `/api/users/${op.id}/suspend`, { token: orgA.token });

  const wrong = await fx.api('POST', '/api/auth/login', { body: { email: op.email, password: 'wrong-password' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.message, 'Invalid credentials');

  const right = await fx.api('POST', '/api/auth/login', { body: { email: op.email, password: fx.PASSWORD } });
  assert.equal(right.status, 403);
});

// ---------------------------------------------------------------------------------------------
// Separate servers: different rate limits / production configuration.

test('wrong inference keys are rate limited; the valid key is not', async () => {
  const limited = await startServer({ name: 'security-limit', port: 5641, env: { RATE_LIMIT_MAX_REQUESTS: '5' } });
  try {
    const call = (key) =>
      fetch(`${limited.baseUrl}/api/internal/inference/cameras`, { headers: { 'X-Inference-Api-Key': key } });
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await call('wrong-key')).status);
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(statuses[6], 429);

    for (let i = 0; i < 10; i += 1) assert.equal((await call('test-inference-key')).status, 200);
  } finally {
    await limited.stop();
  }
});

function runServer(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'server.js')], {
      cwd: ROOT,
      env: {
        ...process.env,
        EMAIL_HOST: '',
        EMAIL_USER: '',
        EMAIL_PASS: '',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/fire-detection-audit-test-security-env-test',
        PORT: '5642',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (c) => { output += c; });
    child.stderr.on('data', (c) => { output += c; });
    const timer = setTimeout(() => child.kill(), 15000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

test('production refuses to start with placeholder or weak secrets', async () => {
  const { code, output } = await runServer({
    NODE_ENV: 'production',
    JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
    JWT_REFRESH_SECRET: 'short',
    INFERENCE_SERVICE_API_KEY: 'change-me-inference-key',
    DEMO_CAMERAS_ENABLED: 'false',
  });
  assert.equal(code, 1);
  assert.match(output, /JWT_SECRET" still uses the example placeholder/);
  assert.match(output, /JWT_REFRESH_SECRET" must be at least 32 characters/);
  assert.match(output, /INFERENCE_SERVICE_API_KEY/);
  assert.doesNotMatch(output, /Server running/);
});

// ---------------------------------------------------------------------------------------------
// Unit tests (no server)

test('checkEnv: strict in production, lenient elsewhere', () => {
  const { checkEnv } = require('../config/env');
  const strong = (c) => c.repeat(40);
  const good = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://db/x',
    JWT_SECRET: strong('a'),
    JWT_REFRESH_SECRET: strong('b'),
    INFERENCE_SERVICE_API_KEY: strong('c'),
    DEMO_CAMERAS_ENABLED: 'true',
    MEDIAMTX_INTERNAL_PASS: strong('d'),
  };
  assert.deepEqual(checkEnv(good), []);
  assert.ok(checkEnv({ ...good, JWT_REFRESH_SECRET: good.JWT_SECRET }).some((m) => /must differ/.test(m)));
  assert.ok(checkEnv({ ...good, MEDIAMTX_INTERNAL_PASS: 'change-me-mediamtx' }).length > 0);
  assert.deepEqual(checkEnv({ ...good, DEMO_CAMERAS_ENABLED: 'false', MEDIAMTX_INTERNAL_PASS: 'x' }), []);
  assert.ok(checkEnv({ ...good, JWT_SECRET: undefined }).some((m) => /JWT_SECRET/.test(m)));

  // Development / test: only presence is required (the test harness uses short secrets).
  assert.deepEqual(checkEnv({ NODE_ENV: 'test', MONGODB_URI: 'x', JWT_SECRET: 's', JWT_REFRESH_SECRET: 'r' }), []);
  assert.ok(checkEnv({ NODE_ENV: 'development', MONGODB_URI: 'x' }).length === 2);
});

test('checkStreamHost refuses names that resolve to loopback or link-local, allows LAN and unresolvable hosts', async () => {
  const { checkStreamHost } = require('../utils/streamSource');
  const resolvesTo = (address) => async () => [{ address, family: address.includes(':') ? 6 : 4 }];
  const fails = async () => {
    throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
  };

  assert.equal((await checkStreamHost('rtsp://cam.nip.io/live', resolvesTo('127.0.0.1'))).ok, false);
  assert.equal((await checkStreamHost('http://meta.example/', resolvesTo('169.254.169.254'))).ok, false);
  assert.equal((await checkStreamHost('http://v6.example/', resolvesTo('::1'))).ok, false);
  assert.equal((await checkStreamHost('rtsp://cam.local/live', resolvesTo('192.168.1.20'))).ok, true);
  assert.equal((await checkStreamHost('rtsp://onsite-only/live', fails)).ok, true);
  assert.equal((await checkStreamHost('rtsp://10.0.0.5/live', resolvesTo('127.0.0.1'))).ok, true, 'literal IPs are not resolved');

  const previous = process.env.CAMERA_BLOCKED_HOSTS;
  process.env.CAMERA_BLOCKED_HOSTS = 'mongodb, backend';
  try {
    assert.equal((await checkStreamHost('http://mongodb:27017/', resolvesTo('172.18.0.2'))).ok, false);
    assert.equal((await checkStreamHost('rtsp://mediamtx:8554/demo/a', resolvesTo('172.18.0.3'))).ok, true);
  } finally {
    if (previous === undefined) delete process.env.CAMERA_BLOCKED_HOSTS;
    else process.env.CAMERA_BLOCKED_HOSTS = previous;
  }
});

test('secretBox still reads passwords saved before CAMERA_CREDENTIALS_KEY was set', () => {
  const box = require('../utils/secretBox');
  const saved = { jwt: process.env.JWT_SECRET, key: process.env.CAMERA_CREDENTIALS_KEY };
  try {
    process.env.JWT_SECRET = 'jwt-secret-for-secretbox-test';
    delete process.env.CAMERA_CREDENTIALS_KEY;
    const legacy = box.encryptSecret('camera-pass');

    process.env.CAMERA_CREDENTIALS_KEY = 'new-dedicated-key';
    assert.equal(box.decryptSecret(legacy), 'camera-pass', 'legacy value still readable');
    const current = box.encryptSecret('camera-pass-2');
    assert.equal(box.decryptSecret(current), 'camera-pass-2');

    delete process.env.CAMERA_CREDENTIALS_KEY;
    assert.equal(box.decryptSecret(current), null, 'new-key value is not readable without the key');
  } finally {
    if (saved.jwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved.jwt;
    if (saved.key === undefined) delete process.env.CAMERA_CREDENTIALS_KEY;
    else process.env.CAMERA_CREDENTIALS_KEY = saved.key;
  }
});
