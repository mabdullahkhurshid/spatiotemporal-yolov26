const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');

// @desc    Get all subscription plans
// @route   GET /api/subscription-plans
// @access  Private (Super Admin: all; others: active only)
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const query = req.user.role === 'super_admin' && req.query.includeInactive === 'true'
      ? {}
      : { isActive: true };

    const plans = await SubscriptionPlan.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
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
    } = req.body;

    const finalSlug = slug || name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const plan = await SubscriptionPlan.create({
      name,
      slug: finalSlug,
      maxCameras: maxCameras ?? 5,
      maxOperators: maxOperators ?? 10,
      alertRetentionDays: alertRetentionDays ?? 30,
      storageLimit: storageLimit ?? 10,
      supportPriority: supportPriority || 'standard',
      price: price ?? 0,
      currency: currency || 'USD',
      durationMonths: durationMonths ?? 1,
      billingCycle: billingCycle || 'monthly',
      description,
    });

    res.status(201).json({
      success: true,
      data: plan,
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
    let plan = await SubscriptionPlan.findById(req.params.id);

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
    } = req.body;
    if (name !== undefined) plan.name = name;
    if (slug !== undefined) plan.slug = slug;
    if (maxCameras !== undefined) plan.maxCameras = maxCameras;
    if (maxOperators !== undefined) plan.maxOperators = maxOperators;
    if (alertRetentionDays !== undefined) plan.alertRetentionDays = alertRetentionDays;
    if (storageLimit !== undefined) plan.storageLimit = storageLimit;
    if (supportPriority !== undefined) plan.supportPriority = supportPriority;
    if (isActive !== undefined) plan.isActive = isActive;
    if (price !== undefined) plan.price = price;
    if (currency !== undefined) plan.currency = currency;
    if (durationMonths !== undefined) plan.durationMonths = durationMonths;
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (description !== undefined) plan.description = description;

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
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
      message: 'Plan deactivated',
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
