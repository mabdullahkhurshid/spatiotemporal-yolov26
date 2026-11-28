const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');

// detection:live fires several times per second per camera, so assignment lookups are cached briefly.
const AUDIENCE_TTL_MS = 5000;
const operatorCache = new Map();

async function getAssignedOperatorIds(cameraId) {
  const key = String(cameraId);
  const cached = operatorCache.get(key);
  if (cached && Date.now() - cached.at < AUDIENCE_TTL_MS) {
    return cached.ids;
  }
  const ids = (await OperatorCameraAssignment.find({ cameraId }).distinct('operatorId')).map(String);
  operatorCache.set(key, { ids, at: Date.now() });
  return ids;
}

/** Drop cached audiences after assignment changes (no argument clears everything). */
function invalidateCameraAudience(cameraId) {
  if (cameraId) {
    operatorCache.delete(String(cameraId));
  } else {
    operatorCache.clear();
  }
}

const SUPER_ADMIN_ROOM = 'superadmins';

/**
 * Org admins listen on `org:<id>`; operators only get events for cameras assigned to them (`user:<id>`).
 * Super admins get platform-wide alert/status events, but not raw detection frames (README §11.1 privacy).
 */
async function emitToCameraAudience(io, { organizationId, cameraId }, event, payload, { superAdmins = true } = {}) {
  if (!io || !organizationId) return;

  const rooms = [`org:${organizationId}`];
  if (superAdmins) rooms.push(SUPER_ADMIN_ROOM);
  if (cameraId) {
    try {
      const operatorIds = await getAssignedOperatorIds(cameraId);
      operatorIds.forEach((id) => rooms.push(`user:${id}`));
    } catch (error) {
      console.error('Socket audience lookup error:', error);
    }
  }

  io.to(rooms).emit(event, payload);
}

/**
 * Ends every open socket of a user (every socket joins user:<id> on connect). Call it whenever the
 * user's sessions are revoked or the account is deactivated, so live alerts stop immediately.
 */
const disconnectUserSockets = (io, userId) => {
  if (!io || !userId) return;
  io.in(`user:${userId}`).disconnectSockets(true);
};

module.exports = { emitToCameraAudience, invalidateCameraAudience, disconnectUserSockets, SUPER_ADMIN_ROOM };
