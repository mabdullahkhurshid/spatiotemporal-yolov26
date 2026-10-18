import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Video } from 'lucide-react';
import { fetchCameras } from '../../store/slices/cameraSlice';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import { findCameraById, isCameraOnline } from '../../utils/camera';

const OperatorCameras = () => {
  const dispatch = useDispatch();
  const { cameras, loading } = useSelector((state) => state.cameras);
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);
  const online = cameras.filter((c) => isCameraOnline(c.status)).length;

  useEffect(() => {
    dispatch(fetchCameras());
  }, [dispatch]);

  return (
    <div>
      <PageHeader
        title="Live cameras"
        description="Cameras assigned to you. Open a camera for live video with AI detection overlays."
        meta={
          cameras.length > 0 && (
            <>
              <Badge tone="success" dot>
                {online} online
              </Badge>
              {cameras.length - online > 0 && <Badge dot>{cameras.length - online} offline</Badge>}
            </>
          )
        }
      />

      <h2 className="sr-only">Assigned cameras</h2>
      <CameraGrid
        cameras={cameras}
        loading={loading}
        onOpenCamera={(camera) => setFullscreenCameraId(camera._id)}
        emptyState={
          <Card>
            <EmptyState
              icon={Video}
              title="No cameras assigned yet"
              description="Your organization admin assigns cameras to operators. Ask them to give you access."
            />
          </Card>
        }
      />

      <CameraFullscreenModal camera={fullscreenCamera} open={Boolean(fullscreenCameraId && fullscreenCamera)} onClose={() => setFullscreenCameraId(null)} />
    </div>
  );
};

export default OperatorCameras;
