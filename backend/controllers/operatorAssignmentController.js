const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const User = require('../models/User');
const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const { invalidateCameraAudience } = require('../sockets/emitters');

// @desc    Get camera assignments for an operator (or all in org)
// @route   GET /api/operator-assignments?operatorId= & organizationId=
// @access  Private (Super Admin, Org Admin)
exports.getAssignments = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'super_admin') {
      if (req.query.operatorId) query.operatorId = req.query.operatorId;
      if (req.query.organizationId) query.organizationId = req.query.organizationId;
    } else if (req.user.role === 'org_admin') {
      query.organizationId = req.user.organizationId;
      if (req.query.operatorId) query.operatorId = req.query.operatorId;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const assignments = await OperatorCameraAssignment.find(query)
      .populate('operatorId', 'name email role')
      .populate('cameraId', 'name ipAddress location status lastHeartbeat')
      .populate('organizationId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign cameras to operator (optionally replace all: replace=true)
// @route   POST /api/operator-assignments
// @access  Private (Super Admin, Org Admin)
exports.assignCameras = async (req, res, next) => {
  try {
    const { operatorId, cameraIds: rawCameraIds, replace } = req.body;

    if (!operatorId || !Array.isArray(rawCameraIds)) {
      return res.status(400).json({
        success: false,
        message: 'operatorId and cameraIds array are required',
      });
    }

    const operator = await User.findOne({
      _id: operatorId,
      role: 'operator',
      isDeleted: false,
    });
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found',
      });
    }

    if (req.user.role === 'org_admin' && operator.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign cameras to this operator',
      });
    }

    const organizationId = operator.organizationId;
    const cameraIds = [...new Set(rawCameraIds.map(String))];

    // Validate before touching existing assignments so a rejected request changes nothing.
    if (cameraIds.length > 0) {
      const cameras = await Camera.find({
        _id: { $in: cameraIds },
        organizationId,
        isDeleted: false,
      });

      if (cameras.length !== cameraIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more cameras not found or do not belong to the operator organization',
        });
      }
    }

    invalidateCameraAudience();

    if (replace) {
      await OperatorCameraAssignment.deleteMany({ operatorId });
    }

    if (cameraIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: replace ? 'All assignments removed' : 'No cameras to add',
      });
    }

    const existing = await OperatorCameraAssignment.find({
      operatorId,
      cameraId: { $in: cameraIds },
    }).distinct('cameraId');
    const toAdd = cameraIds.filter((id) => !existing.some((e) => e.toString() === id.toString()));

    const created = await OperatorCameraAssignment.insertMany(
      toAdd.map((cameraId) => ({
        operatorId,
        cameraId,
        organizationId,
      }))
    );

    const populated = await OperatorCameraAssignment.find({ operatorId })
      .populate('operatorId', 'name email')
      .populate('cameraId', 'name ipAddress location');

    res.status(201).json({
      success: true,
      data: populated,
      message: replace ? 'Assignments updated' : `${created.length} camera(s) assigned`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove camera assignment from operator
// @route   DELETE /api/operator-assignments/:assignmentId
// @access  Private (Super Admin, Org Admin)
exports.removeAssignment = async (req, res, next) => {
  try {
    const assignment = await OperatorCameraAssignment.findById(req.params.assignmentId)
      .populate('operatorId')
      .populate('cameraId');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    if (req.user.role === 'org_admin' && assignment.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await OperatorCameraAssignment.findByIdAndDelete(req.params.assignmentId);
    invalidateCameraAudience(assignment.cameraId?._id || assignment.cameraId);

    res.status(200).json({
      success: true,
      message: 'Assignment removed',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get cameras assigned to current operator
// @route   GET /api/operator-assignments/my-cameras
// @access  Private (Operator)
exports.getMyAssignedCameras = async (req, res, next) => {
  try {
    if (req.user.role !== 'operator') {
      return res.status(403).json({ success: false, message: 'Only operators can use this endpoint' });
    }

    const cameraIds = await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId');
    const cameras = await Camera.find({ _id: { $in: cameraIds }, isDeleted: false })
      .populate('organizationId', 'name')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: cameras.length,
      data: cameras,
    });
  } catch (error) {
    next(error);
  }
};
