import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Building2,
  Calendar,
  Camera,
  CreditCard,
  Package,
  Shield,
  Users,
} from 'lucide-react';
import { getAccountSummary } from '../../services/customerApi';
import AccountStatusBanner from '../../components/account/AccountStatusBanner';
import UsageBar from '../../components/account/UsageBar';
import { SubscriptionPageSkeleton } from '../../components/ui/PortalSkeletons';
import {
  accountStatusBadgeClass,
  formatAccountCurrency,
  formatAccountDate,
  roleLabel,
} from '../../utils/accountFormatting';

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showSuccess = searchParams.get('success') === '1';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getAccountSummary();
        setData(response.data.data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load subscription');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (showSuccess) {
      toast.success('Subscription activated successfully!');
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    }
  }, [showSuccess, searchParams, setSearchParams]);

  if (loading) {
    return <SubscriptionPageSkeleton />;
  }

  if (!data?.flags?.hasOrganization) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Subscription</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View your plan, organization, and billing history.
          </p>
        </div>
        <div className="card border-dashed border-2 border-primary-200 dark:border-primary-800 text-center py-10">
          <Package className="mx-auto text-primary-500 mb-3" size={32} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            No subscription yet
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
            Subscribe to a plan to create your organization and unlock the org admin dashboard.
          </p>
          <Link to="/customer/plans" className="btn-primary inline-flex mt-6">
            Browse Plans
          </Link>
        </div>
      </div>
    );
  }

  const { user, organization, subscription, orders = [], usage, flags } = data;
  const plan = subscription?.planDetails;
  const planName = plan?.name || subscription?.plan || organization?.subscriptionPlan || '—';
  const currency = plan?.currency || 'USD';
  const billingCycle = subscription?.billingCycle || plan?.billingCycle || 'monthly';
  const subStatus = subscription?.status || organization?.subscriptionStatus || 'pending';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Subscription</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Plan details, organization info, usage, and order history.
        </p>
      </div>

      {showSuccess && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="font-semibold text-green-800 dark:text-green-200">
            Welcome! Your subscription is now active.
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            You are now an Organization Admin. Open your org dashboard when you are ready to
            manage cameras and operators.
          </p>
        </div>
      )}

      <AccountStatusBanner flags={flags} organization={organization} subscription={subscription} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary-600">
                <Package className="text-white" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{planName}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {billingCycle} billing
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${accountStatusBadgeClass(subStatus)}`}
            >
              {subStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <CreditCard size={14} />
                Price
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {formatAccountCurrency(subscription?.price, currency)}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  {' '}
                  / {billingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Shield size={14} />
                Your role
              </p>
              <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                {roleLabel(user?.role)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start date</p>
              <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                {formatAccountDate(subscription?.startDate || organization?.subscriptionStartDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Calendar size={14} />
                Expiry date
              </p>
              <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                {formatAccountDate(subscription?.endDate || organization?.subscriptionEndDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Building2 className="text-primary-600 dark:text-amber-400" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {organization?.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{organization?.email}</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${accountStatusBadgeClass(organization?.status)}`}
            >
              {organization?.status}
            </span>
          </div>

          {organization?.phone && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{organization.phone}</p>
          )}

          {flags?.hasActiveSubscription && (
            <Link to="/orgadmin/dashboard" className="btn-primary inline-flex text-sm">
              Open Org Dashboard
            </Link>
          )}
        </div>
      </div>

      {usage && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            Usage vs limits
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <UsageBar
              label="Cameras"
              used={usage.camerasUsed}
              limit={usage.maxCameras}
              icon={Camera}
            />
            <UsageBar
              label="Operators"
              used={usage.operatorsUsed}
              limit={usage.maxOperators}
              icon={Users}
            />
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Order history</h2>
        {orders.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No past orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Plan
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 text-sm">{formatAccountDate(order.createdAt)}</td>
                    <td className="py-3 px-4 text-sm capitalize">{order.subscriptionPlan}</td>
                    <td className="py-3 px-4 text-sm">
                      {formatAccountCurrency(order.amount, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs capitalize ${accountStatusBadgeClass(order.status)}`}
                      >
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

      {!flags?.hasActiveSubscription && (
        <div className="text-center">
          <button type="button" onClick={() => navigate('/customer/plans')} className="btn-primary">
            View Plans
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
