// A small ONVIF device for tests: verifies WS-Security digests (or HTTP Digest), simulates clock skew,
// advertises an internal LAN address (like a camera behind NAT) and answers WS-Discovery probes.
const crypto = require('crypto');
const dgram = require('dgram');
const http = require('http');
const os = require('os');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });

const ENVELOPE_OPEN =
  '<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" ' +
  'xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" ' +
  'xmlns:tr2="http://www.onvif.org/ver20/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema" ' +
  'xmlns:ter="http://www.onvif.org/ver10/error"><SOAP-ENV:Body>';
const ENVELOPE_CLOSE = '</SOAP-ENV:Body></SOAP-ENV:Envelope>';

const fault = (subcode, reason) =>
  `<SOAP-ENV:Fault><SOAP-ENV:Code><SOAP-ENV:Value>SOAP-ENV:Sender</SOAP-ENV:Value><SOAP-ENV:Subcode><SOAP-ENV:Value>${subcode}</SOAP-ENV:Value></SOAP-ENV:Subcode></SOAP-ENV:Code>` +
  `<SOAP-ENV:Reason><SOAP-ENV:Text xml:lang="en">${reason}</SOAP-ENV:Text></SOAP-ENV:Reason></SOAP-ENV:Fault>`;

const DEFAULT_PROFILES = [
  { token: 'profile_main', name: 'MainStream', width: 1920, height: 1080, fps: 25, path: 'main' },
  { token: 'profile_sub', name: 'SubStream', width: 640, height: 360, fps: 10, path: 'sub' },
];

/**
 * options: { port, username, password, auth: 'wsse' | 'digest' | 'none', skewMs, advertisedHost,
 *            rtspPort, media: 'v1' | 'v2', profiles, discovery: boolean }
 */
