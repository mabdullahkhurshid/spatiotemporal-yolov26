// socket.io-client is a frontend dependency; tests reuse it instead of adding a backend dependency.
const path = require('path');
const { ROOT } = require('./harness');

const { io } = require(path.join(ROOT, 'frontend', 'node_modules', 'socket.io-client'));

function connectSocket(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket connect timeout'));
    }, 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

/** Collect every payload of `event` on the socket; inspect `.items` later. */
function collect(socket, event) {
  const items = [];
  socket.on(event, (payload) => items.push(payload));
  return { items };
}

const settle = (ms = 600) => new Promise((r) => setTimeout(r, ms));

module.exports = { connectSocket, collect, settle };
