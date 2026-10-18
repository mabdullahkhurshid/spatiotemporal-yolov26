// The access token lives only in memory (not localStorage), so injected scripts cannot read a persisted
// copy. The long-lived refresh token is an httpOnly cookie the browser sends to /api/auth only.
let accessToken = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

// Builds before this change persisted tokens in localStorage; remove those copies.
export const purgeLegacyStoredTokens = () => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    // storage unavailable
  }
};
