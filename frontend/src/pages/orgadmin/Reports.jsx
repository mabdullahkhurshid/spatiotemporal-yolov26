import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download } from 'lucide-react';
import { getIncident, getIncidents, getIncidentStats } from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { StatGroup } from '../../components/ui/Stat';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable, { Pagination } from '../../components/ui/DataTable';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import ExplainabilityInsights from '../../components/alerts/ExplainabilityInsights';
import { Select } from '../../components/ui/Field';
import { cameraTitle } from '../../utils/camera';
import { formatDate, formatDateTime, formatPercent, formatTime } from '../../utils/format';
import { cn } from '../../utils/cn';

// Chart colours carry meaning: fire = red, smoke = slate, trends = brand.
const C = { fire: '#D92D20', smoke: '#94A3B8', brand: '#2B59D9', growth: '#F79009', grid: 'rgb(148 163 184 / 0.22)', axis: '#7A8699' };
const AXIS = { tick: { fill: C.axis, fontSize: 12 }, tickLine: false, axisLine: false };
const PAGE_SIZE = 10;

const ChartTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium text-fg">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-fg-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <span className="tabular font-medium text-fg">{Number(p.value).toFixed(p.value % 1 ? 3 : 0)}{unit}</span>
        </p>
      ))}
    </div>
  );
};

