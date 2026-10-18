import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MoreHorizontal, Pencil, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrders, getOrder, getOrderStats, updateOrder, deleteOrder } from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Card from '../../components/ui/Card';
import Menu from '../../components/ui/Menu';
import Dialog, { Drawer } from '../../components/ui/Dialog';
import DataTable from '../../components/ui/DataTable';
import { StatGroup } from '../../components/ui/Stat';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Field, Input, SearchInput, Select, Textarea } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PLAN_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const DATE_PRESETS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function formatOrderId(id) {
  if (!id) return '—';
  const str = String(id);
  return `#${str.slice(-6).toUpperCase()}`;
}

function resolvePlanLabel(order) {
  return order.planDisplayName || order.subscriptionPlan || '—';
}

function resolveOrgName(order) {
  const org = order.organizationId;
  if (!org) return '—';
  if (typeof org === 'object') return org.name || '—';
  return '—';
}

const EDIT_STATUS_OPTIONS = STATUS_OPTIONS.filter((opt) => opt.value);
const EDIT_PLAN_OPTIONS = PLAN_OPTIONS.filter((opt) => opt.value);

function buildEditForm(order) {
  return {
    status: order?.status || 'approved',
    subscriptionPlan: order?.subscriptionPlan || 'basic',
    amount: order?.amount ?? 0,
    notes: order?.notes || '',
    paymentIntentId: order?.paymentIntentId || '',
  };
}

function getDateRangeFromPreset(preset) {
  if (!preset) return { from: '', to: '' };
  const days = parseInt(preset, 10);
  if (!Number.isFinite(days) || days <= 0) return { from: '', to: '' };
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: '' };
}

function buildOrdersCacheKey(statusFilter, planFilter, datePreset, page) {
  return `${statusFilter}|${planFilter}|${datePreset}|${page}`;
}

const ordersPageCache = {
  cacheKey: '',
  orders: [],
  orderStats: { total: 0, approved: 0, thisMonth: 0 },
  totalCount: 0,
  totalPages: 1,
};

function getCachedOrdersPage(statusFilter, planFilter, datePreset, page) {
  const cacheKey = buildOrdersCacheKey(statusFilter, planFilter, datePreset, page);
  if (ordersPageCache.cacheKey !== cacheKey) {
    return null;
  }
  return ordersPageCache;
}

const TABLE_SKELETON_ROWS = 5;

const DetailRow = ({ label, children }) => (
  <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
    <dt className="text-fg-muted">{label}</dt>
    <dd className="min-w-0 break-words text-fg">{children}</dd>
  </div>
);

