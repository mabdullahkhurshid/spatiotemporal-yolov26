import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlanCardGrid from '../../components/plans/PlanCardGrid';
import PlanCapacityModal from '../../components/plans/PlanCapacityModal';
import PageHeader from '../../components/ui/PageHeader';
import { Notice } from '../../components/ui/Feedback';
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

  let intro = 'Every plan includes real-time fire and smoke detection, alert workflows and reports.';
  let subscribeLabel = 'Subscribe';

  if (eligibilityLoading) {
    intro = 'Checking your subscription so the right plan action is available.';
  } else if (mode === CHECKOUT_MODE.FIRST_PURCHASE) {
    intro =
      'Every plan includes real-time fire and smoke detection, alert workflows and reports. Subscribing creates your organization.';
  } else if (isRenewalMode) {
    intro =
      'Choose a plan to renew your organization. Your cameras and operators stay in place when the plan can hold them.';
    subscribeLabel = 'Renew';
  } else if (mode === CHECKOUT_MODE.BLOCKED_ACTIVE) {
    intro = 'Your current term is active. You can move to a different plan once it ends.';
    subscribeLabel = 'View subscription';
  } else if (mode === CHECKOUT_MODE.BLOCKED_SUSPENDED) {
    intro = 'Your organization is suspended. Contact support before choosing a plan.';
    subscribeLabel = 'View subscription';
  }

  const planCapacityHint = (plan) => {
    if (!isRenewalMode) return '';
    return getPlanCapacityGaps(plan, usage).camerasOver ? 'Not enough slots' : '';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Plans" description={intro} className="mb-0" />

      {isRenewalMode && usage && (
        <Notice tone="info" title="Renewing your organization">
          You currently use {usage.camerasUsed ?? 0} cameras and {usage.operatorsUsed ?? 0} operators. Plans that can&apos;t hold them are marked.
        </Notice>
      )}

      {eligibilityError && <Notice tone="critical">{eligibilityError}</Notice>}

      <h2 className="sr-only">Available plans</h2>
      <PlanCardGrid
        plans={plans}
        isLoading={isLoadingPlans}
        error={plansError}
        onSubscribe={handleSubscribeClick}
        subscribeLabel={subscribeLabel}
        disableSubscribe={eligibilityLoading || Boolean(eligibilityError)}
        planCapacityHint={planCapacityHint}
      />

      <p className="text-center text-sm text-fg-muted">
        Prices exclude applicable taxes. Questions about a plan?{' '}
        <Link to="/customer/help/contact" className="link">
          Talk to us
        </Link>
      </p>

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
