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
      trim: true,
      match: [
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        'Please provide a valid IP address',
      ],
    },
    cameraType: {
      type: String,
      enum: ['ip_rtsp', 'http_mjpeg', 'onvif'],
      default: 'ip_rtsp',
    },
    displayNumber: {
      type: String,
      trim: true,
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
    // ONVIF connection. streamUrl holds the device-reported RTSP address without credentials; the
    // password is encrypted (utils/secretBox) and only added server-side when a stream is opened.
    onvif: {
      host: { type: String, trim: true },
      port: { type: Number, min: 1, max: 65535 },
      username: { type: String, trim: true },
      passwordEnc: { type: String, select: false },
      hasPassword: { type: Boolean },
      profileToken: { type: String, trim: true },
      profileName: { type: String, trim: true },
      deviceInfo: {
        manufacturer: { type: String },
        model: { type: String },
        firmwareVersion: { type: String },
        serialNumber: { type: String },
        hardwareId: { type: String },
      },
      lastSyncedAt: { type: Date },
    },
    settings: {
      detectionEnabled: { type: Boolean, default: true },
      notes: { type: String, trim: true },
    },
    inference: {
      lastDetectionAt: { type: Date },
      streamStatus: { type: String, enum: ['ok', 'degraded', 'idle'], default: 'idle' },
      status: { type: String, enum: ['ok', 'degraded', 'offline', 'idle'], default: 'idle' },
      fireConfidence: { type: Number, default: 0 },
      smokeConfidence: { type: Number, default: 0 },
      detectionFrequencyPerMin: { type: Number, default: 0 },
      estimatedSpreadRate: { type: Number, default: 0 },
      incidentStartedAt: { type: Date },
      activeIncidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FireIncident' },
      boxes: [
        {
          className: String,
          confidence: Number,
          x: Number,
          y: Number,
          w: Number,
          h: Number,
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: {
      // A document returned by create()/save() still holds the encrypted password; never serialize it.
      transform(doc, ret) {
        if (ret.onvif) delete ret.onvif.passwordEnc;
        return ret;
      },
    },
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

cameraSchema.methods.restore = function () {
  this.isDeleted = false;
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
