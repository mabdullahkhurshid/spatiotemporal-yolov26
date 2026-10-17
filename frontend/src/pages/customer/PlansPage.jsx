import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlanCardGrid from '../../components/plans/PlanCardGrid';
import PlanCapacityModal from '../../components/plans/PlanCapacityModal';
import { useRenewalEligibility } from '../../hooks/useRenewalEligibility';
import { getPublicSubscriptionPlans } from '../../services/publicApi';
import {
  ACTIVE_SUBSCRIPTION_MESSAGE,
  CHECKOUT_MODE,
  getPlanCapacityGaps,
} from '../../utils/checkoutMode';

const PlansPage = () => {
  const navigate = useNavigate();
  const {
    mode,
    usage,
    loading: eligibilityLoading,
    error: eligibilityError,
    isRenewalMode,
    canCheckoutPlan,
  } = useRenewalEligibility();

  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [capacityPlan, setCapacityPlan] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPlans = async () => {
      try {
        setIsLoadingPlans(true);
        setPlansError('');

        const response = await getPublicSubscriptionPlans();

        if (!isMounted) return;

        const fetchedPlans = response?.data?.data;
        setPlans(Array.isArray(fetchedPlans) ? fetchedPlans : []);
      } catch (error) {
        if (!isMounted) return;

        console.error('Failed to load subscription plans:', error);
        setPlans([]);
        setPlansError(
          'Unable to load subscription plans right now. Please try again later.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubscribeClick = (planId) => {
    if (!planId || eligibilityLoading || !mode) return;

    const plan = plans.find((item) => String(item._id) === String(planId));

    if (mode === CHECKOUT_MODE.RENEWAL) {
      if (!plan) {
        return;
      }
      if (!canCheckoutPlan(plan)) {
        setCapacityPlan(plan);
        return;
      }
      navigate(`/customer/subscribe/${encodeURIComponent(planId)}`);
      return;
    }

    if (mode === CHECKOUT_MODE.FIRST_PURCHASE) {
      navigate(`/customer/subscribe/${encodeURIComponent(planId)}`);
      return;
    }

    if (mode === CHECKOUT_MODE.BLOCKED_SUSPENDED) {
      toast.error('Your organization is suspended. Please contact support.');
    } else {
      toast(ACTIVE_SUBSCRIPTION_MESSAGE, { icon: 'ℹ️' });
    }
    navigate('/customer/subscription');
  };

  let intro = 'Compare plans for your account.';
  let subscribeLabel = 'Subscribe';

  if (eligibilityLoading) {
    intro = 'Checking your subscription so the right plan action is available.';
  } else if (mode === CHECKOUT_MODE.FIRST_PURCHASE) {
    intro =
      'Compare plans and subscribe to create your organization and unlock the org admin dashboard.';
  } else if (isRenewalMode) {
    intro =
      'Choose a plan to renew this organization. Cameras stay in place when the plan fits your current usage. A smaller plan asks you to remove devices first.';
    subscribeLabel = 'Renew';
  } else if (mode === CHECKOUT_MODE.BLOCKED_ACTIVE) {
    intro = 'Review available plans. You can change plans after the current term expires.';
    subscribeLabel = 'View Subscription';
  } else if (mode === CHECKOUT_MODE.BLOCKED_SUSPENDED) {
    intro = 'Your organization is suspended. Contact support before choosing a plan.';
    subscribeLabel = 'View Subscription';
  }

  const planCapacityHint = (plan) => {
    if (!isRenewalMode) return '';
    return getPlanCapacityGaps(plan, usage).camerasOver ? 'Not enough slots' : '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Subscription Plans
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          {intro}
        </p>
        {isRenewalMode && usage && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Current usage: {usage.camerasUsed ?? 0} cameras, {usage.operatorsUsed ?? 0} operators.
          </p>
        )}
      </section>

      {eligibilityError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {eligibilityError}
        </p>
      )}

      <PlanCardGrid
        plans={plans}
        isLoading={isLoadingPlans}
        error={plansError}
        variant="portal"
        onSubscribe={handleSubscribeClick}
        subscribeLabel={subscribeLabel}
        disableSubscribe={eligibilityLoading || Boolean(eligibilityError)}
        planCapacityHint={planCapacityHint}
      />

      {capacityPlan && (
        <PlanCapacityModal
          plan={capacityPlan}
          usage={usage}
          onClose={() => setCapacityPlan(null)}
          onChooseOther={() => setCapacityPlan(null)}
          onManageCameras={() => {
            const planId = capacityPlan._id;
            setCapacityPlan(null);
            navigate(`/customer/downgrade-prep?planId=${encodeURIComponent(planId)}`);
          }}
        />
      )}
    </div>
  );
};

export default PlansPage;
