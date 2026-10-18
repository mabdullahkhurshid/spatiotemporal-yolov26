// Shared, locale-aware formatting so every page shows dates, times and numbers the same way.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "3 min ago", "yesterday", "in 2 days". */
export const formatRelative = (value, now = Date.now()) => {
  const d = toDate(value);
  if (!d) return '—';
  const seconds = Math.round((d.getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
};

export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '—';
};

export const formatDate = (value) => {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
};

export const formatTime = (value) => {
  const d = toDate(value);
  return d ? timeFmt.format(d) : '—';
};

export const formatNumber = (value, options) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(undefined, options).format(n) : '—';
};

/** Values already expressed in percent (0–100). */
export const formatPercent = (value, digits = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
};

export const formatCurrency = (amount, currency = 'USD') => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

/** Days from now until a date (negative when past). */
export const daysUntil = (value, now = Date.now()) => {
  const d = toDate(value);
  return d ? Math.ceil((d.getTime() - now) / (24 * 3600 * 1000)) : null;
};

export const initialsOf = (name = '', email = '') => {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
};

/** Snapshot/upload URLs are served by the API origin. */
export const assetUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const api = import.meta.env.VITE_API_URL || '';
  const origin = /^https?:\/\//.test(api) ? new URL(api).origin : '';
  return `${origin}${path}`;
};
