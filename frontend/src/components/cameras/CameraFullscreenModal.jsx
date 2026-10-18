import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Settings, VideoOff, X } from 'lucide-react';
import { cameraTitle, isCameraOnline } from '../../utils/camera';
import { useCameraPlayback } from '../../utils/cameraPlayback';
import { useLiveDetection } from '../../hooks/useLiveDetection';
import { formatRelative, formatTime } from '../../utils/format';
import { useOverlay } from '../ui/useOverlay';
import IconButton from '../ui/IconButton';
import ConfidenceMeter from '../alerts/ConfidenceMeter';
import DetectionOverlayCanvas from './DetectionOverlayCanvas';

const aiMode = import.meta.env.VITE_AI_MODE || 'server';

const Metric = ({ label, value }) => (
  <div>
    <dt className="text-2xs uppercase tracking-wide text-white/50">{label}</dt>
    <dd className="tabular mt-0.5 text-sm font-medium text-white">{value}</dd>
  </div>
);

/** Full-screen live view with server-side detection overlay and a telemetry panel. */
const CameraFullscreenModal = ({ camera, open, onClose, onOpenSettings, showSettingsButton = false }) => {
  const panelRef = useRef(null);
  const detectionEnabled = camera?.settings?.detectionEnabled !== false;
  const serverAi = aiMode === 'server';
  const { detections, metrics, lastUpdated } = useLiveDetection(camera?._id, open && detectionEnabled && serverAi);
  const playback = useCameraPlayback(camera, open);
  useOverlay(open && Boolean(camera), onClose, panelRef);

  if (!open || !camera) return null;

  const online = isCameraOnline(camera.status);
  const title = cameraTitle(camera);
  const hits = detections.filter((d) => d.className === 'fire' || d.className === 'smoke');

  return createPortal(
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Live view: ${title}`} className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-[#05070B]">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} aria-hidden="true" />
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            {camera.displayNumber && <span className="hidden rounded bg-white/10 px-1.5 py-0.5 font-mono text-2xs text-white/70 sm:inline">{camera.displayNumber}</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-white/55">
            {online ? 'Online' : 'Offline'}
            {camera.location ? ` · ${camera.location}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showSettingsButton && onOpenSettings && (
            <IconButton icon={Settings} label="Camera settings" onClick={() => onOpenSettings(camera)} className="text-white/70 hover:bg-white/10 hover:text-white" />
          )}
          <IconButton icon={X} label="Close live view" onClick={onClose} className="text-white/70 hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-[40vh] flex-1 items-center justify-center p-3 sm:p-5">
          {playback.url ? (
            <div className="relative flex h-full w-full items-center justify-center">
              {playback.mode === 'video' ? (
                <video src={playback.url} className="h-full w-full object-contain" autoPlay muted playsInline />
              ) : (
                <img src={playback.url} alt={`Live stream from ${title}`} className="h-full w-full object-contain" />
              )}
              {detectionEnabled && serverAi && <DetectionOverlayCanvas detections={detections} />}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-white/60">
              {playback.mode === 'none' || playback.error ? <VideoOff size={28} aria-hidden="true" /> : <Loader2 size={24} className="animate-spin" aria-hidden="true" />}
              <p className="text-sm">
                {playback.mode === 'none' ? 'No stream URL is configured for this camera.' : playback.error || 'Connecting to the live stream…'}
              </p>
            </div>
          )}
        </div>

        {detectionEnabled && serverAi && (
          <aside className="shrink-0 border-t border-white/10 px-5 py-4 lg:w-72 lg:border-l lg:border-t-0 lg:py-5" aria-label="Detection telemetry">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60">AI detection</p>
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

      <p className="hidden pb-3 text-center text-2xs text-white/40 sm:block">Press Esc to close</p>
    </div>,
    document.body
  );
};

export default CameraFullscreenModal;
