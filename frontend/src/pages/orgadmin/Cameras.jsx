import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fetchCameras,
  fetchCameraUsage,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../../store/slices/cameraSlice';
import CameraUsageBanner from '../../components/cameras/CameraUsageBanner';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFormModal from '../../components/cameras/CameraFormModal';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import CameraSettingsDrawer from '../../components/cameras/CameraSettingsDrawer';
import { findCameraById } from '../../utils/camera';

const OrgAdminCameras = () => {
  const dispatch = useDispatch();
  const { cameras, loading, usage } = useSelector((state) => state.cameras);

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', camera: null });
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const [settingsCameraId, setSettingsCameraId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);
  const settingsCamera = findCameraById(cameras, settingsCameraId);

  useEffect(() => {
    dispatch(fetchCameras());
    dispatch(fetchCameraUsage());
  }, [dispatch]);

  const openAddForm = () => {
    setFormError('');
    setFormModal({ open: true, mode: 'add', camera: null });
  };

  const closeFormModal = () => {
    setFormModal({ open: false, mode: 'add', camera: null });
    setFormError('');
  };

  const handleFormSubmit = async (payload) => {
    setFormSubmitting(true);
    setFormError('');
    try {
      if (formModal.mode === 'edit' && formModal.camera) {
        await dispatch(updateCamera({ id: formModal.camera._id, data: payload })).unwrap();
        toast.success('Camera updated');
      } else {
        await dispatch(createCamera(payload)).unwrap();
        toast.success('Camera added');
        dispatch(fetchCameraUsage());
      }
      closeFormModal();
    } catch (error) {
      const message = typeof error === 'string' ? error : 'Failed to save camera';
      setFormError(message);
      toast.error(message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenCamera = (camera) => {
    setFullscreenCameraId(camera._id);
  };

  const handleOpenSettings = (camera) => {
    setFullscreenCameraId(null);
    setSettingsCameraId(camera._id);
  };

  const handleSettingsSave = async (payload) => {
    if (!settingsCameraId) return;
    setSettingsSaving(true);
    try {
      const updated = await dispatch(
        updateCamera({ id: settingsCameraId, data: payload })
      ).unwrap();
      toast.success('Settings saved');
      setSettingsCameraId(updated._id);
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteCamera = async () => {
    if (!settingsCameraId) return;
    setDeleting(true);
    try {
      await dispatch(deleteCamera(settingsCameraId)).unwrap();
      toast.success('Camera deleted');
      setSettingsCameraId(null);
      setFullscreenCameraId(null);
      dispatch(fetchCameraUsage());
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to delete camera');
    } finally {
      setDeleting(false);
    }
  };

  const emptyState = (
    <div className="card text-center py-12">
      <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <Camera className="text-gray-400" size={32} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No cameras yet</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        Add your first camera to start monitoring live streams and AI fire/smoke detection.
      </p>
      {(!usage.loading && usage.canAddMore) && (
        <button type="button" onClick={openAddForm} className="btn-primary inline-flex items-center gap-2">
          <Plus size={18} />
          Add your first camera
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <CameraUsageBanner
        subtitle="Monitor live streams and AI-based fire/smoke detection for your organization."
        used={usage.used}
        maxCameras={usage.maxCameras}
        canAdd={usage.canAddMore}
        loading={usage.loading}
        onAddClick={openAddForm}
      />

      <CameraGrid
        cameras={cameras}
        loading={loading}
        compact
        showSettings
        onOpenCamera={handleOpenCamera}
        onSettingsCamera={handleOpenSettings}
        emptyState={emptyState}
      />

      <CameraFormModal
        open={formModal.open}
        mode={formModal.mode}
        initialValues={formModal.camera}
        onSubmit={handleFormSubmit}
        onClose={closeFormModal}
        submitting={formSubmitting}
        error={formError}
      />

      <CameraFullscreenModal
        camera={fullscreenCamera}
        open={Boolean(fullscreenCameraId && fullscreenCamera)}
        onClose={() => setFullscreenCameraId(null)}
        onOpenSettings={handleOpenSettings}
        showSettingsButton
      />

      <CameraSettingsDrawer
        camera={settingsCamera}
        open={Boolean(settingsCameraId && settingsCamera)}
        onClose={() => setSettingsCameraId(null)}
        onSave={handleSettingsSave}
        onDelete={handleDeleteCamera}
        saving={settingsSaving}
        deleting={deleting}
      />
    </div>
  );
};

export default OrgAdminCameras;
