// Live previews for camera tiles. One ffmpeg per watched camera, shared by every viewer, sends small
// JPEG frames (CAMERA_PREVIEW_WIDTH px, CAMERA_PREVIEW_FPS fps) to the socket room preview:<cameraId>.
// Tiles use the existing socket instead of an MJPEG <img> each: browsers allow ~6 connections per
// server, so a grid of MJPEG tiles stalls at 6 cameras and blocks the app's API calls with it.
// Independent of AI detection: a camera with detection off still previews.
const { spawn } = require('child_process');
const Camera = require('../models/Camera');
const { FFMPEG_PROTOCOLS, FFMPEG_FAST_START } = require('../utils/streamSource');
const { ffmpegInput } = require('../utils/demoSource');
const { redactCredentials } = require('./onvif');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FPS = parseInt(process.env.CAMERA_PREVIEW_FPS, 10) || 5;
const WIDTH = parseInt(process.env.CAMERA_PREVIEW_WIDTH, 10) || 640;
const RESTART_MS = 2000;
const IDLE_STOP_MS = 5000; // keep the reader briefly after the last viewer leaves (page switches)
const MAX_FRAME_BYTES = 2 * 1024 * 1024;

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

const previewRoom = (cameraId) => `preview:${cameraId}`;
const feeds = new Map(); // cameraId -> { proc, buffer, last, restartTimer, stopTimer }

const viewers = (io, cameraId) => io.of('/').adapter.rooms.get(previewRoom(cameraId))?.size || 0;

function stopFeed(cameraId) {
  const feed = feeds.get(cameraId);
  if (!feed) return;
  feeds.delete(cameraId);
  clearTimeout(feed.restartTimer);
  clearTimeout(feed.stopTimer);
  if (feed.proc && !feed.proc.killed) feed.proc.kill('SIGTERM');
}

/** Splits ffmpeg's image2pipe output into JPEG frames (ffmpeg's encoder writes no embedded thumbnails). */
function takeFrames(feed, chunk, onFrame) {
  feed.buffer = feed.buffer.length ? Buffer.concat([feed.buffer, chunk]) : chunk;
  for (;;) {
    const start = feed.buffer.indexOf(SOI);
    if (start === -1) {
      feed.buffer = Buffer.alloc(0);
      return;
    }
    const end = feed.buffer.indexOf(EOI, start + 2);
    if (end === -1) {
      feed.buffer = feed.buffer.length - start > MAX_FRAME_BYTES ? Buffer.alloc(0) : feed.buffer.subarray(start);
      return;
    }
    onFrame(Buffer.from(feed.buffer.subarray(start, end + 2)));
    feed.buffer = feed.buffer.subarray(end + 2);
  }
}

async function startReader(io, cameraId, feed) {
  const camera = await Camera.findById(cameraId).select('isDeleted status streamUrl cameraType demo onvif.username +onvif.passwordEnc');
  if (feeds.get(cameraId) !== feed) return; // stopped while loading
  const input = camera && !camera.isDeleted && !Camera.HELD_STATUSES.includes(camera.status) ? ffmpegInput(camera) : null;
  if (!input) {
    // Nothing to read now (no stream, maintenance, paused): look again while someone is watching.
    feed.restartTimer = setTimeout(() => restartIfWatched(io, cameraId, feed), RESTART_MS * 5);
    return;
  }

  const args = ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', FFMPEG_PROTOCOLS[input.kind]];
  if (input.kind === 'rtsp') args.push('-rtsp_transport', 'tcp', ...FFMPEG_FAST_START);
  if (input.kind === 'file') args.push('-re', '-stream_loop', '-1');
  args.push('-i', input.url, '-an', '-vf', `fps=${FPS},scale='min(${WIDTH},iw)':-2`, '-c:v', 'mjpeg', '-q:v', '7', '-f', 'image2pipe', 'pipe:1');

  const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  feed.proc = proc;
  feed.buffer = Buffer.alloc(0);

  proc.stdout.on('data', (chunk) =>
    takeFrames(feed, chunk, (frame) => {
      feed.last = frame;
      // volatile: a slow client skips frames instead of queueing them
      io.to(previewRoom(cameraId)).volatile.emit('camera:preview:frame', { cameraId, frame });
    })
  );
  proc.stderr.on('data', (chunk) => {
    console.error(`preview ffmpeg camera ${cameraId}:`, redactCredentials(chunk.toString()).trim());
  });
  proc.on('error', (error) => console.error('preview ffmpeg spawn error:', error.message));
  proc.on('close', () => {
    if (feed.proc === proc) feed.proc = null;
    restartIfWatched(io, cameraId, feed, RESTART_MS);
  });
}

function restartIfWatched(io, cameraId, feed, delay = 0) {
  if (feeds.get(cameraId) !== feed) return;
  if (!viewers(io, cameraId)) {
    stopFeed(cameraId);
    return;
  }
  clearTimeout(feed.restartTimer);
  feed.restartTimer = setTimeout(() => {
    if (feeds.get(cameraId) === feed && !feed.proc) {
      startReader(io, cameraId, feed).catch((error) => console.error(`Preview for ${cameraId} failed:`, error.message));
    }
  }, delay);
}

/** Call after the socket joined previewRoom(cameraId): starts (or keeps) the shared reader. */
function watch(io, socket, cameraId) {
  let feed = feeds.get(cameraId);
  if (feed) {
    clearTimeout(feed.stopTimer);
    feed.stopTimer = null;
    if (feed.last) socket.emit('camera:preview:frame', { cameraId, frame: feed.last });
    return;
  }
  feed = { proc: null, buffer: Buffer.alloc(0), last: null, restartTimer: null, stopTimer: null };
  feeds.set(cameraId, feed);
  startReader(io, cameraId, feed).catch((error) => console.error(`Preview for ${cameraId} failed:`, error.message));
}

/** Stops a camera's reader shortly after its last viewer leaves (unsubscribe or disconnect). */
function attachPreviewHub(io) {
  io.of('/').adapter.on('delete-room', (room) => {
    if (typeof room !== 'string' || !room.startsWith('preview:')) return;
    const cameraId = room.slice('preview:'.length);
    const feed = feeds.get(cameraId);
    if (!feed) return;
    clearTimeout(feed.stopTimer);
    feed.stopTimer = setTimeout(() => {
      if (feeds.get(cameraId) === feed && !viewers(io, cameraId)) stopFeed(cameraId);
    }, IDLE_STOP_MS);
  });
}

module.exports = { attachPreviewHub, watch, previewRoom, stopFeed };
