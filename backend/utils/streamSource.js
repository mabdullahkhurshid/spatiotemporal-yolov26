// Camera stream URLs are opened server-side by ffmpeg (MJPEG proxy) and the inference worker (OpenCV),
// so they must not point at local files or internal/metadata addresses (SSRF / local file read).
const net = require('net');
const dns = require('dns').promises;

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

// Live-stream input options so the first frame comes out quickly. ffmpeg otherwise probes up to 5 s
// (the whole 5 s when a camera announces an audio track that sends nothing) before writing anything.
const FFMPEG_FAST_START = ['-flags', 'low_delay', '-probesize', '500000', '-analyzeduration', '1000000'];

// Hosts named in CAMERA_BLOCKED_HOSTS (comma separated, e.g. "mongodb,backend") are refused outright.
const blockedHosts = () =>
  new Set(
    String(process.env.CAMERA_BLOCKED_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );

/**
 * DNS-aware companion to checkStreamSource for remote URLs: refuses a hostname that resolves to a
 * loopback / link-local address (e.g. *.nip.io tricks) or is on the block list. LAN addresses stay
 * allowed (cameras live there), and a host that does not resolve here is allowed (it may only resolve
 * on site, and nothing can be reached through it anyway). Returns { ok: true } or { ok: false, message }.
 */
async function checkStreamHost(raw, lookup = dns.lookup) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch (_) {
    return { ok: true };
  }
  if (!REMOTE_PROTOCOLS.has(url.protocol)) return { ok: true };

  const host = unmapIPv4(url.hostname.replace(/^\[|\]$/g, '').toLowerCase());
  if (blockedHosts().has(host)) {
    return { ok: false, message: 'This stream address is not allowed on this server' };
  }
  if (localSourcesAllowed() || net.isIP(host)) return { ok: true }; // literal IPs: checkStreamSource covers them

  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch (_) {
    return { ok: true };
  }
  for (const { address } of addresses || []) {
    const ip = unmapIPv4(String(address).toLowerCase());
    if (isLinkLocal(ip)) {
      return { ok: false, message: 'Stream URL resolves to a link-local address (e.g. cloud metadata), which is not allowed' };
    }
    if (isLoopbackOrUnspecified(ip)) {
      return { ok: false, message: `Stream URL resolves to a loopback address, which is not allowed. ${LOCAL_HINT}` };
    }
  }
  return { ok: true };
}

module.exports = { checkStreamSource, checkStreamHost, FFMPEG_PROTOCOLS, FFMPEG_FAST_START };
