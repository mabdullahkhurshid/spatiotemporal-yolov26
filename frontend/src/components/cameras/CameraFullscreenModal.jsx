import { useEffect, useMemo } from 'react';
import { Settings, X } from 'lucide-react';
import { isCameraOnline } from '../../utils/camera';
import { getCameraPlaybackSource } from '../../utils/cameraPlayback';
import { useLiveDetection } from '../../hooks/useLiveDetection';
import DetectionOverlayCanvas from './DetectionOverlayCanvas';

const aiMode = import.meta.env.VITE_AI_MODE || 'server';

const CameraFullscreenModal = ({
  camera,
  open,
  onClose,
  onOpenSettings,
  showSettingsButton = false,
}) => {
  const detectionEnabled = camera?.settings?.detectionEnabled !== false;
  const serverAi = aiMode === 'server';

  const { detections, metrics, lastUpdated } = useLiveDetection(camera?._id, open && detectionEnabled && serverAi);

  const playback = useMemo(() => (camera ? getCameraPlaybackSource(camera) : { mode: 'none', url: null }), [camera]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !camera) return null;

  const online = isCameraOnline(camera.status);
  const primaryLabel = camera.displayNumber || camera.label || camera.name;
  const secondaryParts = [];
  if (camera.displayNumber && (camera.label || camera.name)) {
    secondaryParts.push(camera.label || camera.name);
  }
  if (camera.location) secondaryParts.push(camera.location);

  const startedLabel = metrics.incidentStartedAt
    ? new Date(metrics.incidentStartedAt).toLocaleString()
    : '—';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Live view: ${primaryLabel}`}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-black/80 border-b border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white truncate">{primaryLabel}</h2>
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                online
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {online ? 'Online' : camera.status?.toUpperCase() || 'Offline'}
            </span>
          </div>
          {secondaryParts.length > 0 && (
            <p className="text-sm text-gray-400 truncate">{secondaryParts.join(' · ')}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showSettingsButton && onOpenSettings && (
            <button
              type="button"
              onClick={() => onOpenSettings(camera)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title="Camera settings"
            >
              <Settings size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 p-4">
        {playback.url ? (
          <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center">
            {playback.mode === 'video' ? (
              <video
                src={playback.url}
                className="max-w-full max-h-full w-full h-full object-contain"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <img
                src={playback.url}
                alt={`Live stream ${primaryLabel}`}
                className="max-w-full max-h-full w-full h-full object-contain"
              />
            )}
            {detectionEnabled && serverAi && (
              <DetectionOverlayCanvas detections={detections} />
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400 space-y-2">
            <p className="text-lg">No stream configured</p>
            <p className="text-sm">Add a stream URL in camera settings to view live video.</p>
          </div>
        )}

        {detectionEnabled && serverAi && (
          <div className="absolute bottom-6 left-6 bg-black/75 text-white text-xs px-4 py-3 rounded-lg space-y-1 max-w-md">
            <p>
              Fire: {Number(metrics.fireConfidence || 0).toFixed(1)}% | Smoke:{' '}
              {Number(metrics.smokeConfidence || 0).toFixed(1)}%
            </p>
            <p>Frequency: {Number(metrics.detectionFrequencyPerMin || 0).toFixed(0)} / min</p>
            <p>Spread est.: {Number(metrics.estimatedSpreadRate || 0).toFixed(4)} area/s</p>
            <p>Incident started: {startedLabel}</p>
            {lastUpdated && (
              <p className="text-gray-400">Updated: {new Date(lastUpdated).toLocaleTimeString()}</p>
            )}
          </div>
        )}

        <div className="absolute bottom-6 right-6 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          AI: {detectionEnabled ? 'Server (ONNX CPU)' : 'Disabled'}
          {playback.mode === 'mjpeg' && (
            <span className="block text-gray-400 mt-0.5">RTSP via MJPEG proxy</span>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-500 pb-3">Press Esc to close · Camera ID: {camera._id}</p>
    </div>
  );
};

export default CameraFullscreenModal;
