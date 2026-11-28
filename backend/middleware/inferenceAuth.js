const { hasValidInferenceKey } = require('../utils/safeCompare');

exports.inferenceServiceAuth = (req, res, next) => {
  if (!process.env.INFERENCE_SERVICE_API_KEY) {
    return res.status(503).json({
      success: false,
      message: 'Inference service is not configured on the server',
    });
  }

  if (!hasValidInferenceKey(req)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid inference service credentials',
    });
  }

  next();
};
