import { useEffect, useMemo, useState } from 'react';
import { getIncident, getIncidents, getIncidentStats } from '../../services/apiEndpoints';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};

const OrgAdminReports = () => {
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [statsRes, listRes] = await Promise.all([
          getIncidentStats(),
          getIncidents({ limit: 100 }),
        ]);
        if (!cancelled) {
          setStats(statsRes.data.data);
          const rows = listRes.data.data || [];
          setIncidents(rows);
          if (rows.length > 0) {
            setSelectedId(rows[0]._id);
          }
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
      .then((res) => {
        if (!cancelled) setDetail(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const areaSeries = useMemo(() => {
    if (!detail?.bboxAreaTimeline?.length) return [];
    return detail.bboxAreaTimeline.map((point) => ({
      time: formatDate(point.t),
      area: Number(point.area?.toFixed(4) || 0),
    }));
  }, [detail]);

  const confidenceSeries = useMemo(
    () =>
      incidents.slice(0, 12).map((inc) => ({
        camera: inc.cameraId?.displayNumber || inc.cameraId?.label || 'Cam',
        fire: inc.peakFireConfidence || 0,
        smoke: inc.peakSmokeConfidence || 0,
      })),
    [incidents]
  );

  const exportCsv = () => {
    const header = 'id,camera,status,startedAt,endedAt,frequency,spread,peakFire,peakSmoke\n';
    const rows = incidents
      .map((inc) =>
        [
          inc._id,
          inc.cameraId?.displayNumber || inc.cameraId?.label || '',
          inc.status,
          inc.startedAt,
          inc.endedAt || '',
          inc.detectionFrequencyPerMin,
          inc.estimatedSpreadRate,
          inc.peakFireConfidence,
          inc.peakSmokeConfidence,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fire-incidents.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Incident analytics from server-side YOLOv26 inference (CPU / ONNX)
          </p>
        </div>
        <button type="button" onClick={exportCsv} className="btn-primary" disabled={!incidents.length}>
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="card text-gray-600 dark:text-gray-400">Loading incident analytics…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total incidents', value: stats?.total ?? 0 },
              { label: 'Active', value: stats?.active ?? 0 },
              { label: 'Avg frequency / min', value: Number(stats?.avgFrequency || 0).toFixed(1) },
              { label: 'Peak fire conf.', value: `${Number(stats?.peakFire || 0).toFixed(1)}%` },
            ].map((item) => (
              <div key={item.label} className="card">
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Peak confidence by incident</h2>
              {confidenceSeries.length === 0 ? (
                <p className="text-gray-500">No incidents recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={confidenceSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="camera" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="fire" fill="#ef4444" name="Fire %" />
                    <Bar dataKey="smoke" fill="#64748b" name="Smoke %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">BBox area growth (spread proxy)</h2>
              <select
                className="input mb-4 w-full max-w-md"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {incidents.map((inc) => (
                  <option key={inc._id} value={inc._id}>
                    {inc.cameraId?.displayNumber || inc.cameraId?.label || inc._id} —{' '}
                    {formatDate(inc.startedAt)}
                  </option>
                ))}
              </select>
              {areaSeries.length === 0 ? (
                <p className="text-gray-500">Select an incident with timeline samples.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={areaSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="area" stroke="#f97316" fill="#fed7aa" name="BBox area" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Detection frequency trend (recent incidents)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={incidents.slice(0, 20).map((inc, idx) => ({
                  idx: idx + 1,
                  frequency: inc.detectionFrequencyPerMin || 0,
                  spread: inc.estimatedSpreadRate || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="idx" label={{ value: 'Incident #', position: 'insideBottom', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="frequency" stroke="#2563eb" name="Freq / min" />
                <Line type="monotone" dataKey="spread" stroke="#16a34a" name="Spread est." />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default OrgAdminReports;
