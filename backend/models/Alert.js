const mongoose = require('mongoose');

const FALSE_ALARM_CAUSES = ['SUNLIGHT_REFLECTION', 'ARTIFICIAL_LIGHT', 'STEAM_FOG_DUST', 'CONTROLLED_FLAME', 'SCREEN_OR_IMAGE', 'OTHER'];

const alertSchema = new mongoose.Schema(
  {
    cameraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    fireConfidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    smokeConfidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Average confidence across a temporal window used for triggering
    averageConfidence: {
      type: Number,
      min: 0,
      max: 100,
    },
    intensityLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    // Lifecycle status
    // Mapping to spec:
    // - active       -> ACTIVE
    // - acknowledged -> ACKNOWLEDGED
    // - resolved     -> RESOLVED
    // - false_alarm  -> FALSE_ALARM
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'false_alarm'],
      default: 'active',
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolutionType: {
      type: String,
      enum: ['EXTINGUISHED', 'EVACUATED', 'TEST_DRILL', 'FALSE_ALARM', 'OTHER'],
      default: 'OTHER',
    },
    resolutionNote: {
      type: String,
      trim: true,
    },
    alertImage: {
      type: String, // URL or path to alert image
    },
    frameSnapshotURL: {
      type: String,
      trim: true,
    },
    coordinates: {
      x: { type: Number },
      y: { type: Number },
    },
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FireIncident',
    },
    primaryClass: {
      type: String,
      enum: ['fire', 'smoke', 'other'],
    },
    boundingBoxes: [
      {
        className: String,
        confidence: Number,
        x: Number,
        y: Number,
        w: Number,
        h: Number,
        // Model score of every class for this box (0–100)
        scores: {
          fire: Number,
          smoke: Number,
          other: Number,
        },
      },
    ],
    metricsSnapshot: {
      detectionFrequencyPerMin: Number,
      estimatedSpreadRate: Number,
      incidentDurationSec: Number,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    isFalseAlarm: {
      type: Boolean,
      default: false,
    },
    // What triggered a false alarm (operator feedback; labels for the false-alarm model)
    falseAlarmCause: {
      type: String,
      enum: FALSE_ALARM_CAUSES,
    },
    // Why the alert was raised (services/alertExplanation.js) and, asynchronously, what the model looked at
    explanation: {
      version: Number,
      decision: {
        rule: String,
        alertClasses: [String],
        confThreshold: Number,
        minConsecutive: Number,
        frameIntervalMs: Number,
        cooldownMs: Number,
        consecutiveFrames: Number,
        streakMeanConfidence: Number,
        frames: [
          {
            _id: false,
            t: Date,
            fire: Number,
            smoke: Number,
            area: Number,
          },
        ],
        severity: {
          level: String,
          basis: { type: String, enum: ['peak_confidence', 'provided'] },
          value: Number,
          thresholds: { critical: Number, high: Number, medium: Number },
        },
        coverage: Number,
        spreadRatePerSec: Number,
        detectionFrequencyPerMin: Number,
      },
      reasons: [
        {
          _id: false,
          code: String,
          text: String,
        },
      ],
      // LayerCAM heatmap produced by the explainer process
      visual: {
        status: { type: String, enum: ['pending', 'processing', 'ready', 'failed', 'skipped'] },
        method: String,
        heatmapURL: String,
        targets: [
          {
            _id: false,
            boxIndex: Number,
            className: String,
            confidence: Number,
            focusInBox: Number,
            peak: { x: Number, y: Number },
          },
        ],
        claimedAt: Date,
        completedAt: Date,
        durationMs: Number,
        modelInfo: String,
        error: String,
      },
      // Advisory false-alarm likelihood with SHAP contributions (never changes severity or suppresses alerts)
      risk: {
        probability: Number,
        level: { type: String, enum: ['low', 'medium', 'high'] },
        modelVersion: String,
        contributions: [
          {
            _id: false,
            feature: String,
            label: String,
            value: Number,
            impact: Number,
          },
        ],
        computedAt: Date,
      },
    },
    // Action history for audit trail
    actions: [
      {
        type: {
          type: String,
          enum: ['CREATED', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'],
          required: true,
        },
        byUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        at: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
alertSchema.index({ cameraId: 1 });
alertSchema.index({ organizationId: 1 });
alertSchema.index({ status: 1 });
alertSchema.index({ timestamp: -1 });
alertSchema.index({ organizationId: 1, status: 1 });
alertSchema.index({ organizationId: 1, timestamp: -1 });

// Compound index for efficient queries
alertSchema.index({ organizationId: 1, status: 1, timestamp: -1 });

// Explainer job queue (only alerts waiting for or being given a heatmap carry a status).
alertSchema.index({ 'explanation.visual.status': 1, 'explanation.visual.claimedAt': 1 }, { sparse: true });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.FALSE_ALARM_CAUSES = FALSE_ALARM_CAUSES;
