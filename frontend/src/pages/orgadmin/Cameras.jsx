import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { useFireSmokeDetection } from '../../hooks/useFireSmokeDetection';

const CameraTile = ({ camera }) => {
  const videoRef = useRef(null);
  const [detectionEnabled, setDetectionEnabled] = useState(true);
  const { modelLoaded, lastPrediction, isRunning } = useFireSmokeDetection({
    videoRef,
    cameraId: camera._id,
    enabled: detectionEnabled,
  });

  return (
    <div className="card flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {camera.label || camera.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{camera.location}</p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              camera.status === 'ONLINE' || camera.status === 'online'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {camera.status?.toUpperCase()}
          </span>
          <label className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={detectionEnabled}
              onChange={(e) => setDetectionEnabled(e.target.checked)}
            />
            <span>AI Detection</span>
          </label>
        </div>
      </div>

      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {camera.streamUrl ? (
          <video
            ref={videoRef}
            src={camera.streamUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No stream URL configured
          </div>
        )}
        {lastPrediction && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-3 py-1 rounded">
            Fire: {lastPrediction.fireConfidence.toFixed(1)}% | Smoke:{' '}
            {lastPrediction.smokeConfidence.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          Model: {modelLoaded ? 'Loaded' : 'Loading...'} | Inference:{' '}
          {detectionEnabled ? (isRunning ? 'Running' : 'Idle') : 'Disabled'}
        </span>
        {camera.metadata?.fps && <span>FPS: {camera.metadata.fps}</span>}
      </div>
    </div>
  );
};

const OrgAdminCameras = () => {
  const dispatch = useDispatch();
  const { cameras, loading } = useSelector((state) => state.cameras);

  useEffect(() => {
    dispatch(fetchCameras());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cameras</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor live streams and AI-based fire/smoke detection for your organization.
        </p>
      </div>

      {loading ? (
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">Loading cameras...</p>
        </div>
      ) : cameras.length === 0 ? (
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">
            No cameras found. Please add cameras from the admin panel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cameras.map((camera) => (
            <CameraTile key={camera._id} camera={camera} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgAdminCameras;
