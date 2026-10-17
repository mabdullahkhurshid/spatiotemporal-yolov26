const fs = require('fs');
const path = require('path');
const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const FireIncident = require('../models/FireIncident');
const { createAlertFromDetection } = require('../services/alertCreationService');

const liveEmitThrottleMs = parseInt(process.env.INFERENCE_LIVE_EMIT_MS, 10) || 400;
const lastLiveEmitByCamera = new Map();

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads', 'snapshots');

function ensureUploadsDir(orgId) {
  const dir = path.join(uploadsRoot, String(orgId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveSnapshot(orgId, cameraId, base64) {
  if (!base64) return null;
  const dir = ensureUploadsDir(orgId);
  const filename = `${cameraId}-${Date.now()}.jpg`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  return `/uploads/snapshots/${orgId}/${filename}`;
}

async function getActiveOrgIds() {
  const orgs = await Organization.find({ status: 'ACTIVE', isDeleted: false }).select('_id');
  const orgIds = orgs.map((o) => o._id);
  const subs = await Subscription.find({
    organizationId: { $in: orgIds },
    status: 'active',
    endDate: { $gte: new Date() },
  }).distinct('organizationId');
  return subs.map(String);
}

exports.getInferenceCameras = async (req, res, next) => {
  try {
    const activeOrgIds = await getActiveOrgIds();
    const cameras = await Camera.find({
      organizationId: { $in: activeOrgIds },
      isDeleted: false,
      isActive: true,
      streamUrl: { $exists: true, $ne: '' },
      'settings.detectionEnabled': { $ne: false },
    }).select('_id name label location streamUrl cameraType organizationId settings displayNumber');

    res.status(200).json({ success: true, count: cameras.length, data: cameras });
  } catch (error) {
    next(error);
  }
};

async function upsertActiveIncident(camera, metrics, detections) {
  let incident = await FireIncident.findOne({
    cameraId: camera._id,
    organizationId: camera.organizationId,
    status: 'active',
  }).sort({ startedAt: -1 });

  const startedAt = metrics.startedAt ? new Date(metrics.startedAt) : new Date();
  const lastSeenAt = metrics.lastSeenAt ? new Date(metrics.lastSeenAt) : new Date();

  if (!incident && metrics.incidentActive) {
    incident = await FireIncident.create({
      organizationId: camera.organizationId,
      cameraId: camera._id,
      status: 'active',
      startedAt,
      lastSeenAt,
      peakFireConfidence: metrics.fireConfidence || 0,
      peakSmokeConfidence: metrics.smokeConfidence || 0,
      detectionFrequencyPerMin: metrics.detectionFrequencyPerMin || 0,
      estimatedSpreadRate: metrics.estimatedSpreadRate || 0,
    });
  } else if (incident) {
    incident.lastSeenAt = lastSeenAt;
    incident.peakFireConfidence = Math.max(incident.peakFireConfidence, metrics.fireConfidence || 0);
    incident.peakSmokeConfidence = Math.max(incident.peakSmokeConfidence, metrics.smokeConfidence || 0);
    incident.detectionFrequencyPerMin = metrics.detectionFrequencyPerMin || 0;
    incident.estimatedSpreadRate = metrics.estimatedSpreadRate || 0;
    const area = detections
      .filter((d) => d.className === 'fire' || d.className === 'smoke')
      .reduce((sum, d) => sum + (d.w || 0) * (d.h || 0), 0);
    if (area > 0) {
      incident.bboxAreaTimeline.push({ t: new Date(), area });
      if (incident.bboxAreaTimeline.length > 200) {
        incident.bboxAreaTimeline = incident.bboxAreaTimeline.slice(-200);
      }
    }
    await incident.save();
  }

  return incident;
}

exports.ingestDetection = async (req, res, next) => {
  try {
    const {
      cameraId,
      detections = [],
      metrics = {},
      streamStatus,
      snapshotBase64,
      incidentEnded,
    } = req.body;

    const camera = await Camera.findById(cameraId);
    if (!camera || camera.isDeleted) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }

    const now = new Date();
    camera.inference = camera.inference || {};
    camera.inference.lastDetectionAt = now;
    camera.inference.streamStatus = streamStatus || 'ok';
    camera.inference.fireConfidence = metrics.fireConfidence || 0;
    camera.inference.smokeConfidence = metrics.smokeConfidence || 0;
    camera.inference.boxes = detections;
    camera.inference.detectionFrequencyPerMin = metrics.detectionFrequencyPerMin || 0;
    camera.inference.estimatedSpreadRate = metrics.estimatedSpreadRate || 0;

    camera.markModified('inference');
    if (streamStatus === 'ok') {
      camera.inference.status = 'ok';
      await camera.updateActivity();
    } else {
      camera.inference.status = 'degraded';
      await camera.save();
    }

    let incident = null;
    if (metrics.incidentActive) {
      incident = await upsertActiveIncident(camera, metrics, detections);
      if (incident) {
        camera.inference.activeIncidentId = incident._id;
        camera.inference.incidentStartedAt = incident.startedAt;
        await camera.save();
      }
    }

    if (incidentEnded) {
      const active = await FireIncident.findOne({
        cameraId: camera._id,
        status: 'active',
      }).sort({ startedAt: -1 });
      if (active) {
        active.status = 'ended';
        active.endedAt = new Date();
        await active.save();
        req.io.to(`org:${camera.organizationId}`).emit('incident:ended', {
          incidentId: active._id,
          cameraId: camera._id,
        });
      }
      camera.inference.activeIncidentId = null;
      await camera.save();
    }

    const throttleKey = String(camera._id);
    const lastEmit = lastLiveEmitByCamera.get(throttleKey) || 0;
    if (Date.now() - lastEmit >= liveEmitThrottleMs) {
      lastLiveEmitByCamera.set(throttleKey, Date.now());
      req.io.to(`org:${camera.organizationId}`).emit('detection:live', {
        cameraId: camera._id,
        timestamp: now.toISOString(),
        detections,
        metrics: {
          fireConfidence: metrics.fireConfidence,
          smokeConfidence: metrics.smokeConfidence,
          detectionFrequencyPerMin: metrics.detectionFrequencyPerMin,
          estimatedSpreadRate: metrics.estimatedSpreadRate,
          incidentStartedAt: camera.inference.incidentStartedAt,
          activeIncidentId: camera.inference.activeIncidentId,
        },
      });
    }

    let alert = null;
    if (metrics.createAlert) {
      const snapshotUrl = saveSnapshot(camera.organizationId, camera._id, snapshotBase64);
      if (snapshotUrl && incident) {
        incident.lastSnapshotURL = snapshotUrl;
        await incident.save();
      }

      const primaryDetection = detections.find((d) => d.className === 'fire' || d.className === 'smoke');
      alert = await createAlertFromDetection({
        io: req.io,
        camera,
        fireConfidence: metrics.fireConfidence || 0,
        smokeConfidence: metrics.smokeConfidence || 0,
        averageConfidence: metrics.averageConfidence,
        frameSnapshotURL: snapshotUrl,
        boundingBoxes: detections,
        incidentId: incident?._id,
        primaryClass: primaryDetection?.className,
        metricsSnapshot: {
          detectionFrequencyPerMin: metrics.detectionFrequencyPerMin,
          estimatedSpreadRate: metrics.estimatedSpreadRate,
        },
        actionNote: 'Alert created by inference service',
      });

      if (incident && alert) {
        incident.linkedAlertIds.push(alert._id);
        await incident.save();
        req.io.to(`org:${camera.organizationId}`).emit('incident:updated', { incident });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        incidentId: incident?._id,
        alertId: alert?._id,
      },
    });
  } catch (error) {
    next(error);
  }
};
