const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const { sendTokenResponse } = require("../utils/generateToken");
const { generateOTP, generateToken } = require("../utils/generateOTP");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");
const crypto = require("crypto");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists (active account)
    console.log("Checking for existing user with email:", email);
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
      console.log("user data", existingUser);
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // If email belongs to a soft-deleted account, prevent silent reuse
    const softDeleted = await User.findOne({ email, isDeleted: true });
    if (softDeleted) {
      return res.status(400).json({
        success: false,
        message:
          "An account with this email was previously deleted. Please contact support to restore access.",
      });
    }

    // Landing page registrants are customers until they purchase a plan
    const user = await User.create({
      name,
      email,
      password,
      role: "customer",
      organizationId: null,
      isVerified: true,
    });

    // Generate OTP
    const otp = generateOTP();
    user.emailVerificationToken = otp;
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user, otp);
    } catch (emailError) {
      console.error("Email send error:", emailError);
      // Don't fail registration if email fails
    }

    // Audit log
    await AuditLog.create({
      userId: user._id,
      action: "register",
      resource: "user",
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email for verification code.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || null,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
      emailVerificationToken: otp,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user
    const user = await User.findOne({ email, isDeleted: false }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended. Please contact support.",
      });
    }

    // Google-only accounts have no local password until the user sets one
    if (!user.password) {
      if (user.googleId) {
        return res.status(400).json({
          success: false,
          message:
            "This account uses Google sign-in. Sign in with Google, or set a password after signing in with Google.",
          code: "GOOGLE_ACCOUNT_NO_PASSWORD",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified && !user.googleId) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    // Customers and super_admin bypass org check; org_admin/operator need ACTIVE org
    if (user.role !== "super_admin" && user.role !== "customer" && user.organizationId) {
      const org = await Organization.findOne({
        _id: user.organizationId,
        isDeleted: false,
      });
      if (!org || org.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message: "Your organization is not active. Please contact support.",
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    if (user.organizationId) {
      await user.populate('organizationId', 'name email');
    }

    // Audit log
    await AuditLog.create({
      userId: user._id,
      organizationId: user.organizationId,
      action: "login",
      resource: "user",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=authentication_failed`,
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      organizationId: user.organizationId,
      action: "login",
      resource: "user",
      details: { method: "google_oauth" },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Generate tokens and redirect
    const {
      generateToken,
      generateRefreshToken,
    } = require("../utils/generateToken");
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const userWithPassword = await User.findById(user._id).select("+password");
    const needsPassword = Boolean(
      userWithPassword?.googleId && !userWithPassword?.password,
    );

    // Redirect with tokens
    const callbackUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
    callbackUrl.searchParams.set("token", accessToken);
    callbackUrl.searchParams.set("refresh", refreshToken);
    if (needsPassword) {
      callbackUrl.searchParams.set("needsPassword", "1");
    }

    res.redirect(callbackUrl.toString());
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Clear refresh token
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });

    // Clear cookies
    res.cookie("accessToken", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
    res.cookie("refreshToken", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      action: "logout",
      resource: "user",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("organizationId")
      .select("+password");

    const data = user.toObject();
    data.needsPasswordSetup = Boolean(user.googleId && !user.password);
    delete data.password;

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set password for Google sign-in accounts (first-time setup)
// @route   POST /api/auth/set-password
// @access  Private
exports.setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user.googleId) {
      return res.status(400).json({
        success: false,
        message: "Password setup is only available for Google sign-in accounts.",
      });
    }

    if (user.password) {
      return res.status(400).json({
        success: false,
        message: "Password is already set. Use forgot password to change it.",
      });
    }

    user.password = password;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password set successfully. You can now sign in with email and password.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      isDeleted: false,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "There is no user with that email",
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send email
    try {
      await sendPasswordResetEmail(user, resetToken);
      res.status(200).json({
        success: true,
        message: "Password reset email sent",
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
      isDeleted: false,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      organizationId: user.organizationId,
      action: "password_reset",
      resource: "user",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
