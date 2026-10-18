import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { ArrowRight, Building2, Camera, Check, ChevronRight, CreditCard, LifeBuoy, Package, Settings, User, Users } from 'lucide-react';
import { useRenewalEligibility } from '../../hooks/useRenewalEligibility';
import AccountStatusBanner from '../../components/account/AccountStatusBanner';
import UsageBar from '../../components/account/UsageBar';
import { DashboardSkeleton } from '../../components/ui/PortalSkeletons';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { roleLabel } from '../../utils/accountFormatting';
import { daysUntil, formatDate } from '../../utils/format';
import { clearPendingPlanId, getPendingPlanId, isPortalUser } from '../../utils/roleRoutes';
import { ACTIVE_SUBSCRIPTION_MESSAGE, CHECKOUT_MODE } from '../../utils/checkoutMode';
import { cn } from '../../utils/cn';

const STEPS = [
  { title: 'Choose a plan', body: 'Pick how many cameras and operators you need. You can change plans when your term ends.' },
  { title: 'Name your organization', body: 'Checkout creates your organization and makes you its administrator.' },
  { title: 'Connect cameras', body: 'Add your CCTV streams and invite operators. Monitoring starts immediately.' },
];

const QuickLink = ({ to, icon: Icon, title, description }) => (
  <li>
    <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-subtle group-hover:text-fg">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block truncate text-xs text-fg-muted">{description}</span>
      </span>
      <ChevronRight size={16} className="text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  </li>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const portalReady = isAuthenticated && isPortalUser(user?.role);
  const { accountSummary: summary, loading: loadingSummary, error: summaryError, mode } = useRenewalEligibility({ enabled: portalReady });

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(user?.role)) navigate('/login', { replace: true });
  }, [isAuthenticated, navigate, user?.role]);

  useEffect(() => {
    if (summaryError) toast.error(summaryError);
  }, [summaryError]);

  // A plan chosen on the public pricing page before sign-in continues to checkout here.
  useEffect(() => {
    if (!portalReady || loadingSummary) return;
    const pendingPlanId = getPendingPlanId();
    if (!pendingPlanId) return;

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

  if (loadingSummary) return <DashboardSkeleton />;

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hasOrg = summary?.flags?.hasOrganization;
  const { organization, subscription, usage, flags } = summary || {};
  const planName = subscription?.planDetails?.name || subscription?.plan || organization?.subscriptionPlan;
  const endDate = subscription?.endDate || organization?.subscriptionEndDate;
  const remaining = daysUntil(endDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={hasOrg ? `Account overview for ${organization?.name}.` : 'Set up FireGuard AI for your site in three steps.'}
        actions={
          hasOrg && flags?.hasActiveSubscription ? (
            <Button as={Link} to="/orgadmin/dashboard" iconRight={ArrowRight}>
              Open monitoring
            </Button>
          ) : !hasOrg ? (
            <Button as={Link} to="/customer/plans" iconRight={ArrowRight}>
              Choose a plan
            </Button>
          ) : null
        }
        className="mb-0"
      />

      <AccountStatusBanner flags={flags} organization={organization} subscription={subscription} />

      {!hasOrg ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Get started" description="Most sites are monitoring within minutes." />
            <ol className="divide-y divide-line">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4 px-4 py-4 sm:px-5">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      i === 0 ? 'bg-brand-600 text-white' : 'bg-surface-2 text-fg-muted ring-1 ring-inset ring-line'
                    )}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{step.title}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">{step.body}</p>
                    {i === 0 && (
                      <Button as={Link} to="/customer/plans" size="sm" className="mt-3" iconRight={ArrowRight}>
                        Compare plans
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Your account" />
            <ul className="divide-y divide-line">
              <QuickLink to="/customer/profile" icon={User} title="Profile" description="Name, phone and photo" />
              <QuickLink to="/customer/settings" icon={Settings} title="Settings" description="Password, sessions and theme" />
              <QuickLink to="/customer/help" icon={LifeBuoy} title="Help & support" description="Answers and contact" />
            </ul>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={planName ? `${planName} plan` : 'Subscription'}
                icon={Package}
                actions={<StatusBadge kind="subscription" value={subscription?.status || organization?.subscriptionStatus} />}
              />
              <CardBody>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-fg-muted">{remaining != null && remaining < 0 ? 'Ended' : 'Current term ends'}</dt>
                    <dd className="mt-1 text-sm font-medium text-fg">{formatDate(endDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Time remaining</dt>
                    <dd className={cn('mt-1 text-sm font-medium', remaining != null && remaining < 0 ? 'text-critical-fg' : 'text-fg')}>
                      {remaining == null ? '—' : remaining < 0 ? 'Expired' : `${remaining} day${remaining === 1 ? '' : 's'}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Your role</dt>
                    <dd className="mt-1 text-sm font-medium text-fg">{roleLabel(user?.role)}</dd>
                  </div>
                </dl>
                {usage && (
                  <div className="mt-6 grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
                    <UsageBar label="Cameras" used={usage.camerasUsed} limit={usage.maxCameras} icon={Camera} />
                    <UsageBar label="Operators" used={usage.operatorsUsed} limit={usage.maxOperators} icon={Users} />
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button as={Link} to="/customer/subscription" variant="secondary" size="sm" icon={CreditCard}>
                    Subscription & billing
                  </Button>
                  {flags?.isSubscriptionExpired && (
                    <Button as={Link} to="/customer/plans" size="sm">
                      Renew plan
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={organization?.name} description={organization?.email} icon={Building2} actions={<StatusBadge kind="org" value={organization?.status} />} />
              <ul className="divide-y divide-line">
                {flags?.hasActiveSubscription && <QuickLink to="/orgadmin/cameras" icon={Camera} title="Cameras" description="Add and manage camera feeds" />}
                {flags?.hasActiveSubscription && <QuickLink to="/orgadmin/operators" icon={Users} title="Operators" description="Invite people and assign cameras" />}
                <QuickLink to="/customer/profile" icon={User} title="Profile" description="Your personal details" />
                <QuickLink to="/customer/help" icon={LifeBuoy} title="Help & support" description="Answers and contact" />
              </ul>
            </Card>
          </div>

          {flags?.hasActiveSubscription && (
            <Card>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg">
                    <Check size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">Monitoring is active</p>
                    <p className="text-sm text-fg-muted">Live alerts, camera health and reports are in the monitoring area.</p>
                  </div>
                </div>
                <Button as={Link} to="/orgadmin/dashboard" variant="secondary" iconRight={ArrowRight}>
                  Open monitoring
                </Button>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
