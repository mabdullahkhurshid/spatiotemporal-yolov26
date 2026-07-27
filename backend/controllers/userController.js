const User = require('../models/User');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { sendOperatorWelcomeEmail } = require('../services/emailService');

// @desc    Portal account summary (user + org + subscription)
// @route   GET /api/users/me/account-summary
// @access  Private (customer, org_admin)
exports.getAccountSummary = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role !== 'customer' && user.role !== 'org_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const summary = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        organizationId: user.organizationId,
      },
      organization: null,
      subscription: null,
      orders: [],
      usage: null,
      flags: {
        hasOrganization: false,
        hasActiveSubscription: false,
        isOrgSuspended: false,
        isSubscriptionExpired: false,
      },
    };

    if (!user.organizationId) {
      return res.status(200).json({
        success: true,
        data: summary,
      });
    }

    const organization = await Organization.findById(user.organizationId).populate('subscriptionPlanId');

    if (!organization || organization.isDeleted) {
      return res.status(200).json({
        success: true,
        data: summary,
      });
    }

    const now = new Date();
    if (
      organization.subscriptionEndDate &&
      organization.subscriptionEndDate < now &&
      organization.subscriptionStatus === 'active'
    ) {
      organization.subscriptionStatus = 'expired';
      await organization.save();
    }

    let subscription = await Subscription.findOne({ organizationId: user.organizationId }).populate('planId');

    if (subscription && subscription.endDate < now && subscription.status === 'active') {
      subscription.status = 'expired';
      await subscription.save();
    }

    const orders = await Order.find({ organizationId: user.organizationId })
      .sort({ createdAt: -1 })
      .lean();

    const plan = subscription?.planId || organization.subscriptionPlanId;
    const isOrgSuspended = organization.status === 'SUSPENDED';
    const isSubscriptionExpired =
      subscription?.status === 'expired' ||
      organization.subscriptionStatus === 'expired' ||
      (subscription?.endDate && new Date(subscription.endDate) < now);

    const hasActiveSubscription =
      !isOrgSuspended &&
      !isSubscriptionExpired &&
      organization.status === 'ACTIVE' &&
      (subscription?.status === 'active' || organization.subscriptionStatus === 'active');

    summary.organization = {
      id: organization._id,
      name: organization.name,
      email: organization.email,
      phone: organization.phone,
      status: organization.status,
      subscriptionStatus: organization.subscriptionStatus,
      subscriptionStartDate: organization.subscriptionStartDate,
      subscriptionEndDate: organization.subscriptionEndDate,
      maxCameras: organization.maxCameras,
      maxOperators: organization.maxOperators,
    };

    summary.subscription = subscription
      ? {
          id: subscription._id,
          plan: subscription.plan,
          planDetails: plan,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          price: subscription.price,
          billingCycle: subscription.billingCycle,
        }
      : null;

    summary.orders = orders;
    summary.usage = {
      camerasUsed: subscription?.camerasUsed ?? 0,
      operatorsUsed: subscription?.operatorsUsed ?? 0,
      maxCameras: organization.maxCameras ?? plan?.maxCameras ?? 0,
      maxOperators: organization.maxOperators ?? plan?.maxOperators ?? 0,
    };

    summary.flags = {
      hasOrganization: true,
      hasActiveSubscription,
      isOrgSuspended,
      isSubscriptionExpired,
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Super Admin, Org Admin)
exports.getUsers = async (req, res, next) => {
  try {
    let query = { isDeleted: false };

    // Org admin can only see users in their organization
    if (req.user.role === 'org_admin') {
      query.organizationId = req.user.organizationId;
    }

    // Super admin can see all
    if (req.user.role === 'super_admin') {
      delete query.organizationId;
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .populate('organizationId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken')
      .populate('organizationId');

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    } else if (req.user.role === 'operator' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Operators can only view their own profile',
      });
    } else if (req.user.role === 'customer' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private (Super Admin, Org Admin)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, organizationId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Org admin can only create operators in their org
    if (req.user.role === 'org_admin') {
      const targetOrgId = organizationId || req.user.organizationId?.toString();
      if (role !== 'operator' || targetOrgId !== req.user.organizationId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create this user',
        });
      }
    }

    // Enforce maxOperators limit based on organization subscription
    const targetOrgId = organizationId || req.user.organizationId;
    if (role === 'operator' && targetOrgId) {
      const org = await Organization.findById(targetOrgId).populate('subscriptionPlanId');
      if (!org) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
        });
      }
      const operatorCount = await User.countDocuments({
        organizationId: targetOrgId,
        role: 'operator',
        isDeleted: false,
      });
      const maxOperators = org.subscriptionPlanId ? org.subscriptionPlanId.maxOperators : org.maxOperators || 10;
      if (operatorCount >= maxOperators) {
        return res.status(400).json({
          success: false,
          message: `Operator limit reached. Maximum ${maxOperators} operators allowed for your plan`,
        });
      }
    }

    const plainPassword = password;
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'operator',
      organizationId: organizationId || req.user.organizationId,
      isVerified: true,
      isEmailVerified: true,
    });

    if (user.role === 'operator') {
      try {
        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
        await sendOperatorWelcomeEmail(user, plainPassword, loginUrl);
      } catch (emailError) {
        console.error('Operator welcome email error:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = async (req, res, next) => {
  try {
    const { name, role, isActive, phone, avatar, password } = req.body;
    const needsPassword = password !== undefined && password !== '';
    let user = await User.findById(req.params.id).select(needsPassword ? '+password' : '');

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check access
    if (req.user.role === 'org_admin') {
      if (user.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized',
        });
      }
      if (user.role !== 'operator') {
        return res.status(403).json({
          success: false,
          message: 'Org Admin can only update operators',
        });
      }
    }
    if (req.user.role === 'operator' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Operators can only update their own profile',
      });
    }
    if (req.user.role === 'customer' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Super admin cannot modify another super_admin
    if (req.user.role === 'super_admin' && user.role === 'super_admin' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify another Super Admin',
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar || null;
    if (role && req.user.role === 'super_admin') user.role = role;
    if (isActive !== undefined && req.user.role !== 'operator') user.isActive = isActive;
    if (needsPassword) {
      if (req.user.role === 'super_admin' || (req.user.role === 'org_admin' && user.role === 'operator') || req.params.id === req.user._id.toString()) {
        user.password = password;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to change password',
        });
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user. Super Admin = hard delete; Org Admin deleting operator = hard delete; otherwise soft delete.
// @route   DELETE /api/users/:id
// @access  Private (Super Admin, Org Admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete a Super Admin',
      });
    }

    if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const isSuperAdminDelete = req.user.role === 'super_admin';
    const isOrgAdminDeletingOwnOperator =
      user.role === 'operator' &&
      req.user.role === 'org_admin' &&
      user.organizationId?.toString() === req.user.organizationId?.toString();

    if (isSuperAdminDelete || isOrgAdminDeletingOwnOperator) {
      const deletedUserId = user._id;
      const deletedUserEmail = user.email;
      const deletedUserName = user.name;

      if (user.role === 'operator') {
        await OperatorCameraAssignment.deleteMany({ operatorId: deletedUserId });
      }

      await Notification.deleteMany({ userId: deletedUserId });

      if (user.role === 'org_admin' && user.organizationId) {
        await Organization.updateOne(
          { _id: user.organizationId, adminId: deletedUserId },
          { $unset: { adminId: '' } }
        );
      }

      await AuditLog.create({
        userId: req.user._id,
        organizationId: user.organizationId,
        action: 'delete',
        resource: 'user',
        resourceId: deletedUserId,
        details: {
          type: 'user_hard_delete',
          deletedUserRole: user.role,
          deletedUserEmail,
          deletedUserName,
          deletedAt: new Date(),
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      await User.deleteOne({ _id: deletedUserId });

      return res.status(200).json({
        success: true,
        message: isSuperAdminDelete
          ? 'User permanently deleted. Their email is now available for new signup.'
          : 'Operator permanently deleted. Their email is now available for new signup.',
      });
    }

    await user.softDelete();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify user (Super Admin approves org_admin/operator)
// @route   PUT /api/users/:id/verify
// @access  Private (Super Admin)
exports.verifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin does not require verification',
      });
    }

    user.isVerified = true;
    user.verifiedBy = req.user._id;
    user.verifiedAt = new Date();
    await user.save();

    // Optional real-time notify for manual Super Admin verify (no self-service listener)
    if (req.io) {
      req.io.to(`user:${user._id}`).emit('user:verified', {
        userId: user._id,
        role: user.role,
        isVerified: true,
        message: 'Your account has been approved.',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
      message: 'User verified',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suspend user
// @route   PUT /api/users/:id/suspend
// @access  Private (Super Admin, Org Admin for operators in org)
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot suspend a Super Admin',
      });
    }

    if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
    if (req.user.role === 'org_admin' && user.role === 'org_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot suspend another Org Admin',
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      data: user,
      message: 'User suspended',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reactivate user
// @route   PUT /api/users/:id/reactivate
// @access  Private (Super Admin, Org Admin for operators in org)
exports.reactivateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot reactivate a Super Admin',
      });
    }

    if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({
      success: true,
      data: user,
      message: 'User reactivated',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password (Super Admin only)
// @route   PUT /api/users/:id/reset-password
// @access  Private (Super Admin)
exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'super_admin' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset another Super Admin password',
      });
    }

    user.password = req.body.password;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};
