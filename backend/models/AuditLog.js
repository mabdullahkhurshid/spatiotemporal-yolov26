const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'register',
        'password_reset',
        'email_verify',
        'camera_add',
        'camera_update',
        'camera_delete',
        'alert_resolve',
        'alert_false_alarm',
        'order_approve',
        'order_reject',
        'subscription_update',
      ],
    },
    resource: {
      type: String,
      required: true,
      enum: ['user', 'organization', 'camera', 'alert', 'order', 'subscription'],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ organizationId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
