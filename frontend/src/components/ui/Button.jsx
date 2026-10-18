import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-line-strong bg-surface text-fg shadow-xs hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-critical text-white shadow-xs hover:brightness-95 active:brightness-90',
  'danger-ghost': 'text-critical-fg hover:bg-critical-soft',
  link: 'h-auto px-0 text-brand-600 hover:underline underline-offset-2 dark:text-brand-300',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[0.9375rem] gap-2',
};

/**
 * Button with consistent variants. Pass `as={Link}` (plus `to`) to render a router link that looks like a button.
 */
const Button = forwardRef(function Button(
  { as: Component = 'button', variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, type, ...props },
  ref
) {
  const isButton = Component === 'button';
  return (
    <Component
      ref={ref}
      type={isButton ? type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        variant === 'link' && 'h-auto',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'xs' ? 14 : 16} aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === 'xs' ? 14 : 16} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={size === 'xs' ? 14 : 16} aria-hidden="true" />}
    </Component>
  );
});

export default Button;
