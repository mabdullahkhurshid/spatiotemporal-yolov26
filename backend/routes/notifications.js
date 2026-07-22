const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect, requireActiveOrganization, requireVerifiedUser } = require('../middleware/auth');

router.use(protect);
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);

// @desc    Get user notifications
// @route   GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
    })
      .populate('alertId', 'fireConfidence smokeConfidence intensityLevel')
      .populate('organizationId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
