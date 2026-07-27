import { useState, useEffect } from 'react';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  reactivateUser,
  getOperatorAssignments,
  assignCamerasToOperator,
} from '../../services/apiEndpoints';
import api from '../../services/api';
import { Plus, Trash2, Camera, Pencil, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyModal = { open: false, type: 'add', operator: null, name: '', email: '', password: '' };

const OrgAdminOperators = () => {
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(emptyModal);
  const [assignModal, setAssignModal] = useState({ open: false, operator: null, selectedCameraIds: [], allCameras: [] });

  const loadOperators = async () => {
    try {
      const response = await getUsers();
      setOperators(response.data.data.filter((u) => u.role === 'operator'));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load operators');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const response = await getOperatorAssignments({});
      setAssignments(response.data.data);
    } catch (error) {
      // ignore
    }
  };

  const loadCameras = async () => {
    try {
      const response = await api.get('/cameras');
      setCameras(response.data.data);
    } catch (error) {
      toast.error('Failed to load cameras');
    }
  };

  useEffect(() => {
    loadOperators();
    loadAssignments();
    loadCameras();
  }, []);

  const handleAddOperator = (e) => {
    e.preventDefault();
    const { name, email, password } = modal;
    if (!name || !email || !password || password.length < 6) {
      toast.error('Name, email and password (min 6 chars) required');
      return;
    }
    createUser({ name, email, password, role: 'operator' })
      .then(() => {
        toast.success('Operator added');
        setModal(emptyModal);
        loadOperators();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to add operator'));
  };

  const handleEditOperator = (e) => {
    e.preventDefault();
    const { operator, name, password } = modal;
    if (!operator || !name) {
      toast.error('Name is required');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const payload = { name };
    if (password) payload.password = password;

    updateUser(operator._id, payload)
      .then(() => {
        toast.success('Operator updated');
        setModal(emptyModal);
        loadOperators();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to update operator'));
  };

  const handleSuspend = async (operator) => {
    try {
      await suspendUser(operator._id);
      toast.success('Operator deactivated');
      loadOperators();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate');
    }
  };

  const handleReactivate = async (operator) => {
    try {
      await reactivateUser(operator._id);
      toast.success('Operator activated');
      loadOperators();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to activate');
    }
  };

  const handleDelete = async (operator) => {
    const confirmMessage = `Permanently delete operator "${operator.name}" (${operator.email})? They will be removed from the database, login will be blocked immediately, and their email will be available for new signup. This cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      const res = await deleteUser(operator._id);
      toast.success(res?.data?.message || 'Operator deleted');
      loadOperators();
      loadAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const openEditModal = (operator) => {
    setModal({
      open: true,
      type: 'edit',
      operator,
      name: operator.name,
      email: operator.email,
      password: '',
    });
  };

  const openAssignModal = (operator) => {
    const existing = assignments.filter((a) => a.operatorId?._id === operator._id).map((a) => a.cameraId?._id);
    setAssignModal({
      open: true,
      operator,
      selectedCameraIds: existing,
      allCameras: cameras,
    });
  };

  const handleAssignCameras = () => {
    if (!assignModal.operator) return;
    assignCamerasToOperator(assignModal.operator._id, assignModal.selectedCameraIds)
      .then(() => {
        toast.success('Cameras assigned');
        setAssignModal({ open: false, operator: null, selectedCameraIds: [], allCameras: [] });
        loadAssignments();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to assign'));
  };

  const toggleCamera = (cameraId) => {
    setAssignModal((m) => ({
      ...m,
      selectedCameraIds: m.selectedCameraIds.includes(cameraId)
        ? m.selectedCameraIds.filter((id) => id !== cameraId)
        : [...m.selectedCameraIds, cameraId],
    }));
  };

  const getAssignedCount = (operatorId) =>
    assignments.filter((a) => a.operatorId?._id === operatorId).length;

  const closeModal = () => setModal(emptyModal);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Operators</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Add operators and assign cameras</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, type: 'add', operator: null, name: '', email: '', password: '' })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Operator
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Assigned cameras</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op._id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3">{op.name}</td>
                  <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{op.email}</td>
                  <td className="py-3">
                    {op.isActive ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Inactive</span>
                    )}
                  </td>
                  <td className="py-3">{getAssignedCount(op._id)}</td>
                  <td className="py-3 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(op)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Edit credentials"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssignModal(op)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      <Camera size={14} /> Assign cameras
                    </button>
                    {op.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSuspend(op)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700"
                        title="Deactivate"
                      >
                        <Pause size={14} /> Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(op)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                        title="Activate"
                      >
                        <Play size={14} /> Activate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(op)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {operators.length === 0 && (
            <p className="py-8 text-center text-gray-500 dark:text-gray-400">No operators yet. Add one to get started.</p>
          )}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{modal.type === 'edit' ? 'Edit Operator' : 'Add Operator'}</h3>
            <form onSubmit={modal.type === 'edit' ? handleEditOperator : handleAddOperator} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                  className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  required
                />
              </div>
              {modal.type === 'add' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={modal.email}
                      onChange={(e) => setModal((m) => ({ ...m, email: e.target.value }))}
                      className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password (min 6) <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={modal.password}
                      onChange={(e) => setModal((m) => ({ ...m, password: e.target.value }))}
                      className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                      minLength={6}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={modal.email}
                      readOnly
                      className="w-full rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 px-3 py-2 text-gray-600 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">New password (optional, min 6)</label>
                    <input
                      type="password"
                      value={modal.password}
                      onChange={(e) => setModal((m) => ({ ...m, password: e.target.value }))}
                      placeholder="Leave blank to keep current password"
                      className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                      minLength={6}
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                  {modal.type === 'edit' ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModal.open && assignModal.operator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">Assign cameras to {assignModal.operator.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select cameras this operator can view.</p>
            <div className="space-y-2 mb-4">
              {assignModal.allCameras.map((cam) => (
                <label key={cam._id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignModal.selectedCameraIds.includes(cam._id)}
                    onChange={() => toggleCamera(cam._id)}
                    className="rounded"
                  />
                  <span>{cam.name || cam.label} — {cam.location}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAssignModal({ open: false, operator: null, selectedCameraIds: [], allCameras: [] })} className="px-4 py-2 rounded-lg border dark:border-gray-600">Cancel</button>
              <button type="button" onClick={handleAssignCameras} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgAdminOperators;
