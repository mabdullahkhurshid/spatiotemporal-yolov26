// Decision trace for an alert: which rule fired, on what evidence, and why it got its severity.
// The text is generated from stored numbers so the UI, notifications and emails say the same thing.

// Severity from the alert frame's peak confidence (highest band first).
const SEVERITY_BANDS = [
  { level: 'critical', min: 80 },
  { level: 'high', min: 60 },
  { level: 'medium', min: 40 },
  { level: 'low', min: 0 },
];
const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const ALERT_CLASSES = ['fire', 'smoke'];
const MAX_FRAMES = 10;
// An "other" score this high on an alert box means the model also saw a non-fire look-alike.
const OTHER_SCORE_NOTICE = 25;
// Spread below this (fraction of the frame per second) is treated as steady.
const SPREAD_NOTICE = 0.0005;

const severityFor = (confidence) => SEVERITY_BANDS.find((band) => confidence >= band.min).level;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const pct = (value, digits = 0) => `${Number(value).toFixed(digits)}%`;
const areaPct = (fraction) => pct(fraction * 100, fraction * 100 < 1 ? 1 : 0);
const seconds = (s) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.round(s / 60)} min`);
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function severityTrace(level, value, provided) {
  const thresholds = Object.fromEntries(SEVERITY_BANDS.filter((b) => b.min > 0).map((b) => [b.level, b.min]));
  return { level, basis: provided ? 'provided' : 'peak_confidence', value, thresholds };
}

function severityReason(severity) {
  const label = SEVERITY_LABEL[severity.level] || severity.level;
  if (severity.basis === 'provided') {
    return `Severity ${label} was set by the reporting system.`;
  }
  const index = SEVERITY_BANDS.findIndex((b) => b.level === severity.level);
  const band = SEVERITY_BANDS[index];
  const lower = SEVERITY_BANDS[index + 1];
  const value = pct(severity.value);
  if (!lower) {
    return `Severity ${label}: peak confidence ${value} is below the ${SEVERITY_BANDS[index - 1].min}% Medium band.`;
  }
  return `Severity ${label}: peak confidence ${value} is at or above ${band.min}%; below that it would be ${SEVERITY_LABEL[lower.level]}.`;
}

/**
 * Build `alert.explanation` (decision + reasons).
 * `evidence` is the inference worker's metrics.evidence and is absent for alerts created through the API.
 */
function buildExplanation({
  fireConfidence = 0,
  smokeConfidence = 0,
  intensityLevel,
  intensityProvided = false,
  severityValue,
  boundingBoxes = [],
  metricsSnapshot = {},
  evidence,
}) {
  const ev = evidence && typeof evidence === 'object' ? evidence : {};
  const alertClasses = Array.isArray(ev.alertClasses) && ev.alertClasses.length ? ev.alertClasses.map(String) : ALERT_CLASSES;
  const alertBoxes = (boundingBoxes || []).filter((b) => alertClasses.includes(b.className));
  const frames = (Array.isArray(ev.frames) ? ev.frames : [])
    .slice(-MAX_FRAMES)
    .map((f) => ({ t: new Date(num(f.t) ?? Date.now()), fire: num(f.fire) ?? 0, smoke: num(f.smoke) ?? 0, area: num(f.area) ?? 0 }));
  const coverage = alertBoxes.reduce((sum, b) => sum + (num(b.w) || 0) * (num(b.h) || 0), 0);

  const decision = {
    rule: typeof ev.rule === 'string' ? ev.rule : 'reported',
    alertClasses,
    confThreshold: num(ev.confThreshold),
    minConsecutive: num(ev.minConsecutive),
    frameIntervalMs: num(ev.frameIntervalMs),
    cooldownMs: num(ev.cooldownMs),
    consecutiveFrames: num(ev.consecutiveFrames),
    streakMeanConfidence: num(ev.streakMeanConfidence),
    frames,
    severity: severityTrace(intensityLevel, severityValue, intensityProvided),
    coverage: Number(coverage.toFixed(6)),
    spreadRatePerSec: num(metricsSnapshot.estimatedSpreadRate),
    detectionFrequencyPerMin: num(metricsSnapshot.detectionFrequencyPerMin),
  };

  const reasons = [];
  const threshold = decision.confThreshold !== undefined ? ` (detection threshold ${pct(decision.confThreshold)})` : '';
  if (fireConfidence > 0 && smokeConfidence > 0) {
    reasons.push({ code: 'detected', text: `Fire (${pct(fireConfidence)}) and smoke (${pct(smokeConfidence)}) detected together${threshold}.` });
  } else if (fireConfidence > 0 || smokeConfidence > 0) {
    const [name, value] = fireConfidence > 0 ? ['Fire', fireConfidence] : ['Smoke', smokeConfidence];
    reasons.push({ code: 'detected', text: `${name} detected at ${pct(value)} confidence${threshold}.` });
  }

  const count = decision.consecutiveFrames || frames.length;
  if (decision.rule === 'consecutive_frames' && count) {
    const span =
      frames.length >= 2
        ? (frames[frames.length - 1].t - frames[0].t) / 1000
        : ((count - 1) * (decision.frameIntervalMs || 0)) / 1000;
    const mean = decision.streakMeanConfidence ? `, averaging ${pct(decision.streakMeanConfidence)}` : '';
    const rule = decision.minConsecutive ? ` (rule: at least ${decision.minConsecutive} in a row)` : '';
    reasons.push({ code: 'confirmed', text: `Confirmed in ${count} consecutive frames over ${seconds(span)}${mean}${rule}.` });
  }

  if (intensityLevel && severityValue !== undefined) {
    reasons.push({ code: 'severity', text: severityReason(decision.severity) });
  }

  if (coverage > 0) {
    const names = [...new Set(alertBoxes.map((b) => b.className))];
    const boxes = alertBoxes.length === 1 ? '1 box' : `${alertBoxes.length} boxes`;
    reasons.push({ code: 'coverage', text: `${capitalize(names.join(' and '))} regions cover ${areaPct(coverage)} of the frame (${boxes}).` });
  }

  const spread = decision.spreadRatePerSec;
  if (spread !== undefined && Math.abs(spread) >= SPREAD_NOTICE) {
    const direction = spread > 0 ? 'growing' : 'shrinking';
    reasons.push({ code: 'spread', text: `The detected area is ${direction} by about ${areaPct(Math.abs(spread))} of the frame per second.` });
  }

  const incidentSec = num(metricsSnapshot.incidentDurationSec);
  if (incidentSec && incidentSec >= 1) {
    reasons.push({ code: 'incident', text: `Part of an incident on this camera that has been running for ${seconds(incidentSec)}.` });
  }

  const primary = [...alertBoxes].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  const other = num(primary?.scores?.other);
  if (other !== undefined && other >= OTHER_SCORE_NOTICE) {
    reasons.push({
      code: 'lookalike',
      text: `The model also scored the main region ${pct(other)} as "other" (its non-fire class), so check the snapshot for look-alikes such as lights or reflections.`,
    });
  }

  return { version: 1, decision, reasons };
}

module.exports = { buildExplanation, severityFor, SEVERITY_BANDS, ALERT_CLASSES, OTHER_SCORE_NOTICE };
