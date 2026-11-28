import { useEffect, useState } from 'react';
import { BrainCircuit, MapPinned, ScanSearch, ShieldQuestion } from 'lucide-react';
import { getAlertInsights } from '../../services/apiEndpoints';
import Card, { CardBody, CardHeader } from '../ui/Card';
import Badge from '../ui/Badge';
import DataTable from '../ui/DataTable';
import { EmptyState, Skeleton } from '../ui/Feedback';
import { Select } from '../ui/Field';
import { cn } from '../../utils/cn';
import { formatDateTime, formatNumber, formatPercent } from '../../utils/format';
import useAuthedAsset from '../../hooks/useAuthedAsset';
import { FALSE_ALARM_CAUSE_LABEL } from './alertUtils';
import { LOW_FOCUS } from './AlertExplanation';

// One hue for magnitude (bars and location cells), matching the Reports "brand" series.
const BRAND = '43 89 217';
const CAUSE_LABEL = { ...FALSE_ALARM_CAUSE_LABEL, UNSPECIFIED: 'Not specified' };
const MAP_VIEWS = [
  { value: 'all', label: 'All detections' },
  { value: 'real', label: 'Real fires' },
  { value: 'falseAlarm', label: 'False alarms' },
];

const percentOrDash = (value) => (value === null || value === undefined ? '—' : formatPercent(value * 100));

