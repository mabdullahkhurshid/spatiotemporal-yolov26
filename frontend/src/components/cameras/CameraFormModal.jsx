import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const CAMERA_TYPES = [
  { value: 'ip_rtsp', label: 'IP / RTSP' },
  { value: 'http_mjpeg', label: 'HTTP MJPEG' },
  { value: 'onvif', label: 'ONVIF', disabled: true, badge: 'Coming soon' },
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

const CameraFormModal = ({
  open,
  mode = 'add',
  initialValues,
  onSubmit,
  onClose,
  submitting = false,
  error,
}) => {
  const [form, setForm] = useState(defaultValues);

  useEffect(() => {
    if (!open) return;
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

  if (!open) return null;

  const cameraType = form.cameraType;
  const isOnvif = cameraType === 'onvif';
  const ipRequired = cameraType === 'ip_rtsp' || cameraType === 'onvif';
  const streamRequired = cameraType === 'http_mjpeg';

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleMetadataChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isOnvif) return;

    const payload = {
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
    };

    onSubmit?.(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === 'edit' ? 'Edit Camera' : 'Add Camera'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Camera type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CAMERA_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  disabled={type.disabled || (mode === 'edit')}
                  onClick={() => handleChange('cameraType', type.value)}
                  className={`relative rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                    form.cameraType === type.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${type.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
                    mode === 'edit' ? 'cursor-default' : ''
                  }`}
                >
                  <span className="font-medium">{type.label}</span>
                  {type.badge && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      {type.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {mode === 'edit' && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Camera type cannot be changed after creation.
              </p>
            )}
          </div>

          {isOnvif ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              ONVIF camera setup is coming soon. Please choose IP/RTSP or HTTP MJPEG.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="input-field"
                  placeholder="Lobby Camera"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Display number</label>
                <input
                  value={form.displayNumber}
                  onChange={(e) => handleChange('displayNumber', e.target.value)}
                  className="input-field"
                  placeholder="CAM-01 (auto-assigned if empty)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="input-field"
                  placeholder="Main entrance"
                  required
                />
              </div>

              {ipRequired && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    IP address <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.ipAddress}
                    onChange={(e) => handleChange('ipAddress', e.target.value)}
                    className="input-field"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Stream URL {streamRequired && <span className="text-red-500">*</span>}
                </label>
                <input
                  value={form.streamUrl}
                  onChange={(e) => handleChange('streamUrl', e.target.value)}
                  className="input-field"
                  placeholder={cameraType === 'http_mjpeg' ? 'http://camera.local/mjpeg' : 'rtsp://...'}
                  required={streamRequired}
                />
              </div>

              {!ipRequired && (
                <div>
                  <label className="block text-sm font-medium mb-1">IP address (optional)</label>
                  <input
                    value={form.ipAddress}
                    onChange={(e) => handleChange('ipAddress', e.target.value)}
                    className="input-field"
                    placeholder="192.168.1.100"
                  />
                </div>
              )}

              {mode === 'add' && (
                <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <summary className="text-sm font-medium cursor-pointer">Hardware (optional)</summary>
                  <div className="mt-3 space-y-3">
                    <input
                      value={form.metadata.model}
                      onChange={(e) => handleMetadataChange('model', e.target.value)}
                      className="input-field"
                      placeholder="Model"
                    />
                    <input
                      value={form.metadata.resolution}
                      onChange={(e) => handleMetadataChange('resolution', e.target.value)}
                      className="input-field"
                      placeholder="Resolution (e.g. 1920x1080)"
                    />
                    <input
                      type="number"
                      value={form.metadata.fps}
                      onChange={(e) => handleMetadataChange('fps', e.target.value)}
                      className="input-field"
                      placeholder="FPS"
                      min={1}
                    />
                  </div>
                </details>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isOnvif}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CameraFormModal;
