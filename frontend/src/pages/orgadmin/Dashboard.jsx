import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Flame, Video } from 'lucide-react';
import { fetchAlerts, fetchAlertStats } from '../../store/slices/alertSlice';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { getIncidents } from '../../services/apiEndpoints';
import { isCameraOnline, cameraTitle, findCameraById } from '../../utils/camera';
import { formatRelative, formatPercent } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import { StatGroup } from '../../components/ui/Stat';
import DataTable from '../../components/ui/DataTable';
import AlertQueue from '../../components/alerts/AlertQueue';
import AlertOutcomes from '../../components/alerts/AlertOutcomes';
import AlertDetailDrawer from '../../components/alerts/AlertDetailDrawer';
import useAlertActions from '../../components/alerts/useAlertActions';
import CameraHealthList from '../../components/cameras/CameraHealthList';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';

const orgNameOf = (user) => (typeof user?.organizationId === 'object' && user.organizationId?.name) || user?.organizationName || 'your organization';

const OrgAdminDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { cameras, loading: camerasLoading } = useSelector((state) => state.cameras);
  const { alerts, stats, loading: alertsLoading } = useSelector((state) => state.alerts);
  const actions = useAlertActions();
  const [incidents, setIncidents] = useState({ items: [], loading: true });
  const [selectedId, setSelectedId] = useState(null);
  const [liveCameraId, setLiveCameraId] = useState(null);

  useEffect(() => {
    dispatch(fetchAlertStats());
    dispatch(fetchCameras());
    dispatch(fetchAlerts({ limit: 100 }));
    getIncidents({ status: 'active', limit: 20 })
      .then((res) => setIncidents({ items: res.data.data || [], loading: false }))
      .catch(() => setIncidents({ items: [], loading: false }));
  }, [dispatch]);

  const online = cameras.filter((c) => isCameraOnline(c.status)).length;
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const acknowledgedCount = alerts.filter((a) => a.status === 'acknowledged').length;
  const selected = alerts.find((a) => a._id === selectedId) || null;
  const liveCamera = findCameraById(cameras, liveCameraId);

  const incidentColumns = [
    {
      key: 'camera',
      header: 'Camera',
      primary: true,
      cell: (i) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Flame size={16} className="shrink-0 text-critical" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{cameraTitle(i.cameraId)}</p>
            <p className="truncate text-xs text-fg-muted">{i.cameraId?.location}</p>
          </div>
        </div>
      ),
    },
    { key: 'started', header: 'Started', cell: (i) => <span className="text-sm text-fg-muted">{formatRelative(i.startedAt)}</span> },
    { key: 'peak', header: 'Peak fire', cell: (i) => <span className="tabular text-sm">{formatPercent(i.peakFireConfidence)}</span> },
    { key: 'freq', header: 'Detections / min', hideBelow: 'lg', cell: (i) => <span className="tabular text-sm">{Math.round(i.detectionFrequencyPerMin || 0)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Live status for ${orgNameOf(user)}.`}
        actions={
          <>
            <Button as={Link} to="/orgadmin/cameras" variant="secondary" icon={Video}>
              Cameras
            </Button>
            <Button as={Link} to="/orgadmin/alerts" iconRight={ArrowRight}>
              Open alerts
            </Button>
          </>
        }
        className="mb-0"
      />

      <StatGroup
        loading={alertsLoading && alerts.length === 0}
        items={[
          { label: 'Active alerts', value: activeCount, tone: 'critical', hint: 'Waiting to be acknowledged', to: '/orgadmin/alerts' },
          { label: 'In progress', value: acknowledgedCount, tone: 'warning', hint: 'Acknowledged, not yet resolved', to: '/orgadmin/alerts' },
          { label: 'Cameras online', value: `${online} / ${cameras.length}`, hint: cameras.length - online > 0 ? `${cameras.length - online} offline` : 'All cameras reporting', to: '/orgadmin/cameras' },
          { label: 'Ongoing incidents', value: incidents.items.length, tone: 'critical', hint: 'Fire or smoke still visible', to: '/orgadmin/reports' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Needs attention"
            description="Open alerts, most urgent first."
            actions={
              <Button as={Link} to="/orgadmin/alerts" variant="link" size="sm" iconRight={ArrowRight}>
                All alerts
              </Button>
            }
          />
          <AlertQueue alerts={alerts} actions={actions} loading={alertsLoading} onView={(a) => setSelectedId(a._id)} emptyDescription="All cameras are clear. New detections appear here instantly." />
        </Card>

        <Card>
          <CardHeader
            title="Camera health"
            description={`${online} of ${cameras.length} online`}
            actions={
              <Button as={Link} to="/orgadmin/cameras" variant="link" size="sm" iconRight={ArrowRight}>
                Manage
              </Button>
            }
          />
          <CameraHealthList cameras={cameras} loading={camerasLoading} onOpen={(c) => setLiveCameraId(c._id)} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ongoing incidents" description="Detections the AI is still tracking." />
          <DataTable
            caption="Ongoing incidents"
            columns={incidentColumns}
            rows={incidents.items}
            loading={incidents.loading}
            empty={<p className="px-5 py-8 text-center text-sm text-fg-muted">No ongoing incidents.</p>}
          />
        </Card>
        <Card>
          <CardHeader title="Alert outcomes" description="All time" />
          <CardBody>
            <AlertOutcomes stats={stats} loading={!stats} />
          </CardBody>
        </Card>
      </div>

      <AlertDetailDrawer alert={selected} onClose={() => setSelectedId(null)} actions={actions} />
      {actions.dialogs}
      <CameraFullscreenModal camera={liveCamera} open={Boolean(liveCamera)} onClose={() => setLiveCameraId(null)} />
    </div>
  );
};

export default OrgAdminDashboard;