/** State of the false-alarm likelihood model: learning (label progress) or active (quality, version). */
export const RiskModelCard = ({ model, loading, className }) => (
  <Card className={className}>
    <CardHeader title="False-alarm model" description="Learns from how operators close alerts. Advisory only." icon={BrainCircuit} />
    <CardBody className="space-y-3">
      {loading || !model ? (
        <>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-2.5 w-full" />
        </>
      ) : model.state === 'active' ? (
        <>
          <div className="flex items-center gap-2">
            <Badge tone="success" dot>
              Active
            </Badge>
            {model.rocAuc !== undefined && <span className="tabular text-sm text-fg-muted">Accuracy (ROC-AUC) {model.rocAuc.toFixed(2)}</span>}
          </div>
          <p className="text-xs text-fg-muted">
            Trained {model.trainedAt ? formatDateTime(model.trainedAt) : 'recently'}
            {model.metrics?.samples ? ` on ${formatNumber(model.metrics.samples)} labelled alerts` : ''}. It retrains daily as operators label more alerts.
          </p>
          {model.version && <p className="truncate text-2xs text-fg-subtle">{model.version}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Badge tone="info" dot>
              Learning
            </Badge>
            <span className="tabular text-sm font-medium text-fg">{model.labelProgress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label="Labelled alerts collected"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={model.labelProgress}
          >
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${model.labelProgress}%` }} />
          </div>
          <p className="text-xs text-fg-muted">
            Starts after {model.requirements.minSamples} closed alerts with at least {model.requirements.minPerClass} false alarms and{' '}
            {model.requirements.minPerClass} real fires.
            {model.labels && ` Platform so far: ${model.labels.falseAlarms} false alarms, ${model.labels.realFires} real fires.`}{' '}
            {model.labelledHere > 0 && `${formatNumber(model.labelledHere)} labelled here.`} Choosing a cause when marking a false alarm helps.
          </p>
          {model.message && <p className="text-2xs text-fg-subtle">{model.message}</p>}
        </>
      )}
    </CardBody>
  </Card>
);

const FalseAlarmCauses = ({ causes }) => {
  const max = Math.max(1, ...causes.map((c) => c.count));
  const total = causes.reduce((s, c) => s + c.count, 0);
  return (
    <ul className="space-y-3">
      {causes.map((c) => (
        <li key={c.cause} title={`${CAUSE_LABEL[c.cause] || c.cause}: ${c.count} of ${total} false alarms`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fg">{CAUSE_LABEL[c.cause] || c.cause}</span>
            <span className="tabular text-fg-muted">
              {formatNumber(c.count)} <span className="text-fg-subtle">· {formatPercent((c.count / total) * 100)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-3">
            <span className="block h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: `rgb(${BRAND})` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Where fire/smoke boxes appeared in one camera's view, as a grid over its latest snapshot. */
const DetectionLocationMap = ({ locations }) => {
  const [view, setView] = useState('all');
  const [hover, setHover] = useState(null);
  const counts = locations[view] || [];
  const max = Math.max(1, ...counts);
  const total = counts.reduce((s, v) => s + v, 0);
  const background = useAuthedAsset(locations.backgroundURL);

  const cellText = (i) => {
    const row = Math.floor(i / locations.cols) + 1;
    const col = (i % locations.cols) + 1;
    return `Row ${row}, column ${col}: ${locations.all[i]} detections (${locations.real[i]} real fires, ${locations.falseAlarm[i]} false alarms)`;
  };
  const busiest = counts
    .map((count, i) => ({ count, i }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Detections to show">
        {MAP_VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => setView(v.value)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              view === v.value ? 'border-brand-500 bg-info-soft text-fg' : 'border-line-strong text-fg-muted hover:bg-surface-2'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div
        className="relative overflow-hidden rounded-lg border border-line bg-surface-2"
        role="img"
        aria-label={`Detection locations, ${MAP_VIEWS.find((v) => v.value === view).label.toLowerCase()}: ${total} boxes. ${busiest.map((c) => cellText(c.i)).join('. ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {background ? (
          <img src={background} alt="" className="block h-auto w-full opacity-80" />
        ) : (
          <div className="aspect-video w-full" />
        )}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${locations.cols}, 1fr)`, gridTemplateRows: `repeat(${locations.rows}, 1fr)` }}
        >
          {counts.map((count, i) => (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              className={cn('border border-white/10', hover === i && 'ring-2 ring-inset ring-white')}
              style={{ background: count ? `rgb(${BRAND} / ${0.15 + 0.65 * (count / max)})` : 'transparent' }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <span className="min-h-[1rem]">{hover !== null ? cellText(hover) : `${formatNumber(total)} fire/smoke boxes. Hover a cell for counts.`}</span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Fewer
          <span className="h-2 w-16 rounded-full" style={{ background: `linear-gradient(to right, rgb(${BRAND} / 0.15), rgb(${BRAND} / 0.8))` }} />
          More
        </span>
      </div>
    </div>
  );
};

/**
 * Explainability insights for Reports: why false alarms happen, where detections appear per camera,
 * how much the model's focus can be trusted, and the false-alarm model's state.
 */
const ExplainabilityInsights = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraId, setCameraId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAlertInsights(cameraId ? { cameraId } : undefined)
      .then((res) => !cancelled && setData(res.data.data))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cameraId]);

  const summary = data?.summary;
  const cameras = data?.cameras || [];
  const columns = [
    {
      key: 'camera',
      header: 'Camera',
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{c.name}</p>
          <p className="truncate text-xs text-fg-muted">{c.location}</p>
        </div>
      ),
    },
    { key: 'alerts', header: 'Alerts', align: 'right', cell: (c) => <span className="tabular text-sm">{formatNumber(c.alerts)}</span> },
    { key: 'fa', header: 'False alarm rate', align: 'right', cell: (c) => <span className="tabular text-sm">{percentOrDash(c.falseAlarmRate)}</span> },
    {
      key: 'cause',
      header: 'Main cause',
      hideBelow: 'lg',
      cell: (c) => <span className="text-sm text-fg-muted">{c.topCause ? `${CAUSE_LABEL[c.topCause.cause] || c.topCause.cause} (${c.topCause.count})` : '—'}</span>,
    },
    {
      key: 'focus',
      header: 'Model focus',
      align: 'right',
      cell: (c) =>
        c.avgFocus === null ? (
          <span className="text-sm text-fg-subtle">—</span>
        ) : (
          <Badge tone={c.avgFocus < LOW_FOCUS ? 'warning' : 'neutral'} size="xs">
            {formatPercent(c.avgFocus * 100)}
          </Badge>
        ),
    },
    { key: 'lookalike', header: 'Look-alike flags', align: 'right', hideBelow: 'xl', cell: (c) => <span className="tabular text-sm">{formatNumber(c.lookalikes)}</span> },
  ];

  return (
    <section aria-labelledby="xai-heading" className="space-y-6">
      <div>
        <h2 id="xai-heading" className="text-lg font-medium text-fg">
          Explainable AI
        </h2>
        <p className="text-sm text-fg-muted">
          Why alerts were raised and closed over the last {data?.days || 90} days: false-alarm causes, where each camera detects, and how well the model focused.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <RiskModelCard model={data?.model} loading={loading && !data} />
        <Card>
          <CardHeader title="Why false alarms happened" description="Causes chosen by operators." icon={ShieldQuestion} />
          <CardBody>
            {loading && !data ? (
              <Skeleton className="h-32 w-full" />
            ) : data?.causes?.length ? (
              <FalseAlarmCauses causes={data.causes} />
            ) : (
              <EmptyState title="No false alarms yet" description="Causes appear once operators mark false alarms." compact />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Model focus" description="Share of heatmap attention inside the detected box." icon={ScanSearch} />
          <CardBody className="space-y-3">
            {loading && !data ? (
              <Skeleton className="h-20 w-full" />
            ) : summary?.explained ? (
              <>
                <p className="tabular text-3xl font-semibold text-fg">{percentOrDash(summary.avgFocus)}</p>
                <p className="text-xs text-fg-muted">
                  Average over {formatNumber(summary.explained)} explained alerts. {formatNumber(summary.lowFocus)} had focus below{' '}
                  {formatPercent(LOW_FOCUS * 100)}, and {formatNumber(summary.lookalikes)} were flagged as possible look-alikes.
                </p>
              </>
            ) : (
              <EmptyState title="No heatmaps yet" description="Turn on the explainer (XAI_ENABLED) to measure model focus." compact />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Where detections appear"
            description="Fire/smoke box centres in one camera's view."
            icon={MapPinned}
            actions={
              cameras.length > 0 && (
                <Select
                  value={data?.locations?.cameraId || ''}
                  onChange={(e) => setCameraId(e.target.value)}
                  aria-label="Camera"
                  className="w-48 max-w-full text-xs"
                >
                  {cameras.map((c) => (
                    <option key={c.cameraId} value={c.cameraId}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )
            }
          />
          <CardBody>
            {loading && !data ? (
              <Skeleton className="aspect-video w-full" />
            ) : data?.locations ? (
              <DetectionLocationMap key={data.locations.cameraId} locations={data.locations} />
            ) : (
              <EmptyState title="No detections yet" compact />
            )}
          </CardBody>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Cameras" description="False alarms and model focus per camera. Low focus or many look-alikes suggests glare or lights in view." />
          <DataTable
            caption="Explainability by camera"
            columns={columns}
            rows={cameras}
            rowKey={(c) => c.cameraId}
            loading={loading && !data}
            empty={<EmptyState title="No alerts in this period" compact />}
          />
        </Card>
      </div>
    </section>
  );
};

export default ExplainabilityInsights;
