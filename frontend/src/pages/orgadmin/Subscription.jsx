import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMySubscription } from '../../services/subscriptionApi';
import { Package, Camera, Users, Calendar, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount, currency = 'USD') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount);
};

const statusBadgeClass = (status) => {
  switch (status) {
    case 'active':
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'expired':
    case 'cancelled':
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

const UsageBar = ({ label, used, limit, icon: Icon }) => {
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Icon size={16} />
          <span>{label}</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {used} / {limit ?? '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const OrgAdminSubscription = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getMySubscription();
        setData(response.data.data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load subscription');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-600 dark:text-gray-400">Loading subscription...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="text-gray-600 dark:text-gray-400">No subscription information available.</p>
      </div>
    );
  }

  const { organization, subscription, orders = [] } = data;
  const plan = subscription?.planId || organization?.subscriptionPlanId;
  const planName = plan?.name || subscription?.plan || organization?.subscriptionPlan || '—';
  const price = subscription?.price ?? plan?.price;
  const currency = plan?.currency || 'USD';
  const billingCycle = subscription?.billingCycle || plan?.billingCycle || 'monthly';
  const status = subscription?.status || organization?.subscriptionStatus || 'pending';
  const orgSubscriptionStatus = organization?.subscriptionStatus;
  const showRenewLink =
    status === 'expired' ||
    status === 'cancelled' ||
    orgSubscriptionStatus === 'expired' ||
    orgSubscriptionStatus === 'cancelled';
  const startDate = subscription?.startDate || organization?.subscriptionStartDate;
  const endDate = subscription?.endDate || organization?.subscriptionEndDate;
  const camerasUsed = subscription?.camerasUsed ?? 0;
  const operatorsUsed = subscription?.operatorsUsed ?? 0;
  const maxCameras = organization?.maxCameras ?? plan?.maxCameras ?? 0;
  const maxOperators = organization?.maxOperators ?? plan?.maxOperators ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View your current plan, usage limits, and billing history
        </p>
      </div>

      {showRenewLink && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            This subscription is {status}.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            Renew the same organization from the account portal. Cameras stay in place when the
            plan fits your current usage.
          </p>
          <Link to="/customer/plans" className="btn-primary inline-flex mt-4 text-sm">
            Renew or change plan
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary-600">
                <Package className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{planName}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{billingCycle} billing</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusBadgeClass(status)}`}>
              {status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <CreditCard size={14} />
                Price
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {formatCurrency(price, currency)}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / {billingCycle === 'yearly' ? 'year' : 'month'}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Calendar size={14} />
                Billing cycle
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1 capitalize">{billingCycle}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start date</p>
              <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{formatDate(startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expiry date</p>
              <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{formatDate(endDate)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Usage vs limits</h2>
          <div className="space-y-6">
            <UsageBar label="Cameras" used={camerasUsed} limit={maxCameras} icon={Camera} />
            <UsageBar label="Operators" used={operatorsUsed} limit={maxOperators} icon={Users} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Subscription history</h2>
        {orders.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No past orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Plan</th>
                  <th className="text-left py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-4 capitalize">{order.subscriptionPlan}</td>
                    <td className="py-3 px-4">{formatCurrency(order.amount, currency)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs capitalize ${statusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgAdminSubscription;
