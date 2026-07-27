import { useState, useEffect } from 'react';
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  reactivateSubscriptionPlan,
  deleteSubscriptionPlan,
  assignPlanToOrganization,
} from '../../services/apiEndpoints';
import { getOrganizations } from '../../services/apiEndpoints';
import { Plus, Edit2, Pause, Play, Trash2, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

const formatPrice = (price, currency = 'USD') => {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
};

const billingLabel = (cycle) => {
  const labels = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', custom: 'Custom' };
  return labels[cycle] || cycle;
};

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  currency: 'USD',
  durationMonths: '1',
  billingCycle: 'monthly',
  maxCameras: '5',
  maxOperators: '10',
  alertRetentionDays: '30',
  storageLimit: '10',
  supportPriority: 'standard',
  displayOrder: '0',
  isPopular: false,
  isRecommended: false,
};

const planToForm = (plan) => ({
  name: plan.name || '',
  slug: plan.slug || '',
  description: plan.description || '',
  price: String(plan.price ?? ''),
  currency: plan.currency || 'USD',
  durationMonths: String(plan.durationMonths ?? 1),
  billingCycle: plan.billingCycle || 'monthly',
  maxCameras: String(plan.maxCameras ?? 5),
  maxOperators: String(plan.maxOperators ?? 10),
  alertRetentionDays: String(plan.alertRetentionDays ?? 30),
  storageLimit: String(plan.storageLimit ?? 10),
  supportPriority: plan.supportPriority || 'standard',
  displayOrder: String(plan.displayOrder ?? 0),
  isPopular: !!plan.isPopular,
  isRecommended: !!plan.isRecommended,
});

const parsePlanPayload = (form) => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  description: form.description.trim() || undefined,
  price: parseFloat(form.price) || 0,
  currency: form.currency.trim().toUpperCase(),
  durationMonths: parseInt(form.durationMonths, 10) || 1,
  billingCycle: form.billingCycle,
  maxCameras: parseInt(form.maxCameras, 10) || 1,
  maxOperators: parseInt(form.maxOperators, 10) || 0,
  alertRetentionDays: parseInt(form.alertRetentionDays, 10) || 1,
  storageLimit: parseInt(form.storageLimit, 10) || 0,
  supportPriority: form.supportPriority,
  displayOrder: parseInt(form.displayOrder, 10) || 0,
  isPopular: form.isPopular,
  isRecommended: form.isRecommended,
});

const PlanFormFields = ({ form, setForm }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className="block text-sm font-medium mb-1">Plan name</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Slug</label>
        <input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="auto-generated"
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Display order</label>
        <input
          type="number"
          min={0}
          value={form.displayOrder}
          onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Description</label>
      <textarea
        rows={2}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
      />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-sm font-medium mb-1">Price</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          required
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Currency</label>
        <input
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
          maxLength={3}
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Duration (months)</label>
        <input
          type="number"
          min={1}
          value={form.durationMonths}
          onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))}
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Billing type</label>
        <select
          value={form.billingCycle}
          onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
          className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-sm font-medium mb-1">Max cameras</label>
        <input type="number" min={1} value={form.maxCameras} onChange={(e) => setForm((f) => ({ ...f, maxCameras: e.target.value }))} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max operators</label>
        <input type="number" min={0} value={form.maxOperators} onChange={(e) => setForm((f) => ({ ...f, maxOperators: e.target.value }))} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Alert retention (days)</label>
        <input type="number" min={1} value={form.alertRetentionDays} onChange={(e) => setForm((f) => ({ ...f, alertRetentionDays: e.target.value }))} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Storage (GB)</label>
        <input type="number" min={0} value={form.storageLimit} onChange={(e) => setForm((f) => ({ ...f, storageLimit: e.target.value }))} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Support priority</label>
      <select value={form.supportPriority} onChange={(e) => setForm((f) => ({ ...f, supportPriority: e.target.value }))} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2">
        <option value="standard">Standard</option>
        <option value="priority">Priority</option>
        <option value="premium">Premium</option>
      </select>
    </div>
    <div className="flex gap-4 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm((f) => ({ ...f, isPopular: e.target.checked }))} className="rounded" />
        Popular badge
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isRecommended} onChange={(e) => setForm((f) => ({ ...f, isRecommended: e.target.checked }))} className="rounded" />
        Recommended badge
      </label>
    </div>
  </div>
);

const SuperAdminSubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [assignOrgId, setAssignOrgId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await getSubscriptionPlans({ includeInactive: 'true' });
      setPlans(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = () => {
    getOrganizations()
      .then((res) => setOrganizations(res.data.data.filter((o) => o.status === 'ACTIVE')))
      .catch(() => {});
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (plan) => {
    setForm(planToForm(plan));
    setModal({ type: 'edit', plan });
  };

  const openAssign = (plan) => {
    loadOrganizations();
    setAssignOrgId('');
    setModal({ type: 'assign', plan });
  };

  const closeModal = () => {
    setModal(null);
    setForm(emptyForm);
    setAssignOrgId('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = parsePlanPayload(form);
    try {
      if (modal === 'create') {
        await createSubscriptionPlan(payload);
        toast.success('Subscription plan created');
      } else if (modal?.type === 'edit') {
        await updateSubscriptionPlan(modal.plan._id, payload);
        toast.success('Subscription plan updated');
      }
      closeModal();
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (plan) => {
    if (!window.confirm(`Deactivate "${plan.name}"? Existing subscribers keep access until expiry.`)) return;
    try {
      await deactivateSubscriptionPlan(plan._id);
      toast.success('Plan deactivated');
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate');
    }
  };

  const handleReactivate = async (plan) => {
    try {
      await reactivateSubscriptionPlan(plan._id);
      toast.success('Plan reactivated');
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reactivate');
    }
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Permanently delete "${plan.name}"? This cannot be undone.`)) return;
    try {
      await deleteSubscriptionPlan(plan._id);
      toast.success('Plan permanently deleted');
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Cannot delete this plan');
    }
  };

  const handleAssign = async () => {
    if (!modal?.plan || !assignOrgId) return;
    try {
      await assignPlanToOrganization(modal.plan._id, assignOrgId);
      toast.success('Plan assigned to organization');
      closeModal();
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage pricing, limits, and plan lifecycle</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Create Plan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Plan Name</th>
                <th className="px-4 py-3 text-left font-semibold">Price</th>
                <th className="px-4 py-3 text-left font-semibold">Duration</th>
                <th className="px-4 py-3 text-left font-semibold">Cameras</th>
                <th className="px-4 py-3 text-left font-semibold">Operators</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Orgs Using</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {plans.map((plan) => (
                <tr key={plan._id} className={!plan.isActive ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}>
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3">{formatPrice(plan.price, plan.currency)}</td>
                  <td className="px-4 py-3">
                    {plan.durationMonths} mo · {billingLabel(plan.billingCycle)}
                  </td>
                  <td className="px-4 py-3">{plan.maxCameras}</td>
                  <td className="px-4 py-3">{plan.maxOperators}</td>
                  <td className="px-4 py-3">
                    {plan.isActive ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Active</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Deactivated</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{plan.organizationsUsing ?? 0}</td>
                  <td className="px-4 py-3">{formatDate(plan.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => openEdit(plan)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      {plan.isActive ? (
                        <>
                          <button type="button" onClick={() => openAssign(plan)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Assign to org">
                            <Link2 size={16} />
                          </button>
                          <button type="button" onClick={() => handleDeactivate(plan)} className="p-1.5 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" title="Deactivate">
                            <Pause size={16} />
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => handleReactivate(plan)} className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Reactivate">
                          <Play size={16} />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(plan)} className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete permanently">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No subscription plans yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'create' || modal?.type === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modal === 'create' ? 'Create subscription plan' : `Edit ${modal.plan.name}`}</h3>
            <form onSubmit={handleSave}>
              <PlanFormFields form={form} setForm={setForm} />
              <div className="flex justify-end gap-2 pt-4 mt-4 border-t dark:border-gray-700">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : modal === 'create' ? 'Create' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'assign' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Assign plan to organization</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Plan: {modal.plan.name}</p>
            <select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2">
              <option value="">Select organization...</option>
              {organizations.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
              <button type="button" onClick={handleAssign} disabled={!assignOrgId} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSubscriptionPlans;
