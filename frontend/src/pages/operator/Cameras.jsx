import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera } from 'lucide-react';
import { fetchCameras } from '../../store/slices/cameraSlice';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import { findCameraById } from '../../utils/camera';

const OperatorCameras = () => {
  const dispatch = useDispatch();
  const { cameras, loading } = useSelector((state) => state.cameras);
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);

  useEffect(() => {
    dispatch(fetchCameras());
  }, [dispatch]);

  const emptyState = (
    <div className="card text-center py-12">
      <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <Camera className="text-gray-400" size={32} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No cameras assigned</h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
        Your organization admin has not assigned any cameras to you yet. Contact them to get access.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Cameras</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor your assigned cameras with real-time AI fire/smoke detection.
        </p>
      </div>

      <CameraGrid
        cameras={cameras}
        loading={loading}
        compact
        onOpenCamera={(camera) => setFullscreenCameraId(camera._id)}
        emptyState={emptyState}
      />

      <CameraFullscreenModal
        camera={fullscreenCamera}
        open={Boolean(fullscreenCameraId && fullscreenCamera)}
        onClose={() => setFullscreenCameraId(null)}
      />
    </div>
  );
};

export default OperatorCameras;
