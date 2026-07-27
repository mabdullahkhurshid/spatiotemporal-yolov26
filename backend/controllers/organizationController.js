const Organization = require('../models/Organization');
const User = require('../models/User');
const Camera = require('../models/Camera');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// @desc    Get all organizations
// @route   GET /api/organizations
// @access  Private (Super Admin)
exports.getOrganizations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { isDeleted: false };
    if (status) query.status = status;

    const organizations = await Organization.find(query)
      .populate('adminId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('subscriptionPlanId')
      .sort({ createdAt: -1 });

    const orgIds = organizations.map((org) => org._id);

    const [operatorAgg, userAgg] = orgIds.length
      ? await Promise.all([
          User.aggregate([
            {
              $match: {
                organizationId: { $in: orgIds },
                role: 'operator',
                isDeleted: false,
              },
            },
            { $group: { _id: '$organizationId', count: { $sum: 1 } } },
          ]),
          User.aggregate([
            {
              $match: {
                organizationId: { $in: orgIds },
                isDeleted: false,
              },
            },
            { $group: { _id: '$organizationId', count: { $sum: 1 } } },
          ]),
        ])
      : [[], []];

    const operatorCountMap = Object.fromEntries(
      operatorAgg.map((row) => [row._id.toString(), row.count])
    );
    const totalUsersMap = Object.fromEntries(
      userAgg.map((row) => [row._id.toString(), row.count])
    );

    const data = organizations.map((org) => {
      const obj = org.toObject();
      const orgId = org._id.toString();
      return {
        ...obj,
        admin: obj.adminId || null,
        operatorCount: operatorCountMap[orgId] || 0,
        totalUsers: totalUsersMap[orgId] || 0,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single organization
// @route   GET /api/organizations/:id
// @access  Private
exports.getOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('adminId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('subscriptionPlanId');

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check access
    if (req.user.role !== 'super_admin' && organization._id.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Get stats (use plan limits when subscriptionPlanId is set)
    const cameraCount = await Camera.countDocuments({
      organizationId: organization._id,
      isDeleted: false,
    });
    const userCount = await User.countDocuments({
      organizationId: organization._id,
      isDeleted: false,
    });
    const operatorCount = await User.countDocuments({
      organizationId: organization._id,
      role: 'operator',
      isDeleted: false,
    });
    const operators = await User.find({
      organizationId: organization._id,
      role: 'operator',
      isDeleted: false,
    })
      .select('name email')
      .sort({ name: 1 });

    const maxCameras = organization.subscriptionPlanId
      ? organization.subscriptionPlanId.maxCameras
      : organization.maxCameras;
    const maxOperators = organization.subscriptionPlanId
      ? organization.subscriptionPlanId.maxOperators
      : organization.maxOperators || 10;

    const orgObject = organization.toObject();

    res.status(200).json({
      success: true,
      data: {
        ...orgObject,
        admin: orgObject.adminId || null,
        operators,
        stats: {
          cameras: cameraCount,
          users: userCount,
          operators: operatorCount,
          maxCameras,
          maxOperators,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create organization
// @route   POST /api/organizations
// @access  Private (Super Admin)
exports.createOrganization = async (req, res, next) => {
  try {
    const { name, email, phone, address, installationAddress, subscriptionPlanId, subscriptionPlan, adminId } = req.body;

    const orgData = {
      name,
      email,
      phone,
      address,
      installationAddress,
      subscriptionPlan: subscriptionPlan || 'basic',
      adminId: adminId || req.user._id,
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
    };
    if (subscriptionPlanId) {
      const plan = await SubscriptionPlan.findById(subscriptionPlanId);
      if (plan && plan.isActive) {
        orgData.subscriptionPlanId = subscriptionPlanId;
        orgData.maxCameras = plan.maxCameras;
        orgData.maxOperators = plan.maxOperators;
      }
    }
    const organization = await Organization.create(orgData);

    if (adminId) {
      await User.findByIdAndUpdate(adminId, {
        organizationId: organization._id,
        role: 'org_admin',
      });
    }

    res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organization
// @route   PUT /api/organizations/:id
// @access  Private (Super Admin, Org Admin)
exports.updateOrganization = async (req, res, next) => {
  try {
    let organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (req.user.role === 'org_admin' && organization._id.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const { name, email, phone, address, installationAddress, subscriptionPlan, subscriptionStatus, subscriptionPlanId, logo } = req.body;

    // Org Admin can only update profile fields (name, installation address, contact email, logo)
    if (req.user.role === 'org_admin') {
      if (name) organization.name = name;
      if (installationAddress !== undefined) organization.installationAddress = installationAddress;
      if (email) organization.email = email;
      if (phone !== undefined) organization.phone = phone;
      if (logo !== undefined) organization.logo = logo;
      await organization.save();
      return res.status(200).json({ success: true, data: organization });
    }

    // Super Admin can update everything including plan assignment
    if (name) organization.name = name;
    if (email) organization.email = email;
    if (phone !== undefined) organization.phone = phone;
    if (address !== undefined) organization.address = address;
    if (installationAddress !== undefined) organization.installationAddress = installationAddress;
    if (logo !== undefined) organization.logo = logo;
    if (subscriptionPlan && !subscriptionPlanId) {
      organization.subscriptionPlan = subscriptionPlan;
      const limits = { basic: 5, pro: 20, enterprise: 100 };
      organization.maxCameras = limits[subscriptionPlan] || 5;
    }
    if (subscriptionPlanId !== undefined) {
      if (subscriptionPlanId) {
        const plan = await SubscriptionPlan.findById(subscriptionPlanId);
        if (plan && plan.isActive) {
          organization.subscriptionPlanId = subscriptionPlanId;
          organization.maxCameras = plan.maxCameras;
          organization.maxOperators = plan.maxOperators;
        }
      } else {
        organization.subscriptionPlanId = undefined;
      }
    }
    if (subscriptionStatus !== undefined) organization.subscriptionStatus = subscriptionStatus;

    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete organization (soft delete)
// @route   DELETE /api/organizations/:id
// @access  Private (Super Admin)
exports.deleteOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    await organization.softDelete();

    res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve organization (status → ACTIVE)
// @route   PUT /api/organizations/:id/approve
// @access  Private (Super Admin)
exports.approveOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    organization.status = 'ACTIVE';
    organization.approvedBy = req.user._id;
    organization.approvedAt = new Date();
    organization.rejectionReason = undefined;
    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
      message: 'Organization approved',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject organization (status → REJECTED)
// @route   PUT /api/organizations/:id/reject
// @access  Private (Super Admin)
exports.rejectOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    organization.status = 'REJECTED';
    organization.rejectionReason = req.body.rejectionReason || 'Rejected by Super Admin';
    organization.approvedBy = undefined;
    organization.approvedAt = undefined;
    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
      message: 'Organization rejected',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suspend organization (status → SUSPENDED)
// @route   PUT /api/organizations/:id/suspend
// @access  Private (Super Admin)
exports.suspendOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Only active organizations can be suspended',
      });
    }

    organization.status = 'SUSPENDED';
    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
      message: 'Organization suspended',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unsuspend organization (status → ACTIVE)
// @route   PUT /api/organizations/:id/unsuspend
// @access  Private (Super Admin)
exports.unsuspendOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (organization.status !== 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        message: 'Only suspended organizations can be unsuspended',
      });
    }

    organization.status = 'ACTIVE';
    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
      message: 'Organization unsuspended',
    });
  } catch (error) {
    next(error);
  }
};
