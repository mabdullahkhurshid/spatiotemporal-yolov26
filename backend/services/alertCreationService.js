const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const User = require('../models/User');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const { sendAlertEmail } = require('./emailService');
const { emitToCameraAudience } = require('../sockets/emitters');
const { buildExplanation, severityFor } = require('./alertExplanation');

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
  evidence,
  visualPending = false,
  createdByUserId,
  actionNote = 'Alert created by AI detection',
}) {
  const avgConfidence =
    typeof averageConfidence === 'number' ? averageConfidence : (fireConfidence + smokeConfidence) / 2;
  const intensity = intensityLevel || severityFor(avgConfidence);

  const explanation = buildExplanation({
    fireConfidence,
    smokeConfidence,
    intensityLevel: intensity,
    intensityProvided: Boolean(intensityLevel),
    severityValue: avgConfidence,
    boundingBoxes,
    metricsSnapshot,
    evidence,
  });
  if (visualPending) {
    explanation.visual = { status: 'pending', method: 'layercam' };
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
    explanation,
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

  // The most actionable reason: a possible look-alike first, otherwise how the alert was confirmed.
  const why = (explanation.reasons.find((r) => r.code === 'lookalike') || explanation.reasons.find((r) => r.code === 'confirmed'))?.text;
  const notifications = users.map((user) => ({
    userId: user._id,
    organizationId: camera.organizationId,
    alertId: alert._id,
    type: 'alert',
    title: `Fire Alert: ${camera.label || camera.name}`,
    message: `Detection (${primaryClass || 'fire/smoke'}) — fire ${fireConfidence}%, smoke ${smokeConfidence}%${why ? `. ${why}` : ''}`,
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
