// Camera status from the stream itself: every CAMERA_HEALTH_INTERVAL_MS each camera's stream is opened
// with ffmpeg and one frame decoded. ONLINE = the stream answers; OFFLINE = it failed
// CAMERA_HEALTH_FAILURES probes in a row. Independent of the AI service, so a camera stays ONLINE while
// detection is off or the inference worker is down. Cameras in 'maintenance' or 'paused' are never touched;
// a timed pause ends by itself (resumeDuePauses) and the camera is probed straight away.
const { spawn } = require('child_process');
const Camera = require('../models/Camera');
const { emitToCameraAudience } = require('../sockets/emitters');
const { FFMPEG_PROTOCOLS } = require('../utils/streamSource');
const { ffmpegInput } = require('../utils/demoSource');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const INTERVAL_MS = parseInt(process.env.CAMERA_HEALTH_INTERVAL_MS, 10) || 30 * 1000;
const PROBE_TIMEOUT_MS = parseInt(process.env.CAMERA_HEALTH_TIMEOUT_MS, 10) || 10 * 1000;
const FAILURES_FOR_OFFLINE = parseInt(process.env.CAMERA_HEALTH_FAILURES, 10) || 2;
const CONCURRENCY = 4;
const PAUSE_SWEEP_MS = 15 * 1000;
const { HELD_STATUSES } = Camera;

// Default: on outside tests (test servers have no real streams).
const monitorEnabled = () =>
  process.env.CAMERA_HEALTH_MONITOR !== undefined
    ? process.env.CAMERA_HEALTH_MONITOR === 'true'
    : process.env.NODE_ENV !== 'test';

const failures = new Map(); // cameraId -> consecutive failed probes
const inFlight = new Set();

/** Resolves true when ffmpeg decodes one frame from the stream within the timeout. */
function probeStream({ url, kind }) {
  return new Promise((resolve) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', FFMPEG_PROTOCOLS[kind]];
    if (kind === 'rtsp') args.push('-rtsp_transport', 'tcp');
    args.push('-i', url, '-an', '-frames:v', '1', '-f', 'null', '-');

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const proc = spawn(FFMPEG_BIN, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(false);
    }, PROBE_TIMEOUT_MS);
    proc.on('error', () => finish(false));
    proc.on('close', (code) => finish(code === 0));
  });
}

async function setStatus(io, camera, status, now) {
  const update = status === 'ONLINE' ? { status, lastHeartbeat: now, lastActivity: now } : { status };
  // Conditional so a camera put into maintenance or paused while the probe ran is left alone.
  const { modifiedCount } = await Camera.updateOne(
    { _id: camera._id, isDeleted: false, status: { $nin: HELD_STATUSES } },
    { $set: update }
  );
  if (!modifiedCount || camera.status === status) return;
  await emitToCameraAudience(io, { organizationId: camera.organizationId, cameraId: camera._id }, 'camera:status:update', {
    cameraId: camera._id,
    status,
    lastHeartbeat: status === 'ONLINE' ? now : camera.lastHeartbeat,
  });
}

async function checkCamera(io, camera) {
  const id = String(camera._id);
  if (HELD_STATUSES.includes(camera.status) || inFlight.has(id)) return;
  const target = ffmpegInput(camera);
  if (!target) return; // no stream to probe: device heartbeats decide (sockets/socketHandlers.js)

  inFlight.add(id);
  try {
    const ok = await probeStream(target);
    const now = new Date();
    if (ok) {
      failures.delete(id);
      await setStatus(io, camera, 'ONLINE', now);
    } else {
      const count = (failures.get(id) || 0) + 1;
      failures.set(id, count);
      if (count >= FAILURES_FOR_OFFLINE) await setStatus(io, camera, 'OFFLINE', now);
    }
  } catch (error) {
    console.error(`Camera health check failed for ${id}:`, error.message);
  } finally {
    inFlight.delete(id);
  }
}

const findCameras = (filter) =>
  Camera.find({ isDeleted: false, isActive: true, ...filter }).select(
    '_id organizationId status lastHeartbeat streamUrl cameraType demo onvif.username +onvif.passwordEnc'
  );

let running = false;
async function checkAll(io) {
  if (running) return;
  running = true;
  try {
    const queue = await findCameras({ status: { $nin: HELD_STATUSES } });
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await checkCamera(io, queue.shift());
    });
    await Promise.all(workers);
  } catch (error) {
    console.error('Camera health check error:', error.message);
  } finally {
    running = false;
  }
}

/** Probe one camera now (after it is added, edited or taken out of maintenance). A failed probe here
 * counts toward OFFLINE like any other, so a new camera with a dead stream shows OFFLINE after the next cycle. */
async function checkCameraNow(io, cameraId) {
  if (!monitorEnabled() || !io) return;
  try {
    const [camera] = await findCameras({ _id: cameraId });
    if (camera) await checkCamera(io, camera);
  } catch (error) {
    console.error(`Camera health check failed for ${cameraId}:`, error.message);
  }
}

/** Ends a pause: the camera is OFFLINE until the probe started here finds its stream (seconds).
 * Resolves the updated camera, or null when it was not paused. */
async function resumeCamera(io, cameraId) {
  const camera = await Camera.findOneAndUpdate(
    { _id: cameraId, isDeleted: false, status: 'paused' },
    { $set: { status: 'OFFLINE', pausedUntil: null } },
    { new: true }
  );
  if (!camera) return null;
  failures.delete(String(camera._id));
  await emitToCameraAudience(io, { organizationId: camera.organizationId, cameraId: camera._id }, 'camera:status:update', {
    cameraId: camera._id,
    status: camera.status,
    pausedUntil: null,
  });
  checkCameraNow(io, camera._id);
  return camera;
}

async function resumeDuePauses(io) {
  try {
    const due = await Camera.find({ status: 'paused', pausedUntil: { $ne: null, $lte: new Date() }, isDeleted: false }).select('_id');
    for (const { _id } of due) await resumeCamera(io, _id);
  } catch (error) {
    console.error('Camera pause sweep error:', error.message);
  }
}

function startCameraHealthMonitor(io) {
  // Timed pauses end even when stream probing is switched off.
  if (process.env.NODE_ENV !== 'test') setInterval(() => resumeDuePauses(io), PAUSE_SWEEP_MS).unref();
  if (!monitorEnabled()) return;
  checkAll(io);
  setInterval(() => checkAll(io), INTERVAL_MS).unref();
}

module.exports = { startCameraHealthMonitor, checkCameraNow, resumeCamera };
