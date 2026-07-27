const express = require('express');
const { body } = require('express-validator');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { submitContact } = require('../controllers/contactController');
const { validate } = require('../middleware/validation');

const router = express.Router();

// @desc    Public: get active subscription plans for pricing page
// @route   GET /api/public/subscription-plans
// @access  Public
router.get('/subscription-plans', async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ displayOrder: 1, price: 1 });
    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').optional().trim().isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ min: 10, max: 5000 }),
    body('organization').optional().trim().isLength({ max: 200 }),
  ],
  validate,
  submitContact
);

module.exports = router;