const durationOf = (inc) => {
  const end = inc.endedAt ? new Date(inc.endedAt) : inc.status === 'active' ? new Date() : new Date(inc.lastSeenAt || inc.startedAt);
  const minutes = Math.max(0, Math.round((end - new Date(inc.startedAt)) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

const csvCell = (value) => {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const OrgAdminReports = () => {
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [statsRes, listRes] = await Promise.all([getIncidentStats(), getIncidents({ limit: 100 })]);
        if (!cancelled) {
          setStats(statsRes.data.data);
          const rows = listRes.data.data || [];
          setIncidents(rows);
          if (rows.length > 0) setSelectedId(rows[0]._id);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setIncidents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    getIncident(selectedId)
      .then((res) => !cancelled && setDetail(res.data.data))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const areaSeries = useMemo(
    () => (detail?.bboxAreaTimeline || []).map((point) => ({ time: formatTime(point.t), area: Number((point.area || 0).toFixed(4)) })),
    [detail]
  );

  const confidenceSeries = useMemo(
    () =>
      incidents
        .slice(0, 12)
        .reverse()
        .map((inc) => ({ name: `${cameraTitle(inc.cameraId)} · ${formatDate(inc.startedAt)}`, short: inc.cameraId?.displayNumber || cameraTitle(inc.cameraId), fire: inc.peakFireConfidence || 0, smoke: inc.peakSmokeConfidence || 0 })),
    [incidents]
  );

  const frequencySeries = useMemo(
    () =>
      incidents
        .slice(0, 20)
        .reverse()
        .map((inc) => ({ name: formatDate(inc.startedAt), frequency: inc.detectionFrequencyPerMin || 0 })),
    [incidents]
  );

  const exportCsv = () => {
    const header = ['id', 'camera', 'location', 'status', 'startedAt', 'endedAt', 'detectionsPerMin', 'spreadEstimate', 'peakFire', 'peakSmoke'];
    const rows = incidents.map((inc) =>
      [inc._id, cameraTitle(inc.cameraId), inc.cameraId?.location, inc.status, inc.startedAt, inc.endedAt, inc.detectionFrequencyPerMin, inc.estimatedSpreadRate, inc.peakFireConfidence, inc.peakSmokeConfidence]
        .map(csvCell)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'camera',
      header: 'Camera',
      primary: true,
      cell: (inc) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{cameraTitle(inc.cameraId)}</p>
          <p className="truncate text-xs text-fg-muted">{inc.cameraId?.location}</p>
        </div>
      ),
    },
    { key: 'started', header: 'Started', cell: (inc) => <span className="whitespace-nowrap text-sm text-fg-muted">{formatDateTime(inc.startedAt)}</span> },
    { key: 'duration', header: 'Duration', hideBelow: 'lg', cell: (inc) => <span className="tabular text-sm">{durationOf(inc)}</span> },
    {
      key: 'peak',
      header: 'Peak fire / smoke',
      cell: (inc) => (
        <span className="tabular text-sm">
          {formatPercent(inc.peakFireConfidence)} <span className="text-fg-subtle">/</span> {formatPercent(inc.peakSmokeConfidence)}
        </span>
      ),
    },
    { key: 'freq', header: 'Detections / min', hideBelow: 'xl', align: 'right', cell: (inc) => <span className="tabular text-sm">{Math.round(inc.detectionFrequencyPerMin || 0)}</span> },
    { key: 'status', header: 'Status', cell: (inc) => <StatusBadge kind="incident" value={inc.status} /> },
  ];

  const chartPlaceholder = <Skeleton className="h-[260px] w-full" />;
  const noData = <EmptyState icon={BarChart3} title="No incidents recorded yet" description="Charts fill in as the AI tracks fire and smoke events." compact />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Fire and smoke incidents tracked by the AI: how strong, how often, how fast they grew, and why alerts were raised."
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!incidents.length}>
            Export CSV
          </Button>
        }
        className="mb-0"
      />

      <StatGroup
        loading={loading}
        items={[
          { label: 'Incidents', value: stats?.total ?? 0, hint: 'All time' },
          { label: 'Ongoing', value: stats?.active ?? 0, tone: 'critical', hint: 'Still visible on camera' },
          { label: 'Avg. detections / min', value: Number(stats?.avgFrequency || 0).toFixed(1), hint: 'How persistent detections were' },
          { label: 'Highest fire confidence', value: formatPercent(stats?.peakFire, 1), hint: 'Across all incidents' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Peak confidence" description="Strongest fire and smoke reading per incident (latest 12)." />
          <CardBody>
            {loading ? (
              chartPlaceholder
            ) : confidenceSeries.length === 0 ? (
              noData
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={confidenceSeries} barGap={2} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="short" {...AXIS} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} {...AXIS} unit="%" />
                  <Tooltip content={<ChartTooltip unit="%" />} labelFormatter={(_, p) => p?.[0]?.payload?.name} cursor={{ fill: 'rgb(148 163 184 / 0.12)' }} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span style={{ color: 'rgb(var(--fg-muted))' }}>{value}</span>}
                  />
                  <Bar dataKey="fire" name="Fire" fill={C.fire} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="smoke" name="Smoke" fill={C.smoke} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Fire spread"
            description="Area covered by detections over time, for one incident."
            actions={
              incidents.length > 0 && (
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Incident" className="w-60 max-w-full text-xs">
                  {incidents.map((inc) => (
                    <option key={inc._id} value={inc._id}>
                      {cameraTitle(inc.cameraId)} — {formatDateTime(inc.startedAt)}
                    </option>
                  ))}
                </Select>
              )
            }
          />
          <CardBody>
            {loading ? (
              chartPlaceholder
            ) : areaSeries.length === 0 ? (
              incidents.length ? <p className="py-24 text-center text-sm text-fg-muted">This incident has no spread samples.</p> : noData
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={areaSeries} margin={{ left: -8, right: 8 }}>
                  <defs>
                    <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.growth} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.growth} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="time" {...AXIS} minTickGap={32} />
                  <YAxis {...AXIS} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="area" name="Frame area" stroke={C.growth} strokeWidth={2} fill="url(#spreadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Detection frequency" description="Detections per minute for recent incidents, oldest to newest." />
        <CardBody>
          {loading ? (
            chartPlaceholder
          ) : frequencySeries.length === 0 ? (
            noData
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={frequencySeries} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="name" {...AXIS} minTickGap={24} />
                <YAxis {...AXIS} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="frequency" name="Detections / min" stroke={C.brand} strokeWidth={2} dot={{ r: 3, fill: C.brand }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <ExplainabilityInsights />

      <Card>
        <CardHeader title="Incident log" description="Select an incident to show its spread above." />
        <DataTable
          caption="Incident log"
          columns={columns}
          rows={incidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          loading={loading}
          onRowClick={(inc) => {
            setSelectedId(inc._id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          rowClassName={(inc) => cn(inc._id === selectedId && 'bg-info-soft/60')}
          empty={noData}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={incidents.length} onChange={setPage} />
      </Card>
    </div>
  );
};

export default OrgAdminReports;
