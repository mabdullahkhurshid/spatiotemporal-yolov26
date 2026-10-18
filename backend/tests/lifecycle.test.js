const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

let server;
let fx;
let plan;
let org;
let cam;

before(async () => {
  server = await startServer({ name: 'lifecycle', port: 5615 });
  fx = createFixtures(server);
  plan = await fx.seedPlan({ maxCameras: 2, maxOperators: 2 });
  org = await fx.createOrgAdmin('lc-admin', plan._id);
  cam = await fx.createCamera(org, 'LC1');
});

after(async () => {
  await server?.stop();
});

test('concurrent acknowledge requests produce exactly one transition', async () => {
  const created = await fx.api('POST', '/api/alerts', {
    token: org.token,
    body: { cameraId: cam, fireConfidence: 80, smokeConfidence: 20 },
  });
  const id = created.body.data._id;

  const results = await Promise.all(
    Array.from({ length: 5 }, () => fx.api('PUT', `/api/alerts/${id}/acknowledge`, { token: org.token, body: {} }))
  );
  const ok = results.filter((r) => r.status === 200);
  assert.equal(ok.length, 1, `statuses: ${results.map((r) => r.status).join(',')}`);
  assert.ok(results.every((r) => [200, 400, 409].includes(r.status)));

  const doc = await server.db.collection('alerts').findOne({ _id: new Types.ObjectId(id) });
  assert.equal(doc.actions.filter((a) => a.type === 'ACKNOWLEDGED').length, 1);
});

test('concurrent first-purchase checkouts create only one organization', async () => {
  const email = await fx.registerVerifiedCustomer('lc-race');
  const session = await fx.login(email);
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      fx.api('POST', '/api/subscriptions/checkout', {
        token: session.accessToken,
        body: { planId: String(plan._id), organizationName: 'Race Org' },
      })
    )
  );
  assert.ok(results.some((r) => r.status === 200));
  const orgs = await server.db.collection('organizations').countDocuments({ email });
  assert.equal(orgs, 1);
});

test('parallel camera creates cannot exceed the plan limit', async () => {
  // Plan allows 2 cameras and the org already has 1, so exactly one of these may succeed.
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      fx.api('POST', '/api/cameras', {
        token: org.token,
        body: { name: `Race ${i}`, location: 'x', cameraType: 'http_mjpeg', streamUrl: `http://192.0.2.10/r${i}.mjpg` },
      })
    )
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1, results.map((r) => r.status).join(','));
  const active = await server.db.collection('cameras').countDocuments({
    organizationId: new Types.ObjectId(org.orgId),
    isDeleted: false,
  });
  assert.equal(active, 2);
});

test('parallel operator creates cannot exceed the plan limit', async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      fx.api('POST', '/api/users', {
        token: org.token,
        body: { name: `Race op ${i}`, email: `race-op-${i}@audit.test`, password: 'Passw0rd!', role: 'operator' },
      })
    )
  );
  assert.equal(results.filter((r) => r.status === 201).length, 2, results.map((r) => r.status).join(','));
  const operators = await server.db.collection('users').countDocuments({
    organizationId: new Types.ObjectId(org.orgId),
    role: 'operator',
  });
  assert.equal(operators, 2);
});

test('expired term: alerts blocked, camera list/delete allowed, create blocked, renewal restores access', async () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orgId = new Types.ObjectId(org.orgId);
  await server.db.collection('organizations').updateOne({ _id: orgId }, { $set: { subscriptionEndDate: past } });
  await server.db.collection('subscriptions').updateOne({ organizationId: orgId }, { $set: { endDate: past } });

  assert.equal((await fx.api('GET', '/api/alerts', { token: org.token })).status, 403);
  assert.equal((await fx.api('GET', '/api/cameras', { token: org.token })).status, 200);
  const create = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: { name: 'LC2', location: 'x', cameraType: 'http_mjpeg', streamUrl: 'http://192.0.2.10/b.mjpg' },
  });
  assert.equal(create.status, 403);

  const inferenceCams = await fx.api('GET', '/api/internal/inference/cameras', {
    headers: { 'X-Inference-Api-Key': 'test-inference-key' },
  });
  assert.ok(!inferenceCams.body.data.some((c) => c._id === cam), 'expired org must not be monitored');

  const renew = await fx.api('POST', '/api/subscriptions/checkout', {
    token: org.token,
    body: { planId: String(plan._id) },
  });
  assert.equal(renew.status, 200, JSON.stringify(renew.body));
  assert.equal(String(renew.body.user.organizationId), org.orgId, 'renewal must keep the same organization');
  assert.equal((await fx.api('GET', '/api/alerts', { token: org.token })).status, 200);
});
