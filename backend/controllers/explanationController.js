// Internal API for the explainer process (python -m app.xai.main): heatmap jobs and false-alarm training data.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const XaiModelStatus = require('../models/XaiModelStatus');
const { emitToCameraAudience } = require('../sockets/emitters');

// A claimed job that has not been answered by then is handed out again (explainer crashed or restarted).
const CLAIM_STALE_MS = 5 * 60 * 1000;
const MAX_CLAIM = 5;
const MAX_TARGETS = 10;
const MAX_CONTRIBUTIONS = 5;
const CLOSED_STATUSES = ['resolved', 'false_alarm'];
const RISK_LEVELS = ['low', 'medium', 'high'];
const SUBMIT_STATUSES = ['ready', 'failed', 'skipped'];

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads', 'explanations');

const clamp01 = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined;
};
const finite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};
const text = (value, max = 120) => (typeof value === 'string' ? value.slice(0, max) : undefined);

/** Closed alerts on the camera before `before`: the camera's own false-alarm track record. */
async function cameraHistory(cameraId, before) {
  const [row] = await Alert.aggregate([
    { $match: { cameraId, status: { $in: CLOSED_STATUSES }, timestamp: { $lt: before }, resolvedAt: { $lt: before } } },
    { $group: { _id: null, closed: { $sum: 1 }, falseAlarms: { $sum: { $cond: [{ $eq: ['$status', 'false_alarm'] }, 1, 0] } } } },
  ]);
  return { closed: row?.closed || 0, falseAlarms: row?.falseAlarms || 0 };
}

// @desc    Claim alerts waiting for a heatmap
// @route   POST /api/internal/inference/explanations/claim
// @access  Inference service (API key)
exports.claimExplanations = async (req, res, next) => {
  try {
    const limit = Math.min(MAX_CLAIM, Math.max(1, parseInt(req.body?.limit, 10) || 1));
    const jobs = [];
    for (let i = 0; i < limit; i += 1) {
      const now = new Date();
      // Atomic claim: two explainers never receive the same alert.
      const alert = await Alert.findOneAndUpdate(
        {
          $or: [
            { 'explanation.visual.status': 'pending' },
            { 'explanation.visual.status': 'processing', 'explanation.visual.claimedAt': { $lt: new Date(now - CLAIM_STALE_MS) } },
          ],
        },
        { $set: { 'explanation.visual.status': 'processing', 'explanation.visual.claimedAt': now } },
        { sort: { timestamp: -1 }, new: true }
      ).select('_id cameraId frameSnapshotURL boundingBoxes timestamp fireConfidence smokeConfidence metricsSnapshot explanation.decision');
      if (!alert) break;

      jobs.push({
        alertId: alert._id,
        snapshotURL: alert.frameSnapshotURL,
        boundingBoxes: alert.boundingBoxes,
        // Inputs for the false-alarm likelihood model (same fields the training export provides).
        features: {
          timestamp: alert.timestamp,
          fireConfidence: alert.fireConfidence,
          smokeConfidence: alert.smokeConfidence,
          metricsSnapshot: alert.metricsSnapshot,
          decision: alert.explanation?.decision,
          cameraHistory: await cameraHistory(alert.cameraId, alert.timestamp),
        },
      });
    }
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    next(error);
  }
};

