import { cn } from '../../utils/cn';

/** Quota meter: neutral below 80%, warning from 80%, critical only when the limit is reached. */
const UsageBar = ({ label, used = 0, limit, icon: Icon, className }) => {
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const tone = used >= safeLimit && limit > 0 ? 'bg-critical' : pct >= 80 ? 'bg-warning' : 'bg-brand-600';

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-fg">
          {Icon && <Icon size={16} className="text-fg-subtle" aria-hidden="true" />}
          {label}
        </span>
        <span className="tabular text-fg-muted">
          <span className="font-medium text-fg">{used}</span> of {limit ?? '—'}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit || 0}
        aria-valuenow={used}
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default UsageBar;
