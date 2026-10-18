const Alert = require('../models/Alert');
const Camera = require('../models/Camera');
const User = require('../models/User');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const { createAlertFromDetection } = require('../services/alertCreationService');
const { emitToCameraAudience } = require('../sockets/emitters');

const RESOLUTION_TYPES = ['EXTINGUISHED', 'EVACUATED', 'TEST_DRILL', 'FALSE_ALARM', 'OTHER'];
// Lifecycle: active → acknowledged → resolved | false_alarm. Closed alerts are never reopened.
const OPEN_STATUSES = ['active', 'acknowledged'];

// Returns { status, message } when the user may not act on alerts for this org/camera, otherwise null.
const checkAlertAccess = async (user, organizationId, cameraId) => {
  if (user.role === 'super_admin') return null;
  if (organizationId?.toString() !== user.organizationId?.toString()) {
    return { status: 403, message: 'Not authorized' };
  }
  if (user.role === 'operator') {
    const assigned = await OperatorCameraAssignment.findOne({ operatorId: user._id, cameraId });
    if (!assigned) {
      return { status: 403, message: 'You are not assigned to this camera' };
    }
  }
  return null;
};

// Atomically move an alert out of one of `fromStatuses`; a concurrent change returns 409.
const transitionAlert = async (req, res, next, { fromStatuses, set, action, events }) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    const denied = await checkAlertAccess(req.user, alert.organizationId, alert.cameraId);
    if (denied) {
      return res.status(denied.status).json({ success: false, message: denied.message });
    }

    if (!fromStatuses.includes(alert.status)) {
      return res.status(400).json({
        success: false,
        message: `Alert is already ${alert.status.replace('_', ' ')}`,
      });
    }

    const updated = await Alert.findOneAndUpdate(
      { _id: alert._id, status: { $in: fromStatuses } },
      {
        $set: set,
        $push: { actions: { ...action, byUserId: req.user._id, at: new Date() } },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Alert was updated by another user. Refresh and try again.',
      });
    }

    const audience = { organizationId: updated.organizationId, cameraId: updated.cameraId };
    for (const [event, payload] of events(updated)) {
      await emitToCameraAudience(req.io, audience, event, payload);
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all alerts (OPERATOR: only alerts for assigned cameras)
// @route   GET /api/alerts
// @access  Private
exports.getAlerts = async (req, res, next) => {
  try {
    let query = {};
    let assignedCameraIds = null;

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      query.organizationId = req.user.organizationId;
    }
    if (req.user.role === 'operator') {
      assignedCameraIds = await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId');
      query.cameraId = { $in: assignedCameraIds };
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.timestamp = {};
      if (req.query.startDate) {
        query.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.timestamp.$lte = new Date(req.query.endDate);
      }
    }

    // Filter by camera (operators stay limited to their assigned cameras)
    if (req.query.cameraId) {
      if (assignedCameraIds) {
        const isAssigned = assignedCameraIds.some((id) => id.toString() === String(req.query.cameraId));
        query.cameraId = isAssigned ? req.query.cameraId : { $in: [] };
      } else {
        query.cameraId = req.query.cameraId;
      }
    }

    const alerts = await Alert.find(query)
      .populate('cameraId', 'name label location ipAddress')
      .populate('organizationId', 'name')
      .populate('resolvedBy', 'name email')
      .sort({ timestamp: -1 })
      .limit(parseInt(req.query.limit) || 50);

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Private
exports.getAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('cameraId')
      .populate('organizationId')
      .populate('resolvedBy', 'name email');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    if (req.user.role === 'super_admin') {
      return res.status(200).json({ success: true, data: alert });
    }
    if (alert.organizationId._id.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (req.user.role === 'operator') {
      const assigned = await OperatorCameraAssignment.findOne({
        operatorId: req.user._id,
        cameraId: alert.cameraId._id || alert.cameraId,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this camera' });
      }
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create alert
// @route   POST /api/alerts
// @access  Private (AI System / API)
exports.createAlert = async (req, res, next) => {
  try {
    const {
      cameraId,
      fireConfidence,
      smokeConfidence,
      intensityLevel,
      alertImage,
      coordinates,
      averageConfidence,
      frameSnapshotURL,
      boundingBoxes,
      incidentId,
      primaryClass,
      metricsSnapshot,
    } = req.body;

    const camera = await Camera.findById(cameraId);
    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    const denied = await checkAlertAccess(req.user, camera.organizationId, camera._id);
    if (denied) {
      return res.status(denied.status).json({ success: false, message: denied.message });
    }

    const alert = await createAlertFromDetection({
      io: req.io,
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
      createdByUserId: req.user?._id,
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private (Super Admin, Org Admin, Operator for assigned cameras)
exports.resolveAlert = async (req, res, next) => {
  const resolutionType = req.body.resolutionType || 'OTHER';
  if (!RESOLUTION_TYPES.includes(resolutionType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid resolution type. Use one of: ${RESOLUTION_TYPES.join(', ')}`,
    });
  }
  const resolutionNote = req.body.note || 'Alert resolved';

  return transitionAlert(req, res, next, {
    fromStatuses: OPEN_STATUSES,
    set: {
      status: 'resolved',
      resolvedBy: req.user._id,
      resolvedAt: new Date(),
      resolutionType,
      resolutionNote,
      isFalseAlarm: false,
    },
    action: { type: 'RESOLVED', note: resolutionNote },
    events: (alert) => [
      ['alert:resolved', { alertId: alert._id }],
      [`alert:${alert.organizationId}`, { type: 'alert_resolved', alertId: alert._id }],
    ],
  });
};

// @desc    Mark alert as false alarm
// @route   PUT /api/alerts/:id/false-alarm
// @access  Private (Super Admin, Org Admin, Operator for assigned cameras)
exports.markFalseAlarm = async (req, res, next) => {
  const resolutionNote = req.body.note || 'Marked as false alarm';

  return transitionAlert(req, res, next, {
    fromStatuses: OPEN_STATUSES,
    set: {
      status: 'false_alarm',
      resolvedBy: req.user._id,
      resolvedAt: new Date(),
      resolutionType: 'FALSE_ALARM',
      resolutionNote,
      isFalseAlarm: true,
    },
    action: { type: 'FALSE_ALARM', note: resolutionNote },
    events: (alert) => [
      ['alert:false_alarm', { alertId: alert._id }],
      [`alert:${alert.organizationId}`, { type: 'alert_false_alarm', alertId: alert._id }],
    ],
  });
};

// @desc    Get alert statistics (OPERATOR: only assigned cameras)
// @route   GET /api/alerts/stats
// @access  Private
exports.getAlertStats = async (req, res, next) => {
  try {
    let matchQuery = {};

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      matchQuery.organizationId = req.user.organizationId;
    }
    if (req.user.role === 'operator') {
      const assignedCameraIds = await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId');
      matchQuery.cameraId = { $in: assignedCameraIds };
    }

    if (req.query.startDate || req.query.endDate) {
      matchQuery.timestamp = {};
      if (req.query.startDate) matchQuery.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) matchQuery.timestamp.$lte = new Date(req.query.endDate);
    }

    const stats = await Alert.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
          },
          falseAlarms: {
            $sum: { $cond: [{ $eq: ['$status', 'false_alarm'] }, 1, 0] },
          },
          avgFireConfidence: { $avg: '$fireConfidence' },
          avgSmokeConfidence: { $avg: '$smokeConfidence' },
        },
      },
    ]);

    const baseStats =
      stats[0] || {
        total: 0,
        active: 0,
        resolved: 0,
        falseAlarms: 0,
        avgFireConfidence: 0,
        avgSmokeConfidence: 0,
      };

    const falseAlarmRate =
      baseStats.total > 0 ? baseStats.falseAlarms / baseStats.total : 0;

    res.status(200).json({
      success: true,
      data: {
        ...baseStats,
        falseAlarmRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Acknowledge alert (moves ACTIVE -> ACKNOWLEDGED)
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private (Super Admin, Org Admin, Operator for assigned cameras)
exports.acknowledgeAlert = async (req, res, next) =>
  transitionAlert(req, res, next, {
    fromStatuses: ['active'],
    set: { status: 'acknowledged', acknowledgedAt: new Date() },
    action: { type: 'ACKNOWLEDGED', note: req.body.note || 'Alert acknowledged' },
    events: (alert) => [['alert:updated', { alertId: alert._id, status: alert.status }]],
  });
