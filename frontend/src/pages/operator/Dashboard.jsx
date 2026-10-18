import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Video } from 'lucide-react';
import { fetchAlerts } from '../../store/slices/alertSlice';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { getMe } from '../../store/slices/authSlice';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { StatGroup } from '../../components/ui/Stat';
import { EmptyState } from '../../components/ui/Feedback';
import AlertQueue from '../../components/alerts/AlertQueue';
import AlertDetailDrawer from '../../components/alerts/AlertDetailDrawer';
import useAlertActions from '../../components/alerts/useAlertActions';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import { findCameraById, isCameraOnline } from '../../utils/camera';

const getOrganizationName = (user) => {
  if (!user) return null;
  if (typeof user.organizationId === 'object' && user.organizationId?.name) return user.organizationId.name;
  return user.organizationName || null;
};

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

const OperatorDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { cameras, loading: camerasLoading } = useSelector((state) => state.cameras);
  const { alerts, loading: alertsLoading } = useSelector((state) => state.alerts);
  const actions = useAlertActions();
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);
  const selected = alerts.find((a) => a._id === selectedId) || null;

  useEffect(() => {
    dispatch(fetchCameras());
    dispatch(fetchAlerts({ limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (!getOrganizationName(user)) dispatch(getMe());
  }, [dispatch, user]);

  const online = cameras.filter((c) => isCameraOnline(c.status)).length;
  const active = alerts.filter((a) => a.status === 'active').length;
  const inProgress = alerts.filter((a) => a.status === 'acknowledged').length;
  const firstName = (user?.name || '').split(' ')[0];
  const orgName = getOrganizationName(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={`You're monitoring ${cameras.length} ${cameras.length === 1 ? 'camera' : 'cameras'}${orgName ? ` for ${orgName}` : ''}.`}
        className="mb-0"
      />

      <StatGroup
        className="lg:grid-cols-3"
        loading={alertsLoading && alerts.length === 0}
        items={[
          { label: 'Active alerts', value: active, tone: 'critical', hint: 'Acknowledge to let your team know', to: '/operator/alerts' },
          { label: 'In progress', value: inProgress, tone: 'warning', hint: 'Resolve once handled on site', to: '/operator/alerts' },
          { label: 'Cameras online', value: `${online} / ${cameras.length}`, hint: cameras.length - online > 0 ? `${cameras.length - online} offline` : 'All reporting', to: '/operator/cameras' },
        ]}
      />

      <Card>
        <CardHeader
          title="Your alert queue"
          description="Most urgent first. Acknowledge, then resolve when handled."
          actions={
            <Button as={Link} to="/operator/alerts" variant="link" size="sm" iconRight={ArrowRight}>
              All alerts
            </Button>
          }
        />
        <AlertQueue alerts={alerts} actions={actions} loading={alertsLoading} limit={8} onView={(a) => setSelectedId(a._id)} emptyDescription="Your cameras are clear. You'll see new detections here instantly." />
      </Card>

      <section aria-labelledby="my-cameras">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="my-cameras" className="text-[0.9375rem] font-semibold text-fg">
            Your cameras
          </h2>
          <Button as={Link} to="/operator/cameras" variant="link" size="sm" iconRight={ArrowRight}>
            Live view
          </Button>
        </div>
        <CameraGrid
          cameras={cameras}
          loading={camerasLoading}
          onOpenCamera={(camera) => setFullscreenCameraId(camera._id)}
          emptyState={
            <Card>
              <EmptyState icon={Video} title="No cameras assigned yet" description="Ask your organization admin to give you access to cameras." />
            </Card>
          }
        />
      </section>

      <AlertDetailDrawer alert={selected} onClose={() => setSelectedId(null)} actions={actions} />
      {actions.dialogs}
      <CameraFullscreenModal camera={fullscreenCamera} open={Boolean(fullscreenCameraId && fullscreenCamera)} onClose={() => setFullscreenCameraId(null)} />
    </div>
  );
};

export default OperatorDashboard;
