import { useState, useEffect } from 'react';
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  assignPlanToOrganization,
} from '../../services/apiEndpoints';
import { getOrganizations } from '../../services/apiEndpoints';
import { Package, Plus, Edit2, Pause, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SuperAdminSubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState({ open: false, plan: null, assignOrgId: null });

  const loadPlans = async () => {
    try {
      const params = includeInactive ? { includeInactive: 'true' } : {};
      const response = await getSubscriptionPlans(params);
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
  }, [includeInactive]);

  useEffect(() => {
    if (modal.plan) loadOrganizations();
  }, [modal.plan]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value,
      slug: form.slug.value || form.name.value.toLowerCase().replace(/\s+/g, '-'),
      maxCameras: parseInt(form.maxCameras.value, 10) || 5,
      maxOperators: parseInt(form.maxOperators.value, 10) || 10,
      alertRetentionDays: parseInt(form.alertRetentionDays.value, 10) || 30,
      storageLimit: parseInt(form.storageLimit.value, 10) || 10,
      supportPriority: form.supportPriority.value || 'standard',
    };
    try {
      await createSubscriptionPlan(data);
      toast.success('Plan created');
      setModal({ open: false, plan: null });
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create plan');
    }
  };

  const handleDeactivate = async (plan) => {
    if (!window.confirm(`Deactivate plan "${plan.name}"?`)) return;
    try {
      await deactivateSubscriptionPlan(plan._id);
      toast.success('Plan deactivated');
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate');
    }
  };

  const handleAssign = async () => {
    if (!modal.plan || !modal.assignOrgId) return;
    try {
      await assignPlanToOrganization(modal.plan._id, modal.assignOrgId);
      toast.success('Plan assigned to organization');
      setModal({ open: false, plan: null, assignOrgId: null });
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
          <p className="text-gray-600 dark:text-gray-400 mt-2">Create and manage plans; assign to organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded"
            />
            Include inactive
          </label>
          <button
            type="button"
            onClick={() => setModal({ open: true, plan: null })}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Create Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan._id} className={`card ${!plan.isActive ? 'opacity-75' : ''}`}>
              <div className="flex items-center space-x-4 mb-4">
                <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-lg">
                  <Package className="text-indigo-600 dark:text-indigo-400" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{plan.slug}</p>
                  {!plan.isActive && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700">Inactive</span>
                  )}
                </div>
              </div>
              <ul className="text-sm space-y-1 mb-4">
                <li>Max cameras: <strong>{plan.maxCameras}</strong></li>
                <li>Max operators: <strong>{plan.maxOperators}</strong></li>
                <li>Alert retention: <strong>{plan.alertRetentionDays} days</strong></li>
                <li>Storage: <strong>{plan.storageLimit} GB</strong></li>
                <li>Support: <strong>{plan.supportPriority}</strong></li>
              </ul>
              <div className="flex flex-wrap gap-2">
                {plan.isActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        loadOrganizations();
                        setModal({ open: true, plan, assignOrgId: null });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      <Link2 size={14} /> Assign to org
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(plan)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-500 text-amber-600 dark:text-amber-400 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      <Pause size={14} /> Deactivate
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && !modal.plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create subscription plan</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input name="name" required className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" placeholder="e.g. Pro" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (optional)</label>
                <input name="slug" className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" placeholder="pro" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Max cameras</label>
                  <input name="maxCameras" type="number" min={1} defaultValue={5} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max operators</label>
                  <input name="maxOperators" type="number" min={0} defaultValue={10} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Alert retention (days)</label>
                  <input name="alertRetentionDays" type="number" min={1} defaultValue={30} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Storage (GB)</label>
                  <input name="storageLimit" type="number" min={0} defaultValue={10} className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Support priority</label>
                <select name="supportPriority" className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2">
                  <option value="standard">Standard</option>
                  <option value="priority">Priority</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setModal({ open: false })} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal.open && modal.plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Assign plan to organization</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Plan: {modal.plan.name}</p>
            <label className="block text-sm font-medium mb-2">Organization</label>
            <select
              value={modal.assignOrgId || ''}
              onChange={(e) => setModal((m) => ({ ...m, assignOrgId: e.target.value }))}
              className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            >
              <option value="">Select...</option>
              {organizations.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setModal({ open: false, plan: null, assignOrgId: null })} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
              <button type="button" onClick={handleAssign} disabled={!modal.assignOrgId} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSubscriptionPlans;
