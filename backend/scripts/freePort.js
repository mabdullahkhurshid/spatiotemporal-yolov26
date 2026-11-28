// Development only: stop whatever still listens on the backend port before nodemon starts, so a
// leftover `npm run server` from another terminal cannot crash the new one with EADDRINUSE.
//
//   node backend/scripts/freePort.js            # PORT from .env, default 5000
require('dotenv').config();
const { execSync } = require('child_process');

const port = parseInt(process.env.PORT, 10) || 5000;

function listeningPids() {
  try {
    if (process.platform === 'win32') {
      return execSync('netstat -ano -p tcp', { encoding: 'utf8' })
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter((cols) => cols[3] === 'LISTENING' && cols[1].endsWith(`:${port}`))
        .map((cols) => cols[4]);
    }
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).split('\n');
  } catch (_) {
    return []; // nothing listening (lsof exits 1)
  }
}

const pids = [...new Set(listeningPids().map((pid) => pid.trim()).filter((pid) => pid && pid !== '0'))];
for (const pid of pids) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    console.log(`freePort: stopped PID ${pid} holding port ${port}`);
  } catch (error) {
    console.warn(`freePort: could not stop PID ${pid} on port ${port}: ${error.message}`);
  }
}
