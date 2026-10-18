// Fixtures that build tenants through the public API (register → verify → login → checkout).
const assert = require('node:assert/strict');
const UserModel = require('../../models/User');
const SubscriptionPlanModel = require('../../models/SubscriptionPlan');
const { makeApi } = require('./harness');
const { hashToken } = require('../../utils/generateOTP');

const PASSWORD = 'Passw0rd!';
const KNOWN_OTP = '246810';

function createFixtures(server) {
  const api = makeApi(server.baseUrl);
  const User = server.db.model('User', UserModel.schema);
  const SubscriptionPlan = server.db.model('SubscriptionPlan', SubscriptionPlanModel.schema);

  /** Returns the login body plus `refreshCookie` (the httpOnly refresh token). */
  async function login(email, password = PASSWORD) {
    const res = await api('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.body)}`);
    return { ...res.body, refreshCookie: res.setCookies.refreshToken?.value };
  }

  // Codes are stored hashed, so tests plant a known code instead of reading it back.
  async function plantVerificationCode(email, code = KNOWN_OTP) {
    await server.db.collection('users').updateOne(
      { email },
      {
        $set: {
          emailVerificationToken: hashToken(code),
          emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
          emailVerificationAttempts: 0,
        },
      }
    );
    return code;
  }

  async function plantResetToken(email, token = 'known-reset-token') {
    await server.db.collection('users').updateOne(
      { email },
      { $set: { passwordResetToken: hashToken(token), passwordResetExpires: new Date(Date.now() + 3600 * 1000) } }
    );
    return token;
  }

  async function seedSuperAdmin() {
    const email = 'root@audit.test';
    if (await User.exists({ email })) {
      const existing = await login(email);
      return { token: existing.accessToken, user: existing.user, email };
    }
    await User.create({
      name: 'Root Admin',
      email,
      password: PASSWORD,
      role: 'super_admin',
      isEmailVerified: true,
      isVerified: true,
    });
    const session = await login(email);
    return { token: session.accessToken, user: session.user, email };
  }

  async function seedPlan(overrides = {}) {
    const plan = await SubscriptionPlan.create({
      name: overrides.name || `Plan ${Date.now()}-${Math.random()}`,
      slug: overrides.slug || `plan-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      maxCameras: 3,
      maxOperators: 2,
      alertRetentionDays: 30,
      storageLimit: 10,
      price: 10,
      durationMonths: 1,
      isActive: true,
      ...overrides,
    });
    return plan;
  }

  async function registerVerifiedCustomer(label) {
    const email = `${label}@audit.test`;
    const reg = await api('POST', '/api/auth/register', {
      body: { name: `User ${label}`, email, password: PASSWORD },
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const otp = await plantVerificationCode(email);
    const verify = await api('POST', '/api/auth/verify-email', {
      body: { email, otp },
    });
    assert.equal(verify.status, 200, JSON.stringify(verify.body));
    return email;
  }

  async function createOrgAdmin(label, planId) {
    const email = await registerVerifiedCustomer(label);
    const session = await login(email);
    const checkout = await api('POST', '/api/subscriptions/checkout', {
      token: session.accessToken,
      body: { planId: String(planId), organizationName: `Org ${label}` },
    });
    assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
    return {
      email,
      token: checkout.body.accessToken,
      user: checkout.body.user,
      orgId: String(checkout.body.user.organizationId),
    };
  }

  async function createOperator(admin, label) {
    const email = `${label}@audit.test`;
    const res = await api('POST', '/api/users', {
      token: admin.token,
      body: { name: `Operator ${label}`, email, password: PASSWORD, role: 'operator' },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const session = await login(email);
    return { email, token: session.accessToken, user: session.user, id: String(res.body.data._id) };
  }

  async function createCamera(admin, name = 'Lobby') {
    const res = await api('POST', '/api/cameras', {
      token: admin.token,
      body: {
        name,
        location: `${name} floor 1`,
        cameraType: 'http_mjpeg',
        streamUrl: 'http://192.0.2.10/stream.mjpg',
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return String(res.body.data._id);
  }

  async function assign(admin, operatorId, cameraIds) {
    const res = await api('POST', '/api/operator-assignments', {
      token: admin.token,
      body: { operatorId, cameraIds, replace: true },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  }

  async function ingest(body) {
    return api('POST', '/api/internal/inference/ingest', {
      headers: { 'X-Inference-Api-Key': 'test-inference-key' },
      body,
    });
  }

  return {
    api,
    login,
    plantVerificationCode,
    plantResetToken,
    seedSuperAdmin,
    seedPlan,
    registerVerifiedCustomer,
    createOrgAdmin,
    createOperator,
    createCamera,
    assign,
    ingest,
    PASSWORD,
  };
}

module.exports = { createFixtures, PASSWORD, KNOWN_OTP };
