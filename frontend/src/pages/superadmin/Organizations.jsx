import { useState, useEffect } from 'react';
import {
  getOrganizations,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  deleteOrganization,
} from '../../services/apiEndpoints';
import { Building2, Check, X, Pause, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  SUSPENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const SuperAdminOrganizations = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, org: null, reason: '' });

  const loadOrganizations = async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await getOrganizations(params);
      setOrganizations(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [statusFilter]);

  const handleApprove = async (org) => {
    try {
      await approveOrganization(org._id);
      toast.success('Organization approved');
      loadOrganizations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = () => {
    if (!rejectModal.org) return;
    const { org, reason } = rejectModal;
    rejectOrganization(org._id, reason || 'Rejected by Super Admin')
      .then(() => {
        toast.success('Organization rejected');
        setRejectModal({ open: false, org: null, reason: '' });
        loadOrganizations();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to reject'));
  };

  const handleSuspend = async (org) => {
    try {
      await suspendOrganization(org._id);
      toast.success('Organization suspended');
      loadOrganizations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to suspend');
    }
  };

  const handleDelete = async (org) => {
    if (!window.confirm(`Soft delete organization "${org.name}"?`)) return;
    try {
      await deleteOrganization(org._id);
      toast.success('Organization deleted');
      loadOrganizations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organizations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage all organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="REJECTED">REJECTED</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <button
            type="button"
            onClick={() => loadOrganizations()}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <div key={org._id} className="card">
              <div className="flex items-center space-x-4 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                  <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{org.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{org.email}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                  <span className="font-medium">{org.subscriptionPlanId?.name || org.subscriptionPlan}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[org.status] || 'bg-gray-100 text-gray-800'}`}>
                    {org.status || 'PENDING'}
                  </span>
                </div>
                {org.rejectionReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Reason: {org.rejectionReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {org.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(org)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectModal({ open: true, org, reason: '' })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
                {org.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => handleSuspend(org)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700"
                  >
                    <Pause size={14} /> Suspend
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(org)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Reject organization</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{rejectModal.org?.name}</p>
            <label className="block text-sm font-medium mb-2">Rejection reason (optional)</label>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((m) => ({ ...m, reason: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              rows={3}
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, org: null, reason: '' })}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminOrganizations;
