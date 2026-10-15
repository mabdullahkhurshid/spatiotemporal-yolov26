import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, getOrder, getOrderStats, updateOrder, deleteOrder } from '../../services/apiEndpoints';
import {
  formatAccountDate,
  formatAccountCurrency,
  accountStatusBadgeClass,
} from '../../utils/accountFormatting';
import { Eye, RefreshCw, X, ShoppingCart, Building2, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

const ORG_STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

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

const SuperAdminOrders = () => {
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
  }, [loadOrdersPage]);

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
    if (!window.confirm(`Delete order ${label}? This cannot be undone.`)) return;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View and manage subscription purchase records across all organizations
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadOrdersPage({ showLoading: false })}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Refresh orders"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total orders', value: orderStats.total },
          { label: 'Approved', value: orderStats.approved },
          { label: 'This month', value: orderStats.thisMonth },
        ].map((item) => (
          <div key={item.label} className="card py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 min-h-[2rem]">
              {loading && orders.length === 0 ? (
                <span className="inline-block h-8 w-16 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ) : (
                item.value
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={handleFilterChange(setStatusFilter)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={planFilter}
            onChange={handleFilterChange(setPlanFilter)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={datePreset}
            onChange={handleFilterChange(setDatePreset)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {DATE_PRESETS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by organization..."
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          {refreshing && (
            <RefreshCw size={16} className="text-gray-400 animate-spin shrink-0" aria-hidden="true" />
          )}
        </div>

        <div className={`min-h-[320px] transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
          {!loading && filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto text-gray-400 mb-4" size={40} />
              <p className="text-gray-600 dark:text-gray-400">
                {orders.length === 0
                  ? 'No orders yet. Orders are created automatically when customers complete checkout.'
                  : 'No orders match your filters.'}
              </p>
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto ${refreshing ? 'pointer-events-none' : ''}`}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Order
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Organization
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
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: TABLE_SKELETON_ROWS }, (_, row) => (
                          <tr key={`skeleton-${row}`} className="border-b border-gray-100 dark:border-gray-800">
                            {Array.from({ length: 7 }, (_, col) => (
                              <td key={col} className="py-3 px-4">
                                <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : filteredOrders.map((order) => (
                          <tr
                            key={order._id}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                            onClick={() => openOrderDetail(order)}
                          >
                            <td className="py-3 px-4 text-sm font-mono text-gray-700 dark:text-gray-300">
                              {formatOrderId(order._id)}
                            </td>
                            <td className="py-3 px-4 text-sm">{formatAccountDate(order.createdAt)}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="font-medium">{resolveOrgName(order)}</span>
                              {order.organizationId?.isDeleted && (
                                <span className="ml-2 text-xs text-red-600 dark:text-red-400">(deleted)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">{resolvePlanLabel(order)}</td>
                            <td className="py-3 px-4 text-sm">{formatAccountCurrency(order.amount)}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs capitalize ${accountStatusBadgeClass(order.status)}`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openOrderDetail(order);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Eye size={16} /> View
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => openEditModal(order, e)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Pencil size={16} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteOrder(order, e)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 size={16} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {!loading && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {totalCount} order{totalCount !== 1 ? 's' : ''} total
                    {searchQuery.trim() && filteredOrders.length !== orders.length
                      ? ` · ${filteredOrders.length} shown after search`
                      : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {detailDrawer.open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={closeDetailDrawer}>
          <div
            className="w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order details</h3>
              <div className="flex items-center gap-2">
                {detailOrder && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(detailOrder)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(detailOrder)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeDetailDrawer}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {detailDrawer.loading ? (
                <div className="text-center py-8 text-gray-500">Loading details...</div>
              ) : detailOrder ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                      <ShoppingCart className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Order</p>
                      <p className="font-semibold text-lg font-mono">{formatOrderId(detailOrder._id)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 dark:text-gray-400">Status</span>
                      <span
                        className={`px-2 py-1 rounded text-xs capitalize ${accountStatusBadgeClass(detailOrder.status)}`}
                      >
                        {detailOrder.status}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 dark:text-gray-400">Plan</span>
                      <span className="font-medium text-right">{resolvePlanLabel(detailOrder)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 dark:text-gray-400">Amount</span>
                      <span className="font-medium">{formatAccountCurrency(detailOrder.amount)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 dark:text-gray-400">Created</span>
                      <span>{formatAccountDate(detailOrder.createdAt)}</span>
                    </div>
                    {detailOrder.updatedAt && detailOrder.updatedAt !== detailOrder.createdAt && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500 dark:text-gray-400">Updated</span>
                        <span>{formatAccountDate(detailOrder.updatedAt)}</span>
                      </div>
                    )}
                    {detailOrder.approvedAt && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500 dark:text-gray-400">Approved at</span>
                        <span>{formatAccountDate(detailOrder.approvedAt)}</span>
                      </div>
                    )}
                    {detailOrder.approvedBy && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500 dark:text-gray-400">Approved by</span>
                        <span className="text-right">
                          {detailOrder.approvedBy.name || detailOrder.approvedBy.email || '—'}
                        </span>
                      </div>
                    )}
                    {detailOrder.paymentIntentId && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500 dark:text-gray-400">Payment ID</span>
                        <span className="font-mono text-xs break-all text-right">{detailOrder.paymentIntentId}</span>
                      </div>
                    )}
                  </div>

                  {detailOrder.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40">
                        {detailOrder.notes}
                      </p>
                    </div>
                  )}

                  {detailOrg && typeof detailOrg === 'object' && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 size={18} className="text-gray-500" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Organization</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Name</p>
                          <p className="font-medium">{detailOrg.name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Email</p>
                          <p className="font-medium break-all">{detailOrg.email || '—'}</p>
                        </div>
                        {detailOrg.status && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Org status</p>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${ORG_STATUS_COLORS[detailOrg.status] || 'bg-gray-100 text-gray-800'}`}
                            >
                              {detailOrg.status}
                            </span>
                          </div>
                        )}
                        {detailOrder.organizationAdmin && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Org admin</p>
                            <p className="font-medium">{detailOrder.organizationAdmin.name || '—'}</p>
                            <p className="text-gray-600 dark:text-gray-400">{detailOrder.organizationAdmin.email}</p>
                          </div>
                        )}
                      </div>
                      {detailOrg._id && (
                        <Link
                          to="/organizations"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
                        >
                          View organizations
                        </Link>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit order</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                aria-label="Close edit modal"
              >
                <X size={20} />
              </button>
            </div>

            {!editModal.form ? (
              <div className="px-6 py-10 text-center text-gray-500">Loading order...</div>
            ) : (
              <form onSubmit={handleSaveOrder} className="px-6 py-5 space-y-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm">
                  <p className="text-gray-500 dark:text-gray-400">Order</p>
                  <p className="font-mono font-medium">{formatOrderId(editModal.order?._id)}</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {resolveOrgName(editModal.order)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editModal.form.status}
                    onChange={handleEditFieldChange('status')}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    {EDIT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan
                  </label>
                  <select
                    value={editModal.form.subscriptionPlan}
                    onChange={handleEditFieldChange('subscriptionPlan')}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    {EDIT_PLAN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editModal.form.amount}
                    onChange={handleEditFieldChange('amount')}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment ID
                  </label>
                  <input
                    type="text"
                    value={editModal.form.paymentIntentId}
                    onChange={handleEditFieldChange('paymentIntentId')}
                    placeholder="Optional payment reference"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editModal.form.notes}
                    onChange={handleEditFieldChange('notes')}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="Internal notes about this order"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
                    disabled={editModal.saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50"
                    disabled={editModal.saving}
                  >
                    {editModal.saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminOrders;
