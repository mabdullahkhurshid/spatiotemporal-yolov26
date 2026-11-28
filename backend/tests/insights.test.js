const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Types } = require('mongoose');
const { startServer, ROOT } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

const run = promisify(execFile);
const KEY = { 'X-Inference-Api-Key': 'test-inference-key' };

let server;
let fx;
let orgA;
let orgB;
let root;
let camA;
let camB;

const seed = (args) =>
  run(process.execPath, [path.join(ROOT, 'backend', 'scripts', 'seedXaiDemo.js'), ...args], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: server.mongoUri },
  });

before(async () => {
  server = await startServer({ name: 'insights', port: 5623 });
  fx = createFixtures(server);
  const plan = await fx.seedPlan();
  orgA = await fx.createOrgAdmin('ins-admin-a', plan._id);
  orgB = await fx.createOrgAdmin('ins-admin-b', plan._id);
  root = await fx.seedSuperAdmin();
  camA = await fx.createCamera(orgA, 'InsA');
  camB = await fx.createCamera(orgB, 'InsB');
});

after(async () => {
  await server?.stop();
});

test('demo seed refuses production and labels every alert', async () => {
  await assert.rejects(
    run(process.execPath, [path.join(ROOT, 'backend', 'scripts', 'seedXaiDemo.js'), '--camera', camA], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: server.mongoUri },
    }),
    /production/
  );
  const { stdout } = await seed(['--camera', camA, '--count', '60']);
  assert.match(stdout, /Seeded 60 closed alerts/);
  const seeded = await server.db.collection('alerts').find({ cameraId: new Types.ObjectId(camA) }).toArray();
  assert.equal(seeded.length, 60);
  assert.ok(seeded.every((a) => a.resolutionNote === 'XAI demo seed' && a.explanation?.reasons?.length));
  assert.ok(seeded.some((a) => a.falseAlarmCause));
});

test('insights explain false alarms, cameras and detection locations within the tenant', async () => {
  const res = await fx.api('GET', '/api/alerts/insights', { token: orgA.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data;
  assert.equal(data.summary.alerts, 60);
  assert.ok(data.summary.falseAlarms > 0);
  assert.ok(data.summary.avgFocus > 0 && data.summary.avgFocus < 1);
  assert.ok(data.causes.length > 0 && data.causes.every((c) => c.count > 0));
  assert.equal(data.cameras.length, 1);
  assert.equal(data.cameras[0].cameraId, camA);
  assert.ok(data.cameras[0].topCause.cause);

  const { cols, rows, all, real, falseAlarm } = data.locations;
  assert.equal(all.length, cols * rows);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  assert.ok(sum(all) >= sum(real) + sum(falseAlarm));
  assert.ok(sum(falseAlarm) > 0 && sum(real) > 0);

  // Learning state with progress, but no platform-wide counts for an org admin.
  assert.equal(data.model.state, 'learning');
  assert.ok(data.model.labelProgress > 0 && data.model.labelProgress < 100);
  assert.equal(data.model.labels, undefined);

  const other = await fx.api('GET', '/api/alerts/insights', { token: orgB.token });
  assert.equal(other.body.data.summary.alerts, 0, 'another organization must not see these alerts');
  assert.equal(other.body.data.locations, null);
  const peek = await fx.api('GET', `/api/alerts/insights?cameraId=${camA}`, { token: orgB.token });
  assert.equal(peek.body.data.locations, null);

  const platform = await fx.api('GET', '/api/alerts/insights', { token: root.token });
  assert.equal(platform.status, 200);
  assert.ok(platform.body.data.model.labels.falseAlarms > 0);
});

test('model status reported by the explainer shows up as active', async () => {
  const bad = await fx.api('POST', '/api/internal/inference/explanations/model-status', { headers: KEY, body: { lastResult: 'great' } });
  assert.equal(bad.status, 400);
  const noKey = await fx.api('POST', '/api/internal/inference/explanations/model-status', { body: { lastResult: 'trained' } });
  assert.equal(noKey.status, 401);

  const ok = await fx.api('POST', '/api/internal/inference/explanations/model-status', {
    headers: KEY,
    body: {
      active: true,
      lastResult: 'trained',
      version: 'risk-202610191200-n200',
      trainedAt: '2026-10-19T12:00:00Z',
      metrics: { rocAuc: 0.83, brier: 0.15, samples: 200, falseAlarms: 80 },
      requirements: { minSamples: 150, minPerClass: 30 },
    },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const res = await fx.api('GET', '/api/alerts/insights', { token: orgA.token });
  assert.equal(res.body.data.model.state, 'active');
  assert.equal(res.body.data.model.rocAuc, 0.83);
  assert.equal(res.body.data.model.version, 'risk-202610191200-n200');
});

test('notification text carries the main reason', async () => {
  const res = await fx.ingest({
    cameraId: camA,
    streamStatus: 'ok',
    detections: [{ className: 'fire', confidence: 70, x: 0.1, y: 0.1, w: 0.1, h: 0.1, scores: { fire: 70, other: 55, smoke: 1 } }],
    metrics: { incidentActive: true, createAlert: true, fireConfidence: 70, smokeConfidence: 0, averageConfidence: 70 },
  });
  const note = await server.db.collection('notifications').findOne({ alertId: new Types.ObjectId(res.body.data.alertId) });
  assert.match(note.message, /fire 70%, smoke 0%\. The model also scored the main region 55% as "other"/);
});

test('demo seed --remove deletes only seeded alerts', async () => {
  const before = await server.db.collection('alerts').countDocuments();
  const { stdout } = await seed(['--remove']);
  assert.match(stdout, /Removed 60 seeded alerts/);
  assert.equal(await server.db.collection('alerts').countDocuments(), before - 60);
});
