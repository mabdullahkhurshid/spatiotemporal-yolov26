import { AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

/** Empty state that explains what is missing and offers the next step. */
export const EmptyState = ({ icon: Icon, title, description, action, className, compact = false }) => (
  <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
    {Icon && (
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-fg-subtle">
        <Icon size={20} aria-hidden="true" />
      </span>
    )}
    <p className="text-sm font-semibold text-fg">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Error state with a retry action. */
export const ErrorState = ({ title = 'Something went wrong', description, onRetry, className }) => (
  <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-critical-soft text-critical-fg">
      <AlertCircle size={20} aria-hidden="true" />
    </span>
    <p className="text-sm font-semibold text-fg">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
    {onRetry && (
      <Button variant="secondary" size="sm" icon={RotateCw} className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const Skeleton = ({ className }) => (
  <span
    aria-hidden="true"
    className={cn('relative block overflow-hidden rounded bg-surface-2', 'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent dark:after:via-white/5', className)}
  />
);

export const Spinner = ({ size = 16, className, label = 'Loading' }) => (
  <span role="status" className={cn('inline-flex items-center text-fg-subtle', className)}>
    <Loader2 size={size} className="animate-spin" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </span>
);

/** Inline notice (info / warning / critical / success). */
export const Notice = ({ tone = 'info', icon: Icon = AlertCircle, title, children, action, className }) => {
  const tones = {
    info: 'border-info-line bg-info-soft text-info-fg',
    warning: 'border-warning-line bg-warning-soft text-warning-fg',
    critical: 'border-critical-line bg-critical-soft text-critical-fg',
    success: 'border-success-line bg-success-soft text-success-fg',
  };
  return (
    <div role={tone === 'critical' ? 'alert' : 'status'} className={cn('flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center', tones[tone], className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  );
};
