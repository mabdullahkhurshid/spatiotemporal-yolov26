import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPlanCapacityGaps } from '../../utils/checkoutMode';

const PlanCapacityModal = ({ plan, usage, onClose, onManageCameras, onChooseOther }) => {
  const gaps = getPlanCapacityGaps(plan, usage);
  const planName = plan?.name || 'This plan';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="card max-w-lg w-full space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-capacity-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="plan-capacity-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            This plan doesn&apos;t fit your current usage
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {planName} cannot be renewed until usage is within its limits. Cameras are not
            removed automatically.
          </p>
        </div>

        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          {gaps.camerasOver && (
            <li>
              {gaps.camerasUsed} cameras in use, plan allows {gaps.maxCameras}.
            </li>
          )}
          {gaps.operatorsOver && (
            <li>
              {gaps.operatorsUsed} operators in use, plan allows {gaps.maxOperators}. Remove
              operators or choose a larger plan.
            </li>
          )}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" className="btn-primary" onClick={onChooseOther}>
            Choose another plan
          </button>
          <button type="button" className="btn-secondary" onClick={onManageCameras}>
            Manage cameras
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Need help?{' '}
          <Link to="/customer/help" className="text-primary-600 dark:text-amber-400 hover:underline" onClick={onClose}>
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
};

export default PlanCapacityModal;
