const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Camera name is required'],
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
      match: [
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        'Please provide a valid IP address',
      ],
    },
    streamUrl: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Camera location is required'],
      trim: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'online', 'offline', 'maintenance'],
      default: 'OFFLINE',
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    installationDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    metadata: {
      model: { type: String },
      resolution: { type: String },
      fps: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
cameraSchema.index({ organizationId: 1 });
cameraSchema.index({ status: 1 });
cameraSchema.index({ isDeleted: 1 });
cameraSchema.index({ ipAddress: 1 });
cameraSchema.index({ lastHeartbeat: 1 });

// Soft delete
cameraSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

// Update last activity and heartbeat
cameraSchema.methods.updateActivity = function () {
  const now = new Date();
  this.lastActivity = now;
  this.lastHeartbeat = now;
  this.status = 'ONLINE';
  return this.save();
};

module.exports = mongoose.model('Camera', cameraSchema);
