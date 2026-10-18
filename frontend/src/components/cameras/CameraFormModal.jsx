import { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Notice } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import OnvifConnectFields from './OnvifConnectFields';
import { emptyOnvifValue } from '../../utils/onvif';

const CAMERA_TYPES = [
  { value: 'ip_rtsp', label: 'IP / RTSP', hint: 'Most CCTV and NVR channels' },
  { value: 'http_mjpeg', label: 'HTTP MJPEG', hint: 'Web cameras and simple streams' },
  { value: 'onvif', label: 'ONVIF', hint: 'Connect with the camera login' },
];

const defaultValues = {
  name: '',
  label: '',
  location: '',
  cameraType: 'ip_rtsp',
  ipAddress: '',
  streamUrl: '',
  displayNumber: '',
  metadata: { model: '', resolution: '', fps: '' },
};

const CameraFormModal = ({ open, mode = 'add', initialValues, onSubmit, onClose, submitting = false, error }) => {
  const [form, setForm] = useState(defaultValues);
  const [onvif, setOnvif] = useState(emptyOnvifValue);
  const [onvifConnection, setOnvifConnection] = useState(null);

  useEffect(() => {
    if (!open) return;
    setOnvif(
      mode === 'edit' && initialValues?.onvif
        ? {
            host: initialValues.onvif.host || '',
            port: String(initialValues.onvif.port || 80),
            username: initialValues.onvif.username || '',
            password: '',
            profileToken: initialValues.onvif.profileToken || '',
          }
        : emptyOnvifValue
    );
    setOnvifConnection(null);
    if (mode === 'edit' && initialValues) {
      setForm({
        name: initialValues.name || '',
        label: initialValues.label || initialValues.name || '',
        location: initialValues.location || '',
        cameraType: initialValues.cameraType || 'ip_rtsp',
        ipAddress: initialValues.ipAddress || '',
        streamUrl: initialValues.streamUrl || '',
        displayNumber: initialValues.displayNumber || '',
        metadata: {
          model: initialValues.metadata?.model || '',
          resolution: initialValues.metadata?.resolution || '',
          fps: initialValues.metadata?.fps ?? '',
        },
      });
    } else {
      setForm(defaultValues);
    }
  }, [open, mode, initialValues]);

  const cameraType = form.cameraType;
  const isOnvif = cameraType === 'onvif';
  const ipRequired = cameraType === 'ip_rtsp';
  const streamRequired = cameraType === 'http_mjpeg';
  // A new ONVIF camera must be connected first so the stream profile comes from the device.
  const onvifIncomplete = isOnvif && mode === 'add' && !(onvifConnection && onvif.profileToken);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setMeta = (field) => (e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, [field]: e.target.value } }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onvifIncomplete) return;
    if (isOnvif) {
      onSubmit?.({
        name: form.name || form.label,
        label: form.label || form.name,
        location: form.location.trim(),
        cameraType,
        displayNumber: form.displayNumber.trim() || undefined,
        onvif: {
          host: onvif.host.trim(),
          port: onvif.port ? Number(onvif.port) : 80,
          username: onvif.username.trim(),
          password: onvif.password,
          profileToken: onvif.profileToken || undefined,
        },
      });
      return;
    }
    onSubmit?.({
      name: form.name || form.label,
      label: form.label || form.name,
      location: form.location.trim(),
      cameraType,
      ipAddress: form.ipAddress.trim() || undefined,
      streamUrl: form.streamUrl.trim() || undefined,
      displayNumber: form.displayNumber.trim() || undefined,
      metadata: {
        model: form.metadata.model.trim() || undefined,
        resolution: form.metadata.resolution.trim() || undefined,
        fps: form.metadata.fps ? Number(form.metadata.fps) : undefined,
      },
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit camera' : 'Add camera'}
      description={mode === 'edit' ? 'Update how this camera is identified and reached.' : 'Connect a camera so its feed is monitored for fire and smoke.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="camera-form" loading={submitting} disabled={onvifIncomplete} title={onvifIncomplete ? 'Connect to the camera first' : undefined}>
            {mode === 'edit' ? 'Save changes' : 'Add camera'}
          </Button>
        </>
      }
    >
      <form id="camera-form" onSubmit={handleSubmit} className="space-y-5">
        <fieldset>
          <legend className="label">Connection type</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {CAMERA_TYPES.map((type) => {
              const selected = form.cameraType === type.value;
              const locked = type.disabled || mode === 'edit';
              return (
                <label
                  key={type.value}
                  className={cn(
                    'flex gap-2.5 rounded-md border p-3 transition-colors',
                    selected ? 'border-brand-500 bg-info-soft' : 'border-line-strong',
                    locked ? (selected ? '' : 'cursor-not-allowed opacity-50') : 'cursor-pointer hover:bg-surface-2'
                  )}
                >
                  <input
                    type="radio"
                    name="cameraType"
                    value={type.value}
                    checked={selected}
                    disabled={locked && !selected}
                    onChange={() => setForm((prev) => ({ ...prev, cameraType: type.value }))}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{type.label}</span>
                    <span className="block text-xs text-fg-muted">{type.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {mode === 'edit' && <p className="mt-1.5 text-xs text-fg-subtle">The connection type can&apos;t be changed after a camera is created.</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Camera name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Loading Dock A" data-autofocus />
          </Field>
          <Field label="Display number" optional hint="Assigned automatically if empty.">
            <Input value={form.displayNumber} onChange={set('displayNumber')} placeholder="CAM-01" />
          </Field>
        </div>
        <Field label="Location" required hint="Where the camera is mounted — shown on every alert.">
          <Input value={form.location} onChange={set('location')} placeholder="Warehouse, north wall" />
        </Field>

        {isOnvif ? (
          <OnvifConnectFields
            value={onvif}
            onChange={setOnvif}
            connection={onvifConnection}
            onConnection={setOnvifConnection}
            cameraId={mode === 'edit' ? initialValues?._id : undefined}
            hasStoredPassword={mode === 'edit' && Boolean(initialValues?.onvif?.hasPassword)}
            allowDiscover={mode === 'add'}
            onDiscoveredName={(name) => setForm((prev) => (prev.name ? prev : { ...prev, name, label: name }))}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="IP address" required={ipRequired} optional={!ipRequired}>
                <Input value={form.ipAddress} onChange={set('ipAddress')} placeholder="192.168.1.100" inputMode="decimal" />
              </Field>
              <Field label="Stream URL" required={streamRequired} optional={!streamRequired} hint={cameraType === 'http_mjpeg' ? 'http:// or https://' : 'rtsp:// or rtsps://'}>
                <Input value={form.streamUrl} onChange={set('streamUrl')} placeholder={cameraType === 'http_mjpeg' ? 'http://camera.local/video.mjpg' : 'rtsp://192.168.1.100:554/stream1'} />
              </Field>
            </div>

            {mode === 'add' && (
              <details className="group rounded-md border border-line">
                <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-fg">Hardware details (optional)</summary>
                <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-3">
                  <Field label="Model">
                    <Input value={form.metadata.model} onChange={setMeta('model')} placeholder="DS-2CD2143" />
                  </Field>
                  <Field label="Resolution">
                    <Input value={form.metadata.resolution} onChange={setMeta('resolution')} placeholder="1920×1080" />
                  </Field>
                  <Field label="Frame rate">
                    <Input type="number" min={1} value={form.metadata.fps} onChange={setMeta('fps')} placeholder="25" />
                  </Field>
                </div>
              </details>
            )}
          </>
        )}

        {error && <Notice tone="critical">{error}</Notice>}
      </form>
    </Dialog>
  );
};

export default CameraFormModal;
