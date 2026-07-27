const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const AuditLog = require('../models/AuditLog');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies or Authorization header
    if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token (include isVerified for route guards)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user || req.user.isDeleted || !req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists or is inactive',
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Only ACTIVE organizations can access the system (non-super_admin)
exports.requireActiveOrganization = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin' || req.user.role === 'customer') return next();
    if (!req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to an organization.',
      });
    }
    const org = await Organization.findOne({
      _id: req.user.organizationId,
      isDeleted: false,
    });
    if (!org || org.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your organization is not active. Please contact support.',
      });
    }
    req.organization = org;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Require active, non-expired subscription for organization users
exports.requireActiveSubscription = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin' || req.user.role === 'customer') return next();
    if (!req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to an organization.',
      });
    }

    const org = await Organization.findOne({
      _id: req.user.organizationId,
      isDeleted: false,
    });

    if (!org) {
      return res.status(403).json({
        success: false,
        message: 'Organization not found.',
      });
    }

    // Auto-expire subscriptions based on end date
    const now = new Date();
    if (org.subscriptionEndDate && org.subscriptionEndDate < now && org.subscriptionStatus !== 'expired') {
      org.subscriptionStatus = 'expired';
      await org.save();
    }

    if (org.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your organization is suspended. Please contact support.',
      });
    }

    if (!org.subscriptionStatus || org.subscriptionStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your subscription is not active. Please renew your plan.',
      });
    }

    req.organization = org;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Approval gate removed from self-service flow (ADR-002). Super Admin verify endpoint remains for manual edge cases.
exports.requireVerifiedUser = (req, res, next) => {
  next();
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user belongs to organization
exports.checkOrganizationAccess = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const user = req.user;

    // Super admin has access to all organizations
    if (user.role === 'super_admin') {
      return next();
    }

    // Users without organizationId cannot access organization-specific routes
    if (!user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to an organization. Please contact an administrator.',
      });
    }

    // Check if user belongs to the organization
    if (user.organizationId.toString() === organizationId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this organization',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Audit logging middleware
exports.auditLog = async (req, res, next) => {
  const originalSend = res.json;

  res.json = function (data) {
    // Log after response is sent
    if (req.user && req.statusCode !== 401 && req.statusCode !== 403) {
      const auditData = {
        userId: req.user._id,
        organizationId: req.user.organizationId,
        action: req.method.toLowerCase() + '_' + req.route?.path?.replace(/\/:id/g, '') || 'unknown',
        resource: req.route?.path?.split('/')[1] || 'unknown',
        resourceId: req.params.id,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      AuditLog.create(auditData).catch((err) => console.error('Audit log error:', err));
    }

    return originalSend.call(this, data);
  };

  next();
};
