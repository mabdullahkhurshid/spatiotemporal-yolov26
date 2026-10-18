const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');
const { startServer, ROOT } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

let server;
let fx;
let org;
let cam;

const frame = (overrides = {}) => ({
  cameraId: cam,
  streamStatus: 'ok',
  detections: [{ className: 'smoke', confidence: 80, x: 0.2, y: 0.2, w: 0.3, h: 0.3 }],
  metrics: { incidentActive: true, fireConfidence: 0, smokeConfidence: 80 },
  ...overrides,
});

before(async () => {
  // Low limit proves that the worker's high-frequency ingest is not throttled by the public limiter.
  server = await startServer({ name: 'inference', port: 5614, env: { RATE_LIMIT_MAX_REQUESTS: '15' } });
  fx = createFixtures(server);
  const plan = await fx.seedPlan();
  org = await fx.createOrgAdmin('inf-admin', plan._id);
  cam = await fx.createCamera(org, 'Warehouse');
});

after(async () => {
  if (org) fs.rmSync(path.join(ROOT, 'uploads', 'snapshots', org.orgId), { recursive: true, force: true });
  await server?.stop();
});

test('internal inference API requires the service key', async () => {
  const res = await fx.api('POST', '/api/internal/inference/ingest', { body: frame() });
  assert.equal(res.status, 401);
  const wrong = await fx.api('GET', '/api/internal/inference/cameras', { headers: { 'X-Inference-Api-Key': 'nope' } });
  assert.equal(wrong.status, 401);
});

test('camera registry lists cameras of organizations with an active term', async () => {
  const res = await fx.api('GET', '/api/internal/inference/cameras', {
    headers: { 'X-Inference-Api-Key': 'test-inference-key' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((c) => c._id === cam));
});

test('ingest with createAlert creates incident, alert, snapshot and notifications; incidentEnded closes it', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const res = await fx.ingest(
    frame({
      metrics: { incidentActive: true, createAlert: true, fireConfidence: 0, smokeConfidence: 80, averageConfidence: 80 },
      snapshotBase64: jpeg,
    })
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { alertId, incidentId } = res.body.data;
  assert.ok(alertId && incidentId);

  const alert = await server.db.collection('alerts').findOne({ _id: new Types.ObjectId(alertId) });
  assert.equal(alert.primaryClass, 'smoke');
  assert.match(alert.frameSnapshotURL, /^\/uploads\/snapshots\//);
  const notifications = await server.db.collection('notifications').countDocuments({ alertId: alert._id });
  assert.ok(notifications >= 1);

  const ended = await fx.ingest(frame({ detections: [], metrics: {}, incidentEnded: true }));
  assert.equal(ended.status, 200);
  const incident = await server.db.collection('fireincidents').findOne({ _id: new Types.ObjectId(incidentId) });
  assert.equal(incident.status, 'ended');
});

test('ingest for an unknown camera returns 404', async () => {
  const res = await fx.ingest(frame({ cameraId: new Types.ObjectId().toString() }));
  assert.equal(res.status, 404);
});

test('worker ingest at 2 FPS is not throttled by the public API rate limiter', async () => {
  const statuses = [];
  for (let i = 0; i < 30; i += 1) {
    const res = await fx.ingest(frame({ detections: [], metrics: { incidentActive: false } }));
    statuses.push(res.status);
  }
  assert.equal(statuses.filter((s) => s === 429).length, 0, `ingest statuses: ${statuses.join(',')}`);

  // Public API remains rate limited.
  const publicStatuses = [];
  for (let i = 0; i < 20; i += 1) {
    publicStatuses.push((await fx.api('GET', '/api/public/subscription-plans')).status);
  }
  assert.ok(publicStatuses.includes(429), 'public API should still be rate limited');
});
