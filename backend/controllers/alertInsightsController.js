// Explainability insights for Reports: why false alarms happen, where detections appear, how the model is doing.
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const XaiModelStatus = require('../models/XaiModelStatus');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');

const ALERT_CLASSES = ['fire', 'smoke'];
const REAL_FIRE_OUTCOMES = ['EXTINGUISHED', 'EVACUATED'];
const LOW_FOCUS = 0.5;
// Detection location map resolution (cells across × down the camera view).
const GRID_COLS = 8;
const GRID_ROWS = 6;
const MAX_ALERTS = 5000;
// Defaults of python-services/inference/app/xai/train_risk.py, used until the explainer reports its own.
const DEFAULT_REQUIREMENTS = { minSamples: 150, minPerClass: 30, minAuc: 0.6 };

const outcomeOf = (alert) => {
  if (alert.status === 'false_alarm') return 'falseAlarm';
  if (alert.status === 'resolved' && REAL_FIRE_OUTCOMES.includes(alert.resolutionType)) return 'real';
  return null;
};

const primaryFocus = (alert) => {
  const visual = alert.explanation?.visual;
  if (visual?.status !== 'ready' || !visual.targets?.length) return undefined;
  const best = [...visual.targets].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  return typeof best.focusInBox === 'number' ? best.focusInBox : undefined;
};

const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

function locationGrid(alerts) {
  const cells = () => new Array(GRID_COLS * GRID_ROWS).fill(0);
  const grid = { all: cells(), real: cells(), falseAlarm: cells() };
  for (const alert of alerts) {
    const outcome = outcomeOf(alert);
    for (const box of alert.boundingBoxes || []) {
      if (!ALERT_CLASSES.includes(box.className)) continue;
      const cx = Math.min(0.999, Math.max(0, (box.x || 0) + (box.w || 0) / 2));
      const cy = Math.min(0.999, Math.max(0, (box.y || 0) + (box.h || 0) / 2));
      const index = Math.floor(cy * GRID_ROWS) * GRID_COLS + Math.floor(cx * GRID_COLS);
      grid.all[index] += 1;
      if (outcome) grid[outcome][index] += 1;
    }
  }
  return grid;
}

async function modelStatus(user, scopedLabelled) {
  const [status, falseAlarms, realFires] = await Promise.all([
    XaiModelStatus.findOne({ key: 'risk' }).lean(),
    Alert.countDocuments({ status: 'false_alarm' }),
    Alert.countDocuments({ status: 'resolved', resolutionType: { $in: REAL_FIRE_OUTCOMES } }),
  ]);
  const req = { ...DEFAULT_REQUIREMENTS, ...Object.fromEntries(Object.entries(status?.requirements || {}).filter(([, v]) => typeof v === 'number')) };
  const progress = Math.min(
    1,
    (falseAlarms + realFires) / req.minSamples,
    falseAlarms / req.minPerClass,
    realFires / req.minPerClass
  );
  const model = {
    state: status?.active ? 'active' : 'learning',
    version: status?.version,
    trainedAt: status?.trainedAt,
    rocAuc: status?.metrics?.rocAuc,
    lastResult: status?.lastResult,
    attemptedAt: status?.attemptedAt,
    requirements: req,
    labelProgress: Math.round(Math.max(0, progress) * 100),
    // Labels contributed from the caller's own scope.
    labelledHere: scopedLabelled,
  };
  // The model is trained across all organizations; only platform admins see platform-wide counts.
  if (user.role === 'super_admin') {
    Object.assign(model, { labels: { falseAlarms, realFires }, metrics: status?.metrics, message: status?.message });
  }
  return model;
}

