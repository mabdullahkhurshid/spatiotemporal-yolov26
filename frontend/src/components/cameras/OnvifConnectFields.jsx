import { useState } from 'react';
import { Check, Plug, Radar } from 'lucide-react';
import { discoverOnvifCameras, probeOnvifCamera } from '../../services/apiEndpoints';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Field, Input } from '../ui/Field';
import { Notice } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { describeProfile } from '../../utils/onvif';

const deviceTitle = (info) => [info?.manufacturer, info?.model].filter(Boolean).join(' ') || 'ONVIF camera';

/**
 * Address + credentials for an ONVIF camera, a "Connect" step that lists the device's stream profiles,
 * and optional network discovery. `connection` is the last successful probe (null until connected).
 */
const OnvifConnectFields = ({
  value,
  onChange,
  connection,
  onConnection,
  cameraId,
  hasStoredPassword = false,
  allowDiscover = false,
  onDiscoveredName,
}) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [discovery, setDiscovery] = useState({ loading: false, devices: null, error: '' });

  // Any change to how the device is reached invalidates the previous connection.
  const setConnectionField = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value, ...(field !== 'profileToken' ? { profileToken: '' } : {}) });
    if (connection) onConnection(null);
    setError('');
  };

  const connect = async () => {
    setError('');
    if (!value.host.trim()) {
      setError('Enter the camera IP address or host name.');
      return;
    }
    setConnecting(true);
    try {
      const { data } = await probeOnvifCamera({
        host: value.host.trim(),
        port: value.port ? Number(value.port) : 80,
        username: value.username.trim(),
        password: value.password,
        cameraId,
      });
      const result = data.data;
      onConnection(result);
      const usable = result.profiles.filter((p) => p.streamUrl);
      const keep = usable.find((p) => p.token === value.profileToken);
      onChange({ ...value, profileToken: (keep || usable[0])?.token || '' });
    } catch (err) {
      onConnection(null);
      setError(err.response?.data?.message || 'Could not connect to the camera.');
    } finally {
      setConnecting(false);
    }
  };

  const discover = async () => {
    setDiscovery({ loading: true, devices: null, error: '' });
    try {
      const { data } = await discoverOnvifCameras();
      setDiscovery({ loading: false, devices: data.data, error: '' });
    } catch (err) {
      setDiscovery({ loading: false, devices: null, error: err.response?.data?.message || 'Network scan failed.' });
    }
  };

  const pickDevice = (device) => {
    onChange({ ...value, host: device.host, port: String(device.port), profileToken: '' });
    if (connection) onConnection(null);
    if (device.name) onDiscoveredName?.(device.name);
    setError('');
  };

  return (
    <div className="space-y-4">
      {allowDiscover && (
        <div className="rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Find cameras on this network</p>
              <p className="text-xs text-fg-muted">Scans the server&apos;s local network for ONVIF cameras.</p>
            </div>
            <Button size="sm" variant="secondary" icon={Radar} loading={discovery.loading} onClick={discover}>
              {discovery.devices ? 'Scan again' : 'Scan network'}
            </Button>
          </div>
          {discovery.error && <p className="mt-2 text-xs text-critical-fg">{discovery.error}</p>}
          {discovery.devices && discovery.devices.length === 0 && (
            <p className="mt-2 text-xs text-fg-muted">No ONVIF cameras answered. Enter the camera address below instead.</p>
          )}
          {discovery.devices?.length > 0 && (
            <ul className="mt-3 max-h-44 divide-y divide-line overflow-y-auto rounded-md border border-line scrollbar-thin">
              {discovery.devices.map((device) => {
                const selected = value.host === device.host && String(value.port) === String(device.port);
                return (
                  <li key={device.urn || `${device.host}:${device.port}`}>
                    <button
                      type="button"
                      onClick={() => pickDevice(device)}
                      aria-pressed={selected}
                      className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2', selected && 'bg-info-soft')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{device.name || device.hardware || 'ONVIF camera'}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {[device.hardware, device.location].filter(Boolean).join(' · ') || 'No details advertised'}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-fg-muted">
                        {device.host}:{device.port}
                      </span>
                      {selected && <Check size={16} className="shrink-0 text-brand-600" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field label="Camera address" required hint="IP address or host name of the camera.">
          <Input value={value.host} onChange={setConnectionField('host')} placeholder="192.168.1.64" autoComplete="off" />
        </Field>
        <Field label="ONVIF port" hint="Usually 80.">
          <Input type="number" min={1} max={65535} value={value.port} onChange={setConnectionField('port')} placeholder="80" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username" optional>
          <Input value={value.username} onChange={setConnectionField('username')} placeholder="admin" autoComplete="off" />
        </Field>
        <Field label="Password" optional hint={hasStoredPassword ? 'Saved. Leave blank to keep it.' : 'Stored encrypted on the server.'}>
          <Input
            type="password"
            value={value.password}
            onChange={setConnectionField('password')}
            placeholder={hasStoredPassword ? '••••••••' : ''}
            autoComplete="new-password"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={Plug} loading={connecting} onClick={connect}>
          {connection ? 'Reconnect' : 'Connect'}
        </Button>
        {connection && (
          <Badge tone="success" dot>
            Connected
          </Badge>
        )}
      </div>

      {error && <Notice tone="critical">{error}</Notice>}

      {connection && (
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium text-fg">{deviceTitle(connection.deviceInfo)}</legend>
          <p className="text-xs text-fg-muted">
            {[
              connection.deviceInfo?.firmwareVersion && `Firmware ${connection.deviceInfo.firmwareVersion}`,
              connection.deviceInfo?.serialNumber && `S/N ${connection.deviceInfo.serialNumber}`,
              `ONVIF Media ${connection.mediaVersion === 2 ? '2' : '1'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div role="radiogroup" aria-label="Stream profile" className="space-y-2">
            {connection.profiles.map((profile) => {
              const usable = Boolean(profile.streamUrl);
              const selected = value.profileToken === profile.token;
              return (
                <label
                  key={profile.token}
                  className={cn(
                    'flex gap-2.5 rounded-md border p-2.5 transition-colors',
                    selected ? 'border-brand-500 bg-info-soft' : 'border-line-strong',
                    usable ? 'cursor-pointer hover:bg-surface-2' : 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input
                    type="radio"
                    name="onvifProfile"
                    value={profile.token}
                    checked={selected}
                    disabled={!usable}
                    onChange={() => onChange({ ...value, profileToken: profile.token })}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{profile.name}</span>
                    <span className="block text-xs text-fg-muted">{usable ? describeProfile(profile) : profile.error}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-fg-subtle">A lower-resolution profile uses less bandwidth; detection works on either.</p>
        </fieldset>
      )}
    </div>
  );
};

export default OnvifConnectFields;
