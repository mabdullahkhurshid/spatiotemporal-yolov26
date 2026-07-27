const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');
const Order = require('../models/Order');
const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');

// Helper to compute end date from duration months
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const LEGACY_PLAN_KEYS = ['basic', 'pro', 'enterprise'];

// Organization/Order still use legacy enum; map dynamic plan slugs safely
const resolveLegacySubscriptionPlan = (plan) => {
  const slug = String(plan.slug || '').toLowerCase().trim();
  if (LEGACY_PLAN_KEYS.includes(slug)) return slug;

  const name = String(plan.name || '').toLowerCase();
  if (name.includes('enterprise')) return 'enterprise';
  if (name.includes('pro')) return 'pro';
  if (name.includes('basic')) return 'basic';

  if (Number(plan.maxCameras) >= 50) return 'enterprise';
  if (Number(plan.maxCameras) >= 10) return 'pro';
  return 'basic';
};

const resolveSubscriptionBillingCycle = (cycle) =>
  cycle === 'yearly' ? 'yearly' : 'monthly';

// @desc    Checkout subscription for current user / organization
// @route   POST /api/subscriptions/checkout
// @access  Private (customer first purchase or existing org_admin renewal)
exports.checkoutSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { planId, organizationName, phone, address } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan is required',
      });
    }

    if (user.role !== 'customer' && user.role !== 'org_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only customers and organization admins can purchase subscriptions',
      });
    }

    // Single-org guard: customers must not checkout if already linked to an organization
    if (user.role === 'customer' && user.organizationId) {
      return res.status(400).json({
        success: false,
        message:
          'This account is already linked to an organization. Sign in as organization admin to manage your subscription.',
      });
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found or inactive',
      });
    }

    const legacyPlanKey = resolveLegacySubscriptionPlan(plan);
    const subscriptionBillingCycle = resolveSubscriptionBillingCycle(plan.billingCycle);

    let organization;

    if (user.organizationId) {
      organization = await Organization.findById(user.organizationId);

      if (!organization) {
        return res.status(400).json({
          success: false,
          message: 'Organization record not found for this account',
        });
      }

      const existingSubscription = await Subscription.findOne({
        organizationId: organization._id,
      });

      const hasActiveOrg =
        organization.status === 'ACTIVE' &&
        organization.subscriptionStatus === 'active';

      const hasActiveSubscription =
        existingSubscription?.status === 'active' &&
        existingSubscription?.endDate > new Date();

      if (
        user.role === 'org_admin' &&
        hasActiveOrg &&
        hasActiveSubscription &&
        existingSubscription?.planId?.toString() === planId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active subscription for this plan',
        });
      }
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
        phone: phone || undefined,
        address: address || undefined,
        adminId: user._id,
        status: 'ACTIVE',
      });

      user.organizationId = organization._id;
      user.role = 'org_admin';
      user.isVerified = true;
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
        billingCycle: subscriptionBillingCycle,
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
      subscription.billingCycle = subscriptionBillingCycle;
      subscription.camerasUsed = subscription.camerasUsed || 0;
      subscription.operatorsUsed = subscription.operatorsUsed || 1;
      await subscription.save();
    }

    // Create order record (acts as payment/transaction log)
    await Order.create({
      organizationId: organization._id,
      subscriptionPlan: legacyPlanKey,
      amount: plan.price,
      status: 'approved',
      notes: 'Manual payment simulation for subscription checkout',
    });

    // Update organization with subscription info and plan limits
    organization.subscriptionPlanId = plan._id;
    organization.subscriptionPlan = legacyPlanKey;
    organization.subscriptionStatus = 'active';
    organization.subscriptionStartDate = startDate;
    organization.subscriptionEndDate = endDate;
    organization.maxCameras = plan.maxCameras;
    organization.maxOperators = plan.maxOperators;
    organization.status = 'ACTIVE';
    await organization.save();

    const updatedUser = await User.findById(user._id);
    const accessToken = generateToken(updatedUser._id);
    const refreshToken = generateRefreshToken(updatedUser._id);

    updatedUser.refreshToken = refreshToken;
    await updatedUser.save({ validateBeforeSave: false });

    const cookieOptions = {
      expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };

    res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .cookie('refreshToken', refreshToken, cookieOptions)
      .json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: updatedUser._id,
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          organizationId: updatedUser.organizationId,
          phone: updatedUser.phone,
          avatar: updatedUser.avatar,
          isEmailVerified: updatedUser.isEmailVerified,
          isVerified: updatedUser.isVerified,
        },
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
    const orders = await Order.find({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        organization,
        subscription,
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

