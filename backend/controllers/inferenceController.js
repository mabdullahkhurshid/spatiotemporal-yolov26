const fs = require('fs');
const path = require('path');
const Camera = require('../models/Camera');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const FireIncident = require('../models/FireIncident');
const { createAlertFromDetection } = require('../services/alertCreationService');
const { emitToCameraAudience } = require('../sockets/emitters');
const { checkStreamSource } = require('../utils/streamSource');
const { DEMO_TYPES, isDemoType, demoCamerasEnabled, resolveStreamUrl } = require('../utils/demoSource');

const liveEmitThrottleMs = parseInt(process.env.INFERENCE_LIVE_EMIT_MS, 10) || 400;
const lastLiveEmitByCamera = new Map();

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads', 'snapshots');

// Decoded snapshots above this size are refused (the JSON body limit is 10 MB of base64).
const MAX_SNAPSHOT_BYTES = 7 * 1024 * 1024;
const isJpeg = (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

/**
 * Stores a JPEG snapshot and returns its URL, or null when there is none or it is not a usable JPEG.
 * A bad snapshot never blocks the alert: the alert is created without an image.
 */
async function saveSnapshot(orgId, cameraId, base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_SNAPSHOT_BYTES || !isJpeg(buffer)) {
    console.warn(`Ignoring invalid snapshot for camera ${cameraId} (${buffer.length} bytes)`);
    return null;
  }
  try {
    const dir = path.join(uploadsRoot, String(orgId));
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `${cameraId}-${Date.now()}.jpg`;
    await fs.promises.writeFile(path.join(dir, filename), buffer);
    return `/uploads/snapshots/${orgId}/${filename}`;
  } catch (error) {
    console.error(`Could not store snapshot for camera ${cameraId}:`, error.message);
    return null;
  }
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
      $or: [{ streamUrl: { $exists: true, $ne: '' } }, { cameraType: { $in: DEMO_TYPES } }],
      'settings.detectionEnabled': { $ne: false },
      // Paused cameras get no detection: the worker stops within one registry poll.
      status: { $ne: 'paused' },
    }).select('_id name label location streamUrl cameraType organizationId settings displayNumber demo onvif.username +onvif.passwordEnc');

    // Also covers cameras saved before the stream-source policy existed.
    const allowed = cameras
      .filter((camera) => {
        // Demo streams come from server config (MediaMTX), not a user URL.
        if (isDemoType(camera.cameraType)) return demoCamerasEnabled() && Boolean(resolveStreamUrl(camera));
        const source = checkStreamSource(camera.streamUrl);
        if (!source.ok) {
          console.warn(`Inference skipped camera ${camera._id}: ${source.message}`);
        }
        return source.ok;
      })
      // The worker (API-key authenticated) needs the ONVIF credentials to open the stream.
      .map((camera) => {
        const { onvif, ...rest } = camera.toObject();
        return { ...rest, streamUrl: resolveStreamUrl(camera) };
      });

    res.status(200).json({ success: true, count: allowed.length, data: allowed });
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

    const audience = { organizationId: camera.organizationId, cameraId: camera._id };
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
      const previousStatus = camera.status;
      await camera.updateActivity();
      // Without this the dashboard keeps showing OFFLINE: the stream check only emits on its own changes.
      if (camera.status !== previousStatus) {
        await emitToCameraAudience(req.io, audience, 'camera:status:update', {
          cameraId: camera._id,
          status: camera.status,
          lastHeartbeat: camera.lastHeartbeat,
          lastActivity: camera.lastActivity,
        });
      }
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
        await emitToCameraAudience(req.io, audience, 'incident:ended', {
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
      // Raw detection frames go to the org and assigned operators only (not super admins).
      await emitToCameraAudience(
        req.io,
        audience,
        'detection:live',
        {
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
        },
        { superAdmins: false }
      );
    }

    let alert = null;
    if (metrics.createAlert) {
      const snapshotUrl = await saveSnapshot(camera.organizationId, camera._id, snapshotBase64);
      if (snapshotUrl && incident) {
        incident.lastSnapshotURL = snapshotUrl;
        await incident.save();
      }

      const primaryDetection = detections.find((d) => d.className === 'fire' || d.className === 'smoke');
      const incidentDurationSec = incident?.startedAt ? Math.max(0, Math.round((now - incident.startedAt) / 1000)) : undefined;
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
          incidentDurationSec,
        },
        evidence: metrics.evidence,
        // The explainer process (python -m app.xai.main) turns the snapshot into a heatmap later.
        visualPending: process.env.XAI_ENABLED === 'true' && Boolean(snapshotUrl && primaryDetection),
        actionNote: 'Alert created by inference service',
      });

      if (incident && alert) {
        incident.linkedAlertIds.push(alert._id);
        await incident.save();
        await emitToCameraAudience(req.io, audience, 'incident:updated', { incident });
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
