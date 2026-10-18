import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, RotateCcw, Trash2, Video, VideoOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  fetchCameras,
  fetchCameraUsage,
  createCamera,
  updateCamera,
  deleteCamera,
  restoreCamera,
  permanentDeleteCamera,
} from '../../store/slices/cameraSlice';
import { getDeletedCameras } from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import { EmptyState, Notice } from '../../components/ui/Feedback';
import { useConfirm } from '../../components/ui/confirmContext';
import UsageBar from '../../components/account/UsageBar';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFormModal from '../../components/cameras/CameraFormModal';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import CameraSettingsDrawer from '../../components/cameras/CameraSettingsDrawer';
import { cameraTitle, findCameraById, isCameraOnline } from '../../utils/camera';
import { formatRelative } from '../../utils/format';

const OrgAdminCameras = () => {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { cameras, loading, usage } = useSelector((state) => state.cameras);

  const [view, setView] = useState('active');
  const [formModal, setFormModal] = useState({ open: false, mode: 'add', camera: null });
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const [settingsCameraId, setSettingsCameraId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState({ items: [], loading: false, loaded: false });
  const [busyId, setBusyId] = useState(null);

  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);
  const settingsCamera = findCameraById(cameras, settingsCameraId);
  const online = cameras.filter((c) => isCameraOnline(c.status)).length;
  const limitReached = !usage.loading && !usage.canAddMore;

  useEffect(() => {
    dispatch(fetchCameras());
    dispatch(fetchCameraUsage());
  }, [dispatch]);

  const loadDeleted = useCallback(async () => {
    setDeleted((d) => ({ ...d, loading: true }));
    try {
      const res = await getDeletedCameras();
      setDeleted({ items: res.data.data || [], loading: false, loaded: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load deleted cameras');
      setDeleted((d) => ({ ...d, loading: false, loaded: true }));
    }
  }, []);

  useEffect(() => {
    if (view === 'deleted') loadDeleted();
  }, [view, loadDeleted]);

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
      setFormError(typeof error === 'string' ? error : 'Failed to save camera');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenSettings = (camera) => {
    setFullscreenCameraId(null);
    setSettingsCameraId(camera._id);
  };

  const handleSettingsSave = async (payload) => {
    if (!settingsCameraId) return;
    setSettingsSaving(true);
    try {
      const updated = await dispatch(updateCamera({ id: settingsCameraId, data: payload })).unwrap();
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
      toast.success('Camera moved to deleted cameras');
      setSettingsCameraId(null);
      setFullscreenCameraId(null);
      dispatch(fetchCameraUsage());
      setDeleted((d) => ({ ...d, loaded: false }));
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to delete camera');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (camera) => {
    setBusyId(camera._id);
    try {
      await dispatch(restoreCamera(camera._id)).unwrap();
      toast.success(`${cameraTitle(camera)} restored`);
      setDeleted((d) => ({ ...d, items: d.items.filter((c) => c._id !== camera._id) }));
      dispatch(fetchCameraUsage());
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to restore camera');
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async (camera) => {
    const ok = await confirm({
      title: `Permanently delete ${cameraTitle(camera)}?`,
      description: 'The camera and its alert history are removed for good. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(camera._id);
    try {
      await dispatch(permanentDeleteCamera(camera._id)).unwrap();
      toast.success('Camera permanently deleted');
      setDeleted((d) => ({ ...d, items: d.items.filter((c) => c._id !== camera._id) }));
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to delete camera');
    } finally {
      setBusyId(null);
    }
  };

  const deletedColumns = [
    {
      key: 'name',
      header: 'Camera',
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{cameraTitle(c)}</p>
          <p className="truncate text-xs text-fg-muted">{c.location}</p>
        </div>
      ),
    },
    { key: 'number', header: 'Display no.', hideBelow: 'lg', cell: (c) => <span className="font-mono text-xs text-fg-muted">{c.displayNumber || '—'}</span> },
    { key: 'deleted', header: 'Deleted', cell: (c) => <span className="text-sm text-fg-muted">{formatRelative(c.updatedAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" icon={RotateCcw} loading={busyId === c._id} disabled={limitReached} onClick={() => handleRestore(c)} title={limitReached ? 'Plan limit reached' : undefined}>
            Restore
          </Button>
          <Button size="sm" variant="danger-ghost" icon={Trash2} disabled={busyId === c._id} onClick={() => handlePermanentDelete(c)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cameras"
        description="Every camera connected to your organization. Open a camera for live view with AI overlays."
        actions={
          <Button icon={Plus} onClick={openAddForm} disabled={usage.loading || limitReached} title={limitReached ? 'Camera limit reached for your plan' : undefined}>
            Add camera
          </Button>
        }
      />

      <Card className="mb-6 grid gap-5 p-4 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-8 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-success-soft text-success-fg">
            <Video size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="tabular text-lg font-semibold leading-6 text-fg">{online}</p>
            <p className="text-xs text-fg-muted">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-fg-subtle">
            <VideoOff size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="tabular text-lg font-semibold leading-6 text-fg">{cameras.length - online}</p>
            <p className="text-xs text-fg-muted">Offline</p>
          </div>
        </div>
        <UsageBar label="Plan usage" used={usage.used} limit={usage.maxCameras} />
      </Card>

      {limitReached && cameras.length > 0 && (
        <Notice
          tone="warning"
          title="You've reached your plan's camera limit"
          className="mb-6"
          action={
            <Button as={Link} to="/customer/plans" size="sm" variant="secondary">
              Compare plans
            </Button>
          }
        >
          Remove a camera or move to a larger plan when your current term ends.
        </Notice>
      )}

      <Tabs
        className="mb-5"
        label="Camera views"
        value={view}
        onChange={setView}
        items={[
          { value: 'active', label: 'Cameras', count: cameras.length },
          { value: 'deleted', label: 'Deleted', count: deleted.loaded ? deleted.items.length : undefined },
        ]}
      />

      <h2 className="sr-only">{view === 'active' ? 'Active cameras' : 'Deleted cameras'}</h2>
      {view === 'active' ? (
        <CameraGrid
          cameras={cameras}
          loading={loading}
          showSettings
          onOpenCamera={(camera) => setFullscreenCameraId(camera._id)}
          onSettingsCamera={handleOpenSettings}
          emptyState={
            <Card>
              <EmptyState
                icon={Video}
                title="No cameras yet"
                description="Add your first camera to start monitoring its feed for fire and smoke."
                action={
                  !usage.loading &&
                  usage.canAddMore && (
                    <Button icon={Plus} onClick={openAddForm}>
                      Add your first camera
                    </Button>
                  )
                }
              />
            </Card>
          }
        />
      ) : (
        <Card>
          <DataTable
            caption="Deleted cameras"
            columns={deletedColumns}
            rows={deleted.items}
            loading={deleted.loading}
            empty={<EmptyState icon={Trash2} title="No deleted cameras" description="Cameras you delete appear here and can be restored." />}
          />
        </Card>
      )}

      <CameraFormModal open={formModal.open} mode={formModal.mode} initialValues={formModal.camera} onSubmit={handleFormSubmit} onClose={closeFormModal} submitting={formSubmitting} error={formError} />

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
