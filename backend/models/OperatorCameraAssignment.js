const mongoose = require('mongoose');

const operatorCameraAssignmentSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
  },
  { timestamps: true }
);

operatorCameraAssignmentSchema.index({ operatorId: 1, cameraId: 1 }, { unique: true });
operatorCameraAssignmentSchema.index({ organizationId: 1 });
operatorCameraAssignmentSchema.index({ cameraId: 1 });

module.exports = mongoose.model('OperatorCameraAssignment', operatorCameraAssignmentSchema);
