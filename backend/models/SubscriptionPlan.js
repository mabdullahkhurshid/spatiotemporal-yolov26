const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    maxCameras: {
      type: Number,
      required: true,
      min: 1,
    },
    maxOperators: {
      type: Number,
      required: true,
      min: 0,
    },
    alertRetentionDays: {
      type: Number,
      required: true,
      min: 1,
    },
    storageLimit: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Storage limit in GB',
    },
    // Billing information
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    // Plan duration in months (e.g. 1, 6, 12)
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'custom'],
      default: 'monthly',
    },
    description: {
      type: String,
      trim: true,
    },
    supportPriority: {
      type: String,
      enum: ['standard', 'priority', 'premium'],
      default: 'standard',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ isActive: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
