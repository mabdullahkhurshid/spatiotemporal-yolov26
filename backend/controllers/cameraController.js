const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const User = require('../models/User');
const Alert = require('../models/Alert');

// @desc    Get camera usage vs plan limit
// @route   GET /api/cameras/usage
// @access  Private (Org Admin)
exports.getCameraUsage = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const organization = await Organization.findById(orgId).populate('subscriptionPlanId');
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const used = await Camera.countDocuments({ organizationId: orgId, isDeleted: false });
    const maxCameras =
      organization.subscriptionPlanId?.maxCameras ?? organization.maxCameras ?? 0;

    res.status(200).json({
      success: true,
      data: {
        used,
        maxCameras,
        canAddMore: used < maxCameras,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
    const { name, label, ipAddress, streamUrl, location, organizationId, installationDate, metadata, cameraType, displayNumber, settings } = req.body;

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
      ipAddress: ipAddress || undefined,
      streamUrl: streamUrl || undefined,
      location,
      organizationId: orgId,
      installationDate: installationDate ? new Date(installationDate) : undefined,
      createdBy: req.user._id,
      metadata,
      cameraType: cameraType || 'ip_rtsp',
      displayNumber: displayNumber || `CAM-${String(cameraCount + 1).padStart(2, '0')}`,
      settings: {
        detectionEnabled: settings?.detectionEnabled !== undefined ? settings.detectionEnabled : true,
        notes: settings?.notes || undefined,
      },
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

    const { name, label, ipAddress, streamUrl, location, status, installationDate, metadata, cameraType, displayNumber, settings } = req.body;

    if (name !== undefined) camera.name = name;
    if (label !== undefined) camera.label = label;
    if (ipAddress !== undefined) camera.ipAddress = ipAddress;
    if (streamUrl !== undefined) camera.streamUrl = streamUrl;
    if (location !== undefined) camera.location = location;
    if (status !== undefined) camera.status = status;
    if (installationDate !== undefined) camera.installationDate = new Date(installationDate);
    if (metadata) camera.metadata = { ...camera.metadata, ...metadata };
    if (cameraType !== undefined) camera.cameraType = cameraType;
    if (displayNumber !== undefined) camera.displayNumber = displayNumber;
    if (settings) {
      if (settings.detectionEnabled !== undefined) {
        camera.settings.detectionEnabled = settings.detectionEnabled;
      }
      if (settings.notes !== undefined) {
        camera.settings.notes = settings.notes;
      }
    }

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
    await OperatorCameraAssignment.deleteMany({ cameraId: camera._id });

    res.status(200).json({
      success: true,
      message: 'Camera moved to trash. Restore it or permanently delete it from the deleted cameras list.',
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

// @desc    Assign operators to a camera (replace existing assignments when replace=true)
// @route   PUT /api/cameras/:id/operators
// @access  Private (Org Admin)
exports.assignOperatorsToCamera = async (req, res, next) => {
  try {
    const { operatorIds, replace = true } = req.body;

    if (!Array.isArray(operatorIds)) {
      return res.status(400).json({
        success: false,
        message: 'operatorIds array is required',
      });
    }

    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    if (camera.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const organizationId = camera.organizationId;

    if (replace) {
      await OperatorCameraAssignment.deleteMany({ cameraId: camera._id });
    }

    if (operatorIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'All operator assignments removed for this camera',
      });
    }

    const operators = await User.find({
      _id: { $in: operatorIds },
      role: 'operator',
      organizationId,
      isDeleted: false,
    });

    if (operators.length !== operatorIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more operators not found or do not belong to the organization',
      });
    }

    if (replace) {
      await OperatorCameraAssignment.insertMany(
        operatorIds.map((operatorId) => ({
          operatorId,
          cameraId: camera._id,
          organizationId,
        }))
      );
    } else {
      const existing = await OperatorCameraAssignment.find({
        cameraId: camera._id,
        operatorId: { $in: operatorIds },
      }).distinct('operatorId');
      const toAdd = operatorIds.filter((id) => !existing.some((e) => e.toString() === id.toString()));
      if (toAdd.length > 0) {
        await OperatorCameraAssignment.insertMany(
          toAdd.map((operatorId) => ({
            operatorId,
            cameraId: camera._id,
            organizationId,
          }))
        );
      }
    }

    const assignments = await OperatorCameraAssignment.find({ cameraId: camera._id })
      .populate('operatorId', 'name email role');

    res.status(200).json({
      success: true,
      data: assignments,
      message: 'Camera operator assignments updated',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List soft-deleted cameras (trash)
// @route   GET /api/cameras/deleted
// @access  Private (Super Admin, Org Admin)
exports.getDeletedCameras = async (req, res, next) => {
  try {
    const query = { isDeleted: true };

    if (req.user.role === 'org_admin') {
      query.organizationId = req.user.organizationId;
    } else if (req.user.role === 'super_admin' && req.query.organizationId) {
      query.organizationId = req.query.organizationId;
    }

    const cameras = await Camera.find(query)
      .populate('organizationId', 'name')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: cameras.length,
      data: cameras,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore soft-deleted camera
// @route   PUT /api/cameras/:id/restore
// @access  Private (Super Admin, Org Admin)
exports.restoreCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera || !camera.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Deleted camera not found',
      });
    }

    if (
      req.user.role === 'org_admin' &&
      camera.organizationId.toString() !== req.user.organizationId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const organization = await Organization.findById(camera.organizationId).populate('subscriptionPlanId');
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const activeCount = await Camera.countDocuments({
      organizationId: camera.organizationId,
      isDeleted: false,
    });
    const maxCameras =
      organization.subscriptionPlanId?.maxCameras ?? organization.maxCameras ?? 0;

    if (activeCount >= maxCameras) {
      return res.status(400).json({
        success: false,
        message: `Cannot restore camera. Plan limit reached (${maxCameras} cameras). Remove another active camera first.`,
      });
    }

    await camera.restore();

    res.status(200).json({
      success: true,
      data: camera,
      message: 'Camera restored successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete a soft-deleted camera
// @route   DELETE /api/cameras/:id/permanent
// @access  Private (Super Admin, Org Admin)
exports.permanentDeleteCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera) {
      return res.status(404).json({
        success: false,
        message: 'Camera not found',
      });
    }

    if (!camera.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Camera must be soft-deleted before it can be permanently deleted',
      });
    }

    if (
      req.user.role === 'org_admin' &&
      camera.organizationId.toString() !== req.user.organizationId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const cameraId = camera._id;

    await OperatorCameraAssignment.deleteMany({ cameraId });
    await Alert.deleteMany({ cameraId });
    await Camera.deleteOne({ _id: cameraId });

    res.status(200).json({
      success: true,
      message: 'Camera permanently deleted',
    });
  } catch (error) {
    next(error);
  }
};
