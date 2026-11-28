const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const User = require('../models/User');
const Alert = require('../models/Alert');
const FireIncident = require('../models/FireIncident');
const { emitToCameraAudience, invalidateCameraAudience } = require('../sockets/emitters');
const { OnvifError } = require('../services/onvif');
const { applyOnvifConnection, onvifConnectionChanged, sendOnvifError } = require('./onvifController');
const { isDemoType } = require('../utils/demoSource');
const { checkCameraNow, resumeCamera: resumePausedCamera } = require('../services/cameraHealthMonitor');
const { stopFeed: stopPreviewFeed } = require('../services/livePreviewHub');

const MAX_PAUSE_MINUTES = 7 * 24 * 60;

const emitCameraStatus = (req, camera) =>
  emitToCameraAudience(req.io, { organizationId: camera.organizationId, cameraId: camera._id }, 'camera:status:update', {
    cameraId: camera._id,
    status: camera.status,
    pausedUntil: camera.pausedUntil || null,
  });

/** Camera the signed-in admin may change (super admin: any; org admin: own organization), or null after replying. */
async function findOwnCamera(req, res) {
  const camera = await Camera.findById(req.params.id);
  if (!camera || camera.isDeleted) {
    res.status(404).json({ success: false, message: 'Camera not found' });
    return null;
  }
  if (req.user.role === 'org_admin' && camera.organizationId.toString() !== req.user.organizationId?.toString()) {
    res.status(403).json({ success: false, message: 'Not authorized' });
    return null;
  }
  return camera;
}

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
    if (req.deprovisionMode) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription is not active. Renew your plan to add cameras.',
      });
    }

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

    const isOnvif = cameraType === 'onvif';
    // ONVIF cameras get their address and stream from the device itself (below); demo cameras from MediaMTX.
    const deviceStream = isOnvif || isDemoType(cameraType);
    const camera = new Camera({
      name: name || label,
      label: label || name,
      ipAddress: deviceStream ? undefined : ipAddress || undefined,
      streamUrl: deviceStream ? undefined : streamUrl || undefined,
      demo: cameraType === 'demo_feed' ? { clip: req.body.demo.clip } : undefined,
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
    if (isOnvif) {
      await applyOnvifConnection(camera, req.body.onvif);
    }
    await camera.save();

    // Parallel creates can all pass the count check above. Keep only the earliest cameras (by _id)
    // within the plan limit; a camera ranked beyond it is removed again.
    const earlier = await Camera.countDocuments({
      organizationId: orgId,
      isDeleted: false,
      _id: { $lt: camera._id },
    });
    if (earlier >= maxCameras) {
      await Camera.deleteOne({ _id: camera._id });
      return res.status(400).json({
        success: false,
        message: `Camera limit reached. Maximum ${maxCameras} cameras allowed for your plan`,
      });
    }

    // Shows ONLINE as soon as its stream answers, not after the next health cycle.
    checkCameraNow(req.io, camera._id);

    res.status(201).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    if (error instanceof OnvifError) return sendOnvifError(res, error);
    next(error);
  }
};

