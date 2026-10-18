const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');

let server;
let fx;
let plan;
let orgA;
let orgB;
let opA;
let camA1;
let camA2;
let camB1;

const alertBody = (cameraId) => ({ cameraId, fireConfidence: 90, smokeConfidence: 40 });

before(async () => {
  server = await startServer({ name: 'tenancy', port: 5612 });
  fx = createFixtures(server);
  plan = await fx.seedPlan({ maxCameras: 3, maxOperators: 2 });
  orgA = await fx.createOrgAdmin('admin-a', plan._id);
  orgB = await fx.createOrgAdmin('admin-b', plan._id);
  opA = await fx.createOperator(orgA, 'op-a');
  camA1 = await fx.createCamera(orgA, 'A1');
  camA2 = await fx.createCamera(orgA, 'A2');
  camB1 = await fx.createCamera(orgB, 'B1');
  await fx.assign(orgA, opA.id, [camA1]);
});

after(async () => {
  await server?.stop();
});

test('checkout promotes customer to org_admin with an ACTIVE org and active subscription', async () => {
  const summary = await fx.api('GET', '/api/users/me/account-summary', { token: orgA.token });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.user.role, 'org_admin');
  assert.equal(summary.body.data.flags.hasActiveSubscription, true);
});

test('second checkout during an active term is blocked', async () => {
  const res = await fx.api('POST', '/api/subscriptions/checkout', {
    token: orgA.token,
    body: { planId: String(plan._id) },
  });
  assert.equal(res.status, 400);
});

test('camera plan limit is enforced', async () => {
  await fx.createCamera(orgA, 'A3');
  const res = await fx.api('POST', '/api/cameras', {
    token: orgA.token,
    body: { name: 'A4', location: 'x', cameraType: 'http_mjpeg', streamUrl: 'http://192.0.2.10/a.mjpg' },
  });
  assert.equal(res.status, 400);
});

test('operator sees only assigned cameras and cannot manage cameras', async () => {
  const list = await fx.api('GET', '/api/cameras', { token: opA.token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map((c) => c._id), [camA1]);

  const unassigned = await fx.api('GET', `/api/cameras/${camA2}`, { token: opA.token });
  assert.equal(unassigned.status, 403);

  const create = await fx.api('POST', '/api/cameras', {
    token: opA.token,
    body: { name: 'X', location: 'x', cameraType: 'http_mjpeg', streamUrl: 'http://192.0.2.10/x.mjpg' },
  });
  assert.equal(create.status, 403);
});

test('org admin cannot read another tenant camera', async () => {
  const res = await fx.api('GET', `/api/cameras/${camB1}`, { token: orgA.token });
  assert.equal(res.status, 403);
});

test('org admin cannot create an alert on another tenant camera', async () => {
  const res = await fx.api('POST', '/api/alerts', { token: orgA.token, body: alertBody(camB1) });
  assert.equal(res.status, 403, `cross-tenant alert response: ${res.status}`);
  const count = await server.db.collection('alerts').countDocuments({ cameraId: new Types.ObjectId(camB1) });
  assert.equal(count, 0);
});

test('operator cannot create alerts for unassigned cameras', async () => {
  const res = await fx.api('POST', '/api/alerts', { token: opA.token, body: alertBody(camA2) });
  assert.equal(res.status, 403);
});

test('operator cannot read alerts of unassigned cameras via ?cameraId filter', async () => {
  const created = await fx.api('POST', '/api/alerts', { token: orgA.token, body: alertBody(camA2) });
  assert.equal(created.status, 201);

  const res = await fx.api('GET', `/api/alerts?cameraId=${camA2}`, { token: opA.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 0, 'operator must not see alerts from unassigned camera');
});

test('alert list rejects operator objects in query filters', async () => {
  const res = await fx.api('GET', '/api/alerts?status[$ne]=resolved', { token: orgA.token });
  assert.ok(res.status === 400 || (res.status === 200 && res.body.data.length === 0));
});

test('alert lifecycle: acknowledge → resolve, and closed alerts cannot be reopened', async () => {
  const created = await fx.api('POST', '/api/alerts', { token: orgA.token, body: alertBody(camA1) });
  const id = created.body.data._id;

  const ack = await fx.api('PUT', `/api/alerts/${id}/acknowledge`, { token: opA.token, body: {} });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.data.status, 'acknowledged');

  const resolve = await fx.api('PUT', `/api/alerts/${id}/resolve`, {
    token: opA.token,
    body: { resolutionType: 'EXTINGUISHED', note: 'done' },
  });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.data.status, 'resolved');

  const reAck = await fx.api('PUT', `/api/alerts/${id}/acknowledge`, { token: opA.token, body: {} });
  assert.equal(reAck.status, 400, 'resolved alert must not go back to acknowledged');
  const falseAlarm = await fx.api('PUT', `/api/alerts/${id}/false-alarm`, { token: orgA.token, body: {} });
  assert.equal(falseAlarm.status, 400, 'resolved alert must not become a false alarm');
});

