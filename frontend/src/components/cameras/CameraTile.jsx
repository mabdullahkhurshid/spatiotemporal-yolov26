import { useSelector } from 'react-redux';
import { Flame, Maximize2, Settings, Video, VideoOff } from 'lucide-react';
import { cameraTitle, isCameraOnline } from '../../utils/camera';
import { formatRelative } from '../../utils/format';
import { cn } from '../../utils/cn';
import IconButton from '../ui/IconButton';

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
 * Camera card. The preview area states what is known (online, AI status) instead of
 * attempting browser playback of RTSP streams; live video opens in the viewer.
 */
const CameraTile = ({ camera, onOpen, onSettings, showSettings = false }) => {
  const online = isCameraOnline(camera.status);
  const ai = useAiState(camera);
  const detecting = ai?.kind === 'detecting';
  const title = cameraTitle(camera);

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border bg-surface transition-shadow hover:shadow-overlay',
        detecting ? 'border-critical ring-1 ring-critical' : 'border-line'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(camera)}
        aria-label={`Open live view: ${title}`}
        className="relative flex aspect-video w-full items-center justify-center bg-[#0B111D] text-left"
      >
        {/* faint grid reads as a video surface without pretending to be a frame */}
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]"
        />
        <span className="relative flex flex-col items-center gap-1.5 text-white/60">
          {online ? <Video size={22} aria-hidden="true" /> : <VideoOff size={22} aria-hidden="true" />}
          <span className="text-xs">{online ? 'Open live view' : 'Camera offline'}</span>
        </span>

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-2xs font-medium text-white backdrop-blur-sm">
          <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-400' : 'bg-slate-400')} aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
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
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
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
            {online ? camera.location || 'No location set' : `Last seen ${formatRelative(camera.lastHeartbeat || camera.lastActivity)}`}
          </p>
        </div>
        {showSettings && <IconButton icon={Settings} label={`Settings for ${title}`} size="sm" onClick={() => onSettings?.(camera)} />}
      </div>
    </article>
  );
};

export default CameraTile;
