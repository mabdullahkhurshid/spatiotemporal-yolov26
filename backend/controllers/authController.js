const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const {
  REFRESH_COOKIE,
  sendTokenResponse,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  clearAuthCookies,
} = require("../utils/sessions");
const { generateOTP, generateToken, hashToken } = require("../utils/generateOTP");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";
const RESEND_VERIFICATION_MESSAGE =
  "If that account is awaiting verification, a new code has been sent.";

const ORG_INACTIVE_MESSAGE = "Your organization is not active. Please contact support.";

// Customers and super_admin bypass the org check; org_admin/operator need an ACTIVE organization.
const isOrganizationActiveFor = async (user) => {
  if (user.role === "super_admin" || user.role === "customer" || !user.organizationId) return true;
  const org = await Organization.findOne({ _id: user.organizationId, isDeleted: false });
  return Boolean(org && org.status === "ACTIVE");
};

// Store a fresh hashed OTP and email the plain code (best-effort; never blocks the response).
const issueVerificationCode = async (user) => {
  const otp = generateOTP();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerificationToken: hashToken(otp),
        emailVerificationExpires: new Date(Date.now() + OTP_TTL_MS),
        emailVerificationAttempts: 0,
      },
    }
  );
  sendVerificationEmail(user, otp).catch((emailError) => {
    console.error("Email send error:", emailError);
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists (active account)
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
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

    await issueVerificationCode(user);

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
    const invalid = () =>
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      });

    if (typeof email !== "string" || typeof otp !== "string" || !otp) {
      return invalid();
    }

    const user = await User.findOne({ email, isDeleted: false }).select(
      "+emailVerificationToken"
    );

    if (
      !user ||
      !user.emailVerificationToken ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      return invalid();
    }

    if (user.emailVerificationToken !== hashToken(otp.trim())) {
      // Atomic increment so parallel guesses cannot exceed the limit.
      const updated = await User.findOneAndUpdate(
        { _id: user._id, emailVerificationToken: user.emailVerificationToken },
        { $inc: { emailVerificationAttempts: 1 } },
        { new: true }
      ).select("+emailVerificationAttempts");

      if (!updated || updated.emailVerificationAttempts >= OTP_MAX_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id },
          {
            $unset: { emailVerificationToken: "", emailVerificationExpires: "" },
            $set: { emailVerificationAttempts: 0 },
          }
        );
        return res.status(429).json({
          success: false,
          message: "Too many incorrect codes. Request a new verification code.",
          code: "OTP_LOCKED",
        });
      }
      return invalid();
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { isEmailVerified: true, emailVerificationAttempts: 0 },
        $unset: { emailVerificationToken: "", emailVerificationExpires: "" },
      }
    );

    await AuditLog.create({
      userId: user._id,
      action: "email_verify",
      resource: "user",
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a new email verification code
// @route   POST /api/auth/resend-verification
// @access  Public (same response whether or not the account exists)
exports.resendVerification = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      isDeleted: false,
      isEmailVerified: false,
    });

    // Cooldown: a code issued less than a minute ago is not replaced.
    const issuedAt = user?.emailVerificationExpires
      ? user.emailVerificationExpires.getTime() - OTP_TTL_MS
      : 0;
    if (user && !user.googleId && Date.now() - issuedAt >= OTP_RESEND_COOLDOWN_MS) {
      await issueVerificationCode(user);
    }

    res.status(200).json({
      success: true,
      message: RESEND_VERIFICATION_MESSAGE,
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
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    if (!(await isOrganizationActiveFor(user))) {
      return res.status(403).json({ success: false, message: ORG_INACTIVE_MESSAGE });
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

    sendTokenResponse(user, 200, res, req);
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

    if (user.isDeleted || !user.isActive) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_suspended`);
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

    // Tokens never travel in the URL: the SPA exchanges this one-time, short-lived code for a session.
    const code = generateToken();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          oauthLoginCodeHash: hashToken(code),
          oauthLoginCodeExpires: new Date(Date.now() + OAUTH_CODE_TTL_MS),
        },
      }
    );

    const userWithPassword = await User.findById(user._id).select("+password");
    const needsPassword = Boolean(
      userWithPassword?.googleId && !userWithPassword?.password,
    );

    const callbackUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
    callbackUrl.searchParams.set("code", code);
    if (needsPassword) {
      callbackUrl.searchParams.set("needsPassword", "1");
    }

    res.redirect(callbackUrl.toString());
  } catch (error) {
    next(error);
  }
};

// @desc    Exchange a one-time Google sign-in code for a session
// @route   POST /api/auth/oauth/exchange
// @access  Public
exports.exchangeOAuthCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (typeof code !== "string" || !code) {
      return res.status(400).json({ success: false, message: "Sign-in code is required" });
    }

    // Single use: the code is removed in the same atomic operation that finds it.
    const user = await User.findOneAndUpdate(
      {
        oauthLoginCodeHash: hashToken(code),
        oauthLoginCodeExpires: { $gt: new Date() },
        isDeleted: false,
      },
      { $unset: { oauthLoginCodeHash: "", oauthLoginCodeExpires: "" } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This sign-in link has expired. Please sign in again.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended. Please contact support.",
      });
    }

    if (!(await isOrganizationActiveFor(user))) {
      return res.status(403).json({ success: false, message: ORG_INACTIVE_MESSAGE });
    }

    if (user.organizationId) {
      await user.populate("organizationId", "name email");
    }

    sendTokenResponse(user, 200, res, req);
  } catch (error) {
    next(error);
  }
};

const presentedRefreshToken = (req) =>
  req.cookies?.[REFRESH_COOKIE] ||
  (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null);

// @desc    Logout this device (revokes only the presented session)
// @route   POST /api/auth/logout
// @access  Public (identified by the refresh cookie, so it works even with an expired access token)
exports.logout = async (req, res, next) => {
  try {
    const presented = presentedRefreshToken(req);
    // Decoding (not verifying) is enough: revocation only removes a session whose hash matches.
    const userId = presented ? jwt.decode(presented)?.id : null;

    if (userId) {
      await revokeSession(userId, presented);
      await AuditLog.create({
        userId,
        action: "logout",
        resource: "user",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sign out of every device
// @route   POST /api/auth/logout-all
// @access  Private
exports.logoutAll = async (req, res, next) => {
  try {
    await revokeAllSessions(req.user._id);
    clearAuthCookies(res);

    await AuditLog.create({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      action: "logout",
      resource: "user",
      details: { scope: "all_sessions" },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      success: true,
      message: "Signed out of all devices",
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
// @access  Public (same response whether or not the account exists)
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      isDeleted: false,
    });

    if (user) {
      const resetToken = generateToken();
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetToken: hashToken(resetToken),
            passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        }
      );

      // Not awaited, so response time does not reveal whether the account exists.
      sendPasswordResetEmail(user, resetToken).catch(async (error) => {
        console.error("Password reset email error:", error);
        await User.updateOne(
          { _id: user._id },
          { $unset: { passwordResetToken: "", passwordResetExpires: "" } }
        ).catch(() => {});
      });
    }

    res.status(200).json({
      success: true,
      message: FORGOT_PASSWORD_MESSAGE,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const user = await User.findOne({
      passwordResetToken: hashToken(token),
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

    // A reset means the old password may be compromised: end every existing session.
    await revokeAllSessions(user._id);

    // Audit log
    await AuditLog.create({
      userId: user._id,
      organizationId: user.organizationId,
      action: "password_reset",
      resource: "user",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendTokenResponse(user, 200, res, req);
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token (rotates the presented session)
// @route   POST /api/auth/refresh
// @access  Public (refresh cookie, or body for non-browser clients)
exports.refreshToken = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
    const presented = cookieToken || bodyToken;

    const reject = () => {
      if (cookieToken) clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    };

    if (!presented) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(presented, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return reject();
    }

    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      return reject();
    }

    const session = await rotateSession(user._id, presented, req);
    if (!session) {
      return reject();
    }

    sendTokenResponse(user, 200, res, req, {
      refreshToken: session.refreshToken,
      includeRefreshToken: !cookieToken,
    });
  } catch (error) {
    next(error);
  }
};