// @desc    Explainability insights (OPERATOR: only assigned cameras)
// @route   GET /api/alerts/insights?days=&cameraId=
// @access  Private
exports.getAlertInsights = async (req, res, next) => {
  try {
    const match = {};
    if (req.user.role === 'org_admin' || req.user.role === 'operator') {
      match.organizationId = req.user.organizationId;
    }
    if (req.user.role === 'operator') {
      match.cameraId = { $in: await OperatorCameraAssignment.find({ operatorId: req.user._id }).distinct('cameraId') };
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
    const alerts = await Alert.find({ ...match, timestamp: { $gte: new Date(Date.now() - days * 86400000) } })
      .select('cameraId status resolutionType falseAlarmCause boundingBoxes frameSnapshotURL timestamp explanation.reasons explanation.visual.status explanation.visual.targets')
      .populate('cameraId', 'name label location displayNumber')
      .sort({ timestamp: -1 })
      .limit(MAX_ALERTS)
      .lean();

    const focusValues = [];
    const causes = {};
    const byCamera = new Map();
    let falseAlarms = 0;
    let closed = 0;
    let explained = 0;
    let lookalikes = 0;
    let labelled = 0;

    for (const alert of alerts) {
      const camId = String(alert.cameraId?._id || alert.cameraId);
      if (!byCamera.has(camId)) {
        byCamera.set(camId, { camera: alert.cameraId, alerts: [], focus: [], falseAlarms: 0, closed: 0, lookalikes: 0, causes: {} });
      }
      const cam = byCamera.get(camId);
      cam.alerts.push(alert);

      const isClosed = alert.status === 'resolved' || alert.status === 'false_alarm';
      if (isClosed) {
        closed += 1;
        cam.closed += 1;
      }
      if (outcomeOf(alert)) labelled += 1;
      if (alert.status === 'false_alarm') {
        falseAlarms += 1;
        cam.falseAlarms += 1;
        const cause = alert.falseAlarmCause || 'UNSPECIFIED';
        causes[cause] = (causes[cause] || 0) + 1;
        cam.causes[cause] = (cam.causes[cause] || 0) + 1;
      }
      if (alert.explanation?.reasons?.some((r) => r.code === 'lookalike')) {
        lookalikes += 1;
        cam.lookalikes += 1;
      }
      const focus = primaryFocus(alert);
      if (focus !== undefined) {
        explained += 1;
        focusValues.push(focus);
        cam.focus.push(focus);
      }
    }

    const cameras = [...byCamera.entries()]
      .map(([cameraId, cam]) => {
        const topCause = Object.entries(cam.causes).sort((a, b) => b[1] - a[1])[0];
        return {
          cameraId,
          name: cam.camera?.name || cam.camera?.label || 'Unknown camera',
          location: cam.camera?.location || '',
          alerts: cam.alerts.length,
          closed: cam.closed,
          falseAlarms: cam.falseAlarms,
          falseAlarmRate: cam.closed ? cam.falseAlarms / cam.closed : null,
          topCause: topCause ? { cause: topCause[0], count: topCause[1] } : null,
          avgFocus: mean(cam.focus),
          lookalikes: cam.lookalikes,
        };
      })
      .sort((a, b) => b.alerts - a.alerts);

    // Location map for one camera: every camera has its own view, so maps are never merged.
    const requested = mongoose.isValidObjectId(req.query.cameraId) ? String(req.query.cameraId) : null;
    const mapCameraId = requested && byCamera.has(requested) ? requested : cameras[0]?.cameraId;
    const mapAlerts = mapCameraId ? byCamera.get(mapCameraId).alerts : [];
    const background = mapAlerts.find((a) => a.frameSnapshotURL)?.frameSnapshotURL || null;

    res.status(200).json({
      success: true,
      data: {
        days,
        summary: {
          alerts: alerts.length,
          closed,
          falseAlarms,
          falseAlarmRate: closed ? falseAlarms / closed : 0,
          explained,
          avgFocus: mean(focusValues),
          lowFocus: focusValues.filter((f) => f < LOW_FOCUS).length,
          lookalikes,
        },
        causes: Object.entries(causes)
          .map(([cause, count]) => ({ cause, count }))
          .sort((a, b) => b.count - a.count),
        cameras,
        locations: mapCameraId
          ? { cameraId: mapCameraId, cols: GRID_COLS, rows: GRID_ROWS, backgroundURL: background, ...locationGrid(mapAlerts) }
          : null,
        model: await modelStatus(req.user, labelled),
      },
    });
  } catch (error) {
    next(error);
  }
};
