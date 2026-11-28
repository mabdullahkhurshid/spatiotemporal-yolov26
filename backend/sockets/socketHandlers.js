const jwt = require('jsonwebtoken');
const Camera = require('../models/Camera');
const User = require('../models/User');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const { emitToCameraAudience, SUPER_ADMIN_ROOM } = require('./emitters');
const { attachPreviewHub, watch: watchPreview, previewRoom } = require('../services/livePreviewHub');

const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.CAMERA_HEARTBEAT_TIMEOUT_MS) || 5 * 60 * 1000; // 5 minutes
const OFFLINE_CHECK_INTERVAL_MS = parseInt(process.env.CAMERA_OFFLINE_CHECK_INTERVAL_MS) || 60 * 1000; // 1 min
const SOCKET_USER_RECHECK_MS = parseInt(process.env.SOCKET_USER_RECHECK_MS) || 60 * 1000; // 1 min

// Mark cameras OFFLINE if no heartbeat within timeout
const checkOfflineCameras = async (io) => {
  try {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    const cameras = await Camera.find({
      status: 'ONLINE',
      lastHeartbeat: { $lt: cutoff },
      isDeleted: false,
    });

    for (const camera of cameras) {
      camera.status = 'OFFLINE';
      await camera.save();
      await emitToCameraAudience(
        io,
        { organizationId: camera.organizationId, cameraId: camera._id },
        'camera:status:update',
        {
          cameraId: camera._id,
          status: 'OFFLINE',
          lastHeartbeat: camera.lastHeartbeat,
        }
      );
    }
  } catch (error) {
    console.error('Offline check error:', error);
  }
};

const readCookie = (header, name) => {
  if (!header) return null;
  const match = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

// The frontend stores organizationId either as an id string or as a populated organization object.
const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value._id ? String(value._id) : null;
  return String(value);
};

const loadSocketUser = async (userId) => {
  const user = await User.findById(userId).select('role organizationId isActive isDeleted');
  if (!user || user.isDeleted || !user.isActive) return null;
  return {
    id: String(user._id),
    role: user.role,
    organizationId: user.organizationId ? String(user.organizationId) : null,
  };
};

// Disconnect sockets whose user was deleted or deactivated (safety net for disconnectUserSockets).
const disconnectInactiveUsers = async (io) => {
  try {
    const sockets = await io.fetchSockets();
    const userIds = [...new Set(sockets.map((s) => s.data.user?.id).filter(Boolean))];
    if (userIds.length === 0) return;
    const active = await User.find({ _id: { $in: userIds }, isDeleted: { $ne: true }, isActive: true }).distinct('_id');
    const activeIds = new Set(active.map(String));
    for (const s of sockets) {
      if (!activeIds.has(s.data.user?.id)) s.disconnect(true);
    }
  } catch (error) {
    console.error('Socket user re-check error:', error);
  }
};

