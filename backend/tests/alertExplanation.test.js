const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildExplanation, severityFor } = require('../services/alertExplanation');

const evidence = {
  rule: 'consecutive_frames',
  alertClasses: ['fire', 'smoke'],
  confThreshold: 35,
  minConsecutive: 3,
  frameIntervalMs: 500,
  cooldownMs: 60000,
  consecutiveFrames: 3,
  streakMeanConfidence: 82.3,
  frames: [
    { t: 1_000_000, fire: 78, smoke: 0, area: 0.05 },
    { t: 1_000_500, fire: 82, smoke: 40, area: 0.06 },
    { t: 1_001_000, fire: 87, smoke: 62, area: 0.07 },
  ],
};

const codes = (explanation) => explanation.reasons.map((r) => r.code);

test('severity bands are unchanged', () => {
  assert.equal(severityFor(80), 'critical');
  assert.equal(severityFor(79.9), 'high');
  assert.equal(severityFor(60), 'high');
  assert.equal(severityFor(40), 'medium');
  assert.equal(severityFor(10), 'low');
});

test('inference alert explains detection, confirmation, severity, coverage and spread', () => {
  const e = buildExplanation({
    fireConfidence: 87,
    smokeConfidence: 62,
    intensityLevel: 'critical',
    severityValue: 87,
    boundingBoxes: [
      { className: 'fire', confidence: 87, x: 0.1, y: 0.1, w: 0.2, h: 0.2, scores: { fire: 87, other: 9, smoke: 2 } },
      { className: 'smoke', confidence: 62, x: 0.1, y: 0, w: 0.1, h: 0.2 },
      { className: 'other', confidence: 90, x: 0.6, y: 0.6, w: 0.3, h: 0.3 },
    ],
    metricsSnapshot: { estimatedSpreadRate: 0.004, detectionFrequencyPerMin: 3, incidentDurationSec: 95 },
    evidence,
  });

  assert.deepEqual(codes(e), ['detected', 'confirmed', 'severity', 'coverage', 'spread', 'incident']);
  assert.equal(e.decision.frames.length, 3);
  assert.ok(e.decision.frames[0].t instanceof Date);
  // "other" boxes do not count towards the alert's coverage.
  assert.equal(e.decision.coverage, 0.06);
  assert.equal(e.decision.severity.basis, 'peak_confidence');
  assert.match(e.reasons[0].text, /Fire \(87%\) and smoke \(62%\) detected together \(detection threshold 35%\)/);
  assert.match(e.reasons[1].text, /3 consecutive frames over 1\.0 s, averaging 82%.*at least 3 in a row/);
  assert.match(e.reasons[2].text, /Critical.*at or above 80%; below that it would be High/);
  assert.match(e.reasons[3].text, /Fire and smoke regions cover 6% of the frame \(2 boxes\)/);
  assert.match(e.reasons[4].text, /growing by about 0\.4% of the frame per second/);
  assert.match(e.reasons[5].text, /running for 2 min/);
});

test('a high "other" score on the main box is flagged as a possible look-alike', () => {
  const e = buildExplanation({
    fireConfidence: 55,
    intensityLevel: 'medium',
    severityValue: 55,
    boundingBoxes: [{ className: 'fire', confidence: 55, x: 0, y: 0, w: 0.1, h: 0.1, scores: { fire: 55, other: 48, smoke: 1 } }],
    evidence,
  });
  assert.ok(codes(e).includes('lookalike'));
  assert.match(e.reasons.find((r) => r.code === 'lookalike').text, /48% as "other"/);
});

test('API-created alert without evidence still explains detection and provided severity', () => {
  const e = buildExplanation({ fireConfidence: 30, smokeConfidence: 0, intensityLevel: 'high', intensityProvided: true, severityValue: 15 });
  assert.equal(e.decision.rule, 'reported');
  assert.deepEqual(codes(e), ['detected', 'severity']);
  assert.match(e.reasons[0].text, /^Fire detected at 30% confidence\.$/);
  assert.match(e.reasons[1].text, /set by the reporting system/);
});

test('low severity names the band it fell short of', () => {
  const e = buildExplanation({ smokeConfidence: 36, intensityLevel: 'low', severityValue: 36 });
  assert.match(e.reasons.find((r) => r.code === 'severity').text, /Low: peak confidence 36% is below the 40% Medium band/);
});

test('malformed evidence is ignored instead of stored', () => {
  const e = buildExplanation({
    fireConfidence: 50,
    intensityLevel: 'medium',
    severityValue: 50,
    evidence: { frames: 'nope', minConsecutive: 'abc', alertClasses: [] },
  });
  assert.deepEqual(e.decision.frames, []);
  assert.equal(e.decision.minConsecutive, undefined);
  assert.deepEqual(e.decision.alertClasses, ['fire', 'smoke']);
});
