import CameraTile from './CameraTile';

const CameraGridSkeleton = ({ columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', count = 4 }) => (
  <div className={`grid gap-4 ${columnsClassName}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
      >
        <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
        <div className="p-3 space-y-2">
          <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    ))}
  </div>
);

const CameraGrid = ({
  cameras = [],
  loading = false,
  compact = true,
  onOpenCamera,
  onSettingsCamera,
  showSettings = false,
  emptyState,
  columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  children,
}) => {
  if (loading) {
    return (
      <CameraGridSkeleton columnsClassName={columnsClassName} />
    );
  }

  if (cameras.length === 0) {
    return (
      emptyState ?? (
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">No cameras found.</p>
        </div>
      )
    );
  }

  return (
    <div className={`grid gap-4 ${columnsClassName}`}>
      {cameras.map((camera) => (
        <CameraTile
          key={camera._id}
          camera={camera}
          compact={compact}
          onOpen={onOpenCamera}
          onSettings={onSettingsCamera}
          showSettings={showSettings}
        />
      ))}
      {children}
    </div>
  );
};

export default CameraGrid;
