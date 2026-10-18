const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');
const { connectSocket, collect, settle } = require('./helpers/sockets');

let server;
let fx;
let orgA;
let orgB;
let opA;
let camA1;
let camA2;
const sockets = [];

const alertFrame = (cameraId) => ({
  cameraId,
  streamStatus: 'ok',
  detections: [{ className: 'fire', confidence: 91, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }],
  metrics: { incidentActive: true, createAlert: true, fireConfidence: 91, smokeConfidence: 10, averageConfidence: 91 },
});

async function open(session) {
  const socket = await connectSocket(server.baseUrl, session.token);
  sockets.push(socket);
  // Mirror frontend/src/services/socketService.js: it emits user.organizationId as stored after login.
  if (session.user?.organizationId) socket.emit('join:organization', session.user.organizationId);
  await settle(200);
  return socket;
}

before(async () => {
  server = await startServer({ name: 'realtime', port: 5613 });
  fx = createFixtures(server);
  const plan = await fx.seedPlan({ maxCameras: 5, maxOperators: 3 });
  orgA = await fx.createOrgAdmin('rt-admin-a', plan._id);
  orgB = await fx.createOrgAdmin('rt-admin-b', plan._id);
  opA = await fx.createOperator(orgA, 'rt-op-a');
  camA1 = await fx.createCamera(orgA, 'RA1');
  camA2 = await fx.createCamera(orgA, 'RA2');
  await fx.assign(orgA, opA.id, [camA1]);

  // Use the user object exactly as the browser stores it after a password login.
  orgA.user = (await fx.login(orgA.email)).user;
  opA.user = (await fx.login(opA.email)).user;
});

after(async () => {
  sockets.forEach((s) => s.close());
  await server?.stop();
});

test('anonymous socket connections are rejected', async () => {
  await assert.rejects(connectSocket(server.baseUrl, null));
  await assert.rejects(connectSocket(server.baseUrl, 'not-a-jwt'));
});

test('org admin receives alert:new and detection:live for own cameras using the real login payload', async () => {
  const socket = await open(orgA);
  const alerts = collect(socket, 'alert:new');
  const live = collect(socket, 'detection:live');

  const res = await fx.ingest(alertFrame(camA1));
  assert.equal(res.status, 200);
  await settle();

  assert.equal(alerts.items.length, 1, 'org admin did not receive alert:new');
  assert.ok(live.items.length >= 1, 'org admin did not receive detection:live');
});

test('another tenant cannot subscribe to or observe org A events', async () => {
  const intruder = await open(orgB);
  intruder.emit('join:organization', orgA.orgId);
  await settle(200);
  const alerts = collect(intruder, 'alert:new');
  const live = collect(intruder, 'detection:live');
  const globalAlerts = collect(intruder, `alert:${orgA.orgId}`);

  await fx.ingest(alertFrame(camA2));
  await settle();

  assert.equal(alerts.items.length, 0, 'cross-tenant alert:new leaked');
  assert.equal(live.items.length, 0, 'cross-tenant detection:live leaked');
  assert.equal(globalAlerts.items.length, 0, 'global alert:<orgId> broadcast leaked');
});

test('operator receives real-time alerts only for assigned cameras', async () => {
  const socket = await open(opA);
  const alerts = collect(socket, 'alert:new');

  // Cooldown is enforced by the worker, not the backend, so two alerts are fine here.
  await fx.ingest(alertFrame(camA2));
  await fx.ingest(alertFrame(camA1));
  await settle();

  const cameraIds = alerts.items.map((p) => String(p.alert.cameraId?._id || p.alert.cameraId));
  assert.deepEqual(cameraIds, [camA1]);
});

test('lifecycle updates are pushed to the org', async () => {
  const socket = await open(orgA);
  const resolved = collect(socket, 'alert:resolved');
  const updated = collect(socket, 'alert:updated');

  const created = await fx.api('POST', '/api/alerts', {
    token: orgA.token,
    body: { cameraId: camA1, fireConfidence: 70, smokeConfidence: 70 },
  });
  const id = created.body.data._id;
  await fx.api('PUT', `/api/alerts/${id}/acknowledge`, { token: orgA.token, body: {} });
  await fx.api('PUT', `/api/alerts/${id}/resolve`, { token: orgA.token, body: {} });
  await settle();

  assert.equal(updated.items.length, 1);
  assert.equal(resolved.items.length, 1);
});

test('super admin receives platform-wide alerts but not raw detection frames', async () => {
  const root = await fx.seedSuperAdmin();
  const socket = await connectSocket(server.baseUrl, root.token);
  sockets.push(socket);
  await settle(200);
  const alerts = collect(socket, 'alert:new');
  const live = collect(socket, 'detection:live');

  await fx.ingest(alertFrame(camA1));
  await settle();

  assert.equal(alerts.items.length, 1, 'super admin did not get the live alert');
  assert.equal(live.items.length, 0, 'super admin must not receive raw detection frames');
});

test('another tenant cannot spoof camera status over the socket', async () => {
  const intruder = await open(orgB);
  intruder.emit('camera:status', { cameraId: camA1, status: 'maintenance' });
  await settle();
  const cam = await server.db.collection('cameras').findOne({ _id: new Types.ObjectId(camA1) });
  assert.notEqual(cam.status, 'maintenance');
});
