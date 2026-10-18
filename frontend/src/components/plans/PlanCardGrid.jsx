import { Package } from 'lucide-react';
import PlanCard from './PlanCard';
import { PlanCardGridSkeleton } from '../ui/PortalSkeletons';
import { EmptyState, ErrorState } from '../ui/Feedback';

const PlanCardGrid = ({
  plans = [],
  isLoading = false,
  error = '',
  onSubscribe,
  subscribeLabel = 'Subscribe',
  disableSubscribe = false,
  planCapacityHint,
  emptyMessage = 'Plans are not available yet. Please check back soon or contact us.',
  className = '',
}) => {
  if (isLoading) return <PlanCardGridSkeleton />;
  if (error) return <ErrorState title="Plans could not be loaded" description={error} />;
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong">
        <EmptyState icon={Package} title="No plans yet" description={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}>
      {plans.map((plan) => (
        <PlanCard
          key={plan._id ?? plan.slug ?? plan.name}
          plan={plan}
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
