import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  secondary: 'border border-line-strong bg-surface text-fg-muted shadow-xs hover:bg-surface-2 hover:text-fg',
  'danger-ghost': 'text-fg-muted hover:bg-critical-soft hover:text-critical-fg',
  sidebar: 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg',
};

const SIZES = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' };

/** Icon-only button. `label` is required: it becomes the accessible name and tooltip. */
const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, iconSize = 18, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      <Icon size={iconSize} aria-hidden="true" />
      {children}
    </button>
  );
});

export default IconButton;
