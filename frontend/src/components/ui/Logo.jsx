import { cn } from '../../utils/cn';

export const PRODUCT_NAME = 'FireGuard AI';

/** Shield + flame mark. Single colour so it works on light, dark and the sidebar. */
export const LogoMark = ({ size = 28, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
    <path d="M16 2.5 4.5 6.9v8.4c0 7.3 4.8 12.6 11.5 14.2 6.7-1.6 11.5-6.9 11.5-14.2V6.9L16 2.5Z" fill="#2B59D9" />
    <path
      d="M16.4 8.2c.5 2.4-.8 3.9-2.1 5.3-1.3 1.4-2.6 2.8-2.6 5a4.3 4.3 0 0 0 8.6 0c0-1.5-.5-2.7-1.4-3.7-.1 1.1-.6 1.9-1.4 2.4.3-2.7-.3-6-1.1-9Z"
      fill="#fff"
    />
  </svg>
);

/** Mark + wordmark. `tone="light"` for dark backgrounds (sidebar). */
const Logo = ({ size = 28, tone = 'default', subtitle, className }) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <LogoMark size={size} />
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={cn('truncate text-[0.9375rem] font-semibold tracking-tight', tone === 'light' ? 'text-sidebar-fg' : 'text-fg')}>
        FireGuard<span className={tone === 'light' ? 'text-brand-300' : 'text-brand-600 dark:text-brand-300'}> AI</span>
      </span>
      {subtitle && <span className={cn('truncate text-2xs', tone === 'light' ? 'text-sidebar-muted' : 'text-fg-subtle')}>{subtitle}</span>}
    </span>
  </span>
);

export default Logo;
