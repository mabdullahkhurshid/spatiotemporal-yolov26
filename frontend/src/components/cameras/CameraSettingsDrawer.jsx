import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw, Save, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUsers, getOperatorAssignments, assignOperatorsToCamera, refreshOnvifCamera } from '../../services/apiEndpoints';
import { cameraReplaced } from '../../store/slices/cameraSlice';
import { formatRelative } from '../../utils/format';
import { cameraTitle, isCameraPaused, normalizeCameraId } from '../../utils/camera';
import { Drawer } from '../ui/Dialog';
import Button from '../ui/Button';
import { Field, Input, Switch, Textarea } from '../ui/Field';
import { useConfirm } from '../ui/confirmContext';
import CameraOperatorPicker from './CameraOperatorPicker';
import OnvifConnectFields from './OnvifConnectFields';
import { emptyOnvifValue } from '../../utils/onvif';
import { pausedLabel, useCameraPause } from '../../hooks/useCameraPause';

const TYPE_LABEL = { ip_rtsp: 'IP / RTSP', http_mjpeg: 'HTTP MJPEG', onvif: 'ONVIF', demo_feed: 'Demo video (looping)', webcam: 'Laptop camera' };

const Section = ({ title, description, children, action }) => (
  <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const CameraSettingsDrawer = ({ camera, open, onClose, onSave, onDelete, saving = false, deleting = false }) => {
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const [form, setForm] = useState(null);
  const [onvif, setOnvif] = useState(emptyOnvifValue);
  const [onvifConnection, setOnvifConnection] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [operators, setOperators] = useState([]);
  const [selectedOperatorIds, setSelectedOperatorIds] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const { busy: pauseBusy, pause, resume } = useCameraPause(camera || {});

  useEffect(() => {
    if (!open || !camera) return;
    setOnvif({
      host: camera.onvif?.host || '',
      port: String(camera.onvif?.port || 80),
      username: camera.onvif?.username || '',
      password: '',
      profileToken: camera.onvif?.profileToken || '',
    });
    setOnvifConnection(null);
    setForm({
      name: camera.name || '',
      label: camera.label || camera.name || '',
      displayNumber: camera.displayNumber || '',
      location: camera.location || '',
      cameraType: camera.cameraType || 'ip_rtsp',
      ipAddress: camera.ipAddress || '',
      streamUrl: camera.streamUrl || '',
      metadata: {
        model: camera.metadata?.model || '',
        resolution: camera.metadata?.resolution || '',
        fps: camera.metadata?.fps ?? '',
      },
      settings: {
        detectionEnabled: camera.settings?.detectionEnabled !== false,
        notes: camera.settings?.notes || '',
      },
      maintenance: camera.status === 'maintenance',
    });

    const loadOperators = async () => {
      setOperatorsLoading(true);
      try {
        const [usersRes, assignmentsRes] = await Promise.all([getUsers(), getOperatorAssignments({})]);
        setOperators(usersRes.data.data.filter((u) => u.role === 'operator'));
        const cameraIdStr = normalizeCameraId(camera._id);
        setSelectedOperatorIds(
          assignmentsRes.data.data
            .filter((a) => normalizeCameraId(a.cameraId?._id ?? a.cameraId) === cameraIdStr)
            .map((a) => normalizeCameraId(a.operatorId?._id ?? a.operatorId))
        );
      } catch {
        toast.error('Failed to load operators');
      } finally {
        setOperatorsLoading(false);
      }
    };
    loadOperators();
    // Only when the drawer opens or shows another camera: the camera object is replaced on every live
    // detection, and re-running then would throw away unsaved edits (toggles flipped back by themselves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, camera?._id]);

  if (!open || !camera || !form) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setMeta = (field) => (e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, [field]: e.target.value } }));
  const setSetting = (field, value) => setForm((prev) => ({ ...prev, settings: { ...prev.settings, [field]: value } }));

  const isOnvif = form.cameraType === 'onvif';
  const isDemo = form.cameraType === 'demo_feed' || form.cameraType === 'webcam';
  const ipRequired = form.cameraType === 'ip_rtsp';
  const streamRequired = form.cameraType === 'http_mjpeg';

  const handleSave = async (event) => {
    event.preventDefault();
    await onSave?.({
      name: form.name || form.label,
      label: form.label || form.name,
      cameraType: form.cameraType,
      displayNumber: form.displayNumber.trim() || undefined,
      location: form.location.trim(),
      // ONVIF address and stream come from the device; the server reconnects only if these changed.
      ...(isOnvif
        ? {
            onvif: {
              host: onvif.host.trim(),
              port: onvif.port ? Number(onvif.port) : 80,
              username: onvif.username.trim(),
              password: onvif.password,
              profileToken: onvif.profileToken || undefined,
            },
          }
        : isDemo
          ? {}
          : {
              ipAddress: form.ipAddress.trim() || undefined,
              streamUrl: form.streamUrl.trim() || undefined,
            }),
      metadata: {
        model: form.metadata.model.trim() || undefined,
        resolution: form.metadata.resolution.trim() || undefined,
        fps: form.metadata.fps ? Number(form.metadata.fps) : undefined,
      },
      settings: {
        detectionEnabled: form.settings.detectionEnabled,
        notes: form.settings.notes.trim() || undefined,
      },
      // Leaving maintenance: OFFLINE until the server's stream check marks it ONLINE (seconds).
      ...(form.maintenance
        ? { status: 'maintenance' }
        : camera.status === 'maintenance'
          ? { status: 'OFFLINE' }
          : {}),
    });
  };

  const handleRefreshOnvif = async () => {
    setRefreshing(true);
    try {
      const { data } = await refreshOnvifCamera(camera._id);
      dispatch(cameraReplaced(data.data));
      toast.success('Stream address refreshed from the camera');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not refresh from the camera');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveOperators = async () => {
    setAssignSaving(true);
    try {
      await assignOperatorsToCamera(camera._id, selectedOperatorIds);
      toast.success('Operator access updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update operator access');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${cameraTitle(camera)}?`,
      description: 'The camera stops being monitored and operator access is removed. It moves to the deleted cameras list, where it can be restored.',
      confirmLabel: 'Delete camera',
      tone: 'danger',
    });
    if (ok) onDelete?.();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Camera settings"
      description={`${cameraTitle(camera)}${camera.displayNumber ? ` · ${camera.displayNumber}` : ''}`}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" form="camera-settings-form" icon={Save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <form id="camera-settings-form" onSubmit={handleSave} className="space-y-8">
          <Section title="Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Camera name" required>
                <Input value={form.name} onChange={set('name')} />
              </Field>
              <Field label="Display number">
                <Input value={form.displayNumber} onChange={set('displayNumber')} />
              </Field>
            </div>
            <Field label="Location" required>
              <Input value={form.location} onChange={set('location')} />
            </Field>
          </Section>

          <Section
            title="Connection"
            description={`Connection type: ${TYPE_LABEL[form.cameraType] || form.cameraType}`}
            action={
              isOnvif && (
                <Button size="sm" variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefreshOnvif}>
                  Refresh from camera
                </Button>
              )
            }
          >
            {isOnvif ? (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md bg-surface-2 p-3 text-sm">
                  <dt className="text-fg-muted">Device</dt>
                  <dd className="min-w-0 truncate text-fg">
                    {[camera.onvif?.deviceInfo?.manufacturer, camera.onvif?.deviceInfo?.model].filter(Boolean).join(' ') || '—'}
                    {camera.onvif?.deviceInfo?.firmwareVersion && <span className="text-fg-muted"> · firmware {camera.onvif.deviceInfo.firmwareVersion}</span>}
                  </dd>
                  <dt className="text-fg-muted">Profile</dt>
                  <dd className="min-w-0 truncate text-fg">{camera.onvif?.profileName || '—'}</dd>
                  <dt className="text-fg-muted">Stream</dt>
                  <dd className="min-w-0 truncate font-mono text-xs leading-5 text-fg">{camera.streamUrl || '—'}</dd>
                  <dt className="text-fg-muted">Synced</dt>
                  <dd className="text-fg">{camera.onvif?.lastSyncedAt ? formatRelative(camera.onvif.lastSyncedAt) : '—'}</dd>
                </dl>
                <OnvifConnectFields
                  value={onvif}
                  onChange={setOnvif}
                  connection={onvifConnection}
                  onConnection={setOnvifConnection}
                  cameraId={camera._id}
                  hasStoredPassword={Boolean(camera.onvif?.hasPassword)}
                />
                <p className="text-xs text-fg-subtle">Connect to switch the stream profile. Saving reconnects to the camera only when the address, login or profile changed.</p>
              </>
            ) : isDemo ? (
              <p className="text-sm text-fg-muted">
                {form.cameraType === 'demo_feed'
                  ? `Plays demo_videos/${camera.demo?.clip || '?'}.mp4 on an endless loop.`
                  : 'Streams from a browser: open the live view and choose Start to broadcast this device’s camera.'}
              </p>
            ) : (
              <>
                <Field label="IP address" required={ipRequired} optional={!ipRequired}>
                  <Input value={form.ipAddress} onChange={set('ipAddress')} inputMode="decimal" />
                </Field>
                <Field label="Stream URL" required={streamRequired} optional={!streamRequired}>
                  <Input value={form.streamUrl} onChange={set('streamUrl')} />
                </Field>
              </>
            )}
          </Section>

          <Section title="Status">
            <Switch
              label="Camera live"
              description={
                isCameraPaused(camera.status)
                  ? `Paused: no live view and no fire detection. ${pausedLabel(camera)}. Turn on to go live now.`
                  : 'Turn off to pause the live view, stream checks and fire detection until you turn it back on. Applies immediately.'
              }
              checked={!isCameraPaused(camera.status)}
              disabled={pauseBusy || camera.status === 'maintenance'}
              onChange={(value) => (value ? resume() : pause(null))}
            />
            <Switch
              label="Under maintenance"
              description="Shows the camera as under maintenance and stops its live view. When off, the camera is online whenever its stream is reachable."
              checked={form.maintenance}
              onChange={(value) => setForm((prev) => ({ ...prev, maintenance: value }))}
            />
          </Section>

          <Section title="Detection">
            <Switch
              label="AI fire & smoke detection"
              description="When off, this camera's feed is not analysed and raises no alerts."
              checked={form.settings.detectionEnabled}
              onChange={(value) => setSetting('detectionEnabled', value)}
            />
            <Field label="Notes" optional>
              <Textarea rows={3} value={form.settings.notes} onChange={(e) => setSetting('notes', e.target.value)} placeholder="e.g. Faces loading bay; glare in late afternoon" />
            </Field>
          </Section>

          <Section title="Hardware">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Model">
                <Input value={form.metadata.model} onChange={setMeta('model')} />
              </Field>
              <Field label="Resolution">
                <Input value={form.metadata.resolution} onChange={setMeta('resolution')} />
              </Field>
              <Field label="Frame rate">
                <Input type="number" min={1} value={form.metadata.fps} onChange={setMeta('fps')} />
              </Field>
            </div>
          </Section>
        </form>

        <Section
          title="Operator access"
          description="Operators only see and respond to cameras assigned to them."
          action={
            <Button size="sm" variant="secondary" icon={UserCheck} loading={assignSaving} disabled={operatorsLoading} onClick={handleSaveOperators}>
              Save access
            </Button>
          }
        >
          <CameraOperatorPicker operators={operators} selectedOperatorIds={selectedOperatorIds} onChange={setSelectedOperatorIds} loading={operatorsLoading} />
        </Section>

        <section className="rounded-lg border border-critical-line p-4">
          <h3 className="text-sm font-medium text-critical-fg">Delete camera</h3>
          <p className="mt-1 text-sm text-fg-muted">Stops monitoring and removes operator access. You can restore it later.</p>
          <Button variant="danger" size="sm" icon={Trash2} loading={deleting} onClick={handleDelete} className="mt-3">
            Delete camera
          </Button>
        </section>
      </div>
    </Drawer>
  );
};

export default CameraSettingsDrawer;
