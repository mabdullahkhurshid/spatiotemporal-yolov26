import { Settings, VideoOff } from 'lucide-react';
import { isCameraOnline } from '../../utils/camera';

const getPrimaryLabel = (camera) =>
  camera.displayNumber || camera.label || camera.name || 'Unnamed camera';

const getSecondaryLabel = (camera) => {
  const name = camera.label || camera.name;
  const parts = [];
  if (camera.displayNumber && name && name !== camera.displayNumber) {
    parts.push(name);
  }
  if (camera.location) {
    parts.push(camera.location);
  }
  return parts.join(' · ') || 'No location';
};

const CameraTile = ({
  camera,
  compact = true,
  onOpen,
  onSettings,
  showSettings = false,
}) => {
  const online = isCameraOnline(camera.status);
  const primaryLabel = getPrimaryLabel(camera);
  const secondaryLabel = getSecondaryLabel(camera);

  const handleOpen = () => {
    onOpen?.(camera);
  };

  const handleSettings = (event) => {
    event.stopPropagation();
    onSettings?.(camera);
  };

  if (!compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpen();
          }
        }}
        className="card flex flex-col space-y-3 text-left w-full hover:ring-2 hover:ring-primary-500/40 transition-shadow cursor-pointer"
      >
        <TileHeader
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          online={online}
          status={camera.status}
          showSettings={showSettings}
          onSettings={handleSettings}
        />
        <TilePreview camera={camera} compact={false} />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-left transition-shadow hover:shadow-md hover:ring-2 hover:ring-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
    >
      <TilePreview camera={camera} compact />
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {primaryLabel}
          </p>
          <StatusPill online={online} status={camera.status} />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{secondaryLabel}</p>
      </div>
      {showSettings && (
        <button
          type="button"
          onClick={handleSettings}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/70 transition-opacity"
          title="Camera settings"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );
};

const StatusPill = ({ online, status }) => (
  <span
    className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
      online
        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
    }`}
  >
    {online ? 'Online' : status?.toUpperCase() || 'Offline'}
  </span>
);

const TileHeader = ({ primaryLabel, secondaryLabel, online, status, showSettings, onSettings }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
        {primaryLabel}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{secondaryLabel}</p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <StatusPill online={online} status={status} />
      {showSettings && (
        <button
          type="button"
          onClick={onSettings}
          className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Camera settings"
        >
          <Settings size={16} />
        </button>
      )}
    </div>
  </div>
);

const TilePreview = ({ camera, compact }) => (
  <div
    className={`relative w-full bg-gray-900 overflow-hidden ${
      compact ? 'aspect-[4/3]' : 'aspect-video rounded-lg'
    }`}
  >
    {camera.streamUrl ? (
      <video
        src={camera.streamUrl}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />
    ) : (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500">
        <VideoOff size={compact ? 20 : 28} />
        <span className="text-xs">No stream</span>
      </div>
    )}
  </div>
);

export default CameraTile;
