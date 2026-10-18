// Minimal ONVIF SOAP 1.2 transport: WS-Security UsernameToken (PasswordDigest), with HTTP Digest/Basic
// fallback for devices that authenticate at the HTTP layer instead.
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { XMLParser } = require('fast-xml-parser');

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const timeoutMs = () => parseInt(process.env.ONVIF_TIMEOUT_MS, 10) || 6000;

class OnvifError extends Error {
  /** code: unreachable | timeout | auth | not_onvif | fault | no_profiles | invalid_stream | invalid_host */
  constructor(code, message) {
    super(message);
    this.name = 'OnvifError';
    this.code = code;
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

const xmlEscape = (value) =>
  String(value ?? '').replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);

/** Text content of a parsed node (plain string, or `#text` when the element has attributes). */
const text = (node) => {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'object') return node['#text'] !== undefined ? String(node['#text']) : undefined;
  return String(node);
};

const asArray = (node) => (node === undefined || node === null ? [] : Array.isArray(node) ? node : [node]);

function securityHeader(username, password, timeOffsetMs) {
  if (!username) return '';
  const nonce = crypto.randomBytes(16);
  const created = new Date(Date.now() + (timeOffsetMs || 0)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const digest = crypto
    .createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(String(password ?? ''))]))
    .digest('base64');
  return (
    '<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    '<UsernameToken>' +
    `<Username>${xmlEscape(username)}</Username>` +
    `<Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>` +
    `<Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</Nonce>` +
    `<Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>` +
    '</UsernameToken></Security>'
  );
}

const envelope = (body, header = '') =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">' +
  `<s:Header>${header}</s:Header>` +
  `<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${body}</s:Body>` +
  '</s:Envelope>';

function rawPost(url, xml, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === 'https:' ? https : http;
    const req = lib.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml),
          ...extraHeaders,
        },
        // Cameras almost always use self-signed certificates.
        rejectUnauthorized: false,
        timeout: timeoutMs(),
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy(new OnvifError('not_onvif', 'The device sent an unexpectedly large response'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new OnvifError('timeout', 'The device did not respond in time')));
    req.on('error', (err) => {
      if (err instanceof OnvifError) return reject(err);
      if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(err.code)) {
        return reject(new OnvifError('unreachable', `Could not reach the device (${err.code})`));
      }
      return reject(new OnvifError('unreachable', `Could not reach the device: ${err.message}`));
    });
    req.end(xml);
  });
}

function parseChallenge(header) {
  const scheme = header.split(' ')[0].toLowerCase();
  const params = {};
  header.replace(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g, (_, k, quoted, bare) => {
    params[k.toLowerCase()] = quoted ?? bare;
  });
  return { scheme, params };
}

function httpAuthHeader(challengeHeader, url, username, password) {
  const challenges = asArray(challengeHeader).map(parseChallenge);
  const digest = challenges.find((c) => c.scheme === 'digest');
  if (digest) {
    const { realm = '', nonce = '', qop, opaque, algorithm } = digest.params;
    const md5 = (v) => crypto.createHash('md5').update(v).digest('hex');
    const uri = new URL(url).pathname + new URL(url).search;
    const cnonce = crypto.randomBytes(8).toString('hex');
    const nc = '00000001';
    let ha1 = md5(`${username}:${realm}:${password}`);
    if (String(algorithm).toLowerCase() === 'md5-sess') ha1 = md5(`${ha1}:${nonce}:${cnonce}`);
    const ha2 = md5(`POST:${uri}`);
    const useQop = qop && qop.split(',').map((q) => q.trim()).includes('auth') ? 'auth' : null;
    const response = useQop ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${useQop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
    return [
      `Digest username="${username}"`,
      `realm="${realm}"`,
      `nonce="${nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
      algorithm ? `algorithm=${algorithm}` : null,
      opaque ? `opaque="${opaque}"` : null,
      useQop ? `qop=${useQop}, nc=${nc}, cnonce="${cnonce}"` : null,
    ]
      .filter(Boolean)
      .join(', ');
  }
  if (challenges.some((c) => c.scheme === 'basic')) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
  return null;
}

function faultOf(parsed) {
  const fault = parsed?.Envelope?.Body?.Fault;
  if (!fault) return null;
  const subcodes = [];
  let code = fault.Code;
  while (code) {
    if (code.Value) subcodes.push(text(code.Value));
    code = code.Subcode;
  }
  const reason = text(asArray(fault.Reason?.Text)[0]) || text(fault.faultstring) || 'The device returned an error';
  return { subcodes, reason };
}

const AUTH_MESSAGE = 'The camera rejected the username or password';

/**
 * Send one ONVIF request. `body` is the operation XML; returns the parsed `<Body>` contents.
 * options: { username, password, timeOffsetMs, auth: false to skip WS-Security }
 */
async function soapRequest(url, body, { username, password, timeOffsetMs = 0, auth = true } = {}) {
  const build = () => envelope(body, auth ? securityHeader(username, password, timeOffsetMs) : '');
  let res = await rawPost(url, build());

  if (res.status === 401 && auth && username && res.headers['www-authenticate']) {
    const authorization = httpAuthHeader(res.headers['www-authenticate'], url, username, password);
    // Fresh WS-Security nonce: some devices reject a replayed one.
    if (authorization) res = await rawPost(url, build(), { Authorization: authorization });
  }

  let parsed = null;
  try {
    parsed = res.body ? parser.parse(res.body) : null;
  } catch (_) {
    parsed = null;
  }

  const fault = faultOf(parsed);
  if (fault) {
    const notAuthorized = fault.subcodes.some((c) => /NotAuthorized|FailedAuthentication|InvalidSecurity/i.test(c || ''));
    if (notAuthorized || res.status === 401) throw new OnvifError('auth', AUTH_MESSAGE);
    throw new OnvifError('fault', `The device returned an error: ${fault.reason}`);
  }
  if (res.status === 401 || res.status === 403) throw new OnvifError('auth', AUTH_MESSAGE);
  if (!parsed?.Envelope?.Body) {
    throw new OnvifError('not_onvif', `The device did not answer as an ONVIF service (HTTP ${res.status})`);
  }
  if (res.status >= 400) throw new OnvifError('fault', `The device returned HTTP ${res.status}`);
  return parsed.Envelope.Body;
}

module.exports = { OnvifError, soapRequest, text, asArray, xmlEscape, parser };
