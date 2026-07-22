const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');

// @desc    Get all cameras (OPERATOR: only assigned cameras)
// @route   GET /api/cameras
// @access  Private
exports.getCameras = async (req, res, next) => {
  try {
    let query = { isDeleted: false };

    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      query.organizationId = req.user.organizationId;
    }
    if (req.query.organizationId && req.user.role === 'super_admin') {
      query.organizationId = req.query.organizationId;
    }

    // Operator: only cameras assigned to them
    if (req.user.role === 'operator') {
      const assignments = await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId');
      query._id = { $in: assignments };
    }

    const cameras = await Camera.find(query)
      .populate('organizationId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: cameras.length,
      data: cameras,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single camera
// @route   GET /api/cameras/:id
// @access  Private
exports.getCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id)
      .populate('organizationId')
      .populate('createdBy', 'name email');

    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    if (req.user.role === 'super_admin') {
      return res.status(200).json({ success: true, data: camera });
    }
    if (camera.organizationId._id.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    // Operator: must be assigned to this camera
    if (req.user.role === 'operator') {
      const assigned = await OperatorCameraAssignment.findOne({
        operatorId: req.user._id,
        cameraId: camera._id,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this camera' });
      }
    }

    res.status(200).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create camera
// @route   POST /api/cameras
// @access  Private (Super Admin, Org Admin)
exports.createCamera = async (req, res, next) => {
  try {
    const { name, label, ipAddress, streamUrl, location, organizationId, installationDate, metadata } = req.body;

    const orgId = organizationId || req.user.organizationId;
    const organization = await Organization.findById(orgId).populate('subscriptionPlanId');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const cameraCount = await Camera.countDocuments({
      organizationId: orgId,
      isDeleted: false,
    });
    const maxCameras = organization.subscriptionPlanId
      ? organization.subscriptionPlanId.maxCameras
      : organization.maxCameras;
    if (cameraCount >= maxCameras) {
      return res.status(400).json({
        success: false,
        message: `Camera limit reached. Maximum ${maxCameras} cameras allowed for your plan`,
      });
    }

    if (req.user.role === 'org_admin' && orgId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const camera = await Camera.create({
      name: name || label,
      label: label || name,
      ipAddress,
      streamUrl: streamUrl || undefined,
      location,
      organizationId: orgId,
      installationDate: installationDate ? new Date(installationDate) : undefined,
      createdBy: req.user._id,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update camera
// @route   PUT /api/cameras/:id
// @access  Private (Super Admin, Org Admin)
exports.updateCamera = async (req, res, next) => {
  try {
    let camera = await Camera.findById(req.params.id);

    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    if (req.user.role === 'org_admin' && camera.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const { name, label, ipAddress, streamUrl, location, status, installationDate, metadata } = req.body;

    if (name !== undefined) camera.name = name;
    if (label !== undefined) camera.label = label;
    if (ipAddress !== undefined) camera.ipAddress = ipAddress;
    if (streamUrl !== undefined) camera.streamUrl = streamUrl;
    if (location !== undefined) camera.location = location;
    if (status !== undefined) camera.status = status;
    if (installationDate !== undefined) camera.installationDate = new Date(installationDate);
    if (metadata) camera.metadata = { ...camera.metadata, ...metadata };

    await camera.save();

    res.status(200).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete camera
// @route   DELETE /api/cameras/:id
// @access  Private (Super Admin, Org Admin)
exports.deleteCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    // Check access
    if (req.user.role === 'org_admin' && camera.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await camera.softDelete();

    res.status(200).json({
      success: true,
      message: 'Camera deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update camera activity / heartbeat
// @route   PUT /api/cameras/:id/activity
// @access  Private
exports.updateCameraActivity = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    await camera.updateActivity();

    res.status(200).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    next(error);
  }
};
