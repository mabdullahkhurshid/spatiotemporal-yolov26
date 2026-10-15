import { Camera, Plus } from 'lucide-react';
import UsageBar from '../account/UsageBar';

const CameraUsageBanner = ({
  title = 'Cameras',
  subtitle,
  used,
  maxCameras,
  canAdd,
  loading = false,
  onAddClick,
  addLabel = 'Add Camera',
}) => {
  const limitReached = !loading && !canAdd;
  const addTitle = limitReached ? 'Camera limit reached. Upgrade your plan.' : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">{subtitle}</p>
          )}
        </div>
        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            disabled={loading || limitReached}
            title={addTitle}
            className="btn-primary flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            {addLabel}
          </button>
        )}
      </div>

      <div className="card py-4">
        <UsageBar label="Camera usage" used={used} limit={maxCameras} icon={Camera} />
        {limitReached && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            Camera limit reached. Upgrade your plan to add more cameras.
          </p>
        )}
      </div>
    </div>
  );
};

export default CameraUsageBanner;
