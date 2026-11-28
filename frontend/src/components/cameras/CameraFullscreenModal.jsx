import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, Minimize2, Pause, Play, Settings, VideoOff, X } from 'lucide-react';
import { cameraTitle, isCameraOnline, isCameraPaused } from '../../utils/camera';
import { useCameraPlayback } from '../../utils/cameraPlayback';
import { useLiveDetection } from '../../hooks/useLiveDetection';
import { useCameraPreview } from '../../hooks/useCameraPreview';
import { formatRelative, formatTime } from '../../utils/format';
import { useOverlay } from '../ui/useOverlay';
import IconButton from '../ui/IconButton';
import ConfidenceMeter from '../alerts/ConfidenceMeter';
import DetectionOverlayCanvas from './DetectionOverlayCanvas';
import WebcamBroadcastPanel from './WebcamBroadcastPanel';
import CameraPauseControl from './CameraPauseControl';
import { pausedLabel, useCameraPause } from '../../hooks/useCameraPause';
import Button from '../ui/Button';

const HEADER_ICON = 'text-white/70 hover:bg-white/10 hover:text-white';

const aiMode = import.meta.env.VITE_AI_MODE || 'server';

const Metric = ({ label, value }) => (
  <div>
    <dt className="text-xs text-white/50">{label}</dt>
    <dd className="tabular mt-0.5 text-sm font-medium text-white">{value}</dd>
  </div>
);

const inBrowserFullscreen = () => Boolean(document.fullscreenElement);

/**
 * Live viewer opened from a camera tile: a large (medium) player over the page, with a button for
 * true full screen. Server-side detection overlay and telemetry panel when detection is on; the
 * stream itself plays whether or not detection is on.
 */
