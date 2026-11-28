const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');
const { startServer, ROOT } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');
const { connectSocket, collect, settle } = require('./helpers/sockets');

const KEY = { 'X-Inference-Api-Key': 'test-inference-key' };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');

let server;
let fx;
let org;
let opAssigned;
let opOther;
let cam;
let otherCam;
const sockets = [];

const alertFrame = (cameraId, overrides = {}) => ({
  cameraId,
  streamStatus: 'ok',
  detections: [{ className: 'fire', confidence: 88, x: 0.1, y: 0.1, w: 0.2, h: 0.2, scores: { fire: 88, other: 5, smoke: 1 } }],
  metrics: { incidentActive: true, createAlert: true, fireConfidence: 88, smokeConfidence: 0, averageConfidence: 88 },
  snapshotBase64: JPEG,
  ...overrides,
});

const internal = (method, urlPath, body) => fx.api(method, `/api/internal/inference${urlPath}`, { headers: KEY, body });
const alertDoc = (id) => server.db.collection('alerts').findOne({ _id: new Types.ObjectId(String(id)) });

async function open(session) {
  const socket = await connectSocket(server.baseUrl, session.token);
  sockets.push(socket);
  if (session.user?.organizationId) socket.emit('join:organization', session.user.organizationId);
  await settle(200);
  return socket;
}

before(async () => {
  server = await startServer({ name: 'explanations', port: 5622, env: { XAI_ENABLED: 'true' } });
  fx = createFixtures(server);
  const plan = await fx.seedPlan({ maxCameras: 5, maxOperators: 3 });
  org = await fx.createOrgAdmin('xai-admin', plan._id);
  opAssigned = await fx.createOperator(org, 'xai-op-a');
  opOther = await fx.createOperator(org, 'xai-op-b');
  cam = await fx.createCamera(org, 'XaiCam');
  otherCam = await fx.createCamera(org, 'XaiOther');
  await fx.assign(org, opAssigned.id, [cam]);
  await fx.assign(org, opOther.id, [otherCam]);
  org.user = (await fx.login(org.email)).user;
});

after(async () => {
  sockets.forEach((s) => s.close());
  if (org) {
    for (const dir of ['snapshots', 'explanations']) {
      fs.rmSync(path.join(ROOT, 'uploads', dir, org.orgId), { recursive: true, force: true });
    }
  }
  await server?.stop();
});

