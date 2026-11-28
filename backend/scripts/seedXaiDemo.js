// Development only: fill one camera with labelled sample alerts so the explainability features
// (Reports insights, false-alarm likelihood training) can be seen before real operator feedback exists.
//
//   node backend/scripts/seedXaiDemo.js                     # list cameras
//   node backend/scripts/seedXaiDemo.js --camera <id> [--count 220]
//   node backend/scripts/seedXaiDemo.js --remove            # delete every seeded alert
//
// Seeded alerts are marked with the resolution note "XAI demo seed". After --remove, also delete
// python-services/inference/weights/risk_model.joblib if a model was trained on them.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const Camera = require('../models/Camera');
const { buildExplanation, severityFor } = require('../services/alertExplanation');

const MARK = 'XAI demo seed';
const DAY = 86400000;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1] || true;
};

// Deterministic so repeated seeds give the same picture.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (weighted) => {
  let r = rand() * weighted.reduce((s, [, w]) => s + w, 0);
  for (const [value, w] of weighted) {
    r -= w;
    if (r <= 0) return value;
  }
  return weighted[weighted.length - 1][0];
};
const round = (n, d = 2) => Number(n.toFixed(d));

function sampleAlert(camera, index, count) {
  const kind = pick([
    ['false_alarm', 40],
    ['real', 55],
    ['drill', 5],
  ]);
  const falseAlarm = kind === 'false_alarm';
  // Spread over the last 60 days, oldest first.
  const day = new Date(Date.now() - 60 * DAY + (index / count) * 59 * DAY);
  const hour = falseAlarm ? Math.floor(between(16, 20)) : Math.floor(between(0, 24));
  const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(between(0, 60)));

  // Sample patterns: false alarms are small, high in the frame (lamps, sun glare), rarely with smoke
  // and with a higher "other" score; real fires grow and usually show smoke.
  const fire = round(between(50, 95));
  const smoke = falseAlarm ? (rand() < 0.15 ? round(between(36, 60)) : 0) : rand() < 0.7 ? round(between(40, 90)) : 0;
  const w = falseAlarm ? between(0.04, 0.12) : between(0.1, 0.35);
  const h = falseAlarm ? between(0.04, 0.12) : between(0.12, 0.4);
  const x = falseAlarm ? between(0.55, 0.85) : between(0.1, 0.6);
  const y = falseAlarm ? between(0.02, 0.2) : between(0.4, 0.95 - h);
  const other = round(falseAlarm ? between(20, 70) : between(0, 18));
  const boxes = [{ className: 'fire', confidence: fire, x: round(x, 4), y: round(y, 4), w: round(w, 4), h: round(h, 4), scores: { fire, other, smoke: 1 } }];
  if (smoke) {
    boxes.push({ className: 'smoke', confidence: smoke, x: round(x, 4), y: round(Math.max(0, y - h), 4), w: round(w * 1.3, 4), h: round(h, 4), scores: { fire: 2, other: 3, smoke } });
  }

  const peak = Math.max(fire, smoke);
  const spread = falseAlarm ? between(-0.0003, 0.0003) : between(0.001, 0.01);
  const t0 = timestamp.getTime() - 1000;
  const evidence = {
    rule: 'consecutive_frames',
    alertClasses: ['fire', 'smoke'],
    confThreshold: 35,
    minConsecutive: 3,
    frameIntervalMs: 500,
    cooldownMs: 60000,
    consecutiveFrames: 3,
    streakMeanConfidence: round(peak - between(0, 6)),
    frames: [0, 1, 2].map((i) => ({ t: t0 + i * 500, fire: round(fire - (2 - i) * between(0, 3)), smoke, area: round(w * h, 6) })),
  };
  const metricsSnapshot = { detectionFrequencyPerMin: Math.round(falseAlarm ? between(3, 20) : between(10, 110)), estimatedSpreadRate: round(spread, 6) };
  const intensityLevel = severityFor(peak);
  const explanation = buildExplanation({
    fireConfidence: fire,
    smokeConfidence: smoke,
    intensityLevel,
    severityValue: peak,
    boundingBoxes: boxes,
    metricsSnapshot,
    evidence,
  });
  explanation.visual = {
    status: 'ready',
    method: 'layercam',
    modelInfo: MARK,
    targets: [{ boxIndex: 0, className: 'fire', confidence: fire, focusInBox: round(falseAlarm ? between(0.25, 0.65) : between(0.65, 0.98), 4), peak: { x: round(x + w / 2, 4), y: round(y + h / 2, 4) } }],
  };

  const resolvedAt = new Date(timestamp.getTime() + between(5, 40) * 60000);
  const outcome = {
    false_alarm: {
      status: 'false_alarm',
      resolutionType: 'FALSE_ALARM',
      isFalseAlarm: true,
      falseAlarmCause: pick([
        ['SUNLIGHT_REFLECTION', 40],
        ['ARTIFICIAL_LIGHT', 30],
        ['STEAM_FOG_DUST', 15],
        ['CONTROLLED_FLAME', 15],
      ]),
    },
    real: { status: 'resolved', resolutionType: pick([['EXTINGUISHED', 70], ['EVACUATED', 30]]) },
    drill: { status: 'resolved', resolutionType: 'TEST_DRILL' },
  }[kind];

  return {
    cameraId: camera._id,
    organizationId: camera.organizationId,
    fireConfidence: fire,
    smokeConfidence: smoke,
    averageConfidence: peak,
    intensityLevel,
    primaryClass: 'fire',
    boundingBoxes: boxes,
    metricsSnapshot,
    explanation,
    timestamp,
    resolvedAt,
    resolutionNote: MARK,
    ...outcome,
    actions: [
      { type: 'CREATED', at: timestamp, note: MARK },
      { type: outcome.status === 'false_alarm' ? 'FALSE_ALARM' : 'RESOLVED', at: resolvedAt, note: MARK },
    ],
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo alerts with NODE_ENV=production');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  if (arg('remove')) {
    const { deletedCount } = await Alert.deleteMany({ resolutionNote: MARK, 'actions.note': MARK });
    console.log(`Removed ${deletedCount} seeded alerts.`);
    return;
  }

  const cameraId = arg('camera');
  if (!cameraId || cameraId === true) {
    const cameras = await Camera.find({ isDeleted: false }).select('_id name location organizationId').lean();
    console.log(cameras.length ? 'Pass --camera <id>. Cameras:' : 'No cameras yet. Add one in the app first.');
    cameras.forEach((c) => console.log(`  ${c._id}  ${c.name} (${c.location})`));
    return;
  }

  const camera = await Camera.findOne({ _id: cameraId, isDeleted: false });
  if (!camera) throw new Error(`Camera ${cameraId} not found`);
  const count = Math.min(2000, Math.max(1, parseInt(arg('count'), 10) || 220));
  const docs = Array.from({ length: count }, (_, i) => sampleAlert(camera, i, count));
  await Alert.insertMany(docs);
  const falseAlarms = docs.filter((d) => d.status === 'false_alarm').length;
  console.log(`Seeded ${count} closed alerts on "${camera.name}" (${falseAlarms} false alarms), marked "${MARK}".`);
  console.log('Next: npm run train:risk (or restart the explainer), then open Reports.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
