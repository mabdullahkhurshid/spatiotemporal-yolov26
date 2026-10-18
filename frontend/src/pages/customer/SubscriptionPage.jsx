import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Building2, Camera, CheckCircle2, Package, RefreshCw, Users } from 'lucide-react';
import { getAccountSummary } from '../../services/customerApi';
import AccountStatusBanner from '../../components/account/AccountStatusBanner';
import UsageBar from '../../components/account/UsageBar';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import { EmptyState, ErrorState, Notice, Skeleton } from '../../components/ui/Feedback';
import { formatCurrency, formatDate, daysUntil } from '../../utils/format';
import { roleLabel } from '../../utils/accountFormatting';

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

const Detail = ({ label, children }) => (
  <div>
    <dt className="text-xs text-fg-muted">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-fg">{children}</dd>
  </div>
);

const SubscriptionSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-56" />
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-56 lg:col-span-2" />
      <Skeleton className="h-56" />
    </div>
    <Skeleton className="h-40" />
  </div>
);

/** Subscription, usage and billing history. Also rendered at /orgadmin/subscription. */
const SubscriptionPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [completionNotice, setCompletionNotice] = useState(null);
  const completionHandled = useRef(false);

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await getAccountSummary();
      setState({ loading: false, data: response.data.data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.response?.data?.message || 'Failed to load subscription' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (completionHandled.current || searchParams.get('success') !== '1') return;
    completionHandled.current = true;
    const renewed = searchParams.get('renewed') === '1';
    setCompletionNotice(renewed ? 'renewed' : 'purchase');
    toast.success(renewed ? 'Subscription renewed' : 'Subscription activated');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('success');
    nextParams.delete('renewed');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  if (state.loading) return <SubscriptionSkeleton />;
  if (state.error) return <ErrorState description={state.error} onRetry={load} />;

  const { data } = state;
  if (!data?.flags?.hasOrganization) {
    return (
      <div>
        <PageHeader title="Subscription" description="Your plan, organization and billing history." />
        <Card>
          <EmptyState
            icon={Package}
            title="You don't have a subscription yet"
            description="Choose a plan to create your organization and start monitoring your cameras."
            action={
              <Button as={Link} to="/customer/plans" iconRight={ArrowRight}>
                Browse plans
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const { user, organization, subscription, orders = [], usage, flags } = data;
  const plan = subscription?.planDetails;
  const planName = plan?.name || capitalize(subscription?.plan || organization?.subscriptionPlan);
  const currency = plan?.currency || 'USD';
  const billingCycle = subscription?.billingCycle || plan?.billingCycle || 'monthly';
  const subStatus = subscription?.status || organization?.subscriptionStatus || 'pending';
  const endDate = subscription?.endDate || organization?.subscriptionEndDate;
  const remaining = daysUntil(endDate);
  const canRenew = flags?.isSubscriptionExpired && !flags?.isOrgSuspended;

  const orderColumns = [
    { key: 'date', header: 'Date', primary: true, cell: (o) => <span className="font-medium text-fg">{formatDate(o.createdAt)}</span> },
    { key: 'plan', header: 'Plan', cell: (o) => <span className="text-sm">{o.planName || capitalize(o.subscriptionPlan)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (o) => <span className="tabular text-sm">{formatCurrency(o.amount, currency)}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge kind="order" value={o.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Your plan, usage against its limits, and billing history."
        actions={
          canRenew ? (
            <Button as={Link} to="/customer/plans" icon={RefreshCw}>
              Renew or change plan
            </Button>
          ) : (
            flags?.hasActiveSubscription && (
              <Button as={Link} to="/orgadmin/dashboard" variant="secondary" iconRight={ArrowRight}>
                Open monitoring
              </Button>
            )
          )
        }
        className="mb-0"
      />

      {completionNotice && (
        <Notice tone="success" icon={CheckCircle2} title={completionNotice === 'renewed' ? 'Subscription renewed' : 'Welcome aboard — your subscription is active'}>
          {completionNotice === 'renewed'
            ? 'Your plan is active again with new billing dates. Monitoring has resumed.'
            : "You're now the organization admin. Add your cameras and invite operators from the monitoring area."}
        </Notice>
      )}

      <AccountStatusBanner flags={flags} organization={organization} subscription={subscription} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${planName} plan`} description={`Billed ${billingCycle}`} icon={Package} actions={<StatusBadge kind="subscription" value={subStatus} />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Detail label="Price">
                <span className="tabular">{formatCurrency(subscription?.price, currency)}</span>
                <span className="font-normal text-fg-muted"> / {billingCycle === 'yearly' ? 'year' : 'month'}</span>
              </Detail>
              <Detail label="Started">{formatDate(subscription?.startDate || organization?.subscriptionStartDate)}</Detail>
              <Detail label={remaining != null && remaining < 0 ? 'Ended' : 'Renews / ends'}>{formatDate(endDate)}</Detail>
              <Detail label="Time remaining">
                {remaining == null ? '—' : remaining < 0 ? <span className="text-critical-fg">Expired</span> : `${remaining} day${remaining === 1 ? '' : 's'}`}
              </Detail>
            </dl>
            {usage && (
              <div className="mt-6 grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
                <UsageBar label="Cameras" used={usage.camerasUsed} limit={usage.maxCameras} icon={Camera} />
                <UsageBar label="Operators" used={usage.operatorsUsed} limit={usage.maxOperators} icon={Users} />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={organization?.name || 'Organization'} description={organization?.email} icon={Building2} actions={<StatusBadge kind="org" value={organization?.status} />} />
          <CardBody>
            <dl className="space-y-4">
              <Detail label="Your role">{roleLabel(user?.role)}</Detail>
              {organization?.phone && <Detail label="Phone">{organization.phone}</Detail>}
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Billing history" description="Payments are recorded when a plan is purchased or renewed." />
        <DataTable caption="Billing history" columns={orderColumns} rows={orders} empty={<p className="px-5 py-8 text-center text-sm text-fg-muted">No orders yet.</p>} />
      </Card>
    </div>
  );
};

export default SubscriptionPage;
