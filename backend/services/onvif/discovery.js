// WS-Discovery: multicast a Probe for ONVIF NetworkVideoTransmitters on every IPv4 interface of the
// server and collect the ProbeMatches. Only finds cameras on the server's own network segments.
const crypto = require('crypto');
const dgram = require('dgram');
const net = require('net');
const os = require('os');
const { parser, text, asArray } = require('./soap');

const MULTICAST_ADDRESS = '239.255.255.250';
const DISCOVERY_PORT = 3702;

const probeMessage = (messageId) =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" ' +
  'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
  '<e:Header>' +
  `<w:MessageID>${messageId}</w:MessageID>` +
  '<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>' +
  '<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>' +
  '</e:Header>' +
  '<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>' +
  '</e:Envelope>';

const scopeValue = (scopes, kind) => {
  const match = scopes.find((s) => s.toLowerCase().startsWith(`onvif://www.onvif.org/${kind}/`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.split('/').slice(4).join('/')).replace(/_/g, ' ');
  } catch (_) {
    return match.split('/').slice(4).join('/');
  }
};

function parseProbeMatches(message, sender) {
  let parsed;
  try {
    parsed = parser.parse(message.toString('utf8'));
  } catch (_) {
    return [];
  }
  return asArray(parsed?.Envelope?.Body?.ProbeMatches?.ProbeMatch)
    .map((match) => {
      const xaddrs = (text(match.XAddrs) || '').split(/\s+/).filter((x) => /^https?:\/\//i.test(x));
      const scopes = (text(match.Scopes) || '').split(/\s+/).filter(Boolean);
      // Prefer the service address on the interface the reply came from.
      const urls = xaddrs.map((x) => { try { return new URL(x); } catch (_) { return null; } }).filter(Boolean);
      const chosen =
        urls.find((u) => u.hostname === sender.address) || urls.find((u) => net.isIPv4(u.hostname)) || urls[0];
      if (!chosen) return null;
      return {
        urn: text(match.EndpointReference?.Address),
        name: scopeValue(scopes, 'name'),
        hardware: scopeValue(scopes, 'hardware'),
        location: scopeValue(scopes, 'location'),
        host: chosen.hostname.replace(/^\[|\]$/g, ''),
        port: Number(chosen.port) || (chosen.protocol === 'https:' ? 443 : 80),
        xaddrs,
      };
    })
    .filter(Boolean);
}

function localIPv4Addresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses.length ? addresses : ['0.0.0.0'];
}

/** Returns [{ urn, name, hardware, location, host, port, xaddrs }], de-duplicated by device. */
async function discoverOnvifDevices({ timeoutMs = 3000 } = {}) {
  const messageId = `uuid:${crypto.randomUUID()}`;
  const probe = Buffer.from(probeMessage(messageId));
  const found = new Map();

  const sockets = await Promise.all(
    localIPv4Addresses().map(
      (address) =>
        new Promise((resolve) => {
          const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
          socket.on('error', () => {
            try { socket.close(); } catch (_) { /* already closed */ }
            resolve(null);
          });
          socket.on('message', (message, sender) => {
            for (const device of parseProbeMatches(message, sender)) {
              const key = device.urn || `${device.host}:${device.port}`;
              if (!found.has(key)) found.set(key, device);
            }
          });
          socket.bind(0, address === '0.0.0.0' ? undefined : address, () => {
            try {
              if (address !== '0.0.0.0') socket.setMulticastInterface(address);
            } catch (_) { /* platform without per-interface multicast */ }
            const send = () => socket.send(probe, DISCOVERY_PORT, MULTICAST_ADDRESS, () => {});
            send();
            // UDP is lossy; a second probe catches devices that missed the first.
            setTimeout(send, Math.min(500, timeoutMs / 3));
            resolve(socket);
          });
        })
    )
  );

  await new Promise((r) => setTimeout(r, timeoutMs));
  for (const socket of sockets) {
    try { socket?.close(); } catch (_) { /* already closed */ }
  }

  return [...found.values()].sort((a, b) => a.host.localeCompare(b.host, undefined, { numeric: true }));
}

module.exports = { discoverOnvifDevices, parseProbeMatches, DISCOVERY_PORT, MULTICAST_ADDRESS };
