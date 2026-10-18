import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAlertStats } from '../../store/slices/alertSlice';
import { getOrderStats, getOrders, getOrganizations } from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { StatGroup } from '../../components/ui/Stat';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/Feedback';
import AlertOutcomes from '../../components/alerts/AlertOutcomes';
import { daysUntil, formatCurrency, formatDate, formatRelative } from '../../utils/format';

const EXPIRY_WINDOW_DAYS = 14;

const SuperAdminDashboard = () => {
  const dispatch = useDispatch();
  const { stats } = useSelector((state) => state.alerts);
  // Socket alert events update the alerts store; refresh counters when they arrive.
  const liveAlerts = useSelector((state) => state.alerts.alerts);
  const [data, setData] = useState({ orgs: [], orders: [], orderStats: null, loading: true });

  const load = useCallback(async () => {
    try {
      const [orgsRes, orderStatsRes, ordersRes] = await Promise.all([getOrganizations(), getOrderStats(), getOrders({ limit: 5 })]);
      setData({ orgs: orgsRes.data.data || [], orderStats: orderStatsRes.data.data, orders: ordersRes.data.data || [], loading: false });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load dashboard data');
      setData((d) => ({ ...d, loading: false }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(fetchAlertStats());
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [dispatch, load, liveAlerts]);

  const byStatus = data.orgs.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  const expiring = data.orgs
    .filter((o) => o.subscriptionEndDate && daysUntil(o.subscriptionEndDate) <= EXPIRY_WINDOW_DAYS)
    .sort((a, b) => new Date(a.subscriptionEndDate) - new Date(b.subscriptionEndDate));

  const expiringColumns = [
    {
      key: 'org',
      header: 'Organization',
      primary: true,
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{o.name}</p>
          <p className="truncate text-xs text-fg-muted">{o.admin?.email || o.email}</p>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (o) => <span className="text-sm">{o.subscriptionPlanId?.name || '—'}</span> },
    {
      key: 'ends',
      header: 'Term ends',
      cell: (o) => {
        const days = daysUntil(o.subscriptionEndDate);
        return (
          <span className={`text-sm ${days < 0 ? 'text-critical-fg' : 'text-warning-fg'}`} title={formatDate(o.subscriptionEndDate)}>
            {days < 0 ? `Expired ${formatRelative(o.subscriptionEndDate)}` : formatRelative(o.subscriptionEndDate)}
          </span>
        );
      },
    },
    { key: 'status', header: 'Subscription', hideBelow: 'lg', cell: (o) => <StatusBadge kind="subscription" value={o.subscriptionStatus} /> },
  ];

  const orderColumns = [
    {
      key: 'org',
      header: 'Organization',
      primary: true,
      cell: (o) => <span className="truncate font-medium text-fg">{o.organizationId?.name || 'Deleted organization'}</span>,
    },
    { key: 'plan', header: 'Plan', cell: (o) => <span className="text-sm">{o.planDisplayName}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (o) => <span className="tabular text-sm">{formatCurrency(o.amount)}</span> },
    { key: 'date', header: 'Date', hideBelow: 'lg', cell: (o) => <span className="text-sm text-fg-muted">{formatDate(o.createdAt)}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge kind="order" value={o.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Organizations, subscriptions and alert activity across FireGuard AI." className="mb-0" />

      <StatGroup
        loading={data.loading}
        items={[
          {
            label: 'Organizations',
            value: data.orgs.length,
            hint: `${byStatus.ACTIVE || 0} active · ${byStatus.SUSPENDED || 0} suspended`,
            to: '/superadmin/organizations',
          },
          { label: 'Active alerts', value: stats?.active ?? 0, tone: 'critical', hint: 'Unacknowledged, all organizations', to: '/superadmin/alerts' },
          { label: 'Alerts (all time)', value: stats?.total ?? 0, hint: `False alarm rate ${((stats?.falseAlarmRate || 0) * 100).toFixed(1)}%`, to: '/superadmin/alerts' },
          { label: 'Orders this month', value: data.orderStats?.thisMonth ?? 0, hint: `${data.orderStats?.total ?? 0} orders in total`, to: '/superadmin/orders' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Subscriptions to watch" description={`Expired or ending within ${EXPIRY_WINDOW_DAYS} days.`} icon={CalendarClock} />
          <DataTable
            caption="Subscriptions expiring soon"
            columns={expiringColumns}
            rows={expiring}
            loading={data.loading}
            empty={<EmptyState icon={CalendarClock} title="Nothing expiring soon" description={`No subscriptions end in the next ${EXPIRY_WINDOW_DAYS} days.`} compact />}
          />
        </Card>
        <Card>
          <CardHeader title="Alert outcomes" description="All organizations, all time" />
          <CardBody>
            <AlertOutcomes stats={stats} loading={!stats} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent orders"
            actions={
              <Button as={Link} to="/superadmin/orders" variant="link" size="sm" iconRight={ArrowRight}>
                All orders
              </Button>
            }
          />
          <DataTable caption="Recent orders" columns={orderColumns} rows={data.orders} loading={data.loading} empty={<EmptyState title="No orders yet" compact />} />
        </Card>
        <Card>
          <CardHeader
            title="Organizations by status"
            actions={
              <Button as={Link} to="/superadmin/organizations" variant="link" size="sm" iconRight={ArrowRight}>
                Manage
              </Button>
            }
          />
          <ul className="divide-y divide-line">
            {['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'].map((status) => (
              <li key={status} className="flex items-center justify-between px-4 py-3 sm:px-5">
                <StatusBadge kind="org" value={status} />
                <span className="tabular text-sm font-semibold text-fg">{byStatus[status] || 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
