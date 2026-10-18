// Multi-device refresh sessions. Each sign-in gets its own hashed refresh token, so signing in on one
// device no longer invalidates another. The refresh token lives only in an httpOnly cookie.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('./generateToken');
const { hashToken } = require('./generateOTP');

const REFRESH_COOKIE = 'refreshToken';
const MAX_SESSIONS_PER_USER = 10;
const ROTATION_GRACE_MS = () => parseInt(process.env.REFRESH_ROTATION_GRACE_MS, 10) || 30 * 1000;

const tokenExpiry = (token) => new Date(jwt.decode(token).exp * 1000);

const sessionMeta = (req) => ({
  userAgent: (req?.get?.('user-agent') || '').slice(0, 200),
  ip: req?.ip,
});

/** Start a new session for a sign-in; keeps at most MAX_SESSIONS_PER_USER (oldest dropped). */
async function createSession(userId, req) {
  const refreshToken = generateRefreshToken(userId);
  const now = new Date();

  await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { expiresAt: { $lte: now } } } });
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        refreshSessions: {
          $each: [
            {
              tokenHash: hashToken(refreshToken),
              createdAt: now,
              lastUsedAt: now,
              expiresAt: tokenExpiry(refreshToken),
              ...sessionMeta(req),
            },
          ],
          $slice: -MAX_SESSIONS_PER_USER,
        },
      },
    }
  );

  return refreshToken;
}

/**
 * Rotate the presented refresh token.
 * Returns { refreshToken } (new token), { refreshToken: null } when the token was rotated moments ago by a
 * parallel request (caller issues an access token only), or null when the session is unknown/expired.
 */
async function rotateSession(userId, presentedToken, req) {
  const presentedHash = hashToken(presentedToken);
  const now = new Date();
  const nextToken = generateRefreshToken(userId);

  const rotated = await User.updateOne(
    {
      _id: userId,
      refreshSessions: { $elemMatch: { tokenHash: presentedHash, expiresAt: { $gt: now } } },
    },
    {
      $set: {
        'refreshSessions.$.tokenHash': hashToken(nextToken),
        'refreshSessions.$.prevTokenHash': presentedHash,
        'refreshSessions.$.rotatedAt': now,
        'refreshSessions.$.lastUsedAt': now,
        'refreshSessions.$.expiresAt': tokenExpiry(nextToken),
        'refreshSessions.$.ip': req?.ip,
      },
    }
  );
  if (rotated.modifiedCount === 1) {
    return { refreshToken: nextToken };
  }

  const justRotated = await User.exists({
    _id: userId,
    refreshSessions: {
      $elemMatch: {
        prevTokenHash: presentedHash,
        rotatedAt: { $gt: new Date(now.getTime() - ROTATION_GRACE_MS()) },
      },
    },
  });
  if (justRotated) {
    return { refreshToken: null };
  }

  // Tokens issued before multi-session support: accept once and convert into a session.
  const legacy = await User.findById(userId).select('+refreshToken');
  if (legacy?.refreshToken && legacy.refreshToken === presentedToken) {
    await User.updateOne({ _id: userId }, { $unset: { refreshToken: '' } });
    return { refreshToken: await createSession(userId, req) };
  }

  return null;
}

async function revokeSession(userId, presentedToken) {
  if (!userId || !presentedToken) return;
  const hash = hashToken(presentedToken);
  await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { tokenHash: hash } } });
  await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { prevTokenHash: hash } } });
  await User.updateOne({ _id: userId, refreshToken: presentedToken }, { $unset: { refreshToken: '' } });
}

/** Sign out everywhere (password change/reset, suspension, "sign out all devices"). */
async function revokeAllSessions(userId) {
  if (!userId) return;
  await User.updateOne({ _id: userId }, { $set: { refreshSessions: [] }, $unset: { refreshToken: '' } });
}

const cookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers on Secure cookies.
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true' || sameSite === 'none',
    sameSite,
    path: '/api/auth',
  };
};

function setRefreshCookie(res, refreshToken) {
  // Older builds stored auth cookies at path "/"; drop them so only the scoped cookie is sent.
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.clearCookie('accessToken', { path: '/' });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), expires: tokenExpiry(refreshToken) });
}

function clearAuthCookies(res) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.clearCookie('accessToken', { path: '/' });
}

const serializeUser = (user) => {
  const org = user.organizationId && typeof user.organizationId === 'object' && user.organizationId.name
    ? user.organizationId
    : null;
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: org || user.organizationId,
    organizationName: org?.name || null,
    phone: user.phone,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified,
    isVerified: user.isVerified,
  };
};

/**
 * Respond with an access token and set the refresh cookie.
 * `refreshToken: undefined` starts a new session; `null` keeps the current cookie (parallel refresh).
 * The refresh token is only echoed in the body for clients that sent it in the body (non-browser clients).
 * Callers do not await this, so it must never reject (an unhandled rejection stops the server).
 */
const sendTokenResponse = async (user, statusCode, res, req, { refreshToken, includeRefreshToken = false } = {}) => {
  try {
    const sessionToken = refreshToken === undefined ? await createSession(user._id, req) : refreshToken;
    const accessToken = generateToken(user._id);

    if (sessionToken) {
      setRefreshCookie(res, sessionToken);
    }

    res.status(statusCode).json({
      success: true,
      accessToken,
      ...(includeRefreshToken && sessionToken ? { refreshToken: sessionToken } : {}),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Session start error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Could not start session' });
    }
  }
};

module.exports = {
  REFRESH_COOKIE,
  createSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  setRefreshCookie,
  clearAuthCookies,
  serializeUser,
  sendTokenResponse,
};