function saveHeatmap(orgId, alertId, base64) {
  const buffer = Buffer.from(base64, 'base64');
  // JPEG only: the file is served as a static asset next to the snapshots.
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const dir = path.join(uploadsRoot, String(orgId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${alertId}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/explanations/${orgId}/${filename}`;
}

const sanitizeTargets = (targets) =>
  (Array.isArray(targets) ? targets : []).slice(0, MAX_TARGETS).map((t) => ({
    boxIndex: Number.isInteger(t?.boxIndex) ? t.boxIndex : undefined,
    className: text(t?.className, 20),
    confidence: finite(t?.confidence),
    focusInBox: clamp01(t?.focusInBox),
    peak: { x: clamp01(t?.peak?.x), y: clamp01(t?.peak?.y) },
  }));

function sanitizeRisk(risk) {
  if (!risk || typeof risk !== 'object') return undefined;
  const probability = clamp01(risk.probability);
  if (probability === undefined || !RISK_LEVELS.includes(risk.level)) return undefined;
  return {
    probability,
    level: risk.level,
    modelVersion: text(risk.modelVersion, 60),
    contributions: (Array.isArray(risk.contributions) ? risk.contributions : []).slice(0, MAX_CONTRIBUTIONS).map((c) => ({
      feature: text(c?.feature, 60),
      label: text(c?.label, 160),
      value: finite(c?.value),
      impact: finite(c?.impact),
    })),
    computedAt: new Date(),
  };
}

// @desc    Store the explainer's result for a claimed alert
// @route   POST /api/internal/inference/explanations/:alertId
// @access  Inference service (API key)
exports.submitExplanation = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    if (!mongoose.isValidObjectId(alertId)) {
      return res.status(400).json({ success: false, message: 'Invalid alert id' });
    }
    const { status, heatmapBase64, targets, durationMs, modelInfo, error, method, risk } = req.body || {};
    if (!SUBMIT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Use one of: ${SUBMIT_STATUSES.join(', ')}` });
    }

    const alert = await Alert.findOne({ _id: alertId, 'explanation.visual.status': 'processing' }).select('_id organizationId cameraId');
    if (!alert) {
      return res.status(409).json({ success: false, message: 'Alert is not waiting for an explanation' });
    }

    const set = {
      'explanation.visual.status': status,
      'explanation.visual.completedAt': new Date(),
      'explanation.visual.durationMs': finite(durationMs),
      'explanation.visual.modelInfo': text(modelInfo),
      'explanation.visual.error': status === 'ready' ? undefined : text(error, 300) || status,
    };
    if (text(method, 30)) set['explanation.visual.method'] = text(method, 30);

    if (status === 'ready') {
      const heatmapURL = typeof heatmapBase64 === 'string' ? saveHeatmap(alert.organizationId, alert._id, heatmapBase64) : null;
      if (!heatmapURL) {
        return res.status(400).json({ success: false, message: 'A JPEG heatmap is required when status is ready' });
      }
      set['explanation.visual.heatmapURL'] = heatmapURL;
      set['explanation.visual.targets'] = sanitizeTargets(targets);
    }
    const cleanRisk = sanitizeRisk(risk);
    if (cleanRisk) set['explanation.risk'] = cleanRisk;

    const update = { $set: Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined)) };
    if (status === 'ready') update.$unset = { 'explanation.visual.error': '' };

    // Only the claimed state may be completed, so a re-queued job cannot overwrite a newer result.
    const updated = await Alert.findOneAndUpdate({ _id: alert._id, 'explanation.visual.status': 'processing' }, update, {
      new: true,
    }).select('_id organizationId cameraId explanation');
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Alert is not waiting for an explanation' });
    }

    await emitToCameraAudience(
      req.io,
      { organizationId: updated.organizationId, cameraId: updated.cameraId },
      'alert:explained',
      { alertId: updated._id, explanation: updated.explanation }
    );

    res.status(200).json({ success: true, data: { alertId: updated._id, status } });
  } catch (err) {
    next(err);
  }
};

const MODEL_RESULTS = ['loaded', 'trained', 'not_enough_labels', 'low_auc', 'error'];

// @desc    Record the false-alarm model's state after a training attempt (shown in Reports)
// @route   POST /api/internal/inference/explanations/model-status
// @access  Inference service (API key)
exports.reportModelStatus = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!MODEL_RESULTS.includes(body.lastResult)) {
      return res.status(400).json({ success: false, message: `Invalid lastResult. Use one of: ${MODEL_RESULTS.join(', ')}` });
    }
    const metrics = body.metrics || {};
    const requirements = body.requirements || {};
    const trainedAt = body.trainedAt ? new Date(body.trainedAt) : undefined;
    const status = await XaiModelStatus.findOneAndUpdate(
      { key: 'risk' },
      {
        $set: {
          active: Boolean(body.active),
          version: text(body.version, 60),
          trainedAt: trainedAt && !Number.isNaN(trainedAt.getTime()) ? trainedAt : undefined,
          metrics: {
            rocAuc: finite(metrics.rocAuc),
            brier: finite(metrics.brier),
            samples: finite(metrics.samples),
            falseAlarms: finite(metrics.falseAlarms),
            folds: finite(metrics.folds),
          },
          lastResult: body.lastResult,
          message: text(body.message, 300),
          requirements: {
            minSamples: finite(requirements.minSamples),
            minPerClass: finite(requirements.minPerClass),
            minAuc: finite(requirements.minAuc),
          },
          attemptedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

// @desc    Closed alerts with their outcome, for training the false-alarm likelihood model
// @route   GET /api/internal/inference/explanations/training-data
// @access  Inference service (API key)
exports.getTrainingData = async (req, res, next) => {
  try {
    const limit = Math.min(20000, Math.max(1, parseInt(req.query.limit, 10) || 5000));
    const alerts = await Alert.find({ status: { $in: CLOSED_STATUSES } })
      .select(
        'cameraId timestamp resolvedAt status resolutionType falseAlarmCause fireConfidence smokeConfidence boundingBoxes metricsSnapshot explanation.decision explanation.visual.targets'
      )
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    next(error);
  }
};
