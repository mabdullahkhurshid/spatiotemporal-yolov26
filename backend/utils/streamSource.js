// Camera stream URLs are opened server-side by ffmpeg (MJPEG proxy) and the inference worker (OpenCV),
// so they must not point at local files or internal/metadata addresses (SSRF / local file read).
const net = require('net');

const REMOTE_PROTOCOLS = new Set(['rtsp:', 'rtsps:', 'http:', 'https:']);

// Local video files and loopback stream servers are handy for demos; opt in explicitly.
const localSourcesAllowed = () => process.env.CAMERA_ALLOW_LOCAL_SOURCES === 'true';

const LOCAL_HINT = 'Set CAMERA_ALLOW_LOCAL_SOURCES=true on the server to allow local demo sources.';

// ::ffff:a9fe:a9fe → 169.254.169.254
const unmapIPv4 = (host) => {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!match) return host;
  const hi = parseInt(match[1], 16);
  const lo = parseInt(match[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
};

const isLinkLocal = (host) =>
  (net.isIPv4(host) && host.startsWith('169.254.')) || (net.isIPv6(host) && /^fe[89ab]/i.test(host));

const isLoopbackOrUnspecified = (host) =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  (net.isIPv4(host) && (host.startsWith('127.') || host === '0.0.0.0')) ||
  host === '::1' ||
  host === '::';

/** Returns { ok: true, kind } or { ok: false, message }. Empty URLs are allowed (field is optional). */
function checkStreamSource(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: true, kind: 'none' };

  let url = null;
  try {
    url = new URL(value);
  } catch (_) {
    url = null;
  }

  // Plain paths ("/videos/a.mp4", "C:\\videos\\a.mp4") and file:// URLs are local files.
  const isPath = !url || /^[a-z]:$/i.test(url.protocol);
  if (isPath || url.protocol === 'file:') {
    return localSourcesAllowed()
      ? { ok: true, kind: 'file' }
      : { ok: false, message: `Local file stream sources are not allowed. ${LOCAL_HINT}` };
  }

  if (!REMOTE_PROTOCOLS.has(url.protocol)) {
    return { ok: false, message: 'Stream URL must start with rtsp://, rtsps://, http:// or https://' };
  }

  const host = unmapIPv4(url.hostname.replace(/^\[|\]$/g, '').toLowerCase());
  if (!host) {
    return { ok: false, message: 'Stream URL must include a host' };
  }
  if (isLinkLocal(host)) {
    return { ok: false, message: 'Link-local addresses (e.g. cloud metadata 169.254.169.254) are not allowed' };
  }
  if (isLoopbackOrUnspecified(host) && !localSourcesAllowed()) {
    return { ok: false, message: `Loopback stream addresses are not allowed. ${LOCAL_HINT}` };
  }

  return { ok: true, kind: url.protocol.startsWith('rtsp') ? 'rtsp' : 'http' };
}

// ffmpeg protocols needed for each source kind (prevents concat:, subfile:, etc. tricks).
const FFMPEG_PROTOCOLS = {
  rtsp: 'rtsp,rtsps,rtp,srtp,udp,tcp,tls,crypto',
  http: 'http,https,tcp,tls,crypto',
  file: 'file',
};

module.exports = { checkStreamSource, FFMPEG_PROTOCOLS };
