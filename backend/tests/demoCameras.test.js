const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

const videosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-videos-'));
const INTERNAL = { user: 'internal', password: 'test-mediamtx-pass' };

let server;
let fx;
let org;
let otherOrg;
let operator;

const mediamtxAuth = (body) => fx.api('POST', '/api/internal/mediamtx/auth', { body });

before(async () => {
  fs.writeFileSync(path.join(videosDir, 'fire_kitchen.mp4'), '');
  fs.writeFileSync(path.join(videosDir, 'bad name.mp4'), '');
  server = await startServer({
    name: 'demo-cameras',
    port: 5624,
    env: {
      DEMO_CAMERAS_ENABLED: 'true',
      DEMO_VIDEOS_DIR: videosDir,
      MEDIAMTX_RTSP_URL: 'rtsp://mediamtx:8554',
      MEDIAMTX_WHIP_URL: 'http://localhost:8889',
      MEDIAMTX_INTERNAL_USER: INTERNAL.user,
      MEDIAMTX_INTERNAL_PASS: INTERNAL.password,
    },
  });
  fx = createFixtures(server);
  const plan = await fx.seedPlan({ maxCameras: 10, maxOperators: 2 });
  org = await fx.createOrgAdmin('demo-admin', plan._id);
  otherOrg = await fx.createOrgAdmin('demo-other', plan._id);
  operator = await fx.createOperator(org, 'demo-op');
});

after(async () => {
  await server?.stop();
  fs.rmSync(videosDir, { recursive: true, force: true });
});

test('demo feeds list the videos in the folder, read fresh each time', async () => {
  const first = await fx.api('GET', '/api/cameras/demo-feeds', { token: org.token });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.enabled, true);
  assert.deepEqual(first.body.data.clips.map((c) => c.id), ['fire_kitchen']);

  fs.writeFileSync(path.join(videosDir, 'warehouse.mp4'), '');
  const second = await fx.api('GET', '/api/cameras/demo-feeds', { token: org.token });
  assert.deepEqual(second.body.data.clips.map((c) => c.id), ['fire_kitchen', 'warehouse']);
});

test('a demo video camera streams its clip from MediaMTX and ignores client URLs', async () => {
  const bad = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: { name: 'Bad', location: 'Lab', cameraType: 'demo_feed', demo: { clip: '../secrets' } },
  });
  assert.equal(bad.status, 400);

  const created = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: {
      name: 'Kitchen demo',
      location: 'Lab',
      cameraType: 'demo_feed',
      demo: { clip: 'fire_kitchen' },
      streamUrl: 'file:///etc/passwd',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.streamUrl, undefined);
  assert.equal(created.body.data.demo.clip, 'fire_kitchen');

  const typeChange = await fx.api('PUT', `/api/cameras/${created.body.data._id}`, {
    token: org.token,
    body: { name: 'Kitchen demo', location: 'Lab', cameraType: 'ip_rtsp', ipAddress: '192.168.1.9' },
  });
  assert.equal(typeChange.status, 400);

  const inference = await fx.api('GET', '/api/internal/inference/cameras', {
    headers: { 'X-Inference-Api-Key': 'test-inference-key' },
  });
  const cam = inference.body.data.find((c) => c._id === created.body.data._id);
  assert.equal(cam.streamUrl, 'rtsp://internal:test-mediamtx-pass@mediamtx:8554/demo/fire_kitchen');
});

test('only the org admin can get a webcam publish token, and MediaMTX accepts only that token', async () => {
  const created = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: { name: 'Laptop', location: 'Desk', cameraType: 'webcam' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data._id;

  assert.equal((await fx.api('GET', `/api/cameras/${id}/publish-token`, { token: operator.token })).status, 403);
  assert.equal((await fx.api('GET', `/api/cameras/${id}/publish-token`, { token: otherOrg.token })).status, 403);

  const issued = await fx.api('GET', `/api/cameras/${id}/publish-token`, { token: org.token });
  assert.equal(issued.status, 200);
  const whip = new URL(issued.body.data.whipUrl);
  assert.equal(whip.pathname, `/webcam/${id}/whip`);
  const query = whip.search.slice(1);

  assert.equal((await mediamtxAuth({ action: 'publish', path: `webcam/${id}`, query })).status, 200);
  assert.equal((await mediamtxAuth({ action: 'read', path: `webcam/${id}`, query })).status, 401);
  assert.equal((await mediamtxAuth({ action: 'publish', path: `webcam/${'0'.repeat(24)}`, query })).status, 401);
  assert.equal((await mediamtxAuth({ action: 'publish', path: 'demo/fire_kitchen', query })).status, 401);
  assert.equal((await mediamtxAuth({ action: 'publish', path: `webcam/${id}`, query: 'token=forged' })).status, 401);

  assert.equal((await mediamtxAuth({ ...INTERNAL, action: 'read', path: `webcam/${id}` })).status, 200);
  assert.equal((await mediamtxAuth({ user: INTERNAL.user, password: 'wrong', action: 'read', path: 'demo/x' })).status, 401);
});
