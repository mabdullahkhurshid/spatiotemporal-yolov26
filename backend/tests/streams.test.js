const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

let server;
let localServer;
let fx;
let org;
let otherOrg;
let operator;
let mjpegCam;
let otherCam;

const camBody = (streamUrl, extra = {}) => ({
  name: 'Policy cam',
  location: 'Gate',
  cameraType: 'ip_rtsp',
  ipAddress: '192.168.1.20',
  streamUrl,
  ...extra,
});

const hasFfmpeg = (() => {
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
})();

before(async () => {
  server = await startServer({ name: 'streams', port: 5618 });
  fx = createFixtures(server);
  const plan = await fx.seedPlan({ maxCameras: 20, maxOperators: 3 });
  org = await fx.createOrgAdmin('st-admin', plan._id);
  otherOrg = await fx.createOrgAdmin('st-other', plan._id);
  operator = await fx.createOperator(org, 'st-op');
  mjpegCam = await fx.createCamera(org, 'Mjpeg');
  otherCam = await fx.createCamera(otherOrg, 'Other');
});

after(async () => {
  await server?.stop();
  await localServer?.stop();
});

test('stream URLs that would make the server read local files or internal addresses are rejected', async () => {
  const rejected = [
    'C:\\videos\\fire.mp4',
    '/etc/passwd',
    'file:///etc/passwd',
    'ftp://192.168.1.20/stream',
    'concat:/etc/passwd|/etc/hosts',
    'rtsp://127.0.0.1:8554/live',
    'http://localhost:8080/video.mjpg',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:169.254.169.254]/latest/meta-data/',
    'http://2852039166/latest/meta-data/',
  ];
  for (const url of rejected) {
    const res = await fx.api('POST', '/api/cameras', { token: org.token, body: camBody(url) });
    assert.equal(res.status, 400, `${url} was accepted`);
    assert.match(res.body.message, /not allowed|must start with|must include/);
  }
});

test('normal camera URLs are accepted, and edits are validated too', async () => {
  const ok = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: camBody('rtsp://admin:pass@192.168.1.20:554/Streaming/Channels/101'),
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const https = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: { name: 'Web', location: 'Roof', cameraType: 'http_mjpeg', streamUrl: 'https://cams.example.com/roof.mjpg' },
  });
  assert.equal(https.status, 201);

  const edit = await fx.api('PUT', `/api/cameras/${ok.body.data._id}`, {
    token: org.token,
    body: camBody('file:///etc/shadow'),
  });
  assert.equal(edit.status, 400);
});

test('cameras saved before the policy are not handed to the inference worker', async () => {
  await server.db.collection('cameras').insertOne({
    name: 'Legacy local',
    location: 'Old',
    organizationId: new (require('mongoose').Types.ObjectId)(org.orgId),
    cameraType: 'http_mjpeg',
    streamUrl: 'C:\\demo\\fire.mp4',
    isDeleted: false,
    isActive: true,
    settings: { detectionEnabled: true },
  });
  const res = await fx.api('GET', '/api/internal/inference/cameras', {
    headers: { 'X-Inference-Api-Key': 'test-inference-key' },
  });
  assert.equal(res.status, 200);
  assert.ok(!res.body.data.some((c) => c.name === 'Legacy local'));
  assert.ok(res.body.data.some((c) => c._id === mjpegCam));
});

test('live view uses a short-lived camera-scoped token instead of the access token in the URL', async () => {
  const issued = await fx.api('GET', `/api/cameras/${mjpegCam}/stream-token`, { token: org.token });
  assert.equal(issued.status, 200);
  const { token, expiresIn } = issued.body.data;
  assert.ok(token && expiresIn <= 60);

  // The access token is no longer accepted in the query string.
  const viaAccess = await fx.api('GET', `/api/cameras/${mjpegCam}/stream/mjpeg?accessToken=${org.token}`);
  assert.equal(viaAccess.status, 401);

  // Valid stream token passes auth (this camera is HTTP MJPEG, so the proxy answers 400 "not required").
  const viaStream = await fx.api('GET', `/api/cameras/${mjpegCam}/stream/mjpeg?streamToken=${token}`);
  assert.equal(viaStream.status, 400);
  assert.match(viaStream.body.message, /only required for RTSP/);

  // Scoped to one camera, and useless as an API token.
  const wrongCam = await fx.api('GET', `/api/cameras/${otherCam}/stream/mjpeg?streamToken=${token}`);
  assert.equal(wrongCam.status, 401);
  const asBearer = await fx.api('GET', '/api/auth/me', { token });
  assert.equal(asBearer.status, 401);
});

test('stream tokens follow camera access rules', async () => {
  const unassigned = await fx.api('GET', `/api/cameras/${mjpegCam}/stream-token`, { token: operator.token });
  assert.equal(unassigned.status, 403);
  const crossTenant = await fx.api('GET', `/api/cameras/${otherCam}/stream-token`, { token: org.token });
  assert.equal(crossTenant.status, 403);
});

test('local demo sources work end-to-end when explicitly enabled', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  localServer = await startServer({ name: 'streams-local', port: 5619, env: { CAMERA_ALLOW_LOCAL_SOURCES: 'true' } });
  const lfx = createFixtures(localServer);
  const plan = await lfx.seedPlan();
  const admin = await lfx.createOrgAdmin('st-local', plan._id);

  const video = path.join(require('os').tmpdir(), `audit-demo-${process.pid}.mp4`);
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=5', '-t', '2', video,
  ]);

  try {
    const created = await lfx.api('POST', '/api/cameras', { token: admin.token, body: camBody(video) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const camId = created.body.data._id;
    const { token } = (await lfx.api('GET', `/api/cameras/${camId}/stream-token`, { token: admin.token })).body.data;

    const controller = new AbortController();
    const res = await fetch(`${localServer.baseUrl}/api/cameras/${camId}/stream/mjpeg?streamToken=${token}`, {
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /multipart\/x-mixed-replace/);

    // Read until the first JPEG start-of-image marker arrives.
    const reader = res.body.getReader();
    let buffer = Buffer.alloc(0);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff])) === -1) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = Buffer.concat([buffer, Buffer.from(value)]);
    }
    controller.abort();
    assert.ok(buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff])) !== -1, 'no JPEG frame received from the proxy');
  } finally {
    // Succeeds only once the proxy has killed ffmpeg after the viewer disconnected (Windows locks open files).
    fs.rmSync(video, { force: true, maxRetries: 25, retryDelay: 200 });
  }
});
