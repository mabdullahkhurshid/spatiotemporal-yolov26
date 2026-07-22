const User = require('../models/User');
const Organization = require('../models/Organization');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

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

    // Unverified org_admin/operator can only view own profile
    if ((req.user.role === 'org_admin' || req.user.role === 'operator') && !req.user.isVerified) {
      if (req.params.id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Account pending verification. You can only view your own profile.',
        });
      }
    } else if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    } else if (req.user.role === 'operator' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Operators can only view their own profile',
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
      if (role !== 'operator' || organizationId !== req.user.organizationId.toString()) {
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

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'operator',
      organizationId: organizationId || req.user.organizationId,
      isVerified: req.user.role === 'super_admin', // Super Admin-created users are pre-approved
    });

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
    let user = await User.findById(req.params.id);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Unverified org_admin/operator can only update own profile (limited: name only)
    if ((req.user.role === 'org_admin' || req.user.role === 'operator') && !req.user.isVerified) {
      if (req.params.id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Account pending verification. You can only update your own profile.',
        });
      }
      const { name } = req.body;
      if (name) user.name = name;
      await user.save();
      return res.status(200).json({ success: true, data: user });
    }

    // Check access
    if (req.user.role === 'org_admin' && user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
    if (req.user.role === 'operator' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Operators can only update their own profile',
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
    const { name, role, isActive } = req.body;
    if (name) user.name = name;
    if (role && req.user.role === 'super_admin') user.role = role;
    if (isActive !== undefined && req.user.role !== 'operator') user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user. Super Admin deleting Operator = hard delete; otherwise soft delete.
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

    // Super Admin deleting Operator: permanent (hard) delete so email can be reused and login is blocked immediately
    if (req.user.role === 'super_admin' && user.role === 'operator') {
      const deletedUserId = user._id;
      const deletedUserEmail = user.email;
      const deletedUserName = user.name;

      await OperatorCameraAssignment.deleteMany({ operatorId: deletedUserId });
      await Notification.deleteMany({ userId: deletedUserId });

      await AuditLog.create({
        userId: req.user._id,
        organizationId: user.organizationId,
        action: 'delete',
        resource: 'user',
        resourceId: deletedUserId,
        details: {
          type: 'operator_hard_delete',
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
        message: 'Operator permanently deleted. Their email is now available for new signup.',
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
