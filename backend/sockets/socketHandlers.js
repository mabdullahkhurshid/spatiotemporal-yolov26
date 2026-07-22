const Camera = require('../models/Camera');
const Alert = require('../models/Alert');

const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.CAMERA_HEARTBEAT_TIMEOUT_MS) || 5 * 60 * 1000; // 5 minutes
const OFFLINE_CHECK_INTERVAL_MS = parseInt(process.env.CAMERA_OFFLINE_CHECK_INTERVAL_MS) || 60 * 1000; // 1 min

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
      io.to(`org:${camera.organizationId}`).emit('camera:status:update', {
        cameraId: camera._id,
        status: 'OFFLINE',
        lastHeartbeat: camera.lastHeartbeat,
      });
    }
  } catch (error) {
    console.error('Offline check error:', error);
  }
};

// Handle socket connections
const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join:organization', (organizationId) => {
      socket.join(`org:${organizationId}`);
      console.log(`Socket ${socket.id} joined organization ${organizationId}`);
    });

    socket.on('leave:organization', (organizationId) => {
      socket.leave(`org:${organizationId}`);
      console.log(`Socket ${socket.id} left organization ${organizationId}`);
    });

    // Camera status update (manual)
    socket.on('camera:status', async (data) => {
      try {
        const { cameraId, status } = data;
        const camera = await Camera.findById(cameraId);

        if (camera && !camera.isDeleted) {
          const now = new Date();
          camera.status = status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : status;
          camera.lastActivity = now;
          camera.lastHeartbeat = now;
          await camera.save();

          io.to(`org:${camera.organizationId}`).emit('camera:status:update', {
            cameraId,
            status: camera.status,
            lastActivity: camera.lastActivity,
            lastHeartbeat: camera.lastHeartbeat,
          });
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

        if (camera && !camera.isDeleted) {
          const now = new Date();
          camera.status = 'ONLINE';
          camera.lastActivity = now;
          camera.lastHeartbeat = now;
          await camera.save();

          io.to(`org:${camera.organizationId}`).emit('camera:status:update', {
            cameraId,
            status: 'ONLINE',
            lastHeartbeat: now,
            lastActivity: now,
          });
        }
      } catch (error) {
        console.error('Socket camera heartbeat error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Periodic check: mark cameras OFFLINE if no heartbeat
  setInterval(() => checkOfflineCameras(io), OFFLINE_CHECK_INTERVAL_MS);
};

module.exports = handleSocketConnection;
