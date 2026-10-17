const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendAlertEmail } = require('./emailService');

/**
 * Create alert, notifications, emails, and socket events.
 * Used by user-facing POST /api/alerts and inference ingest.
 */
async function createAlertFromDetection({
  io,
  camera,
  fireConfidence,
  smokeConfidence,
  averageConfidence,
  intensityLevel,
  alertImage,
  frameSnapshotURL,
  coordinates,
  boundingBoxes,
  incidentId,
  primaryClass,
  metricsSnapshot,
  createdByUserId,
  actionNote = 'Alert created by AI detection',
}) {
  let intensity = intensityLevel;
  const avgConfidence =
    typeof averageConfidence === 'number' ? averageConfidence : (fireConfidence + smokeConfidence) / 2;

  if (!intensity) {
    if (avgConfidence >= 80) intensity = 'critical';
    else if (avgConfidence >= 60) intensity = 'high';
    else if (avgConfidence >= 40) intensity = 'medium';
    else intensity = 'low';
  }

  const alert = await Alert.create({
    cameraId: camera._id,
    organizationId: camera.organizationId,
    fireConfidence,
    smokeConfidence,
    averageConfidence: avgConfidence,
    intensityLevel: intensity,
    alertImage,
    frameSnapshotURL,
    coordinates,
    boundingBoxes,
    incidentId,
    primaryClass,
    metricsSnapshot,
    actions: [
      {
        type: 'CREATED',
        byUserId: createdByUserId,
        note: actionNote,
      },
    ],
  });

  await alert.populate('cameraId organizationId');

  const users = await User.find({
    organizationId: camera.organizationId,
    role: { $in: ['org_admin', 'operator'] },
    isActive: true,
    isDeleted: false,
  });

  const notifications = users.map((user) => ({
    userId: user._id,
    organizationId: camera.organizationId,
    alertId: alert._id,
    type: 'alert',
    title: `Fire Alert: ${camera.label || camera.name}`,
    message: `Detection (${primaryClass || 'fire/smoke'}) — fire ${fireConfidence}%, smoke ${smokeConfidence}%`,
    priority: intensity === 'critical' || intensity === 'high' ? 'critical' : 'high',
  }));

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }

  const admins = users.filter((u) => u.role === 'org_admin');
  for (const admin of admins) {
    try {
      await sendAlertEmail(admin, alert, camera);
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }
  }

  if (io) {
    const alertObj = alert.toObject();
    io.to(`org:${camera.organizationId}`).emit('alert:new', { alert: alertObj });
    io.emit(`alert:${camera.organizationId}`, { type: 'new_alert', alert: alertObj });
  }

  return alert;
}

module.exports = { createAlertFromDetection };
