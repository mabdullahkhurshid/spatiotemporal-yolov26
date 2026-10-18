import { CheckCircle2, Hand, ImageOff, XCircle } from 'lucide-react';
import { Drawer } from '../ui/Dialog';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { assetUrl, formatDateTime, formatPercent, formatRelative } from '../../utils/format';
import { RESOLUTION_LABEL, cameraLocation, cameraName, isOpen, orgName } from './alertUtils';
import ConfidenceMeter from './ConfidenceMeter';

const ACTION_LABEL = {
  CREATED: 'Detected',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
  FALSE_ALARM: 'Marked false alarm',
};

const Row = ({ label, children }) => (
  <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2 text-sm">
    <dt className="text-fg-muted">{label}</dt>
    <dd className="min-w-0 text-fg">{children}</dd>
  </div>
);

/** Full context for one alert: snapshot, readings, outcome and the action history. */
const AlertDetailDrawer = ({ alert, onClose, actions, showOrganization }) => {
  if (!alert) return null;
  const snapshot = assetUrl(alert.frameSnapshotURL || alert.alertImage);
  const open = isOpen(alert);

  return (
    <Drawer
      open={Boolean(alert)}
      onClose={onClose}
      title={cameraName(alert)}
      width="max-w-lg"
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="alert" value={alert.status} />
          <StatusBadge kind="severity" value={alert.intensityLevel} />
          <span className="text-fg-subtle">{formatRelative(alert.timestamp)}</span>
        </span>
      }
      footer={
        open && (
          <>
            <Button variant="ghost" icon={XCircle} onClick={() => actions.falseAlarm(alert)}>
              False alarm
            </Button>
            {alert.status === 'active' && (
              <Button variant="secondary" icon={CheckCircle2} onClick={() => actions.requestResolve(alert)}>
                Resolve
              </Button>
            )}
            {alert.status === 'active' ? (
              <Button icon={Hand} loading={actions.isPending(alert, 'acknowledge')} onClick={() => actions.acknowledge(alert)}>
                Acknowledge
              </Button>
            ) : (
              <Button icon={CheckCircle2} onClick={() => actions.requestResolve(alert)}>
                Resolve
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-6">
        <figure className="overflow-hidden rounded-lg border border-line bg-surface-2">
          {snapshot ? (
            <img src={snapshot} alt={`Frame captured from ${cameraName(alert)} when the alert was raised`} className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-fg-subtle">
              <ImageOff size={22} aria-hidden="true" />
              <span className="text-xs">No snapshot was captured for this alert</span>
            </div>
          )}
        </figure>

        <section aria-labelledby="readings-heading">
          <h3 id="readings-heading" className="eyebrow mb-3">
            Detection
          </h3>
          <div className="space-y-3">
            <ConfidenceMeter label="Fire" value={alert.fireConfidence} tone="critical" />
            <ConfidenceMeter label="Smoke" value={alert.smokeConfidence} tone="smoke" />
          </div>
          {alert.averageConfidence !== undefined && (
            <p className="mt-3 text-xs text-fg-muted">
              Confirmed over consecutive frames · average confidence {formatPercent(alert.averageConfidence, 1)}
              {alert.primaryClass ? ` · primary class: ${alert.primaryClass}` : ''}
            </p>
          )}
        </section>

        <section aria-labelledby="details-heading">
          <h3 id="details-heading" className="eyebrow mb-1">
            Details
          </h3>
          <dl className="divide-y divide-line">
            <Row label="Camera">{cameraName(alert)}</Row>
            {cameraLocation(alert) && <Row label="Location">{cameraLocation(alert)}</Row>}
            {showOrganization && orgName(alert) && <Row label="Organization">{orgName(alert)}</Row>}
            <Row label="Detected">{formatDateTime(alert.timestamp)}</Row>
            {alert.acknowledgedAt && <Row label="Acknowledged">{formatDateTime(alert.acknowledgedAt)}</Row>}
            {alert.resolvedAt && <Row label="Closed">{formatDateTime(alert.resolvedAt)}</Row>}
            {alert.resolvedBy?.name && <Row label="Closed by">{alert.resolvedBy.name}</Row>}
            {!open && alert.resolutionType && <Row label="Outcome">{RESOLUTION_LABEL[alert.resolutionType] || alert.resolutionType}</Row>}
            {!open && alert.resolutionNote && <Row label="Note">{alert.resolutionNote}</Row>}
          </dl>
        </section>

        {alert.actions?.length > 0 && (
          <section aria-labelledby="history-heading">
            <h3 id="history-heading" className="eyebrow mb-3">
              History
            </h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {[...alert.actions].reverse().map((step, i) => (
                <li key={step._id || i} className="relative">
                  <span
                    className={`absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${
                      step.type === 'CREATED' ? 'bg-critical' : step.type === 'ACKNOWLEDGED' ? 'bg-warning' : step.type === 'RESOLVED' ? 'bg-success' : 'bg-fg-subtle'
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-fg">{ACTION_LABEL[step.type] || step.type}</p>
                  <p className="text-xs text-fg-subtle">{formatDateTime(step.at)}</p>
                  {step.note && <p className="mt-1 text-sm text-fg-muted">{step.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Drawer>
  );
};

export default AlertDetailDrawer;
