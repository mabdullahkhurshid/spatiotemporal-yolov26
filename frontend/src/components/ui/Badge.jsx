import { cn } from '../../utils/cn';
import { statusMeta } from './status';

const TONES = {
  neutral: 'bg-surface-2 text-fg-muted ring-line',
  brand: 'bg-info-soft text-info-fg ring-info-line',
  critical: 'bg-critical-soft text-critical-fg ring-critical-line',
  warning: 'bg-warning-soft text-warning-fg ring-warning-line',
  success: 'bg-success-soft text-success-fg ring-success-line',
  info: 'bg-info-soft text-info-fg ring-info-line',
  'critical-solid': 'bg-critical text-white ring-transparent',
};

const DOTS = {
  neutral: 'bg-fg-subtle',
  brand: 'bg-info',
  critical: 'bg-critical',
  warning: 'bg-warning',
  success: 'bg-success',
  info: 'bg-info',
  'critical-solid': 'bg-white',
};

/** Small status label. Color is never the only signal: badges always carry text. */
const Badge = ({ tone = 'neutral', dot = false, pulse = false, size = 'sm', className, children }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
      size === 'xs' ? 'px-1.5 py-px text-2xs' : 'px-2 py-0.5 text-xs',
      TONES[tone],
      className
    )}
  >
    {dot && (
      <span
        className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone], pulse && 'animate-pulse-ring')}
        aria-hidden="true"
      />
    )}
    {children}
  </span>
);

export default Badge;

/** <StatusBadge kind="alert" value="active" /> */
export const StatusBadge = ({ kind, value, size, className }) => {
  const meta = statusMeta(kind, value);
  return (
    <Badge tone={meta.tone} dot={meta.dot} pulse={meta.pulse} size={size} className={className}>
      {meta.label}
    </Badge>
  );
};
