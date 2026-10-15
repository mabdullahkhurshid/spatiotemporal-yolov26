import { useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { useFireSmokeDetection } from '../../hooks/useFireSmokeDetection';
import { isCameraOnline } from '../../utils/camera';

const CameraFullscreenModal = ({
  camera,
  open,
  onClose,
  onOpenSettings,
  showSettingsButton = false,
}) => {
  const videoRef = useRef(null);

  const detectionEnabled = camera?.settings?.detectionEnabled !== false;

  const { modelLoaded, lastPrediction, isRunning } = useFireSmokeDetection({
    videoRef,
    cameraId: camera?._id,
    enabled: open && detectionEnabled,
  });

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
        {camera.streamUrl ? (
          <video
            ref={videoRef}
            src={camera.streamUrl}
            className="max-w-full max-h-full w-full h-full object-contain"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="text-center text-gray-400 space-y-2">
            <p className="text-lg">No stream configured</p>
            <p className="text-sm">Add a stream URL in camera settings to view live video.</p>
          </div>
        )}

        {lastPrediction && detectionEnabled && (
          <div className="absolute bottom-6 left-6 bg-black/70 text-white text-sm px-4 py-2 rounded-lg">
            Fire: {lastPrediction.fireConfidence.toFixed(1)}% | Smoke:{' '}
            {lastPrediction.smokeConfidence.toFixed(1)}%
          </div>
        )}

        <div className="absolute bottom-6 right-6 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          AI: {detectionEnabled ? (modelLoaded ? (isRunning ? 'Running' : 'Idle') : 'Loading model...') : 'Disabled'}
        </div>
      </div>

      <p className="text-center text-xs text-gray-500 pb-3">Press Esc to close</p>
    </div>
  );
};

export default CameraFullscreenModal;
