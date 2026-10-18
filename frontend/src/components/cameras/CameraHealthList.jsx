import { VideoOff } from 'lucide-react';
import { StatusBadge } from '../ui/Badge';
import { EmptyState, Skeleton } from '../ui/Feedback';
import { cameraTitle, isCameraOnline } from '../../utils/camera';
import { formatRelative } from '../../utils/format';

/** Cameras ordered by health: offline first, then by name. */
const CameraHealthList = ({ cameras, loading, limit = 6, onOpen }) => {
  if (loading && cameras.length === 0) {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (cameras.length === 0) {
    return <EmptyState icon={VideoOff} title="No cameras yet" compact />;
  }
  const ordered = [...cameras]
    .sort((a, b) => Number(isCameraOnline(a.status)) - Number(isCameraOnline(b.status)) || cameraTitle(a).localeCompare(cameraTitle(b)))
    .slice(0, limit);

  return (
    <ul className="divide-y divide-line">
      {ordered.map((camera) => {
        const online = isCameraOnline(camera.status);
        return (
          <li key={camera._id}>
            <button type="button" onClick={() => onOpen?.(camera)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 sm:px-5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{cameraTitle(camera)}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {online ? camera.location || '—' : `Last seen ${formatRelative(camera.lastHeartbeat || camera.lastActivity)}`}
                </span>
              </span>
              <StatusBadge kind="camera" value={online ? 'online' : 'offline'} />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default CameraHealthList;