const SuperAdminOrders = () => {
  const confirm = useConfirm();
  const initialCache = getCachedOrdersPage('', '', '', 1);
  const [orders, setOrders] = useState(() => initialCache?.orders ?? []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages ?? 1);
  const [totalCount, setTotalCount] = useState(() => initialCache?.totalCount ?? 0);
  const [orderStats, setOrderStats] = useState(
    () => initialCache?.orderStats ?? { total: 0, approved: 0, thisMonth: 0 }
  );
  const [detailDrawer, setDetailDrawer] = useState({ open: false, order: null, loading: false });
  const [editModal, setEditModal] = useState({ open: false, order: null, form: null, saving: false });

  const loadOrdersPage = useCallback(async ({ showLoading = false } = {}) => {
    const cacheKey = buildOrdersCacheKey(statusFilter, planFilter, datePreset, page);
    const hasCachedData = ordersPageCache.cacheKey === cacheKey;

    if (showLoading || !hasCachedData) {
      setLoading(true);
      if (!hasCachedData) {
        setOrders([]);
      }
    } else {
      setRefreshing(true);
    }

    try {
      const { from, to } = getDateRangeFromPreset(datePreset);
      const params = {
        page,
        limit: 25,
        sort: '-createdAt',
      };
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.subscriptionPlan = planFilter;
      if (from) params.from = from;
      if (to) params.to = to;

      const [ordersResponse, statsResponse] = await Promise.all([
        getOrders(params),
        getOrderStats(),
      ]);

      const nextOrders = ordersResponse.data.data || [];
      const nextStats = statsResponse.data.data || { total: 0, approved: 0, thisMonth: 0 };
      const nextTotalCount = ordersResponse.data.count || 0;
      const nextTotalPages = ordersResponse.data.totalPages || 1;

      ordersPageCache.cacheKey = cacheKey;
      ordersPageCache.orders = nextOrders;
      ordersPageCache.orderStats = nextStats;
      ordersPageCache.totalCount = nextTotalCount;
      ordersPageCache.totalPages = nextTotalPages;

      setOrders(nextOrders);
      setOrderStats(nextStats);
      setTotalCount(nextTotalCount);
      setTotalPages(nextTotalPages);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load orders');
      if (!hasCachedData) {
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, planFilter, datePreset, page]);

  useEffect(() => {
    const cacheKey = buildOrdersCacheKey(statusFilter, planFilter, datePreset, page);
    const hasCachedData = ordersPageCache.cacheKey === cacheKey;
    loadOrdersPage({ showLoading: !hasCachedData });
  }, [loadOrdersPage, statusFilter, planFilter, datePreset, page]);

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => resolveOrgName(order).toLowerCase().includes(q));
  }, [orders, searchQuery]);

  const openOrderDetail = async (order) => {
    setDetailDrawer({ open: true, order: null, loading: true });
    try {
      const response = await getOrder(order._id);
      setDetailDrawer({ open: true, order: response.data.data, loading: false });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load order details');
      setDetailDrawer({ open: false, order: null, loading: false });
    }
  };

  const closeDetailDrawer = () => {
    setDetailDrawer({ open: false, order: null, loading: false });
  };

  const openEditModal = async (order, event) => {
    event?.stopPropagation();
    setEditModal({ open: true, order: null, form: null, saving: false });
    try {
      const response = await getOrder(order._id);
      const fullOrder = response.data.data;
      setEditModal({
        open: true,
        order: fullOrder,
        form: buildEditForm(fullOrder),
        saving: false,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load order for editing');
      setEditModal({ open: false, order: null, form: null, saving: false });
    }
  };

  const closeEditModal = () => {
    setEditModal({ open: false, order: null, form: null, saving: false });
  };

  const handleEditFieldChange = (field) => (event) => {
    const value = field === 'amount' ? Number(event.target.value) : event.target.value;
    setEditModal((prev) => ({
      ...prev,
      form: { ...prev.form, [field]: value },
    }));
  };

  const handleDeleteOrder = async (order, event) => {
    event?.stopPropagation();
    const label = formatOrderId(order._id);
    const ok = await confirm({
      title: `Delete order ${label}?`,
      description: "The purchase record is removed permanently. The organization's subscription is not changed.",
      confirmLabel: 'Delete order',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await deleteOrder(order._id);
      toast.success(`Order ${label} deleted`);
      ordersPageCache.cacheKey = '';
      closeDetailDrawer();
      closeEditModal();
      loadOrdersPage({ showLoading: false });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleSaveOrder = async (event) => {
    event.preventDefault();
    if (!editModal.order || !editModal.form) return;

    setEditModal((prev) => ({ ...prev, saving: true }));
    try {
      const payload = {
        status: editModal.form.status,
        subscriptionPlan: editModal.form.subscriptionPlan,
        amount: editModal.form.amount,
        notes: editModal.form.notes,
        paymentIntentId: editModal.form.paymentIntentId,
      };

      const response = await updateOrder(editModal.order._id, payload);
      const updated = response.data.data;

      toast.success('Order updated');
      closeEditModal();
      loadOrdersPage({ showLoading: false });

      if (detailDrawer.open && detailDrawer.order?._id === updated._id) {
        setDetailDrawer({ open: true, order: updated, loading: false });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update order');
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const detailOrder = detailDrawer.order;
  const detailOrg = detailOrder?.organizationId;
  const busy = loading && orders.length === 0;

  const columns = [
    {
      key: 'order',
      header: 'Order',
      primary: true,
      cell: (order) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{resolveOrgName(order)}</p>
          <p className="font-mono text-2xs text-fg-subtle">{formatOrderId(order._id)}</p>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (order) => <span className="text-sm">{resolvePlanLabel(order)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (order) => <span className="tabular text-sm font-medium">{formatCurrency(order.amount)}</span> },
    { key: 'date', header: 'Date', hideBelow: 'lg', cell: (order) => <span className="whitespace-nowrap text-sm text-fg-muted">{formatDate(order.createdAt)}</span> },
    { key: 'status', header: 'Status', cell: (order) => <StatusBadge kind="order" value={order.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (order) => (
        <Menu
          width="w-44"
          items={[
            { label: 'View details', icon: Eye, onClick: () => openOrderDetail(order) },
            { label: 'Edit order', icon: Pencil, onClick: () => openEditModal(order) },
            { divider: true },
            { label: 'Delete order', icon: Trash2, tone: 'danger', onClick: () => handleDeleteOrder(order) },
          ]}
          trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={`Actions for order ${formatOrderId(order._id)}`} size="sm" />}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Subscription purchases and renewals across all organizations."
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => loadOrdersPage({ showLoading: false })}>
            Refresh
          </Button>
        }
        className="mb-0"
      />

      <StatGroup
        className="lg:grid-cols-3"
        loading={busy}
        items={[
          { label: 'Total orders', value: orderStats.total },
          { label: 'Approved', value: orderStats.approved },
          { label: 'This month', value: orderStats.thisMonth },
        ]}
      />

      <Card>
        <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem]">
          <SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by organization" label="Search orders" />
          <Select value={statusFilter} onChange={handleFilterChange(setStatusFilter)} aria-label="Status">
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select value={planFilter} onChange={handleFilterChange(setPlanFilter)} aria-label="Plan tier">
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value ? `Tier: ${opt.label}` : 'All tiers'}
              </option>
            ))}
          </Select>
          <Select value={datePreset} onChange={handleFilterChange(setDatePreset)} aria-label="Date range">
            {DATE_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <DataTable
          caption="Orders"
          columns={columns}
          rows={filteredOrders}
          loading={busy}
          skeletonRows={TABLE_SKELETON_ROWS}
          onRowClick={openOrderDetail}
          empty={<EmptyState icon={Receipt} title="No orders found" description={searchQuery || statusFilter || planFilter || datePreset ? 'Try different filters.' : 'Orders appear when customers purchase or renew a plan.'} />}
        />

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <p className="tabular text-sm text-fg-muted">
              Page <span className="font-medium text-fg">{page}</span> of <span className="font-medium text-fg">{totalPages}</span> · {totalCount} orders
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </nav>
        )}
      </Card>

      <Drawer
        open={detailDrawer.open}
        onClose={closeDetailDrawer}
        title={detailOrder ? `Order ${formatOrderId(detailOrder._id)}` : 'Order'}
        description={detailOrder && <StatusBadge kind="order" value={detailOrder.status} />}
        footer={
          detailOrder && (
            <>
              <Button variant="danger-ghost" icon={Trash2} onClick={() => handleDeleteOrder(detailOrder)}>
                Delete
              </Button>
              <Button variant="secondary" icon={Pencil} onClick={() => openEditModal(detailOrder)}>
                Edit order
              </Button>
            </>
          )
        }
      >
        {detailDrawer.loading || !detailOrder ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="eyebrow mb-1">Payment</h3>
              <dl className="divide-y divide-line">
                <DetailRow label="Plan">{resolvePlanLabel(detailOrder)}</DetailRow>
                <DetailRow label="Amount">
                  <span className="tabular font-medium">{formatCurrency(detailOrder.amount)}</span>
                </DetailRow>
                <DetailRow label="Created">{formatDateTime(detailOrder.createdAt)}</DetailRow>
                {detailOrder.approvedAt && <DetailRow label="Approved">{formatDateTime(detailOrder.approvedAt)}</DetailRow>}
                {detailOrder.approvedBy && <DetailRow label="Approved by">{detailOrder.approvedBy.name || detailOrder.approvedBy.email}</DetailRow>}
                {detailOrder.paymentIntentId && (
                  <DetailRow label="Payment ref.">
                    <span className="font-mono text-xs">{detailOrder.paymentIntentId}</span>
                  </DetailRow>
                )}
                {detailOrder.notes && <DetailRow label="Notes">{detailOrder.notes}</DetailRow>}
              </dl>
            </section>

            {detailOrg && typeof detailOrg === 'object' && (
              <section>
                <h3 className="eyebrow mb-1">Organization</h3>
                <dl className="divide-y divide-line">
                  <DetailRow label="Name">
                    <Link to="/superadmin/organizations" className="link">
                      {detailOrg.name || '—'}
                    </Link>
                  </DetailRow>
                  <DetailRow label="Email">{detailOrg.email || '—'}</DetailRow>
                  {detailOrg.status && (
                    <DetailRow label="Status">
                      <StatusBadge kind="org" value={detailOrg.status} />
                    </DetailRow>
                  )}
                  {detailOrder.organizationAdmin && (
                    <DetailRow label="Admin">
                      {detailOrder.organizationAdmin.name}
                      <span className="block text-xs text-fg-muted">{detailOrder.organizationAdmin.email}</span>
                    </DetailRow>
                  )}
                </dl>
              </section>
            )}
          </div>
        )}
      </Drawer>

      <Dialog
        open={editModal.open}
        onClose={closeEditModal}
        title={editModal.order ? `Edit order ${formatOrderId(editModal.order._id)}` : 'Edit order'}
        description="Manual corrections are recorded on the order."
        footer={
          <>
            <Button variant="secondary" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button type="submit" form="order-form" loading={editModal.saving} disabled={!editModal.form}>
              Save changes
            </Button>
          </>
        }
      >
        {!editModal.form ? (
          <div className="space-y-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <form id="order-form" onSubmit={handleSaveOrder} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={editModal.form.status} onChange={handleEditFieldChange('status')}>
                  {EDIT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plan tier">
                <Select value={editModal.form.subscriptionPlan} onChange={handleEditFieldChange('subscriptionPlan')}>
                  {EDIT_PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Amount">
              <Input type="number" min={0} step="0.01" value={editModal.form.amount} onChange={handleEditFieldChange('amount')} />
            </Field>
            <Field label="Payment reference" optional>
              <Input value={editModal.form.paymentIntentId} onChange={handleEditFieldChange('paymentIntentId')} placeholder="Optional payment reference" />
            </Field>
            <Field label="Notes" optional>
              <Textarea rows={3} value={editModal.form.notes} onChange={handleEditFieldChange('notes')} placeholder="Internal notes about this order" />
            </Field>
          </form>
        )}
      </Dialog>
    </div>
  );
};

export default SuperAdminOrders;