// Require a valid access token (handshake auth or cookie) before a socket can connect.
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token || readCookie(socket.handshake.headers?.cookie, 'accessToken');
    if (!token) {
      return next(new Error('Not authorized'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadSocketUser(decoded.id);
    if (!user) {
      return next(new Error('Not authorized'));
    }
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Not authorized'));
  }
};

const joinScopedRooms = (socket, user) => {
  socket.join(`user:${user.id}`);
  // Operators are not in the org room: they receive events only for assigned cameras via user:<id>.
  if (user.role === 'org_admin' && user.organizationId) {
    socket.join(`org:${user.organizationId}`);
  }
  if (user.role === 'super_admin') {
    socket.join(SUPER_ADMIN_ROOM);
  }
};

// Org admins (own org) and super admins may change camera state; operators only for assigned cameras.
const canTouchCamera = async (user, camera) => {
  if (user.role === 'super_admin') return true;
  if (!user.organizationId || String(camera.organizationId) !== user.organizationId) return false;
  if (user.role === 'org_admin') return true;
  if (user.role === 'operator') {
    return Boolean(await OperatorCameraAssignment.exists({ operatorId: user.id, cameraId: camera._id }));
  }
  return false;
};

// Handle socket connections
const handleSocketConnection = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log('User connected:', socket.id);
    joinScopedRooms(socket, user);

    // Personal room is joined on connect; only the user's own room is accepted here.
    socket.on('join:user', (userId) => {
      if (normalizeId(userId) === user.id) {
        socket.join(`user:${user.id}`);
      }
    });

    socket.on('leave:user', (userId) => {
      if (normalizeId(userId) === user.id) {
        socket.leave(`user:${user.id}`);
      }
    });

    // Re-read the user so a customer promoted to org_admin by checkout can join without reconnecting.
    socket.on('join:organization', async (organizationId) => {
      try {
        const requested = normalizeId(organizationId);
        const fresh = await loadSocketUser(user.id);
        if (!requested || !fresh) return;
        Object.assign(user, fresh);

        const allowed =
          fresh.role === 'super_admin' ||
          (fresh.role === 'org_admin' && fresh.organizationId === requested);
        if (allowed) {
          socket.join(`org:${requested}`);
          console.log(`Socket ${socket.id} joined organization ${requested}`);
        }
      } catch (error) {
        console.error('Socket join organization error:', error);
      }
    });

    socket.on('leave:organization', (organizationId) => {
      const requested = normalizeId(organizationId);
      if (requested) {
        socket.leave(`org:${requested}`);
        console.log(`Socket ${socket.id} left organization ${requested}`);
      }
    });

    // Camera status update (manual)
    socket.on('camera:status', async (data) => {
      try {
        const { cameraId, status } = data || {};
        if (!cameraId) return;
        const camera = await Camera.findById(cameraId);

        // Only online/offline can be set here; paused/maintenance go through the REST endpoints.
        const nextStatus = status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : null;
        if (!nextStatus) return;
        if (camera && !camera.isDeleted && user.role !== 'operator' && (await canTouchCamera(user, camera))) {
          const now = new Date();
          camera.status = nextStatus;
          camera.lastActivity = now;
          camera.lastHeartbeat = now;
          await camera.save();

          await emitToCameraAudience(
            io,
            { organizationId: camera.organizationId, cameraId: camera._id },
            'camera:status:update',
            {
              cameraId,
              status: camera.status,
              lastActivity: camera.lastActivity,
              lastHeartbeat: camera.lastHeartbeat,
            }
          );
        }
      } catch (error) {
        console.error('Socket camera status error:', error);
      }
    });

    // Camera heartbeat (device sends periodically → mark ONLINE)
    socket.on('camera:heartbeat', async (data) => {
      try {
        const { cameraId } = data || {};
        if (!cameraId) return;
        const camera = await Camera.findById(cameraId);

        if (camera && !camera.isDeleted && (await canTouchCamera(user, camera))) {
          const now = new Date();
          if (!Camera.HELD_STATUSES.includes(camera.status)) camera.status = 'ONLINE';
          camera.lastActivity = now;
          camera.lastHeartbeat = now;
          await camera.save();

          await emitToCameraAudience(
            io,
            { organizationId: camera.organizationId, cameraId: camera._id },
            'camera:status:update',
            {
              cameraId,
              status: camera.status,
              lastHeartbeat: now,
              lastActivity: now,
            }
          );
        }
      } catch (error) {
        console.error('Socket camera heartbeat error:', error);
      }
    });

    // Live tile previews (services/livePreviewHub.js), for anyone who may view the camera.
    socket.on('camera:preview:subscribe', async (cameraId) => {
      try {
        const id = normalizeId(cameraId);
        if (!/^[a-f0-9]{24}$/.test(id)) return;
        const camera = await Camera.findById(id).select('organizationId isDeleted');
        if (!camera || camera.isDeleted || !(await canTouchCamera(user, camera))) return;
        socket.join(previewRoom(id));
        watchPreview(io, socket, id);
      } catch (error) {
        console.error('Socket camera preview error:', error);
      }
    });

    socket.on('camera:preview:unsubscribe', (cameraId) => {
      socket.leave(previewRoom(normalizeId(cameraId)));
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  attachPreviewHub(io);

  // Periodic check: mark cameras OFFLINE if no heartbeat
  setInterval(() => checkOfflineCameras(io), OFFLINE_CHECK_INTERVAL_MS);
  // Periodic check: drop sockets of users deleted or deactivated since they connected
  setInterval(() => disconnectInactiveUsers(io), SOCKET_USER_RECHECK_MS).unref();
};

module.exports = handleSocketConnection;
