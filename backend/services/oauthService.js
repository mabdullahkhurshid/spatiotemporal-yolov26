const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { normalizeEmail } = require('validator');
const User = require('../models/User');

const STATE_COOKIE = 'oauthState';
const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_COOKIE_PATH = '/api/auth/google';

const isGoogleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);

// Lax (not the refresh cookie's Strict): the cookie must come back on the top-level redirect from Google.
const stateCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  path: STATE_COOKIE_PATH,
});

// OAuth `state` bound to the browser that started sign-in, so a callback URL cannot be replayed
// into someone else's browser (login CSRF). No server session is needed.
const cookieStateStore = {
  store(req, meta, callback) {
    const state = crypto.randomBytes(24).toString('hex');
    req.res.cookie(STATE_COOKIE, state, { ...stateCookieOptions(), maxAge: STATE_TTL_MS });
    callback(null, state);
  },
  verify(req, providedState, callback) {
    const expected = req.cookies?.[STATE_COOKIE];
    req.res.clearCookie(STATE_COOKIE, stateCookieOptions());
    const valid =
      typeof expected === 'string' &&
      typeof providedState === 'string' &&
      expected.length === providedState.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedState));
    if (!valid) {
      return callback(null, false, { message: 'invalid_state' });
    }
    return callback(null, true);
  },
};

// Same normalization as registration (express-validator normalizeEmail), so a Google account matches
// the stored email even when Gmail dots or letter case differ.
const normalizeGoogleEmail = (email) => normalizeEmail(String(email || '').trim()) || null;

async function verifyGoogleProfile(accessToken, refreshToken, profile, done) {
  try {
    const primary = profile.emails?.[0];
    const email = normalizeGoogleEmail(primary?.value);
    // Linking by email is only safe when Google has verified the address.
    if (!email || primary.verified === false || primary.verified === 'false') {
      return done(null, false, { message: 'email_unverified' });
    }

    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      return done(null, user);
    }

    user = await User.findOne({ email });
    if (user) {
      user.googleId = profile.id;
      user.isEmailVerified = true;
      await user.save();
      return done(null, user);
    }

    // New customer (pre-purchase); password optional until the user sets one.
    user = await User.create({
      name: profile.displayName || email.split('@')[0],
      email,
      googleId: profile.id,
      isEmailVerified: true,
      isVerified: true,
      role: 'customer',
    });

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}

// Integration tests point the strategy at a local mock of Google's endpoints; ignored outside NODE_ENV=test.
const testEndpointOverrides = () =>
  process.env.NODE_ENV === 'test' && process.env.GOOGLE_TEST_OAUTH_BASE_URL
    ? {
        authorizationURL: `${process.env.GOOGLE_TEST_OAUTH_BASE_URL}/auth`,
        tokenURL: `${process.env.GOOGLE_TEST_OAUTH_BASE_URL}/token`,
        userProfileURL: `${process.env.GOOGLE_TEST_OAUTH_BASE_URL}/userinfo`,
      }
    : {};

if (isGoogleConfigured()) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        store: cookieStateStore,
        ...testEndpointOverrides(),
      },
      verifyGoogleProfile
    )
  );
} else {
  console.warn('Google sign-in disabled. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL to enable it.');
}

const loginRedirect = (res, error) =>
  res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);

// @route   GET /api/auth/google
const startGoogleSignIn = (req, res, next) => {
  if (!isGoogleConfigured()) return loginRedirect(res, 'google_unavailable');
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false, prompt: 'select_account' })(
    req,
    res,
    next
  );
};

// @route   GET /api/auth/google/callback
// Every failure (user cancelled, bad state, token error) returns to the login page instead of a raw 401/500.
const handleGoogleCallback = (req, res, next) => {
  if (!isGoogleConfigured()) return loginRedirect(res, 'google_unavailable');
  if (req.query.error) {
    return loginRedirect(res, req.query.error === 'access_denied' ? 'google_cancelled' : 'authentication_failed');
  }
  return passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Google sign-in error:', err.message);
      return loginRedirect(res, 'authentication_failed');
    }
    if (!user) {
      const reason = info?.message;
      return loginRedirect(res, reason === 'email_unverified' || reason === 'invalid_state' ? reason : 'authentication_failed');
    }
    req.user = user;
    return next();
  })(req, res, next);
};

module.exports = {
  passport,
  startGoogleSignIn,
  handleGoogleCallback,
  isGoogleConfigured,
  normalizeGoogleEmail,
  verifyGoogleProfile,
};
