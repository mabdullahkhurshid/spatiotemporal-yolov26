// Integration test harness: runs the real backend against an isolated MongoDB database.
// Email is disabled (empty EMAIL_* vars stop dotenv from loading real SMTP credentials).
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..', '..', '..');
const MONGO_BASE = process.env.TEST_MONGODB_BASE || 'mongodb://127.0.0.1:27017';

const TEST_ENV = {
  NODE_ENV: 'test',
  EMAIL_HOST: '',
  EMAIL_USER: '',
  EMAIL_PASS: '',
  JWT_SECRET: 'test-jwt-secret',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
  JWT_EXPIRE: '1h',
  JWT_REFRESH_EXPIRE: '1d',
  BCRYPT_ROUNDS: '4',
  INFERENCE_SERVICE_API_KEY: 'test-inference-key',
  INFERENCE_LIVE_EMIT_MS: '0',
  RATE_LIMIT_MAX_REQUESTS: '100000',
  AUTH_RATE_LIMIT_MAX: '100000',
  EMAIL_RATE_LIMIT_MAX: '100000',
  CONTACT_RATE_LIMIT_MAX: '100000',
  ONVIF_RATE_LIMIT_MAX: '100000',
  ONVIF_TIMEOUT_MS: '3000',
  CAMERA_ALLOW_LOCAL_SOURCES: 'false',
  // Off unless a test opts in, whatever the developer's .env says.
  XAI_ENABLED: 'false',
  FRONTEND_URL: 'http://localhost:5173',
  SOCKET_CORS_ORIGIN: 'http://localhost:5173',
  GOOGLE_CLIENT_ID: 'test-google-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost/api/auth/google/callback',
  CAMERA_OFFLINE_CHECK_INTERVAL_MS: '3600000',
};

function testDbUri(name) {
  const dbName = `fire-detection-audit-test-${name}-test`;
  return `${MONGO_BASE}/${dbName}`;
}

async function resetDatabase(uri) {
  const dbName = new URL(uri).pathname.slice(1);
  if (!dbName.endsWith('-test')) {
    throw new Error(`Refusing to drop non-test database: ${dbName}`);
  }
  const conn = await mongoose.createConnection(uri).asPromise();
  await conn.dropDatabase();
  await conn.close();
}

async function startServer({ name, port, env = {} }) {
  const mongoUri = testDbUri(name);
  await resetDatabase(mongoUri);

  const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ...TEST_ENV, ...env, PORT: String(port), MONGODB_URI: mongoUri },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early:\n${output}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) break;
    } catch (_) {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Wait for MongoDB connection so seeded data is visible to the server.
  const db = await mongoose.createConnection(mongoUri).asPromise();

  return {
    baseUrl,
    mongoUri,
    db,
    output: () => output,
    async stop() {
      await db.close();
      child.kill();
      await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)));
      await resetDatabase(mongoUri);
    },
  };
}

/** Parse Set-Cookie headers into { name: { value, attributes } }. */
function parseSetCookies(headers) {
  const cookies = {};
  for (const raw of headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(';').map((p) => p.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const value = decodeURIComponent(pair.slice(eq + 1));
    const attributes = {};
    for (const a of attrs) {
      const [k, ...v] = a.split('=');
      attributes[k.toLowerCase()] = v.length ? v.join('=') : true;
    }
    // Several Set-Cookie headers may clear legacy paths first; keep the one with a value.
    if (!cookies[name] || value) cookies[name] = { value, attributes };
  }
  return cookies;
}

function makeApi(baseUrl) {
  return async function api(method, urlPath, { token, body, headers = {}, cookies } = {}) {
    const cookieHeader = cookies
      ? Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
      : undefined;
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text;
    }
    return { status: res.status, body: data, setCookies: parseSetCookies(res.headers), headers: res.headers };
  };
}

module.exports = { ROOT, startServer, makeApi, testDbUri, parseSetCookies };
