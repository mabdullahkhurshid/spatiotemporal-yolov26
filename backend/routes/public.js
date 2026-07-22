const express = require('express');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const router = express.Router();

// @desc    Public: get active subscription plans for pricing page
// @route   GET /api/public/subscription-plans
// @access  Public
router.get('/subscription-plans', async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