const CameraFullscreenModal = ({ camera, open, onClose, onOpenSettings, showSettingsButton = false }) => {
  const panelRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const detectionEnabled = camera?.settings?.detectionEnabled !== false;
  const serverAi = aiMode === 'server';
  const { detections, metrics, lastUpdated } = useLiveDetection(camera?._id, open && detectionEnabled && serverAi);
  const maintenance = camera?.status === 'maintenance';
  const paused = isCameraPaused(camera?.status);
  const { busy: resuming, resume } = useCameraPause(camera || {});
  const playback = useCameraPlayback(camera, open && !maintenance && !paused);
  // The tile's socket preview is already running: show it at once (the server sends its latest frame on
  // subscribe) while the full-quality stream starts up, which covers it from its first frame.
  const preview = useCameraPreview(camera?._id, open && !maintenance && isCameraOnline(camera?.status));

  const close = () => {
    if (inBrowserFullscreen()) document.exitFullscreen().catch(() => {});
    onClose?.();
  };
  useOverlay(open && Boolean(camera), close, panelRef);

  // Esc / the browser's own controls leave full screen: drop back to the medium player.
  useEffect(() => {
    const onChange = () => !inBrowserFullscreen() && setFullscreen(false);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open, camera?._id]);

  if (!open || !camera) return null;

  const toggleFullscreen = () => {
    if (fullscreen) {
      if (inBrowserFullscreen()) document.exitFullscreen().catch(() => {});
      setFullscreen(false);
      return;
    }
    setFullscreen(true);
    // Falls back to filling the window when the browser refuses (e.g. inside an iframe).
    panelRef.current?.requestFullscreen?.().catch(() => {});
  };

  const online = isCameraOnline(camera.status);
  const title = cameraTitle(camera);
  const hits = detections.filter((d) => d.className === 'fire' || d.className === 'smoke');

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/75 ${fullscreen ? '' : 'p-3 sm:p-6'}`}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Live view: ${title}`}
        className={`flex flex-col overflow-hidden bg-[#05070B] ${
          fullscreen ? 'h-full w-full' : 'h-full max-h-[88vh] w-full max-w-6xl rounded-xl border border-white/10 shadow-2xl'
        }`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-success' : paused ? 'bg-info' : maintenance ? 'bg-warning' : 'bg-white/40'}`}
                aria-hidden="true"
              />
              <h2 className="truncate text-base font-medium text-white">{title}</h2>
              {camera.displayNumber && <span className="hidden rounded bg-white/10 px-1.5 py-0.5 font-mono text-2xs text-white/70 sm:inline">{camera.displayNumber}</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-white/55">
              {online ? 'Online' : paused ? `Paused · ${pausedLabel(camera)}` : maintenance ? 'Under maintenance' : 'Offline'}
              {camera.location ? ` · ${camera.location}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showSettingsButton && <CameraPauseControl camera={camera} size="md" className={HEADER_ICON} />}
            {showSettingsButton && onOpenSettings && <IconButton icon={Settings} label="Camera settings" onClick={() => onOpenSettings(camera)} className={HEADER_ICON} />}
            <IconButton
              icon={fullscreen ? Minimize2 : Maximize2}
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={toggleFullscreen}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            />
            <IconButton icon={X} label="Close live view" onClick={close} className="text-white/70 hover:bg-white/10 hover:text-white" />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative flex min-h-[40vh] flex-1 items-center justify-center p-3 sm:p-5">
            {/* Org admins broadcast a "Laptop camera" from this view; the image below is the server's feed. */}
            {camera.cameraType === 'webcam' && showSettingsButton && <WebcamBroadcastPanel cameraId={camera._id} />}
            {paused ? (
              <div className="flex flex-col items-center gap-3 text-center text-white/60">
                <Pause size={28} aria-hidden="true" />
                <p className="text-sm">
                  This camera is paused: no live view and no fire detection. {camera.pausedUntil ? `${pausedLabel(camera)}.` : 'It stays paused until resumed.'}
                </p>
                {showSettingsButton && (
                  <Button size="sm" icon={Play} loading={resuming} onClick={resume}>
                    Go live now
                  </Button>
                )}
              </div>
            ) : playback.url || preview.url ? (
              <div className="relative flex h-full w-full items-center justify-center">
                {/* Covered by the first frame. */}
                {preview.url ? (
                  <img ref={previewRef} src={preview.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/55">
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Connecting to the live stream…
                  </p>
                )}
                {playback.url &&
                  (playback.mode === 'video' ? (
                    <video ref={streamRef} src={playback.url} onError={playback.onError} className="relative h-full w-full object-contain" autoPlay muted playsInline />
                  ) : (
                    <img ref={streamRef} src={playback.url} onError={playback.onError} alt={`Live stream from ${title}`} className="relative h-full w-full object-contain text-transparent" />
                  ))}
                {detectionEnabled && serverAi && <DetectionOverlayCanvas detections={detections} mediaRefs={[streamRef, previewRef]} />}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center text-white/60">
                {maintenance || playback.mode === 'none' || playback.error ? <VideoOff size={28} aria-hidden="true" /> : <Loader2 size={24} className="animate-spin" aria-hidden="true" />}
                <p className="text-sm">
                  {maintenance
                    ? 'This camera is under maintenance. Turn maintenance off in camera settings to resume the live view.'
                    : playback.mode === 'none'
                      ? 'No stream URL is configured for this camera.'
                      : playback.error || 'Connecting to the live stream…'}
                </p>
              </div>
            )}
          </div>

          {detectionEnabled && serverAi && (
            <aside className="shrink-0 border-t border-white/10 px-5 py-4 lg:w-72 lg:border-l lg:border-t-0 lg:py-5" aria-label="Detection telemetry">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/60">AI detection</p>
                {hits.length > 0 ? (
                  <span className="rounded-full bg-critical px-2 py-0.5 text-2xs font-semibold text-white">Detecting</span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-2xs font-medium text-white/70">Clear</span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <ConfidenceMeter label="Fire" value={metrics.fireConfidence} tone="critical" inverted />
                <ConfidenceMeter label="Smoke" value={metrics.smokeConfidence} tone="smoke" inverted />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Metric label="Detections / min" value={Number(metrics.detectionFrequencyPerMin || 0).toFixed(0)} />
                <Metric label="Spread estimate" value={`${Number(metrics.estimatedSpreadRate || 0).toFixed(4)} /s`} />
                <Metric label="Incident started" value={metrics.incidentStartedAt ? formatRelative(metrics.incidentStartedAt) : 'No active incident'} />
                <Metric label="Last update" value={lastUpdated ? formatTime(lastUpdated) : 'Waiting for data'} />
              </dl>
            </aside>
          )}
        </div>

        <p className="hidden pb-3 text-center text-2xs text-white/40 sm:block">{fullscreen ? 'Press Esc to leave full screen' : 'Press Esc to close'}</p>
      </div>
    </div>,
    document.body
  );
};

export default CameraFullscreenModal;
