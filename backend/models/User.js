const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const refreshSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    // Previous token stays valid briefly so parallel refreshes (e.g. two tabs) don't log the user out.
    prevTokenHash: { type: String },
    rotatedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'org_admin', 'operator', 'customer'],
      default: 'customer',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false, // Optional during registration, can be assigned later
    },
    googleId: {
      type: String,
      sparse: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      comment: 'Super Admin verification for org_admin/operator access',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    // Secrets are stored as SHA-256 hashes and never returned by default queries.
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
    },
    // Legacy single refresh token (pre multi-session); migrated into refreshSessions on next refresh.
    refreshToken: {
      type: String,
      select: false,
    },
    // One entry per signed-in device/browser.
    refreshSessions: {
      type: [refreshSessionSchema],
      default: [],
      select: false,
    },
    // One-time Google sign-in code exchanged by the SPA for a session.
    oauthLoginCodeHash: {
      type: String,
      select: false,
    },
    oauthLoginCodeExpires: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (email index is automatically created by unique: true)
userSchema.index({ organizationId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ isVerified: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, parseInt(process.env.BCRYPT_ROUNDS || 12));
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Soft delete
userSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