test('invalid resolutionType returns 400, not 500', async () => {
  const created = await fx.api('POST', '/api/alerts', { token: orgA.token, body: alertBody(camA1) });
  const res = await fx.api('PUT', `/api/alerts/${created.body.data._id}/resolve`, {
    token: orgA.token,
    body: { resolutionType: 'BOGUS' },
  });
  assert.equal(res.status, 400);
});

test('other tenant cannot acknowledge an alert', async () => {
  const created = await fx.api('POST', '/api/alerts', { token: orgA.token, body: alertBody(camA1) });
  const res = await fx.api('PUT', `/api/alerts/${created.body.data._id}/acknowledge`, { token: orgB.token, body: {} });
  assert.equal(res.status, 403);
});

test('alert stats are scoped to the tenant', async () => {
  const a = await fx.api('GET', '/api/alerts/stats', { token: orgA.token });
  const b = await fx.api('GET', '/api/alerts/stats', { token: orgB.token });
  assert.ok(a.body.data.total > 0);
  assert.equal(b.body.data.total, 0);
});

test('org admin cannot touch another tenant camera heartbeat', async () => {
  const res = await fx.api('PUT', `/api/cameras/${camB1}/activity`, { token: orgA.token });
  assert.equal(res.status, 403);
});

test('failed replace-assignment keeps existing assignments', async () => {
  const res = await fx.api('POST', '/api/operator-assignments', {
    token: orgA.token,
    body: { operatorId: opA.id, cameraIds: [camB1], replace: true },
  });
  assert.equal(res.status, 400);
  const list = await fx.api('GET', '/api/cameras', { token: opA.token });
  assert.deepEqual(list.body.data.map((c) => c._id), [camA1], 'operator lost assignment after rejected request');
});

test('org admin can edit their own profile', async () => {
  const res = await fx.api('PUT', `/api/users/${orgA.user._id}`, {
    token: orgA.token,
    body: { name: 'Renamed Admin', phone: '123' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.name, 'Renamed Admin');
});

test('editing an operator does not hand the org admin that operator\'s session secrets', async () => {
  await fx.api('POST', '/api/auth/forgotpassword', { body: { email: opA.email } });
  const res = await fx.api('PUT', `/api/users/${opA.id}`, { token: orgA.token, body: { phone: '555' } });
  assert.equal(res.status, 200);
  for (const field of ['refreshToken', 'refreshSessions', 'passwordResetToken', 'emailVerificationToken', 'password']) {
    assert.equal(res.body.data[field], undefined, `${field} leaked`);
  }
});

test('org admin can load their own profile (populated organization is compared by id)', async () => {
  const res = await fx.api('GET', `/api/users/${orgA.user._id}`, { token: orgA.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const other = await fx.api('GET', `/api/users/${orgB.user._id}`, { token: orgA.token });
  assert.equal(other.status, 403);
});

test('orders record the purchased plan name', async () => {
  const summary = await fx.api('GET', '/api/users/me/account-summary', { token: orgA.token });
  assert.equal(summary.body.data.orders[0].planName, plan.name);
  const root = await fx.seedSuperAdmin();
  const orders = await fx.api('GET', '/api/orders', { token: root.token });
  assert.ok(orders.body.data.every((o) => o.planDisplayName === plan.name));
});

test('org admin cannot edit operators of another tenant', async () => {
  const res = await fx.api('PUT', `/api/users/${opA.id}`, { token: orgB.token, body: { name: 'x' } });
  assert.equal(res.status, 403);
});

test('operator limit is enforced', async () => {
  await fx.createOperator(orgA, 'op-a2');
  const res = await fx.api('POST', '/api/users', {
    token: orgA.token,
    body: { name: 'Too many', email: 'op-a3@audit.test', password: 'Passw0rd!', role: 'operator' },
  });
  assert.equal(res.status, 400);
});

test('super admin sees all organizations; org admin cannot list them', async () => {
  const root = await fx.seedSuperAdmin();
  const all = await fx.api('GET', '/api/organizations', { token: root.token });
  assert.equal(all.status, 200);
  assert.ok(all.body.data.length >= 2);
  const denied = await fx.api('GET', '/api/organizations', { token: orgA.token });
  assert.equal(denied.status, 403);
});

test('suspended organization loses product access', async () => {
  const root = await fx.login('root@audit.test');
  const suspend = await fx.api('PUT', `/api/organizations/${orgB.orgId}/suspend`, { token: root.accessToken });
  assert.equal(suspend.status, 200);
  const res = await fx.api('GET', '/api/cameras', { token: orgB.token });
  assert.equal(res.status, 403);
  await fx.api('PUT', `/api/organizations/${orgB.orgId}/unsuspend`, { token: root.accessToken });
});
