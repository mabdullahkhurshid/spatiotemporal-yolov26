import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw, ShieldCheck, SearchX, SlidersHorizontal } from 'lucide-react';
import { fetchAlerts } from '../../store/slices/alertSlice';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import Tabs from '../ui/Tabs';
import Button from '../ui/Button';
import Badge, { StatusBadge } from '../ui/Badge';
import DataTable, { Pagination } from '../ui/DataTable';
import { EmptyState } from '../ui/Feedback';
import { SearchInput, Select } from '../ui/Field';
import { cn } from '../../utils/cn';
import { formatDateTime, formatRelative } from '../../utils/format';
import AlertActions from './AlertActions';
import AlertDetailDrawer from './AlertDetailDrawer';
import useAlertActions from './useAlertActions';
import { PERIODS, cameraLocation, cameraName, cameraOf, compareByNewest, compareByUrgency, orgName } from './alertUtils';

const PAGE_SIZE = 20;

const TABS = [
  { value: 'attention', label: 'Needs attention', match: (a) => a.status === 'active' || a.status === 'acknowledged' },
  { value: 'resolved', label: 'Resolved', match: (a) => a.status === 'resolved' },
  { value: 'false_alarm', label: 'False alarms', match: (a) => a.status === 'false_alarm' },
  { value: 'all', label: 'All', match: () => true },
];

/**
 * The alert queue used by org admins, operators and super admins.
 * `scope`: 'organization' | 'assigned' | 'platform' (adds the organization column).
 */
const AlertsWorkspace = ({ title = 'Alerts', description, scope = 'organization' }) => {
  const dispatch = useDispatch();
  const { alerts, loading, error } = useSelector((state) => state.alerts);
  const actions = useAlertActions();
  const platform = scope === 'platform';

  const [tab, setTab] = useState('attention');
  const [query, setQuery] = useState('');
  const [camera, setCamera] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [period, setPeriod] = useState('30d');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = () => dispatch(fetchAlerts({ limit: 200 }));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => setPage(1), [tab, query, camera, severity, period]);

  const cameraOptions = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      const cam = cameraOf(a);
      if (cam?._id) map.set(cam._id, cam.name || cam.label);
    });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [alerts]);

  // Everything except the tab, so tab counts reflect the other filters.
  const filtered = useMemo(() => {
    const cutoff = PERIODS.find((p) => p.value === period)?.ms;
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (camera !== 'all' && cameraOf(a)?._id !== camera) return false;
      if (severity !== 'all' && a.intensityLevel !== severity) return false;
      if (cutoff && Date.now() - new Date(a.timestamp).getTime() > cutoff && a.status !== 'active') return false;
      if (q && ![cameraName(a), cameraLocation(a), orgName(a)].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [alerts, camera, severity, period, query]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, filtered.filter(t.match).length])), [filtered]);

  const rows = useMemo(() => {
    const current = TABS.find((t) => t.value === tab);
    return filtered.filter(current.match).sort(tab === 'attention' ? compareByUrgency : compareByNewest);
  }, [filtered, tab]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = alerts.find((a) => a._id === selectedId) || null;
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const filtersActive = query || camera !== 'all' || severity !== 'all' || period !== '30d';
  const filterCount = [camera !== 'all', severity !== 'all', period !== '30d'].filter(Boolean).length;

  const alertContext = (a) => [platform && orgName(a), cameraLocation(a)].filter(Boolean).join(' · ');

  const columns = [
    {
      key: 'camera',
      header: 'Alert',
      primary: true,
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn('hidden h-9 w-1 shrink-0 rounded-full md:block', a.status === 'active' ? 'bg-critical' : a.status === 'acknowledged' ? 'bg-warning' : 'bg-line-strong')}
            aria-hidden="true"
          />
          {/* Cap the width so long organization/location text truncates instead of pushing the actions out of view. */}
          <div className="min-w-0 max-w-[9.5rem] lg:max-w-xs xl:max-w-sm">
            <p className="truncate font-medium text-fg">{cameraName(a)}</p>
            <p className="truncate text-xs text-fg-muted" title={alertContext(a) || undefined}>
              {alertContext(a) || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'severity', header: 'Severity', cell: (a) => <StatusBadge kind="severity" value={a.intensityLevel} /> },
    {
      key: 'detection',
      header: 'Fire / smoke',
      hideBelow: 'lg',
      cell: (a) => (
        <span className="tabular text-sm text-fg-muted">
          <span className="font-medium text-fg">{Math.round(a.fireConfidence)}%</span> / {Math.round(a.smokeConfidence)}%
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge kind="alert" value={a.status} /> },
    {
      key: 'time',
      header: 'Detected',
      cell: (a) => (
        <time dateTime={a.timestamp} title={formatDateTime(a.timestamp)} className="whitespace-nowrap text-sm text-fg-muted">
          {formatRelative(a.timestamp)}
        </time>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (a) => <AlertActions alert={a} actions={actions} onView={(x) => setSelectedId(x._id)} />,
    },
  ];

  const resetFilters = () => {
    setQuery('');
    setCamera('all');
    setSeverity('all');
    setPeriod('30d');
  };

  const empty =
    tab === 'attention' && !filtersActive ? (
      <EmptyState icon={ShieldCheck} title="No alerts need attention" description="All cameras are clear. New detections appear here instantly." />
    ) : (
      <EmptyState
        icon={SearchX}
        title="No alerts match"
        description="Try a different view or clear the filters."
        action={
          filtersActive && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          )
        }
      />
    );

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        meta={
          <>
            <Badge tone="success" dot>
              Live
            </Badge>
            {activeCount > 0 && (
              <Badge tone="critical" dot pulse>
                {activeCount} unacknowledged
              </Badge>
            )}
          </>
        }
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="px-4 pt-3 sm:px-5">
          <Tabs
            label="Alert views"
            value={tab}
            onChange={setTab}
            items={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value], tone: t.value === 'attention' ? 'critical' : undefined }))}
          />
        </div>

        <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_10rem]">
          <div className="flex gap-2 sm:contents">
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={platform ? 'Search camera, location or organization' : 'Search camera or location'} label="Search alerts" />
            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              aria-expanded={filtersOpen}
              aria-controls="alert-filters"
              onClick={() => setFiltersOpen((v) => !v)}
              className="sm:hidden"
            >
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
          </div>
          <div id="alert-filters" className={cn('grid gap-2 sm:contents', !filtersOpen && 'hidden')}>
          <Select value={camera} onChange={(e) => setCamera(e.target.value)} aria-label="Camera">
            <option value="all">All cameras</option>
            {cameraOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Time period">
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          </div>
        </div>

        <DataTable
          caption={`${title}: ${TABS.find((t) => t.value === tab).label}`}
          columns={columns}
          rows={pageRows}
          loading={loading && alerts.length === 0}
          error={error && alerts.length === 0 ? error : null}
          onRetry={load}
          empty={empty}
          onRowClick={(a) => setSelectedId(a._id)}
          rowClassName={(a) => (a.status === 'active' ? 'bg-critical-soft/40' : undefined)}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
      </Card>

      <AlertDetailDrawer alert={selected} onClose={() => setSelectedId(null)} actions={actions} showOrganization={platform} />
      {actions.dialogs}
    </div>
  );
};

export default AlertsWorkspace;