// @desc    Update camera
// @route   PUT /api/cameras/:id
// @access  Private (Super Admin, Org Admin)
exports.updateCamera = async (req, res, next) => {
  if (req.deprovisionMode) {
    return res.status(403).json({
      success: false,
      message: 'Your subscription is not active. Renew your plan to edit cameras.',
    });
  }

  try {
    let camera = await Camera.findById(req.params.id).select('+onvif.passwordEnc');

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

    const { name, label, ipAddress, streamUrl, location, status, installationDate, metadata, cameraType, displayNumber, settings, onvif } = req.body;
    const wasOnvif = camera.cameraType === 'onvif';
    const willBeOnvif = cameraType !== undefined ? cameraType === 'onvif' : wasOnvif;
    const isDemo = isDemoType(camera.cameraType);

    if (cameraType !== undefined && cameraType !== camera.cameraType && (isDemo || isDemoType(cameraType))) {
      return res.status(400).json({ success: false, message: 'Demo cameras cannot change connection type' });
    }

    if (name !== undefined) camera.name = name;
    if (label !== undefined) camera.label = label;
    if (camera.cameraType === 'demo_feed' && req.body.demo?.clip !== undefined) camera.demo = { clip: req.body.demo.clip };
    // ONVIF address and stream come from the device and demo streams from MediaMTX; they are not edited directly.
    if (!willBeOnvif && !isDemo) {
      if (ipAddress !== undefined) camera.ipAddress = ipAddress;
      if (streamUrl !== undefined) camera.streamUrl = streamUrl;
    }
    if (location !== undefined) camera.location = location;
    const previousStatus = camera.status;
    if (status !== undefined) {
      camera.status = status;
      if (status !== 'paused') camera.pausedUntil = null;
    }
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

    if (willBeOnvif && (!wasOnvif || onvifConnectionChanged(camera, onvif))) {
      if (!wasOnvif && !onvif?.host) {
        return res.status(400).json({ success: false, message: 'Camera IP address or host name is required for ONVIF cameras' });
      }
      await applyOnvifConnection(camera, onvif);
    } else if (wasOnvif && !willBeOnvif) {
      camera.onvif = undefined;
    }

    await camera.save();
    if (camera.status !== previousStatus) await emitCameraStatus(req, camera);
    // Re-check after a stream change or leaving maintenance.
    checkCameraNow(req.io, camera._id);

    res.status(200).json({
      success: true,
      data: camera,
    });
  } catch (error) {
    if (error instanceof OnvifError) return sendOnvifError(res, error);
    next(error);
  }
};

// @desc    Pause a camera: no live view, stream checks or fire detection until resumed
// @route   PUT /api/cameras/:id/pause   body { minutes } (omit for "until resumed")
// @access  Private (Super Admin, Org Admin)
exports.pauseCamera = async (req, res, next) => {
  try {
    const { minutes } = req.body || {};
    if (minutes != null && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_PAUSE_MINUTES)) {
      return res.status(400).json({ success: false, message: `Pause length must be 1 to ${MAX_PAUSE_MINUTES} minutes` });
    }
    const camera = await findOwnCamera(req, res);
    if (!camera) return;
    if (camera.status === 'maintenance') {
      return res.status(409).json({ success: false, message: 'Turn maintenance off before pausing this camera' });
    }

    camera.status = 'paused';
    camera.pausedUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000) : null;
    await camera.save();
    stopPreviewFeed(String(camera._id));
    await emitCameraStatus(req, camera);

    res.status(200).json({ success: true, data: camera });
  } catch (error) {
    next(error);
  }
};

// @desc    Resume a paused camera (live again as soon as its stream answers)
// @route   PUT /api/cameras/:id/resume
// @access  Private (Super Admin, Org Admin)
exports.resumeCamera = async (req, res, next) => {
  try {
    const camera = await findOwnCamera(req, res);
    if (!camera) return;
    if (camera.status !== 'paused') {
      return res.status(200).json({ success: true, data: camera });
    }
    const resumed = await resumePausedCamera(req.io, camera._id);
    res.status(200).json({ success: true, data: resumed || camera });
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

    if (req.user.role !== 'super_admin' && camera.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
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
    const { operatorIds: rawOperatorIds, replace = true } = req.body;

    if (!Array.isArray(rawOperatorIds)) {
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
    const operatorIds = [...new Set(rawOperatorIds.map(String))];

    // Validate before touching existing assignments so a rejected request changes nothing.
    if (operatorIds.length > 0) {
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
    }

    invalidateCameraAudience(camera._id);

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

    // A parallel create/restore may have taken the last slot; undo this restore if now over the limit.
    const afterRestore = await Camera.countDocuments({
      organizationId: camera.organizationId,
      isDeleted: false,
    });
    if (afterRestore > maxCameras) {
      await camera.softDelete();
      return res.status(400).json({
        success: false,
        message: `Cannot restore camera. Plan limit reached (${maxCameras} cameras). Remove another active camera first.`,
      });
    }
    checkCameraNow(req.io, camera._id);

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
    await FireIncident.deleteMany({ cameraId });
    await Camera.deleteOne({ _id: cameraId });

    res.status(200).json({
      success: true,
      message: 'Camera permanently deleted',
    });
  } catch (error) {
    next(error);
  }
};
