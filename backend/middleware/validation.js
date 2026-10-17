const { body, validationResult } = require("express-validator");

// Validation result handler
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: errors.array(),
    });
  }
  console.log("Validation passed for:", req.path);
  next();
};

// User creation validation (Org Admin / Super Admin)
exports.validateCreateUser = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

// User registration validation
exports.validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("organization").optional().trim(),
];

// User login validation
exports.validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Forgot password validation
exports.validateForgotPassword = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
];

// Reset password validation
exports.validateResetPassword = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

// Set password validation (Google sign-in accounts)
exports.validateSetPassword = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

// Camera validation (name or label required for backward compatibility)
const IP_ADDRESS_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

exports.validateCamera = [
  body("name").optional().trim(),
  body("label").optional().trim(),
  body("cameraType")
    .optional()
    .isIn(["ip_rtsp", "http_mjpeg", "onvif"])
    .withMessage("Invalid camera type"),
  body("displayNumber").optional().trim(),
  body("streamUrl").optional().trim(),
  body("location").trim().notEmpty().withMessage("Camera location is required"),
  (req, res, next) => {
    if (!req.body.name && !req.body.label) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: [{ msg: "Camera name or label is required", path: "name" }],
      });
    }

    const cameraType = req.body.cameraType || "ip_rtsp";

    if (cameraType === "ip_rtsp" || cameraType === "onvif") {
      const ip = req.body.ipAddress?.trim();
      if (!ip || !IP_ADDRESS_REGEX.test(ip)) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: [{ msg: "Please provide a valid IP address", path: "ipAddress" }],
        });
      }
    }

    if (cameraType === "http_mjpeg") {
      const streamUrl = req.body.streamUrl?.trim();
      if (!streamUrl) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: [{ msg: "Stream URL is required for HTTP MJPEG cameras", path: "streamUrl" }],
        });
      }
    }

    next();
  },
];

// Organization validation
exports.validateOrganization = [
  body("name").trim().notEmpty().withMessage("Organization name is required"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("address.street").optional().trim(),
  body("address.city").optional().trim(),
  body("address.state").optional().trim(),
  body("address.zipCode").optional().trim(),
  body("address.country").optional().trim(),
];

// Order update validation (Super Admin)
exports.validateUpdateOrder = [
  body("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "cancelled"])
    .withMessage("Invalid order status"),
  body("subscriptionPlan")
    .optional()
    .isIn(["basic", "pro", "enterprise"])
    .withMessage("Invalid subscription plan"),
  body("amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount must be zero or greater"),
  body("notes").optional().trim(),
  body("paymentIntentId").optional().trim(),
  (req, res, next) => {
    const fields = ["status", "subscriptionPlan", "amount", "notes", "paymentIntentId"];
    const hasField = fields.some((field) => req.body[field] !== undefined);
    if (!hasField) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: [{ msg: "At least one field is required to update the order", path: "body" }],
      });
    }
    next();
  },
];

// Alert validation
exports.validateAlert = [
  body("cameraId").isMongoId().withMessage("Valid camera ID is required"),
  body("fireConfidence")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Fire confidence must be between 0 and 100"),
  body("smokeConfidence")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Smoke confidence must be between 0 and 100"),
  body("intensityLevel")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid intensity level"),
];
