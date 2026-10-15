import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUsers, getOperatorAssignments, assignOperatorsToCamera } from '../../services/apiEndpoints';
import { normalizeCameraId } from '../../utils/camera';
import CameraOperatorPicker from './CameraOperatorPicker';

const CameraSettingsDrawer = ({
  camera,
  open,
  onClose,
  onSave,
  onDelete,
  saving = false,
  deleting = false,
}) => {
  const [form, setForm] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedOperatorIds, setSelectedOperatorIds] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !camera) return;

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
    });
    setConfirmDelete(false);

    const loadOperators = async () => {
      setOperatorsLoading(true);
      try {
        const [usersRes, assignmentsRes] = await Promise.all([
          getUsers(),
          getOperatorAssignments({}),
        ]);
        const orgOperators = usersRes.data.data.filter((u) => u.role === 'operator');
        setOperators(orgOperators);

        const cameraIdStr = normalizeCameraId(camera._id);
        const assigned = assignmentsRes.data.data
          .filter((a) => normalizeCameraId(a.cameraId?._id ?? a.cameraId) === cameraIdStr)
          .map((a) => normalizeCameraId(a.operatorId?._id ?? a.operatorId));
        setSelectedOperatorIds(assigned);
      } catch {
        toast.error('Failed to load operators');
      } finally {
        setOperatorsLoading(false);
      }
    };

    loadOperators();
  }, [open, camera]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !camera || !form) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleMetadataChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const handleSettingsChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      settings: { ...prev.settings, [field]: value },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name || form.label,
      label: form.label || form.name,
      cameraType: form.cameraType,
      displayNumber: form.displayNumber.trim() || undefined,
      location: form.location.trim(),
      ipAddress: form.ipAddress.trim() || undefined,
      streamUrl: form.streamUrl.trim() || undefined,
      metadata: {
        model: form.metadata.model.trim() || undefined,
        resolution: form.metadata.resolution.trim() || undefined,
        fps: form.metadata.fps ? Number(form.metadata.fps) : undefined,
      },
      settings: {
        detectionEnabled: form.settings.detectionEnabled,
        notes: form.settings.notes.trim() || undefined,
      },
    };
    await onSave?.(payload);
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

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete?.();
  };

  const cameraTypeLabel =
    form.cameraType === 'http_mjpeg'
      ? 'HTTP MJPEG'
      : form.cameraType === 'onvif'
        ? 'ONVIF'
        : 'IP / RTSP';
  const ipRequired = form.cameraType === 'ip_rtsp' || form.cameraType === 'onvif';
  const streamRequired = form.cameraType === 'http_mjpeg';

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Camera settings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {form.displayNumber || form.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Identity
            </h4>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Display number</label>
              <input
                value={form.displayNumber}
                onChange={(e) => handleChange('displayNumber', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Camera type</label>
              <input
                value={cameraTypeLabel}
                readOnly
                className="input-field bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Connection
            </h4>
            <div>
              <label className="block text-sm font-medium mb-1">
                IP address {ipRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                value={form.ipAddress}
                onChange={(e) => handleChange('ipAddress', e.target.value)}
                className="input-field"
                required={ipRequired}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Stream URL {streamRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                value={form.streamUrl}
                onChange={(e) => handleChange('streamUrl', e.target.value)}
                className="input-field"
                required={streamRequired}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Hardware
            </h4>
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
              placeholder="Resolution"
            />
            <input
              type="number"
              value={form.metadata.fps}
              onChange={(e) => handleMetadataChange('fps', e.target.value)}
              className="input-field"
              placeholder="FPS"
              min={1}
            />
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Detection
            </h4>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.settings.detectionEnabled}
                onChange={(e) => handleSettingsChange('detectionEnabled', e.target.checked)}
                className="rounded"
              />
              Enable AI fire/smoke detection
            </label>
            <textarea
              value={form.settings.notes}
              onChange={(e) => handleSettingsChange('notes', e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Notes (optional)"
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                Operator access
              </h4>
              <button
                type="button"
                onClick={handleSaveOperators}
                disabled={assignSaving || operatorsLoading}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
              >
                {assignSaving ? 'Saving...' : 'Save access'}
              </button>
            </div>
            <CameraOperatorPicker
              operators={operators}
              selectedOperatorIds={selectedOperatorIds}
              onChange={setSelectedOperatorIds}
              loading={operatorsLoading}
            />
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <section className="rounded-lg border border-red-200 dark:border-red-800 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Soft-delete moves this camera to trash and removes operator assignments.
            </p>
            {confirmDelete && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Are you sure? This cannot be undone from the grid (restore from trash if needed).
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : confirmDelete ? 'Confirm delete' : 'Delete camera'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CameraSettingsDrawer;
