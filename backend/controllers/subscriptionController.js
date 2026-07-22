const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');
const Order = require('../models/Order');
const User = require('../models/User');

// Helper to compute end date from duration months
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// @desc    Checkout subscription for current user / organization
// @route   POST /api/subscriptions/checkout
// @access  Private (org_admin or operator wishing to create org)
exports.checkoutSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { planId, organizationName } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan is required',
      });
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found or inactive',
      });
    }

    let organization;

    // If user already belongs to an organization, reuse it
    if (user.organizationId) {
      organization = await Organization.findById(user.organizationId);
    } else {
      // Create minimal organization record and make user org_admin
      if (!organizationName) {
        return res.status(400).json({
          success: false,
          message: 'Organization name is required for first-time subscription',
        });
      }

      organization = await Organization.create({
        name: organizationName,
        email: user.email,
        adminId: user._id,
        status: 'PENDING',
      });

      user.organizationId = organization._id;
      user.role = 'org_admin';
      await user.save();
    }

    // Compute subscription dates
    const now = new Date();
    const startDate = now;
    const endDate = addMonths(now, plan.durationMonths || 1);

    // Create or update subscription document
    let subscription = await Subscription.findOne({ organizationId: organization._id });
    if (!subscription) {
      subscription = await Subscription.create({
        organizationId: organization._id,
        planId: plan._id,
        plan: plan.slug || plan.name,
        status: 'active',
        startDate,
        endDate,
        price: plan.price,
        billingCycle: plan.billingCycle || 'monthly',
        paymentMethod: 'manual',
        autoRenew: true,
        camerasUsed: 0,
        operatorsUsed: 1,
      });
    } else {
      subscription.planId = plan._id;
      subscription.plan = plan.slug || plan.name;
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.price = plan.price;
      subscription.billingCycle = plan.billingCycle || 'monthly';
      subscription.camerasUsed = subscription.camerasUsed || 0;
      subscription.operatorsUsed = subscription.operatorsUsed || 1;
      await subscription.save();
    }

    // Create order record (acts as payment/transaction log)
    await Order.create({
      organizationId: organization._id,
      subscriptionPlan: plan.slug || plan.name,
      amount: plan.price,
      status: 'approved',
      notes: 'Manual payment simulation for subscription checkout',
    });

    // Update organization with subscription info and plan limits
    organization.subscriptionPlanId = plan._id;
    organization.subscriptionPlan = plan.slug || organization.subscriptionPlan;
    organization.subscriptionStatus = 'active';
    organization.subscriptionStartDate = startDate;
    organization.subscriptionEndDate = endDate;
    organization.maxCameras = plan.maxCameras;
    organization.maxOperators = plan.maxOperators;
    organization.status = organization.status === 'PENDING' ? 'ACTIVE' : organization.status;
    await organization.save();

    res.status(200).json({
      success: true,
      data: {
        subscription,
        organization,
      },
      message: 'Subscription activated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current organization subscription (org_admin/operator)
// @route   GET /api/subscriptions/me
// @access  Private (Org Admin / Operator)
exports.getMySubscription = async (req, res, next) => {
  try {
    if (!req.user.organizationId) {
      return res.status(404).json({
        success: false,
        message: 'You are not assigned to an organization',
      });
    }

    const organization = await Organization.findById(req.user.organizationId).populate('subscriptionPlanId');
    const subscription = await Subscription.findOne({ organizationId: req.user.organizationId }).populate('planId');

    res.status(200).json({
      success: true,
      data: {
        organization,
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

