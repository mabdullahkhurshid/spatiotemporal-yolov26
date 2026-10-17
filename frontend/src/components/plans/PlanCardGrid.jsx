import PlanCard from './PlanCard';
import { PlanCardGridSkeleton } from '../ui/PortalSkeletons';

const PlanCardGrid = ({
  plans = [],
  isLoading = false,
  error = '',
  variant = 'landing',
  onSubscribe,
  subscribeLabel = 'Subscribe',
  disableSubscribe = false,
  planCapacityHint,
  emptyMessage = 'Subscription plans are not configured yet. Please contact the system administrator.',
  className = '',
}) => {
  if (isLoading) {
    return <PlanCardGridSkeleton />;
  }

  if (error) {
    return (
      <div className="col-span-full text-center text-red-500 dark:text-red-400" role="alert">
        {error}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div
        className={`col-span-full text-center py-10 px-4 rounded-xl border border-dashed ${
          variant === 'landing'
            ? 'border-slate-600 text-slate-300'
            : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`.trim()}>
      {plans.map((plan) => (
        <PlanCard
          key={plan._id ?? plan.slug ?? plan.name}
          plan={plan}
          variant={variant}
          onSubscribe={onSubscribe}
          subscribeLabel={subscribeLabel}
          disabled={disableSubscribe}
          capacityHint={planCapacityHint?.(plan) || ''}
        />
      ))}
    </div>
  );
};

export default PlanCardGrid;
