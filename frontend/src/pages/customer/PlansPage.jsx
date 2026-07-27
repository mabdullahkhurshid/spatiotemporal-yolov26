import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import PlanCardGrid from '../../components/plans/PlanCardGrid';
import { getPublicSubscriptionPlans } from '../../services/publicApi';

const PlansPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isCustomer = user?.role === 'customer';

  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');

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
    if (!planId) return;

    if (isCustomer) {
      navigate(`/customer/subscribe/${encodeURIComponent(planId)}`);
      return;
    }

    toast('You already have an active subscription. View it under My Subscription.', {
      icon: 'ℹ️',
    });
    navigate('/customer/subscription');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Subscription Plans
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          {isCustomer
            ? 'Compare plans and subscribe to create your organization and unlock the org admin dashboard.'
            : 'Review available plans. Manage your current subscription from My Subscription.'}
        </p>
      </section>

      <PlanCardGrid
        plans={plans}
        isLoading={isLoadingPlans}
        error={plansError}
        variant="portal"
        onSubscribe={handleSubscribeClick}
        subscribeLabel={isCustomer ? 'Subscribe' : 'View Subscription'}
      />
    </div>
  );
};

export default PlansPage;
