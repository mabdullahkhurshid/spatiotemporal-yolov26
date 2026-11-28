import { VideoOff } from 'lucide-react';
import CameraTile from './CameraTile';
import { Skeleton, EmptyState } from '../ui/Feedback';
import Card from '../ui/Card';

// Small live tiles (as in the earlier camera wall); click a tile for the larger viewer.
const DEFAULT_COLUMNS = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

const CameraGridSkeleton = ({ columnsClassName, count = 4 }) => (
  <div className={`grid gap-4 ${columnsClassName}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="overflow-hidden rounded-lg border border-line bg-surface">
        <Skeleton className="aspect-video rounded-none" />
        <div className="space-y-2 p-3.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const CameraGrid = ({
  cameras = [],
  loading = false,
  onOpenCamera,
  onSettingsCamera,
  showSettings = false,
  emptyState,
  columnsClassName = DEFAULT_COLUMNS,
  children,
}) => {
  if (loading && cameras.length === 0) {
    return <CameraGridSkeleton columnsClassName={columnsClassName} />;
  }

  if (cameras.length === 0) {
    return (
      emptyState ?? (
        <Card>
          <EmptyState icon={VideoOff} title="No cameras found" />
        </Card>
      )
    );
  }

  // Offline cameras sink to the end so live feeds stay first.
  const ordered = [...cameras].sort((a, b) => Number(/online/i.test(b.status)) - Number(/online/i.test(a.status)));

  return (
    <div className={`grid gap-4 ${columnsClassName}`}>
      {ordered.map((camera) => (
        <CameraTile key={camera._id} camera={camera} onOpen={onOpenCamera} onSettings={onSettingsCamera} showSettings={showSettings} />
      ))}
      {children}
    </div>
  );
};

export default CameraGrid;
