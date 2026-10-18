import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Skeleton } from './Feedback';

/**
 * A row of key figures separated by dividers (one surface, not a grid of decorated cards).
 *   <StatGroup items={[{ label, value, hint, tone, to }]} />
 */
export const StatGroup = ({ items, loading = false, className }) => (
  <div className={cn('grid overflow-hidden rounded-lg border border-line bg-surface', COLS[items.length] || 'sm:grid-cols-2 lg:grid-cols-4', className)}>
    {items.map((item, i) => (
      <Stat key={item.label} {...item} loading={loading} index={i} />
    ))}
  </div>
);

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

const TONE_VALUE = {
  critical: 'text-critical-fg',
  warning: 'text-warning-fg',
  success: 'text-success-fg',
};

const Stat = ({ label, value, hint, tone, to, loading, icon: Icon }) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          {tone === 'critical' && Number(value) > 0 && <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-critical" aria-hidden="true" />}
          {Icon && <Icon size={14} className="text-fg-subtle" aria-hidden="true" />}
          {label}
        </p>
        {to && <ArrowUpRight size={14} className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className={cn('tabular mt-1.5 text-2xl font-semibold leading-8 tracking-tight', (tone && Number(value) > 0 && TONE_VALUE[tone]) || 'text-fg')}>
          {value}
        </p>
      )}
      {hint && <p className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</p>}
    </>
  );

  const base = 'group min-w-0 border-line p-4 sm:px-5 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r';
  return to ? (
    <Link to={to} className={cn(base, 'block transition-colors hover:bg-surface-2/60')}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
};

export default Stat;
