import { formatNumber } from '../../utils/format';
import { Skeleton } from '../ui/Feedback';

const SEGMENTS = [
  { key: 'active', label: 'Active', color: 'bg-critical' },
  { key: 'acknowledged', label: 'Acknowledged', color: 'bg-warning' },
  { key: 'resolved', label: 'Resolved', color: 'bg-success' },
  { key: 'falseAlarms', label: 'False alarm', color: 'bg-fg-subtle/60' },
];

/**
 * Where alerts ended up, as one stacked bar with a legend.
 * `stats` comes from GET /alerts/stats ({ total, active, resolved, falseAlarms, falseAlarmRate }).
 */
const AlertOutcomes = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  const total = stats.total || 0;
  const values = {
    active: stats.active || 0,
    resolved: stats.resolved || 0,
    falseAlarms: stats.falseAlarms || 0,
  };
  values.acknowledged = Math.max(0, total - values.active - values.resolved - values.falseAlarms);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={SEGMENTS.map((s) => `${s.label} ${values[s.key]}`).join(', ')}>
        {total > 0 &&
          SEGMENTS.map((s) =>
            values[s.key] > 0 ? <span key={s.key} className={`${s.color} h-full border-r-2 border-surface last:border-r-0`} style={{ width: `${(values[s.key] / total) * 100}%` }} /> : null
          )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {SEGMENTS.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span className={`h-2 w-2 rounded-full ${s.color}`} aria-hidden="true" />
              {s.label}
            </dt>
            <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{formatNumber(values[s.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-fg-subtle">
        {formatNumber(total)} alerts in total · false alarm rate {((stats.falseAlarmRate || 0) * 100).toFixed(1)}%
      </p>
    </div>
  );
};

export default AlertOutcomes;