test('explainer endpoints require the service key', async () => {
  for (const [method, url] of [
    ['POST', '/api/internal/inference/explanations/claim'],
    ['GET', '/api/internal/inference/explanations/training-data'],
    ['POST', `/api/internal/inference/explanations/${new Types.ObjectId()}`],
  ]) {
    const res = await fx.api(method, url, { body: method === 'POST' ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${url}`);
  }
  const user = await fx.api('POST', '/api/internal/inference/explanations/claim', { token: org.token, body: {} });
  assert.equal(user.status, 401);
});

test('alerts with a snapshot are queued; alerts without one are not', async () => {
  const withSnapshot = await fx.ingest(alertFrame(cam));
  assert.equal((await alertDoc(withSnapshot.body.data.alertId)).explanation.visual.status, 'pending');

  const noSnapshot = await fx.ingest(alertFrame(cam, { snapshotBase64: undefined }));
  assert.equal((await alertDoc(noSnapshot.body.data.alertId)).explanation.visual?.status, undefined);

  // Clear the queue for the following tests.
  await server.db.collection('alerts').updateMany({}, { $unset: { 'explanation.visual': '' } });
});

test('claim hands a job out once, with the snapshot, boxes and camera history', async () => {
  const created = await fx.ingest(alertFrame(cam));
  const alertId = created.body.data.alertId;

  const first = await internal('POST', '/explanations/claim', { limit: 3 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.count, 1);
  const job = first.body.data[0];
  assert.equal(job.alertId, alertId);
  assert.match(job.snapshotURL, /^\/uploads\/snapshots\//);
  assert.equal(job.boundingBoxes[0].scores.fire, 88);
  assert.deepEqual(job.features.cameraHistory, { closed: 0, falseAlarms: 0 });
  assert.equal((await alertDoc(alertId)).explanation.visual.status, 'processing');

  const second = await internal('POST', '/explanations/claim', {});
  assert.equal(second.body.count, 0);

  // A claim left unanswered for more than 5 minutes is handed out again.
  await server.db.collection('alerts').updateOne(
    { _id: new Types.ObjectId(alertId) },
    { $set: { 'explanation.visual.claimedAt': new Date(Date.now() - 6 * 60 * 1000) } }
  );
  const again = await internal('POST', '/explanations/claim', {});
  assert.equal(again.body.data[0]?.alertId, alertId);
});

test('submitted heatmap is stored and pushed only to the camera audience', async () => {
  const created = await fx.ingest(alertFrame(cam));
  const alertId = created.body.data.alertId;
  await internal('POST', '/explanations/claim', {});

  const adminSocket = await open(org);
  const assignedSocket = await open(opAssigned);
  const otherSocket = await open(opOther);
  const adminEvents = collect(adminSocket, 'alert:explained');
  const assignedEvents = collect(assignedSocket, 'alert:explained');
  const otherEvents = collect(otherSocket, 'alert:explained');

  const notJpeg = await internal('POST', `/explanations/${alertId}`, { status: 'ready', heatmapBase64: Buffer.from('<svg/>').toString('base64') });
  assert.equal(notJpeg.status, 400);

  const res = await internal('POST', `/explanations/${alertId}`, {
    status: 'ready',
    method: 'layercam',
    heatmapBase64: JPEG,
    durationMs: 3100,
    modelInfo: 'best.pt',
    targets: [{ boxIndex: 0, className: 'fire', confidence: 88, focusInBox: 1.7, peak: { x: 0.2, y: -3 } }],
    risk: {
      probability: 0.32,
      level: 'medium',
      modelVersion: 'risk-test',
      contributions: [{ feature: 'cameraFalseAlarmRate', label: 'Camera false-alarm history', value: 0.5, impact: 0.12 }],
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const alert = await alertDoc(alertId);
  assert.equal(alert.explanation.visual.status, 'ready');
  assert.match(alert.explanation.visual.heatmapURL, new RegExp(`^/uploads/explanations/${org.orgId}/${alertId}-[0-9a-f]{16}\\.jpg$`));
  assert.ok(fs.existsSync(path.join(ROOT, alert.explanation.visual.heatmapURL)));
  assert.equal(alert.explanation.visual.targets[0].focusInBox, 1);
  assert.equal(alert.explanation.visual.targets[0].peak.y, 0);
  assert.equal(alert.explanation.risk.level, 'medium');
  // The decision trace written at creation is untouched.
  assert.ok(alert.explanation.reasons.length > 0);

  await settle();
  assert.equal(adminEvents.items.length, 1);
  assert.equal(adminEvents.items[0].alertId, alertId);
  assert.equal(adminEvents.items[0].explanation.visual.status, 'ready');
  assert.equal(assignedEvents.items.length, 1);
  assert.equal(otherEvents.items.length, 0, 'operator of another camera must not receive the explanation');

  const repeat = await internal('POST', `/explanations/${alertId}`, { status: 'ready', heatmapBase64: JPEG });
  assert.equal(repeat.status, 409);
});

test('failed explanations keep the error and no heatmap', async () => {
  const created = await fx.ingest(alertFrame(cam));
  const alertId = created.body.data.alertId;
  await internal('POST', '/explanations/claim', {});
  const res = await internal('POST', `/explanations/${alertId}`, { status: 'failed', error: 'snapshot unreadable' });
  assert.equal(res.status, 200);
  const alert = await alertDoc(alertId);
  assert.equal(alert.explanation.visual.status, 'failed');
  assert.equal(alert.explanation.visual.error, 'snapshot unreadable');
  assert.equal(alert.explanation.visual.heatmapURL, undefined);

  const invalid = await internal('POST', `/explanations/${alertId}`, { status: 'done' });
  assert.equal(invalid.status, 400);
});

test('training data lists closed alerts with outcome and cause only', async () => {
  const a = (await fx.ingest(alertFrame(cam, { snapshotBase64: undefined }))).body.data.alertId;
  const b = (await fx.ingest(alertFrame(cam, { snapshotBase64: undefined }))).body.data.alertId;
  await fx.api('PUT', `/api/alerts/${a}/false-alarm`, { token: org.token, body: { cause: 'ARTIFICIAL_LIGHT' } });
  await fx.api('PUT', `/api/alerts/${b}/resolve`, { token: org.token, body: { resolutionType: 'EXTINGUISHED' } });

  const res = await internal('GET', '/explanations/training-data');
  assert.equal(res.status, 200);
  const statuses = new Set(res.body.data.map((x) => x.status));
  assert.deepEqual([...statuses].sort(), ['false_alarm', 'resolved']);
  const fa = res.body.data.find((x) => x._id === a);
  assert.equal(fa.falseAlarmCause, 'ARTIFICIAL_LIGHT');
  assert.ok(fa.explanation.decision);
  assert.equal(fa.organizationId, undefined, 'training data carries no organization identifiers');

  // The camera's track record now shows up in the next job.
  await fx.ingest(alertFrame(cam));
  const job = (await internal('POST', '/explanations/claim', {})).body.data[0];
  assert.deepEqual(job.features.cameraHistory, { closed: 2, falseAlarms: 1 });
});
