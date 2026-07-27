const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Camera = require('../models/Camera');
const User = require('../models/User');
const Order = require('../models/Order');

const attachUsageCounts = async (plans) => {
  const planIds = plans.map((p) => p._id);
  const orgCounts = await Organization.aggregate([
    { $match: { subscriptionPlanId: { $in: planIds }, isDeleted: false } },
    { $group: { _id: '$subscriptionPlanId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(orgCounts.map((o) => [o._id.toString(), o.count]));

  return plans.map((plan) => {
    const obj = plan.toObject ? plan.toObject() : plan;
    return { ...obj, organizationsUsing: countMap[plan._id.toString()] || 0 };
  });
};

// @desc    Get all subscription plans
// @route   GET /api/subscription-plans
// @access  Private (Super Admin: all with includeInactive; others: active only)
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    let query = { isActive: true };
    if (req.user.role === 'super_admin' && req.query.includeInactive === 'true') {
      query = {};
    }

    const plans = await SubscriptionPlan.find(query).sort({ displayOrder: 1, price: 1, createdAt: -1 });

    let data = plans;
    if (req.user.role === 'super_admin') {
      data = await attachUsageCounts(plans);
    }

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single subscription plan
// @route   GET /api/subscription-plans/:id
// @access  Private
exports.getSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create subscription plan
// @route   POST /api/subscription-plans
// @access  Private (Super Admin)
exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      maxCameras,
      maxOperators,
      alertRetentionDays,
      storageLimit,
      supportPriority,
      price,
      currency,
      durationMonths,
      billingCycle,
      description,
      displayOrder,
      isPopular,
      isRecommended,
    } = req.body;

    if (price !== undefined && Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price cannot be negative' });
    }
    if (durationMonths !== undefined && Number(durationMonths) < 1) {
      return res.status(400).json({ success: false, message: 'Duration must be at least 1 month' });
    }

    const finalSlug = slug || name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const existingName = await SubscriptionPlan.findOne({ name: name?.trim() });
    if (existingName) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
    }

    const plan = await SubscriptionPlan.create({
      name,
      slug: finalSlug,
      maxCameras: maxCameras ?? 5,
      maxOperators: maxOperators ?? 10,
      alertRetentionDays: alertRetentionDays ?? 30,
      storageLimit: storageLimit ?? 10,
      supportPriority: supportPriority || 'standard',
      price: price ?? 0,
      currency: (currency || 'USD').toUpperCase(),
      durationMonths: durationMonths ?? 1,
      billingCycle: billingCycle || 'monthly',
      description,
      displayOrder: displayOrder ?? 0,
      isPopular: !!isPopular,
      isRecommended: !!isRecommended,
    });

    res.status(201).json({
      success: true,
      data: plan,
      message: 'Subscription plan created',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update subscription plan
// @route   PUT /api/subscription-plans/:id
// @access  Private (Super Admin)
exports.updateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      });
    }

    const {
      name,
      slug,
      maxCameras,
      maxOperators,
      alertRetentionDays,
      storageLimit,
      supportPriority,
      isActive,
      price,
      currency,
      durationMonths,
      billingCycle,
      description,
      displayOrder,
      isPopular,
      isRecommended,
    } = req.body;

    if (price !== undefined && Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price cannot be negative' });
    }
    if (durationMonths !== undefined && Number(durationMonths) < 1) {
      return res.status(400).json({ success: false, message: 'Duration must be at least 1 month' });
    }

    if (name && name.trim() !== plan.name) {
      const dup = await SubscriptionPlan.findOne({ name: name.trim(), _id: { $ne: plan._id } });
      if (dup) {
        return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
      }
      plan.name = name.trim();
    }

    // Validate limits against current org usage when lowering limits
    if (maxCameras !== undefined || maxOperators !== undefined) {
      const orgs = await Organization.find({ subscriptionPlanId: plan._id, isDeleted: false });
      for (const org of orgs) {
        const cameraCount = await Camera.countDocuments({ organizationId: org._id, isDeleted: false });
        const operatorCount = await User.countDocuments({
          organizationId: org._id,
          role: 'operator',
          isDeleted: false,
        });
        const newMaxCameras = maxCameras !== undefined ? maxCameras : plan.maxCameras;
        const newMaxOperators = maxOperators !== undefined ? maxOperators : plan.maxOperators;
        if (cameraCount > newMaxCameras) {
          return res.status(400).json({
            success: false,
            message: `Cannot set camera limit below current usage (${cameraCount} cameras in use by ${org.name})`,
          });
        }
        if (operatorCount > newMaxOperators) {
          return res.status(400).json({
            success: false,
            message: `Cannot set operator limit below current usage (${operatorCount} operators in use by ${org.name})`,
          });
        }
      }
    }

    if (slug !== undefined) plan.slug = slug;
    if (maxCameras !== undefined) plan.maxCameras = maxCameras;
    if (maxOperators !== undefined) plan.maxOperators = maxOperators;
    if (alertRetentionDays !== undefined) plan.alertRetentionDays = alertRetentionDays;
    if (storageLimit !== undefined) plan.storageLimit = storageLimit;
    if (supportPriority !== undefined) plan.supportPriority = supportPriority;
    if (isActive !== undefined) plan.isActive = isActive;
    if (price !== undefined) plan.price = price;
    if (currency !== undefined) plan.currency = currency.toUpperCase();
    if (durationMonths !== undefined) plan.durationMonths = durationMonths;
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (description !== undefined) plan.description = description;
    if (displayOrder !== undefined) plan.displayOrder = displayOrder;
    if (isPopular !== undefined) plan.isPopular = isPopular;
    if (isRecommended !== undefined) plan.isRecommended = isRecommended;

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Subscription plan updated',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate subscription plan
// @route   PUT /api/subscription-plans/:id/deactivate
// @access  Private (Super Admin)
exports.deactivateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      });
    }

    plan.isActive = false;
    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Plan deactivated. Existing subscribers retain access until expiry.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reactivate subscription plan
// @route   PUT /api/subscription-plans/:id/activate
// @access  Private (Super Admin)
exports.reactivateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      });
    }

    plan.isActive = true;
    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Plan reactivated and available for purchase',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete subscription plan (only if never purchased)
// @route   DELETE /api/subscription-plans/:id
// @access  Private (Super Admin)
exports.deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      });
    }

    const orgCount = await Organization.countDocuments({ subscriptionPlanId: plan._id });
    const subCount = await Subscription.countDocuments({
      $or: [{ planId: plan._id }, { plan: plan.slug }],
    });
    const orderCount = await Order.countDocuments({
      subscriptionPlan: plan.slug,
    });

    if (orgCount > 0 || subCount > 0 || orderCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          'This plan has active or historical subscriptions and cannot be permanently deleted. Deactivate it instead.',
      });
    }

    await plan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Plan permanently deleted',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign plan to organization
// @route   PUT /api/subscription-plans/:planId/assign/:organizationId
// @access  Private (Super Admin)
exports.assignPlanToOrganization = async (req, res, next) => {
  try {
    const { planId, organizationId } = req.params;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found or inactive',
      });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization || organization.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    organization.subscriptionPlanId = plan._id;
    organization.maxCameras = plan.maxCameras;
    organization.maxOperators = plan.maxOperators;
    await organization.save();

    const populated = await Organization.findById(organizationId).populate('subscriptionPlanId');

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Plan assigned to organization',
    });
  } catch (error) {
    next(error);
  }
};
