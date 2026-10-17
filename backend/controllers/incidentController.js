const FireIncident = require('../models/FireIncident');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');

exports.getIncidentStats = async (req, res, next) => {
  try {
    const match = {};

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      match.organizationId = req.user.organizationId;
    }

    if (req.user.role === 'operator') {
      const assignedCameraIds = await OperatorCameraAssignment.find({
        operatorId: req.user._id,
      }).distinct('cameraId');
      match.cameraId = { $in: assignedCameraIds };
    }

    if (req.query.startDate || req.query.endDate) {
      match.startedAt = {};
      if (req.query.startDate) match.startedAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) match.startedAt.$lte = new Date(req.query.endDate);
    }

    const stats = await FireIncident.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          ended: { $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] } },
          avgFrequency: { $avg: '$detectionFrequencyPerMin' },
          avgSpread: { $avg: '$estimatedSpreadRate' },
          peakFire: { $max: '$peakFireConfidence' },
          peakSmoke: { $max: '$peakSmokeConfidence' },
        },
      },
    ]);

    const data = stats[0] || {
      total: 0,
      active: 0,
      ended: 0,
      avgFrequency: 0,
      avgSpread: 0,
      peakFire: 0,
      peakSmoke: 0,
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getIncidents = async (req, res, next) => {
  try {
    const query = {};

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      query.organizationId = req.user.organizationId;
    }

    if (req.user.role === 'operator') {
      const assignedCameraIds = await OperatorCameraAssignment.find({
        operatorId: req.user._id,
      }).distinct('cameraId');
      query.cameraId = { $in: assignedCameraIds };
    }

    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.cameraId) {
      query.cameraId = req.query.cameraId;
    }

    const incidents = await FireIncident.find(query)
      .populate('cameraId', 'name label location displayNumber')
      .sort({ startedAt: -1 })
      .limit(parseInt(req.query.limit, 10) || 50);

    res.status(200).json({ success: true, count: incidents.length, data: incidents });
  } catch (error) {
    next(error);
  }
};

exports.getIncident = async (req, res, next) => {
  try {
    const incident = await FireIncident.findById(req.params.id)
      .populate('cameraId', 'name label location displayNumber streamUrl')
      .populate('linkedAlertIds');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (req.user.role === 'super_admin') {
      return res.status(200).json({ success: true, data: incident });
    }

    if (incident.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (req.user.role === 'operator') {
      const assigned = await OperatorCameraAssignment.findOne({
        operatorId: req.user._id,
        cameraId: incident.cameraId._id || incident.cameraId,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    res.status(200).json({ success: true, data: incident });
  } catch (error) {
    next(error);
  }
};
