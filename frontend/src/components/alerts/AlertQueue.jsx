import { ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../ui/Badge';
import { EmptyState, Skeleton } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { formatDateTime, formatRelative } from '../../utils/format';
import AlertActions from './AlertActions';
import { cameraLocation, cameraName, compareByUrgency, isOpen } from './alertUtils';

/** Compact, actionable list of open alerts for dashboards. */
const AlertQueue = ({ alerts, actions, onView, loading = false, limit = 6, emptyTitle = 'No alerts need attention', emptyDescription = 'All cameras are clear.' }) => {
  const open = alerts.filter(isOpen).sort(compareByUrgency).slice(0, limit);

  if (loading && alerts.length === 0) {
    return (
      <ul className="divide-y divide-line">
        {[0, 1, 2].map((i) => (
          <li key={i} className="space-y-2 px-4 py-4 sm:px-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  if (open.length === 0) {
    return <EmptyState icon={ShieldCheck} title={emptyTitle} description={emptyDescription} compact />;
  }

  return (
    <ul className="divide-y divide-line">
      {open.map((alert) => (
        <li key={alert._id} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5', alert.status === 'active' && 'bg-critical-soft/40')}>
          <button type="button" onClick={() => onView?.(alert)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', alert.status === 'active' ? 'animate-pulse-ring bg-critical' : 'bg-warning')} aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-fg">{cameraName(alert)}</span>
                <StatusBadge kind="severity" value={alert.intensityLevel} size="xs" />
              </span>
              <span className="mt-0.5 block truncate text-xs text-fg-muted">
                {[cameraLocation(alert), `Fire ${Math.round(alert.fireConfidence)}% · Smoke ${Math.round(alert.smokeConfidence)}%`].filter(Boolean).join(' · ')}
              </span>
              <time dateTime={alert.timestamp} title={formatDateTime(alert.timestamp)} className="mt-0.5 block text-xs text-fg-subtle">
                {alert.status === 'active' ? 'Detected' : 'Acknowledged'} {formatRelative(alert.status === 'active' ? alert.timestamp : alert.acknowledgedAt || alert.timestamp)}
              </time>
            </span>
          </button>
          <AlertActions alert={alert} actions={actions} onView={onView} className="sm:shrink-0" />
        </li>
      ))}
    </ul>
  );
};

export default AlertQueue;
