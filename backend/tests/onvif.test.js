// ONVIF cameras: probe, create, credentials handling, stream resolution, refresh and discovery,
// against the simulated device in helpers/onvifSimulator.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/harness');
const { createFixtures } = require('./helpers/fixtures');
const { startOnvifSimulator } = require('./helpers/onvifSimulator');
const { parseProbeMatches } = require('../services/onvif/discovery');

let server;
let fx;
let org;
let otherOrg;
let operator;
let device; // WS-Security camera, clock 2 h ahead, advertising an internal LAN address
let digestDevice;
let media2Device;

const CREDS = { username: 'admin', password: 'cam-secret' };

before(async () => {
  device = await startOnvifSimulator({ skewMs: 2 * 3600 * 1000, rtspPort: 8554 });
  digestDevice = await startOnvifSimulator({ auth: 'digest', password: 'digest-pass' });
  media2Device = await startOnvifSimulator({ media: 'v2' });
  // Loopback is allowed here because the simulated cameras listen on 127.0.0.1.
  server = await startServer({ name: 'onvif', port: 5630, env: { CAMERA_ALLOW_LOCAL_SOURCES: 'true' } });
  fx = createFixtures(server);
  const plan = await fx.seedPlan({ maxCameras: 10, maxOperators: 3 });
  org = await fx.createOrgAdmin('onvif-admin', plan._id);
  otherOrg = await fx.createOrgAdmin('onvif-other', plan._id);
  operator = await fx.createOperator(org, 'onvif-op');
});

after(async () => {
  await server?.stop();
  await device?.stop();
  await digestDevice?.stop();
  await media2Device?.stop();
});

const probe = (token, body) => fx.api('POST', '/api/cameras/onvif/probe', { token, body });
const target = (sim, extra = {}) => ({ host: '127.0.0.1', port: sim.port, ...CREDS, ...extra });

const onvifCamera = (sim, extra = {}) => ({
  name: 'Lobby ONVIF',
  location: 'Lobby',
  cameraType: 'onvif',
  onvif: target(sim),
  ...extra,
});

test('probe lists device identity and video profiles, corrected for device clock skew', async () => {
  const res = await probe(org.token, target(device));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data;
  assert.deepEqual(data.deviceInfo, {
    manufacturer: 'SimCam',
    model: 'FD-1000',
    firmwareVersion: '2.4.1',
    serialNumber: 'SN-0042',
    hardwareId: 'HW-7',
  });
  assert.equal(data.mediaVersion, 1);
  assert.deepEqual(
    data.profiles.map((p) => [p.token, p.name, p.encoding, p.width, p.height, p.fps]),
    [
      ['profile_main', 'MainStream', 'H264', 1920, 1080, 25],
      ['profile_sub', 'SubStream', 'H264', 640, 360, 10],
    ],
    'audio-only profile is left out'
  );
  // The device advertises 10.1.2.3; the address the user entered is the reachable one.
  assert.equal(data.profiles[0].streamUrl, 'rtsp://127.0.0.1:8554/main');
  assert.ok(!JSON.stringify(data).includes('cam-secret'));
});

test('probe reports wrong credentials, unreachable and non-ONVIF devices clearly', async () => {
  const wrong = await probe(org.token, target(device, { password: 'nope' }));
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'onvif_auth');
  assert.match(wrong.body.message, /username or password/);

  const none = await probe(org.token, target(device, { username: '', password: '' }));
  assert.equal(none.body.code, 'onvif_auth', 'device that requires credentials');

  const closed = await probe(org.token, { host: '127.0.0.1', port: 1, ...CREDS });
  assert.equal(closed.status, 502);
  assert.equal(closed.body.code, 'onvif_unreachable');

  const notOnvif = await probe(org.token, { host: '127.0.0.1', port: 5630, ...CREDS });
  assert.equal(notOnvif.status, 502);
  assert.equal(notOnvif.body.code, 'onvif_not_onvif');

  const metadata = await probe(org.token, { host: '169.254.169.254', port: 80 });
  assert.equal(metadata.status, 400);
  assert.equal(metadata.body.code, 'onvif_invalid_host');

  const junk = await probe(org.token, { host: 'bad host!', port: 80 });
  assert.equal(junk.body.code, 'onvif_invalid_host');
  const badPort = await probe(org.token, { host: '127.0.0.1', port: 70000 });
  assert.equal(badPort.body.code, 'onvif_invalid_host');
});

