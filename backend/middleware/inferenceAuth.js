exports.inferenceServiceAuth = (req, res, next) => {
  const configured = process.env.INFERENCE_SERVICE_API_KEY;
  if (!configured) {
    return res.status(503).json({
      success: false,
      message: 'Inference service is not configured on the server',
    });
  }

  const provided = req.headers['x-inference-api-key'];
  if (!provided || provided !== configured) {
    return res.status(401).json({
      success: false,
      message: 'Invalid inference service credentials',
    });
  }

  next();
};
