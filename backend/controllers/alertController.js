const Alert = require('../models/Alert');
const Camera = require('../models/Camera');
const Notification = require('../models/Notification');
const User = require('../models/User');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const { sendAlertEmail } = require('../services/emailService');

// @desc    Get all alerts (OPERATOR: only alerts for assigned cameras)
// @route   GET /api/alerts
// @access  Private
exports.getAlerts = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      query.organizationId = req.user.organizationId;
    }
    if (req.user.role === 'operator') {
      const assignedCameraIds = await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId');
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

    // Filter by camera
    if (req.query.cameraId) {
      query.cameraId = req.query.cameraId;
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
    } = req.body;

    const camera = await Camera.findById(cameraId);
    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    // Determine intensity level if not provided
    let intensity = intensityLevel;
    const avgConfidence = typeof averageConfidence === 'number'
      ? averageConfidence
      : (fireConfidence + smokeConfidence) / 2;

    if (!intensity) {
      if (avgConfidence >= 80) intensity = 'critical';
      else if (avgConfidence >= 60) intensity = 'high';
      else if (avgConfidence >= 40) intensity = 'medium';
      else intensity = 'low';
    }

    const alert = await Alert.create({
      cameraId,
      organizationId: camera.organizationId,
      fireConfidence,
      smokeConfidence,
      averageConfidence: avgConfidence,
      intensityLevel: intensity,
      alertImage,
      frameSnapshotURL,
      coordinates,
      actions: [
        {
          type: 'CREATED',
          byUserId: req.user?._id,
          note: 'Alert created by AI detection',
        },
      ],
    });

    // Populate for response
    await alert.populate('cameraId organizationId');

    // Create notifications for organization admins and operators
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
      title: `Fire Alert: ${camera.label}`,
      message: `Fire detected with ${fireConfidence}% confidence. Intensity: ${intensity}`,
      priority: intensity === 'critical' || intensity === 'high' ? 'critical' : 'high',
    }));

    await Notification.insertMany(notifications);

    // Send email notifications to admins
    const admins = users.filter((u) => u.role === 'org_admin');
    for (const admin of admins) {
      try {
        await sendAlertEmail(admin, alert, camera);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    // Emit socket event (organization room + generic event)
    const alertObj = alert.toObject();
    req.io.to(`org:${camera.organizationId}`).emit('alert:new', {
      alert: alertObj,
    });
    req.io.emit(`alert:${camera.organizationId}`, {
      type: 'new_alert',
      alert: alertObj,
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
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    if (req.user.role === 'super_admin') {
      // allow
    } else if (req.user.role === 'org_admin' && alert.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    } else if (req.user.role === 'operator') {
      if (alert.organizationId.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      const assigned = await OperatorCameraAssignment.findOne({ operatorId: req.user._id, cameraId: alert.cameraId });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this camera' });
      }
    }

    alert.status = 'resolved';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    alert.resolutionType = req.body.resolutionType || 'OTHER';
    alert.resolutionNote = req.body.note || 'Alert resolved';
    alert.isFalseAlarm = false;
    alert.actions.push({
      type: 'RESOLVED',
      byUserId: req.user._id,
      note: alert.resolutionNote,
    });

    await alert.save();

    // Emit socket event
    req.io.to(`org:${alert.organizationId}`).emit('alert:resolved', {
      alertId: alert._id,
    });
    req.io.emit(`alert:${alert.organizationId}`, {
      type: 'alert_resolved',
      alertId: alert._id,
    });

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark alert as false alarm
// @route   PUT /api/alerts/:id/false-alarm
// @access  Private (Super Admin, Org Admin, Operator for assigned cameras)
exports.markFalseAlarm = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    if (req.user.role === 'super_admin') {
      // allow
    } else if (req.user.role === 'org_admin' && alert.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    } else if (req.user.role === 'operator') {
      if (alert.organizationId.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      const assigned = await OperatorCameraAssignment.findOne({ operatorId: req.user._id, cameraId: alert.cameraId });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this camera' });
      }
    }

    alert.status = 'false_alarm';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    alert.resolutionType = 'FALSE_ALARM';
    alert.resolutionNote = req.body.note || 'Marked as false alarm';
    alert.isFalseAlarm = true;
    alert.actions.push({
      type: 'FALSE_ALARM',
      byUserId: req.user._id,
      note: alert.resolutionNote,
    });

    await alert.save();

    // Emit socket event
    req.io.to(`org:${alert.organizationId}`).emit('alert:false_alarm', {
      alertId: alert._id,
    });
    req.io.emit(`alert:${alert.organizationId}`, {
      type: 'alert_false_alarm',
      alertId: alert._id,
    });

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
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
exports.acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    if (req.user.role === 'super_admin') {
      // allow
    } else if (req.user.role === 'org_admin' && alert.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    } else if (req.user.role === 'operator') {
      if (alert.organizationId.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      const assigned = await OperatorCameraAssignment.findOne({ operatorId: req.user._id, cameraId: alert.cameraId });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this camera' });
      }
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.actions.push({
      type: 'ACKNOWLEDGED',
      byUserId: req.user._id,
      note: req.body.note || 'Alert acknowledged',
    });

    await alert.save();

    req.io.to(`org:${alert.organizationId}`).emit('alert:updated', {
      alertId: alert._id,
      status: alert.status,
    });

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};
