import { useState, useEffect } from 'react';
import {
  getUsers,
  verifyUser,
  suspendUser,
  reactivateUser,
  resetUserPassword,
  updateUser,
  deleteUser,
} from '../../services/apiEndpoints';
import { Check, Pause, Play, Key, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SuperAdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, user: null, newPassword: '' });

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleVerify = async (user) => {
    try {
      await verifyUser(user._id);
      toast.success('User verified');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to verify');
    }
  };

  const handleSuspend = async (user) => {
    try {
      await suspendUser(user._id);
      toast.success('User suspended');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to suspend');
    }
  };

  const handleReactivate = async (user) => {
    try {
      await reactivateUser(user._id);
      toast.success('User reactivated');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reactivate');
    }
  };

  const handleResetPassword = () => {
    if (!modal.user || !modal.newPassword || modal.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    resetUserPassword(modal.user._id, modal.newPassword)
      .then(() => {
        toast.success('Password reset');
        setModal({ open: false, user: null, newPassword: '' });
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to reset password'));
  };

  const handleRoleChange = async (user, newRole) => {
    if (user.role === 'super_admin') {
      toast.error('Cannot change Super Admin role');
      return;
    }
    try {
      await updateUser(user._id, { role: newRole });
      toast.success('Role updated');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDelete = async (user) => {
    const confirmMessage = `Permanently delete user "${user.name}" (${user.email})? They will be removed from the database, login will be blocked immediately, and their email will be available for new signup. This cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      const res = await deleteUser(user._id);
      const message = res?.data?.message || 'User deleted.';
      toast.success(message);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const roleLabel = (r) => {
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'org_admin') return 'Org Admin';
    if (r === 'customer') return 'Customer';
    return 'Operator';
  };

  const renderRoleControl = (u) => (
    <>
      <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700">{roleLabel(u.role)}</span>
      {u.role !== 'super_admin' && (
        <select
          value={u.role}
          onChange={(e) => handleRoleChange(u, e.target.value)}
          aria-label={`Change role for ${u.name}`}
          className="text-xs rounded border dark:border-gray-600 bg-white dark:bg-gray-800 py-1"
        >
          <option value="org_admin">Org Admin</option>
          <option value="operator">Operator</option>
        </select>
      )}
    </>
  );

  const renderActions = (u) => (
    <div className="flex flex-wrap gap-1">
      {u.role !== 'super_admin' && !u.isVerified && (
        <button type="button" onClick={() => handleVerify(u)} className="p-1.5 rounded bg-green-600 text-white hover:bg-green-700" title="Verify">
          <Check size={14} />
        </button>
      )}
      {u.role !== 'super_admin' && u.isActive && (
        <button type="button" onClick={() => handleSuspend(u)} className="p-1.5 rounded bg-amber-600 text-white hover:bg-amber-700" title="Suspend">
          <Pause size={14} />
        </button>
      )}
      {u.role !== 'super_admin' && !u.isActive && (
        <button type="button" onClick={() => handleReactivate(u)} className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" title="Reactivate">
          <Play size={14} />
        </button>
      )}
      {u.role !== 'super_admin' && (
        <button type="button" onClick={() => setModal({ open: true, user: u, newPassword: '' })} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700" title="Reset password">
          <Key size={14} />
        </button>
      )}
      {u.role !== 'super_admin' && (
        <button type="button" onClick={() => handleDelete(u)} className="p-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:bg-red-900/20" title="Delete">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Full user governance across all organizations</p>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <>
          <div className="md:hidden space-y-4">
            {users.map((u) => (
              <article key={u._id} className="card space-y-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white break-words">{u.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{u.email}</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-600 dark:text-gray-400 shrink-0">Role</dt>
                    <dd className="flex flex-wrap items-center justify-end gap-2">{renderRoleControl(u)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-600 dark:text-gray-400 shrink-0">Organization</dt>
                    <dd className="font-medium text-right break-words">{u.organizationId?.name || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-600 dark:text-gray-400 shrink-0">Verified</dt>
                    <dd>
                      {u.role === 'super_admin' ? (
                        '—'
                      ) : u.isVerified ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Pending</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-600 dark:text-gray-400 shrink-0">Status</dt>
                    <dd>
                      {u.isActive ? (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Suspended</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {renderActions(u)}
              </article>
            ))}
          </div>

          <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Organization</th>
                  <th className="pb-3 font-medium">Verified</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3">{u.name}</td>
                    <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">{renderRoleControl(u)}</div>
                    </td>
                    <td className="py-3 text-sm">{u.organizationId?.name || '—'}</td>
                    <td className="py-3">
                      {u.role === 'super_admin' ? (
                        '—'
                      ) : u.isVerified ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Pending</span>
                      )}
                    </td>
                    <td className="py-3">
                      {u.isActive ? (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Suspended</span>
                      )}
                    </td>
                    <td className="py-3">{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Reset password</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{modal.user?.email}</p>
            <input
              type="password"
              value={modal.newPassword}
              onChange={(e) => setModal((m) => ({ ...m, newPassword: e.target.value }))}
              placeholder="New password (min 6 chars)"
              className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 mb-4"
              minLength={6}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal({ open: false, user: null, newPassword: '' })} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
              <button type="button" onClick={handleResetPassword} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsers;
