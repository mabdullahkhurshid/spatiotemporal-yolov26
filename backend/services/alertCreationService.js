const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const User = require('../models/User');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const { sendAlertEmail } = require('./emailService');
const { emitToCameraAudience } = require('../sockets/emitters');

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

  // Push to dashboards first so SMTP latency never delays the real-time alert.
  if (io) {
    const alertObj = alert.toObject();
    const audience = { organizationId: camera.organizationId, cameraId: camera._id };
    await emitToCameraAudience(io, audience, 'alert:new', { alert: alertObj });
    await emitToCameraAudience(io, audience, `alert:${camera.organizationId}`, { type: 'new_alert', alert: alertObj });
  }

  // Org admins plus operators assigned to this camera (operators only see assigned cameras).
  const assignedOperatorIds = await OperatorCameraAssignment.find({ cameraId: camera._id }).distinct('operatorId');
  const users = await User.find({
    organizationId: camera.organizationId,
    $or: [{ role: 'org_admin' }, { role: 'operator', _id: { $in: assignedOperatorIds } }],
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

  // Emails are best-effort and must not block the HTTP response / inference worker.
  const admins = users.filter((u) => u.role === 'org_admin');
  for (const admin of admins) {
    sendAlertEmail(admin, alert, camera).catch((emailError) => {
      console.error('Email send error:', emailError);
    });
  }

  return alert;
}

module.exports = { createAlertFromDetection };
