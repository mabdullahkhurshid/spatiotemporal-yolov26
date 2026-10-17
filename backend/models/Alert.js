const mongoose = require('mongoose');

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

module.exports = mongoose.model('Alert', alertSchema);
