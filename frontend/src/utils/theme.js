const THEME_KEY = 'theme';
const LEGACY_DARK_MODE_KEY = 'darkMode';

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return null;

  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  const legacyDarkMode = localStorage.getItem(LEGACY_DARK_MODE_KEY);
  if (legacyDarkMode === 'true') {
    localStorage.setItem(THEME_KEY, 'dark');
    localStorage.removeItem(LEGACY_DARK_MODE_KEY);
    return 'dark';
  }
  if (legacyDarkMode === 'false') {
    localStorage.setItem(THEME_KEY, 'light');
    localStorage.removeItem(LEGACY_DARK_MODE_KEY);
    return 'light';
  }

  return null;
};

export const getInitialDarkMode = () => {
  const storedTheme = getStoredTheme();
  if (storedTheme === 'dark') return true;
  if (storedTheme === 'light') return false;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export const applyDarkMode = (isDark) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
};

const THEME_EVENT = 'fireguard:themechange';

const notify = (isDark) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: isDark }));
};

export const setTheme = (isDark) => {
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  applyDarkMode(isDark);
  notify(isDark);
};

/** 'light' | 'dark' | 'system' */
export const getThemePreference = () => getStoredTheme() || 'system';

export const setThemePreference = (preference) => {
  if (preference === 'system') {
    localStorage.removeItem(THEME_KEY);
    const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    applyDarkMode(isDark);
    notify(isDark);
    return;
  }
  setTheme(preference === 'dark');
};

export const toggleTheme = () => {
  const next = !document.documentElement.classList.contains('dark');
  setTheme(next);
  return next;
};

export const initTheme = () => {
  applyDarkMode(getInitialDarkMode());
};

export const subscribeToThemeChanges = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event) => {
    if (event.key === THEME_KEY) {
      callback(event.newValue === 'dark');
    }
  };

  // Same-tab changes (top bar toggle, settings page) arrive as a custom event.
  const handleLocal = (event) => callback(Boolean(event.detail));

  window.addEventListener('storage', handleStorage);
  window.addEventListener(THEME_EVENT, handleLocal);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(THEME_EVENT, handleLocal);
  };
};

export const subscribeToSystemTheme = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const storedTheme = getStoredTheme();
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleSystemThemeChange = (event) => {
    callback(event.matches);
  };

  mediaQuery.addEventListener?.('change', handleSystemThemeChange);
  return () => mediaQuery.removeEventListener?.('change', handleSystemThemeChange);
};
