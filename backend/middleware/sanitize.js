// Reject MongoDB operator keys (e.g. {"$ne": null}) in client input so they cannot reach query filters.
const hasOperatorKey = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 10) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasOperatorKey(item, depth + 1));
  }
  return Object.keys(value).some((key) => key.startsWith('$') || hasOperatorKey(value[key], depth + 1));
};

exports.rejectMongoOperators = (req, res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query) || hasOperatorKey(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request payload',
    });
  }
  next();
};

exports.hasOperatorKey = hasOperatorKey;
