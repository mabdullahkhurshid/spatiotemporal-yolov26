import { useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useSelector } from 'react-redux';

import toast from 'react-hot-toast';

import {

  ArrowRight,

  Building2,

  CreditCard,

  HelpCircle,

  Package,

  User,

} from 'lucide-react';

import { useRenewalEligibility } from '../../hooks/useRenewalEligibility';

import AccountStatusBanner from '../../components/account/AccountStatusBanner';
import { DashboardSkeleton } from '../../components/ui/PortalSkeletons';

import {

  accountStatusBadgeClass,

  formatAccountDate,

  roleLabel,

} from '../../utils/accountFormatting';

import { clearPendingPlanId, getPendingPlanId, isPortalUser } from '../../utils/roleRoutes';

import {
  ACTIVE_SUBSCRIPTION_MESSAGE,
  CHECKOUT_MODE,
} from '../../utils/checkoutMode';



const Dashboard = () => {

  const navigate = useNavigate();

  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const portalReady = isAuthenticated && isPortalUser(user?.role);

  const {
    accountSummary: summary,
    loading: loadingSummary,
    error: summaryError,
    mode,
  } = useRenewalEligibility({ enabled: portalReady });



  useEffect(() => {

    if (!isAuthenticated || !isPortalUser(user?.role)) {

      navigate('/login', { replace: true });

    }

  }, [isAuthenticated, navigate, user?.role]);



  useEffect(() => {
    if (summaryError) {
      toast.error(summaryError);
    }
  }, [summaryError]);

  useEffect(() => {
    if (!portalReady || loadingSummary) {
      return;
    }

    const pendingPlanId = getPendingPlanId();
    if (!pendingPlanId) {
      return;
    }

    if (mode === CHECKOUT_MODE.BLOCKED_ACTIVE) {
      clearPendingPlanId();
      toast.error(ACTIVE_SUBSCRIPTION_MESSAGE);
      navigate('/customer/subscription', { replace: true });
      return;
    }

    if (mode === CHECKOUT_MODE.BLOCKED_SUSPENDED) {
      clearPendingPlanId();
      toast.error('Your organization is suspended. Please contact support.');
      navigate('/customer/subscription', { replace: true });
      return;
    }

    if (mode === CHECKOUT_MODE.RENEWAL || mode === CHECKOUT_MODE.FIRST_PURCHASE) {
      clearPendingPlanId();
      navigate(`/customer/subscribe/${encodeURIComponent(pendingPlanId)}`, { replace: true });
    }
  }, [portalReady, loadingSummary, mode, navigate]);



  const firstName = user?.name?.split(' ')[0] || 'there';

  const hasOrg = summary?.flags?.hasOrganization;

  const planName =

    summary?.subscription?.planDetails?.name ||

    summary?.subscription?.plan ||

    summary?.organization?.subscriptionPlan;



  return (

    <div className="max-w-4xl mx-auto space-y-6">

      {loadingSummary ? (
        <DashboardSkeleton />
      ) : (
        <>
      <section className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0">

        <p className="text-sm opacity-90">Welcome back</p>

        <h2 className="text-2xl sm:text-3xl font-bold mt-1">Hello, {firstName}</h2>

        <p className="mt-2 text-sm sm:text-base opacity-90 max-w-xl">

          {hasOrg

            ? 'Manage your subscription, profile, and organization from your account portal.'

            : 'Browse plans, manage your profile, and subscribe when you are ready to get started.'}

        </p>

      </section>



      {hasOrg && (
        <AccountStatusBanner
          flags={summary.flags}
          organization={summary.organization}
          subscription={summary.subscription}
        />
      )}

      {!hasOrg && (

        <section className="card border-dashed border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">

                No active subscription yet

              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">

                Choose a plan to create your organization and unlock the org admin dashboard.

              </p>

            </div>

            <Link to="/customer/plans" className="btn-primary inline-flex items-center gap-2 whitespace-nowrap">

              Browse Plans

              <ArrowRight size={16} />

            </Link>

          </div>

        </section>

      )}



      {hasOrg && (

        <section className="grid gap-4 sm:grid-cols-2">

          <div className="card">

            <div className="flex items-start justify-between gap-3">

              <div className="flex items-start gap-3">

                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">

                  <CreditCard size={20} />

                </div>

                <div>

                  <h3 className="font-semibold text-gray-900 dark:text-white">Subscription</h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{planName || '—'}</p>

                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">

                    Expires{' '}

                    {formatAccountDate(

                      summary?.subscription?.endDate || summary?.organization?.subscriptionEndDate

                    )}

                  </p>

                </div>

              </div>

              <span

                className={`px-2 py-1 rounded-full text-xs font-medium capitalize shrink-0 ${accountStatusBadgeClass(

                  summary?.subscription?.status || summary?.organization?.subscriptionStatus

                )}`}

              >

                {summary?.subscription?.status || summary?.organization?.subscriptionStatus}

              </span>

            </div>

            <Link

              to="/customer/subscription"

              className="mt-4 inline-flex items-center gap-1 text-sm text-primary-600 dark:text-amber-400 hover:underline"

            >

              View details

              <ArrowRight size={14} />

            </Link>

          </div>



          <div className="card">

            <div className="flex items-start justify-between gap-3">

              <div className="flex items-start gap-3">

                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">

                  <Building2 size={20} />

                </div>

                <div>

                  <h3 className="font-semibold text-gray-900 dark:text-white">

                    {summary.organization?.name}

                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">

                    {roleLabel(summary.user?.role)}

                  </p>

                </div>

              </div>

              <span

                className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${accountStatusBadgeClass(

                  summary.organization?.status

                )}`}

              >

                {summary.organization?.status}

              </span>

            </div>

            {summary.flags?.hasActiveSubscription && (

              <Link

                to="/orgadmin/dashboard"

                className="mt-4 inline-flex items-center gap-2 btn-primary text-sm"

              >

                Open Org Dashboard

                <ArrowRight size={14} />

              </Link>

            )}

          </div>

        </section>

      )}



      <section className="grid gap-4 sm:grid-cols-2">

        <Link

          to={hasOrg ? '/customer/subscription' : '/customer/subscribe'}

          className="card hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"

        >

          <div className="flex items-start gap-3">

            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">

              {hasOrg ? <CreditCard size={20} /> : <Package size={20} />}

            </div>

            <div>

              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-amber-400">

                {hasOrg ? 'My Subscription' : 'Subscribe to a Plan'}

              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">

                {hasOrg

                  ? 'View your plan, billing dates, and usage.'

                  : 'Compare plans and complete checkout.'}

              </p>

            </div>

          </div>

        </Link>



        <Link

          to="/customer/profile"

          className="card hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"

        >

          <div className="flex items-start gap-3">

            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">

              <User size={20} />

            </div>

            <div>

              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-amber-400">

                Your Profile

              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">

                View and edit your account information.

              </p>

            </div>

          </div>

        </Link>



        <Link

          to="/customer/help"

          className="card hover:border-primary-300 dark:hover:border-primary-700 transition-colors group sm:col-span-2"

        >

          <div className="flex items-start gap-3">

            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">

              <HelpCircle size={20} />

            </div>

            <div>

              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-amber-400">

                Help & Support

              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">

                FAQs and guidance for your account and subscriptions.

              </p>

            </div>

          </div>

        </Link>

      </section>
        </>
      )}

    </div>

  );

};



export default Dashboard;

