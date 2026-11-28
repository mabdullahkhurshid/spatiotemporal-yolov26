import { useSelector } from 'react-redux';
import { Flame, Maximize2, Pause, Settings, Video, VideoOff, Wrench } from 'lucide-react';
import { cameraTitle, isCameraOnline, isCameraPaused } from '../../utils/camera';
import { useCameraPreview } from '../../hooks/useCameraPreview';
import { formatRelative } from '../../utils/format';
import { cn } from '../../utils/cn';
import IconButton from '../ui/IconButton';
import CameraPauseControl from './CameraPauseControl';
import { pausedLabel } from '../../hooks/useCameraPause';

const LIVE_WINDOW_MS = 15 * 1000;
const MONITORING_WINDOW_MS = 2 * 60 * 1000;

/** What the AI pipeline currently reports for this camera. */
const useAiState = (camera) => {
  const live = useSelector((state) => state.cameras.liveDetectionById[String(camera._id)]);
  const liveAge = live?.timestamp ? Date.now() - new Date(live.timestamp).getTime() : Infinity;
  const hits = (live?.detections || []).filter((d) => d.className === 'fire' || d.className === 'smoke');
  if (liveAge < LIVE_WINDOW_MS && hits.length) {
    const fire = Math.round(live.metrics?.fireConfidence || 0);
    const smoke = Math.round(live.metrics?.smokeConfidence || 0);
    return { kind: 'detecting', label: fire >= smoke ? `Fire ${fire}%` : `Smoke ${smoke}%` };
  }
  const last = camera.inference?.lastDetectionAt;
  if ((last && Date.now() - new Date(last).getTime() < MONITORING_WINDOW_MS) || liveAge < LIVE_WINDOW_MS) {
    return { kind: 'monitoring', label: 'AI monitoring' };
  }
  return null;
};

/**
 * Camera card (small size). Online cameras show a live preview pushed over the socket, whether or
 * not AI detection is on; offline / paused / maintenance cameras say so. Click opens the larger live viewer.
 * Admins (showSettings) also get pause / resume and settings in the footer.
 */
const CameraTile = ({ camera, onOpen, onSettings, showSettings = false }) => {
  const online = isCameraOnline(camera.status);
  const maintenance = camera.status === 'maintenance';
  const paused = isCameraPaused(camera.status);
  const preview = useCameraPreview(camera._id, online);
  const ai = useAiState(camera);
  const detecting = ai?.kind === 'detecting';
  const title = cameraTitle(camera);

  return (
    <article
      className={cn(
        // No overflow-hidden here: it would clip the footer's pause menu.
        'group rounded-lg border bg-surface transition-shadow hover:shadow-overlay',
        detecting ? 'border-critical ring-1 ring-critical' : 'border-line'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(camera)}
        aria-label={`Open live view: ${title}`}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-t-lg bg-[#0B111D] text-left"
      >
        {/* faint grid reads as a video surface without pretending to be a frame */}
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]"
        />
        {/* Shown until the first frame arrives, and whenever there is no feed. */}
        <span className="relative flex flex-col items-center gap-1.5 text-white/60">
          {online ? (
            <Video size={22} aria-hidden="true" />
          ) : paused ? (
            <Pause size={22} aria-hidden="true" />
          ) : maintenance ? (
            <Wrench size={22} aria-hidden="true" />
          ) : (
            <VideoOff size={22} aria-hidden="true" />
          )}
          <span className="text-xs">
            {online ? 'Connecting to live feed…' : paused ? pausedLabel(camera) : maintenance ? 'Under maintenance' : 'Camera offline'}
          </span>
        </span>
        {online && preview.url && <img src={preview.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {online && preview.stale && (
          <span className="absolute inset-x-0 bottom-9 mx-auto w-fit rounded-full bg-black/60 px-2 py-0.5 text-2xs text-white/85">Reconnecting…</span>
        )}

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-2xs font-medium text-white backdrop-blur-sm">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-success' : paused ? 'bg-info' : maintenance ? 'bg-warning' : 'bg-white/40')}
            aria-hidden="true"
          />
          {online ? 'Live' : paused ? 'Paused' : maintenance ? 'Maintenance' : 'Offline'}
        </span>

        {camera.displayNumber && (
          <span className="absolute right-2.5 top-2.5 rounded bg-black/45 px-1.5 py-0.5 font-mono text-2xs text-white/80 backdrop-blur-sm">
            {camera.displayNumber}
          </span>
        )}

        {ai && (
          <span
            className={cn(
              'absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold',
              detecting ? 'bg-critical text-white' : 'bg-black/45 text-white/85 backdrop-blur-sm'
            )}
          >
            {detecting ? (
              <Flame size={12} aria-hidden="true" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
            )}
            {ai.label}
          </span>
        )}

        <Maximize2 size={14} className="absolute bottom-2.5 right-2.5 text-white/0 transition-colors group-hover:text-white/70" aria-hidden="true" />
      </button>

      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-fg" title={title}>
            {title}
          </h3>
          <p className="truncate text-xs text-fg-muted">
            {paused
              ? pausedLabel(camera)
              : online || maintenance
                ? camera.location || 'No location set'
                : `Last seen ${formatRelative(camera.lastHeartbeat || camera.lastActivity)}`}
          </p>
        </div>
        {showSettings && (
          <div className="flex shrink-0 items-center">
            <CameraPauseControl camera={camera} />
            <IconButton icon={Settings} label={`Settings for ${title}`} size="sm" onClick={() => onSettings?.(camera)} />
          </div>
        )}
      </div>
    </article>
  );
};

export default CameraTile;