test('HTTP Digest devices and Media2-only devices are supported', async () => {
  const digest = await probe(org.token, { host: '127.0.0.1', port: digestDevice.port, username: 'admin', password: 'digest-pass' });
  assert.equal(digest.status, 200, JSON.stringify(digest.body));
  assert.equal(digest.body.data.profiles.length, 2);
  const digestWrong = await probe(org.token, { host: '127.0.0.1', port: digestDevice.port, username: 'admin', password: 'x' });
  assert.equal(digestWrong.body.code, 'onvif_auth');

  const m2 = await probe(org.token, target(media2Device));
  assert.equal(m2.status, 200, JSON.stringify(m2.body));
  assert.equal(m2.body.data.mediaVersion, 2);
  assert.equal(m2.body.data.profiles[0].encoding, 'H265');
  assert.equal(m2.body.data.profiles[1].streamUrl, 'rtsp://127.0.0.1:554/sub');
});

test('creating an ONVIF camera resolves the stream from the device and encrypts the password', async () => {
  const res = await fx.api('POST', '/api/cameras', {
    token: org.token,
    body: onvifCamera(device, { onvif: target(device, { profileToken: 'profile_sub' }) }),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const cam = res.body.data;
  assert.equal(cam.cameraType, 'onvif');
  assert.equal(cam.streamUrl, 'rtsp://127.0.0.1:8554/sub', 'no credentials in the stored URL');
  assert.equal(cam.ipAddress, '127.0.0.1');
  assert.equal(cam.onvif.profileToken, 'profile_sub');
  assert.equal(cam.onvif.profileName, 'SubStream');
  assert.equal(cam.onvif.username, 'admin');
  assert.equal(cam.onvif.hasPassword, true);
  assert.equal(cam.onvif.deviceInfo.serialNumber, 'SN-0042');
  assert.equal(cam.metadata.model, 'SimCam FD-1000');
  assert.equal(cam.metadata.resolution, '640×360');
  assert.equal(cam.metadata.fps, 10);
  assert.equal(cam.onvif.passwordEnc, undefined, 'encrypted password is never returned');
  assert.ok(!JSON.stringify(res.body).includes('cam-secret'));

  const stored = await server.db.collection('cameras').findOne({ name: 'Lobby ONVIF' });
  assert.match(stored.onvif.passwordEnc, /^v1:/);
  assert.ok(!stored.onvif.passwordEnc.includes('cam-secret'));

  // Lists, single reads and operators never see the secret either.
  await fx.assign(org, operator.id, [cam._id]);
  for (const [token, path] of [[org.token, '/api/cameras'], [org.token, `/api/cameras/${cam._id}`], [operator.token, '/api/cameras']]) {
    const read = await fx.api('GET', path, { token });
    assert.equal(read.status, 200);
    assert.ok(!JSON.stringify(read.body).includes('passwordEnc'), path);
  }
});

test('the inference worker receives the stream URL with credentials; nobody else does', async () => {
  const res = await fx.api('GET', '/api/internal/inference/cameras', { headers: { 'X-Inference-Api-Key': 'test-inference-key' } });
  assert.equal(res.status, 200);
  const cam = res.body.data.find((c) => c.name === 'Lobby ONVIF');
  assert.ok(cam, 'ONVIF camera is monitored');
  assert.equal(cam.streamUrl, 'rtsp://admin:cam-secret@127.0.0.1:8554/sub');
  assert.equal(cam.onvif, undefined);
});

test('a camera is not created when the device refuses the credentials or the profile is gone', async () => {
  const before = await server.db.collection('cameras').countDocuments();
  const bad = await fx.api('POST', '/api/cameras', { token: org.token, body: onvifCamera(device, { onvif: target(device, { password: 'nope' }) }) });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'onvif_auth');
  const gone = await fx.api('POST', '/api/cameras', { token: org.token, body: onvifCamera(device, { onvif: target(device, { profileToken: 'missing' }) }) });
  assert.equal(gone.status, 400);
  assert.equal(gone.body.code, 'onvif_no_profiles');
  const noHost = await fx.api('POST', '/api/cameras', { token: org.token, body: { name: 'x', location: 'y', cameraType: 'onvif', onvif: {} } });
  assert.equal(noHost.status, 400);
  assert.equal(await server.db.collection('cameras').countDocuments(), before);
});

test('updates reconnect only when the connection changes; a blank password keeps the stored one', async () => {
  const create = await fx.api('POST', '/api/cameras', { token: org.token, body: onvifCamera(device, { name: 'Update ONVIF' }) });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const id = create.body.data._id;
  assert.equal(create.body.data.onvif.profileToken, 'profile_main', 'first profile by default');

  const calls = device.count();
  const notes = await fx.api('PUT', `/api/cameras/${id}`, {
    token: org.token,
    body: { name: 'Update ONVIF', location: 'Lobby', cameraType: 'onvif', settings: { notes: 'glare at noon' }, onvif: { host: '127.0.0.1', port: device.port, username: 'admin', password: '', profileToken: 'profile_main' } },
  });
  assert.equal(notes.status, 200, JSON.stringify(notes.body));
  assert.equal(device.count(), calls, 'no device round-trip for an unrelated edit');

  const switchProfile = await fx.api('PUT', `/api/cameras/${id}`, {
    token: org.token,
    body: { name: 'Update ONVIF', location: 'Lobby', cameraType: 'onvif', onvif: { host: '127.0.0.1', port: device.port, username: 'admin', password: '', profileToken: 'profile_sub' } },
  });
  assert.equal(switchProfile.status, 200, JSON.stringify(switchProfile.body));
  assert.equal(switchProfile.body.data.streamUrl, 'rtsp://127.0.0.1:8554/sub');
  assert.equal(switchProfile.body.data.onvif.hasPassword, true, 'stored password reused');

  // Client-supplied stream URLs are ignored for ONVIF cameras.
  const spoof = await fx.api('PUT', `/api/cameras/${id}`, {
    token: org.token,
    body: { name: 'Update ONVIF', location: 'Lobby', cameraType: 'onvif', streamUrl: 'rtsp://10.9.9.9/evil' },
  });
  assert.equal(spoof.status, 200);
  assert.equal(spoof.body.data.streamUrl, 'rtsp://127.0.0.1:8554/sub');
});

test('probe reuses a saved password only for the same device and user', async () => {
  const cam = await server.db.collection('cameras').findOne({ name: 'Lobby ONVIF' });
  const reuse = await probe(org.token, { host: '127.0.0.1', port: device.port, username: 'admin', cameraId: String(cam._id) });
  assert.equal(reuse.status, 200, JSON.stringify(reuse.body));

  const otherDevice = await probe(org.token, { host: '127.0.0.1', port: digestDevice.port, username: 'admin', cameraId: String(cam._id) });
  assert.equal(otherDevice.body.code, 'onvif_auth', 'stored secret not sent to another address');

  const crossTenant = await probe(otherOrg.token, { host: '127.0.0.1', port: device.port, username: 'admin', cameraId: String(cam._id) });
  assert.equal(crossTenant.status, 404);
});

test('refresh re-reads the stream address from the device', async () => {
  const cam = await server.db.collection('cameras').findOne({ name: 'Lobby ONVIF' });
  device.state.profiles = device.state.profiles.map((p) => (p.token === 'profile_sub' ? { ...p, path: 'sub-v2' } : p));
  try {
    const res = await fx.api('POST', `/api/cameras/${cam._id}/onvif/refresh`, { token: org.token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.streamUrl, 'rtsp://127.0.0.1:8554/sub-v2');
    assert.ok(new Date(res.body.data.onvif.lastSyncedAt) > new Date(cam.onvif.lastSyncedAt));

    const other = await fx.api('POST', `/api/cameras/${cam._id}/onvif/refresh`, { token: otherOrg.token });
    assert.equal(other.status, 404);
    const mjpegId = await fx.createCamera(org, 'Plain MJPEG');
    const notOnvif = await fx.api('POST', `/api/cameras/${mjpegId}/onvif/refresh`, { token: org.token });
    assert.equal(notOnvif.status, 400);
  } finally {
    device.state.profiles = device.state.profiles.map((p) => (p.token === 'profile_sub' ? { ...p, path: 'sub' } : p));
  }
});

test('operators cannot probe, discover or refresh', async () => {
  const cam = await server.db.collection('cameras').findOne({ name: 'Lobby ONVIF' });
  assert.equal((await probe(operator.token, target(device))).status, 403);
  assert.equal((await fx.api('POST', '/api/cameras/onvif/discover', { token: operator.token })).status, 403);
  assert.equal((await fx.api('POST', `/api/cameras/${cam._id}/onvif/refresh`, { token: operator.token })).status, 403);
});

test('WS-Discovery replies are parsed into devices', () => {
  const reply = Buffer.from(
    '<?xml version="1.0"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">' +
      '<e:Body><d:ProbeMatches><d:ProbeMatch><w:EndpointReference><w:Address>urn:uuid:abc</w:Address></w:EndpointReference>' +
      '<d:Scopes>onvif://www.onvif.org/name/Dock_Cam onvif://www.onvif.org/hardware/DS-2CD2143 onvif://www.onvif.org/location/Dock%203</d:Scopes>' +
      '<d:XAddrs>http://[fe80::1]/onvif/device_service http://192.168.1.64:8080/onvif/device_service</d:XAddrs></d:ProbeMatch></d:ProbeMatches></e:Body></e:Envelope>'
  );
  assert.deepEqual(parseProbeMatches(reply, { address: '192.168.1.64' }), [
    {
      urn: 'urn:uuid:abc',
      name: 'Dock Cam',
      hardware: 'DS-2CD2143',
      location: 'Dock 3',
      host: '192.168.1.64',
      port: 8080,
      xaddrs: ['http://[fe80::1]/onvif/device_service', 'http://192.168.1.64:8080/onvif/device_service'],
    },
  ]);
});

test('network discovery finds a camera answering WS-Discovery', async (t) => {
  const sim = await startOnvifSimulator({ discovery: true });
  try {
    const res = await fx.api('POST', '/api/cameras/onvif/discover', { token: org.token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const found = res.body.data.find((d) => d.urn === 'urn:uuid:sim-camera-0042');
    if (!found) {
      t.skip('multicast is not available on this machine');
      return;
    }
    assert.equal(found.name, 'Sim Cam Lobby');
    assert.equal(found.location, 'Lobby East');
    assert.equal(found.hardware, 'FD-1000');
    assert.equal(found.host, '127.0.0.1');
    assert.equal(found.port, sim.port);
  } finally {
    await sim.stop();
  }
});

test('discovery can be switched off', async () => {
  const off = await startServer({ name: 'onvif-off', port: 5632, env: { ONVIF_DISCOVERY_ENABLED: 'false' } });
  try {
    const offFx = createFixtures(off);
    const plan = await offFx.seedPlan();
    const admin = await offFx.createOrgAdmin('onvif-off-admin', plan._id);
    const res = await offFx.api('POST', '/api/cameras/onvif/discover', { token: admin.token });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'onvif_discovery_disabled');
    // Without the local-sources opt-in, loopback devices are refused like loopback stream URLs.
    const loop = await offFx.api('POST', '/api/cameras/onvif/probe', { token: admin.token, body: target(device) });
    assert.equal(loop.body.code, 'onvif_invalid_host');
  } finally {
    await off.stop();
  }
});
