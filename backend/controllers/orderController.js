const Order = require('../models/Order');

const ALLOWED_SORT_FIELDS = ['createdAt', 'amount', 'status'];
const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const ALLOWED_PLANS = ['basic', 'pro', 'enterprise'];

function capitalizePlanKey(key) {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function resolvePlanDisplayName(order, organization) {
  if (organization?.subscriptionPlanId?.name) {
    return organization.subscriptionPlanId.name;
  }
  return capitalizePlanKey(order.subscriptionPlan);
}

function formatOrganizationRef(org) {
  if (!org || typeof org !== 'object' || !org._id) {
    return org;
  }

  return {
    _id: org._id,
    name: org.name,
    email: org.email,
    status: org.status,
    isDeleted: org.isDeleted,
  };
}

function formatOrderListItem(order) {
  const org = order.organizationId;

  return {
    _id: order._id,
    organizationId: formatOrganizationRef(org),
    subscriptionPlan: order.subscriptionPlan,
    planDisplayName: resolvePlanDisplayName(order, org),
    amount: order.amount,
    status: order.status,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function buildOrderQuery(queryParams) {
  const query = {};

  if (queryParams.status && ALLOWED_STATUSES.includes(queryParams.status)) {
    query.status = queryParams.status;
  }

  if (queryParams.organizationId) {
    query.organizationId = queryParams.organizationId;
  }

  if (queryParams.subscriptionPlan && ALLOWED_PLANS.includes(queryParams.subscriptionPlan)) {
    query.subscriptionPlan = queryParams.subscriptionPlan;
  }

  if (queryParams.from || queryParams.to) {
    query.createdAt = {};
    if (queryParams.from) {
      query.createdAt.$gte = new Date(queryParams.from);
    }
    if (queryParams.to) {
      query.createdAt.$lte = new Date(queryParams.to);
    }
  }

  return query;
}

function resolveSortParam(sortParam) {
  if (!sortParam) {
    return '-createdAt';
  }

  const field = sortParam.startsWith('-') ? sortParam.slice(1) : sortParam;
  return ALLOWED_SORT_FIELDS.includes(field) ? sortParam : '-createdAt';
}

// @desc    Get all orders (platform-wide audit log)
// @route   GET /api/orders
// @access  Private (Super Admin)
exports.getOrders = async (req, res, next) => {
  try {
    const query = buildOrderQuery(req.query);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const sort = resolveSortParam(req.query.sort);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate({
          path: 'organizationId',
          select: 'name email status isDeleted adminId subscriptionPlanId',
          populate: { path: 'subscriptionPlanId', select: 'name' },
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: total,
      data: orders.map(formatOrderListItem),
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private (Super Admin)
exports.getOrder = async (req, res, next) => {
  try {
    const formatted = await fetchFormattedOrder(req.params.id);

    if (!formatted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order summary stats for dashboard
// @route   GET /api/orders/stats
// @access  Private (Super Admin)
exports.getOrderStats = async (req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, approved, thisMonth] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: 'approved' }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        approved,
        thisMonth,
      },
    });
  } catch (error) {
    next(error);
  }
};

async function fetchFormattedOrder(orderId) {
  const order = await Order.findById(orderId)
    .populate({
      path: 'organizationId',
      select: 'name email status isDeleted adminId subscriptionPlanId',
      populate: [
        { path: 'subscriptionPlanId', select: 'name price currency billingCycle' },
        { path: 'adminId', select: 'name email' },
      ],
    })
    .populate('approvedBy', 'name email')
    .lean();

  if (!order) {
    return null;
  }

  const org = order.organizationId;

  return {
    ...formatOrderListItem(order),
    approvedBy: order.approvedBy || null,
    approvedAt: order.approvedAt || null,
    paymentIntentId: order.paymentIntentId || null,
    organizationAdmin:
      org && typeof org === 'object' && org.adminId
        ? {
            _id: org.adminId._id,
            name: org.adminId.name,
            email: org.adminId.email,
          }
        : null,
  };
}

// @desc    Update order (Super Admin manual correction)
// @route   PUT /api/orders/:id
// @access  Private (Super Admin)
exports.updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const { status, subscriptionPlan, amount, notes, paymentIntentId } = req.body;
    const previousStatus = order.status;

    if (status !== undefined) {
      order.status = status;
    }
    if (subscriptionPlan !== undefined) {
      order.subscriptionPlan = subscriptionPlan;
    }
    if (amount !== undefined) {
      order.amount = amount;
    }
    if (notes !== undefined) {
      order.notes = notes;
    }
    if (paymentIntentId !== undefined) {
      order.paymentIntentId = paymentIntentId || undefined;
    }

    if (status !== undefined) {
      if (status === 'approved' && previousStatus !== 'approved') {
        order.approvedBy = req.user._id;
        order.approvedAt = new Date();
      } else if (status !== 'approved') {
        order.approvedBy = undefined;
        order.approvedAt = undefined;
      }
    }

    await order.save();

    const formatted = await fetchFormattedOrder(order._id);

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete order (Super Admin)
// @route   DELETE /api/orders/:id
// @access  Private (Super Admin)
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    await order.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
