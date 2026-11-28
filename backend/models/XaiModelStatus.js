const mongoose = require('mongoose');

// Latest state of the false-alarm likelihood model, reported by the explainer after each training attempt.
const xaiModelStatusSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'risk' },
    active: { type: Boolean, default: false },
    version: String,
    trainedAt: Date,
    metrics: {
      rocAuc: Number,
      brier: Number,
      samples: Number,
      falseAlarms: Number,
      folds: Number,
    },
    lastResult: { type: String, enum: ['loaded', 'trained', 'not_enough_labels', 'low_auc', 'error'] },
    message: { type: String, trim: true },
    requirements: {
      minSamples: Number,
      minPerClass: Number,
      minAuc: Number,
    },
    attemptedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('XaiModelStatus', xaiModelStatusSchema);
