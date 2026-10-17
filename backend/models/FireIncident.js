const mongoose = require('mongoose');

const bboxAreaPointSchema = new mongoose.Schema(
  {
    t: { type: Date, required: true },
    area: { type: Number, default: 0 },
  },
  { _id: false }
);

const fireIncidentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    cameraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
    },
    startedAt: {
      type: Date,
      required: true,
    },
    lastSeenAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    peakFireConfidence: { type: Number, default: 0, min: 0, max: 100 },
    peakSmokeConfidence: { type: Number, default: 0, min: 0, max: 100 },
    detectionFrequencyPerMin: { type: Number, default: 0 },
    estimatedSpreadRate: { type: Number, default: 0 },
    bboxAreaTimeline: [bboxAreaPointSchema],
    linkedAlertIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert',
      },
    ],
    lastSnapshotURL: { type: String, trim: true },
  },
  { timestamps: true }
);

fireIncidentSchema.index({ organizationId: 1, status: 1, startedAt: -1 });
fireIncidentSchema.index({ cameraId: 1, status: 1 });

module.exports = mongoose.model('FireIncident', fireIncidentSchema);
