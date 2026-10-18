/** @type {import('tailwindcss').Config} */

// Semantic colors resolve to CSS variables (see src/index.css) so light/dark share one class vocabulary.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// Cobalt brand scale. 600 is the interactive color (white text 5.9:1).
const brand = {
  50: '#EFF4FF',
  100: '#DCE6FE',
  200: '#BFD0FD',
  300: '#93AEF8',
  400: '#6B8BF0',
  500: '#4A6CE6',
  600: '#2B59D9',
  700: '#2347B8',
  800: '#213C93',
  900: '#1F3574',
  950: '#151F45',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"Cascadia Code"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        brand,
        // Legacy alias: older markup uses primary-*; it now follows the brand instead of alarm red.
        primary: brand,
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
          3: token('surface-3'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
        },
        accent: token('accent'),
        critical: { DEFAULT: token('critical'), fg: token('critical-fg'), soft: token('critical-soft'), line: token('critical-line') },
        warning: { DEFAULT: token('warning'), fg: token('warning-fg'), soft: token('warning-soft'), line: token('warning-line') },
        success: { DEFAULT: token('success'), fg: token('success-fg'), soft: token('success-soft'), line: token('success-line') },
        info: { DEFAULT: token('info'), fg: token('info-fg'), soft: token('info-soft'), line: token('info-line') },
        sidebar: {
          DEFAULT: token('sidebar'),
          fg: token('sidebar-fg'),
          muted: token('sidebar-muted'),
          hover: token('sidebar-hover'),
          line: token('sidebar-line'),
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        overlay: '0 12px 32px -8px rgb(15 23 42 / 0.18), 0 4px 8px -4px rgb(15 23 42 / 0.08)',
        focus: '0 0 0 3px rgb(43 89 217 / 0.35)',
      },
      maxWidth: {
        content: '90rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgb(var(--critical) / 0.45)' }, '100%': { boxShadow: '0 0 0 6px rgb(var(--critical) / 0)' } },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out',
        'pop-in': 'pop-in 140ms ease-out',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.2, 0, 0, 1)',
        'slide-in-left': 'slide-in-left 200ms cubic-bezier(0.2, 0, 0, 1)',
        shimmer: 'shimmer 1.4s infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