async function startOnvifSimulator(options = {}) {
  const state = {
    username: 'admin',
    password: 'cam-secret',
    auth: 'wsse',
    skewMs: 0,
    advertisedHost: '10.1.2.3',
    rtspPort: 554,
    media: 'v1',
    profiles: DEFAULT_PROFILES,
    discovery: false,
    ...options,
    requests: [],
  };
  const digestNonce = crypto.randomBytes(8).toString('hex');
  const deviceNow = () => new Date(Date.now() + state.skewMs);

  function checkWsse(envelope) {
    const token = envelope?.Header?.Security?.UsernameToken;
    if (!token) return false;
    const text = (n) => (typeof n === 'object' ? n['#text'] : n);
    const created = text(token.Created);
    const nonce = Buffer.from(text(token.Nonce) || '', 'base64');
    const expected = crypto
      .createHash('sha1')
      .update(Buffer.concat([nonce, Buffer.from(created || ''), Buffer.from(state.password)]))
      .digest('base64');
    const drift = Math.abs(new Date(created).getTime() - deviceNow().getTime());
    return text(token.Username) === state.username && text(token.Password) === expected && drift < 60 * 1000;
  }

  function checkDigest(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Digest ')) return false;
    const p = {};
    header.replace(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g, (_, k, q, b) => { p[k] = q ?? b; });
    const md5 = (v) => crypto.createHash('md5').update(v).digest('hex');
    const ha1 = md5(`${state.username}:sim:${state.password}`);
    const ha2 = md5(`POST:${p.uri}`);
    return p.username === state.username && p.nonce === digestNonce &&
      p.response === md5(`${ha1}:${digestNonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`);
  }

  const profileXml = (p) =>
    `<trt:Profiles token="${p.token}" fixed="true"><tt:Name>${p.name}</tt:Name>` +
    `<tt:VideoSourceConfiguration token="vsc"><tt:Name>vs</tt:Name></tt:VideoSourceConfiguration>` +
    `<tt:VideoEncoderConfiguration token="vec_${p.token}"><tt:Name>enc</tt:Name><tt:Encoding>H264</tt:Encoding>` +
    `<tt:Resolution><tt:Width>${p.width}</tt:Width><tt:Height>${p.height}</tt:Height></tt:Resolution>` +
    `<tt:RateControl><tt:FrameRateLimit>${p.fps}</tt:FrameRateLimit><tt:BitrateLimit>2048</tt:BitrateLimit></tt:RateControl>` +
    `</tt:VideoEncoderConfiguration></trt:Profiles>`;

  const profile2Xml = (p) =>
    `<tr2:Profiles token="${p.token}" fixed="true"><tr2:Name>${p.name}</tr2:Name><tr2:Configurations>` +
    `<tr2:VideoEncoder token="vec_${p.token}"><tt:Name>enc</tt:Name><tt:Encoding>H265</tt:Encoding>` +
    `<tt:Resolution><tt:Width>${p.width}</tt:Width><tt:Height>${p.height}</tt:Height></tt:Resolution>` +
    `<tt:RateControl ConstantBitRate="false"><tt:FrameRateLimit>${p.fps}</tt:FrameRateLimit></tt:RateControl>` +
    `</tr2:VideoEncoder></tr2:Configurations></tr2:Profiles>`;

  const streamUri = (p) => `rtsp://${state.advertisedHost}:${state.rtspPort}/${p.path}`;
  const xaddr = (path) => `http://${state.advertisedHost}:${state.port}/onvif/${path}`;

  function handle(op, params) {
    const findProfile = () => state.profiles.find((p) => p.token === params?.ProfileToken);
    switch (op) {
      case 'GetDeviceInformation':
        return '<tds:GetDeviceInformationResponse><tds:Manufacturer>SimCam</tds:Manufacturer><tds:Model>FD-1000</tds:Model>' +
          '<tds:FirmwareVersion>2.4.1</tds:FirmwareVersion><tds:SerialNumber>SN-0042</tds:SerialNumber><tds:HardwareId>HW-7</tds:HardwareId></tds:GetDeviceInformationResponse>';
      case 'GetServices': {
        const services = [['http://www.onvif.org/ver10/device/wsdl', 'device_service']];
        if (state.media === 'v1') services.push(['http://www.onvif.org/ver10/media/wsdl', 'media_service']);
        if (state.media === 'v2') services.push(['http://www.onvif.org/ver20/media/wsdl', 'media2_service']);
        return '<tds:GetServicesResponse>' +
          services.map(([ns, path]) => `<tds:Service><tds:Namespace>${ns}</tds:Namespace><tds:XAddr>${xaddr(path)}</tds:XAddr><tds:Version><tt:Major>2</tt:Major><tt:Minor>60</tt:Minor></tds:Version></tds:Service>`).join('') +
          '</tds:GetServicesResponse>';
      }
      case 'GetProfiles':
        return state.media === 'v2'
          ? `<tr2:GetProfilesResponse>${state.profiles.map(profile2Xml).join('')}</tr2:GetProfilesResponse>`
          : `<trt:GetProfilesResponse>${state.profiles.map(profileXml).join('')}` +
              '<trt:Profiles token="profile_audio" fixed="true"><tt:Name>AudioOnly</tt:Name></trt:Profiles></trt:GetProfilesResponse>';
      case 'GetStreamUri': {
        const p = findProfile();
        if (!p) return { fault: fault('ter:InvalidArgVal', 'No such profile') };
        return state.media === 'v2'
          ? `<tr2:GetStreamUriResponse><tr2:Uri>${streamUri(p)}</tr2:Uri></tr2:GetStreamUriResponse>`
          : `<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>${streamUri(p)}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect><tt:Timeout>PT0S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>`;
      }
      default:
        return { fault: fault('ter:ActionNotSupported', `${op} not supported`) };
    }
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (status, xml, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/soap+xml; charset=utf-8', ...headers });
        res.end(ENVELOPE_OPEN + xml + ENVELOPE_CLOSE);
      };
      let envelope;
      try {
        envelope = parser.parse(body).Envelope;
      } catch (_) {
        return send(400, fault('ter:WellFormed', 'Bad XML'));
      }
      const op = Object.keys(envelope?.Body || {}).find((k) => !k.startsWith('@_'));
      state.requests.push({ path: req.url, op });

      if (op === 'GetSystemDateAndTime') {
        const d = deviceNow();
        return send(200,
          '<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType><tt:UTCDateTime>' +
          `<tt:Time><tt:Hour>${d.getUTCHours()}</tt:Hour><tt:Minute>${d.getUTCMinutes()}</tt:Minute><tt:Second>${d.getUTCSeconds()}</tt:Second></tt:Time>` +
          `<tt:Date><tt:Year>${d.getUTCFullYear()}</tt:Year><tt:Month>${d.getUTCMonth() + 1}</tt:Month><tt:Day>${d.getUTCDate()}</tt:Day></tt:Date>` +
          '</tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>');
      }

      if (state.auth === 'digest' && !checkDigest(req)) {
        return send(401, fault('ter:NotAuthorized', 'Unauthorized'), {
          'WWW-Authenticate': `Digest realm="sim", qop="auth", nonce="${digestNonce}", algorithm=MD5`,
        });
      }
      if (state.auth === 'wsse' && !checkWsse(envelope)) {
        return send(400, fault('ter:NotAuthorized', 'Sender not Authorized'));
      }

      const result = handle(op, envelope.Body[op]);
      if (result?.fault) return send(400, result.fault);
      return send(200, result);
    });
  });

  await new Promise((resolve) => server.listen(state.port || 0, '127.0.0.1', resolve));
  state.port = server.address().port;

  // WS-Discovery responder on every IPv4 interface (best effort: multicast may be unavailable).
  let udp = null;
  if (state.discovery) {
    udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    udp.on('error', () => {});
    udp.on('message', (msg, rinfo) => {
      let probe;
      try { probe = parser.parse(msg.toString()).Envelope; } catch (_) { return; }
      if (!probe?.Body?.Probe) return;
      const relatesTo = typeof probe.Header?.MessageID === 'object' ? probe.Header.MessageID['#text'] : probe.Header?.MessageID;
      const reply =
        '<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
        `<e:Header><w:RelatesTo>${relatesTo}</w:RelatesTo><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</w:Action></e:Header>` +
        '<e:Body><d:ProbeMatches><d:ProbeMatch><w:EndpointReference><w:Address>urn:uuid:sim-camera-0042</w:Address></w:EndpointReference>' +
        '<d:Types>dn:NetworkVideoTransmitter</d:Types>' +
        '<d:Scopes>onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/name/Sim_Cam_Lobby onvif://www.onvif.org/hardware/FD-1000 onvif://www.onvif.org/location/Lobby%20East</d:Scopes>' +
        `<d:XAddrs>http://${state.discoveryHost || '127.0.0.1'}:${state.port}/onvif/device_service</d:XAddrs><d:MetadataVersion>1</d:MetadataVersion></d:ProbeMatch></d:ProbeMatches></e:Body></e:Envelope>`;
      udp.send(Buffer.from(reply), rinfo.port, rinfo.address);
    });
    await new Promise((resolve) => udp.bind(3702, () => {
      for (const entries of Object.values(os.networkInterfaces())) {
        for (const e of entries || []) {
          if (e.family === 'IPv4' || e.family === 4) {
            try { udp.addMembership('239.255.255.250', e.address); } catch (_) { /* interface without multicast */ }
          }
        }
      }
      resolve();
    }));
  }

  return {
    state,
    get port() { return state.port; },
    count: (op) => state.requests.filter((r) => !op || r.op === op).length,
    async stop() {
      if (udp) { try { udp.close(); } catch (_) { /* closed */ } }
      await new Promise((r) => server.close(r));
    },
  };
}

module.exports = { startOnvifSimulator, DEFAULT_PROFILES };
