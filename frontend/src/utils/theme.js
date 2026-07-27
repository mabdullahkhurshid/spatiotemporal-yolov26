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

export const setTheme = (isDark) => {
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  applyDarkMode(isDark);
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

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
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
