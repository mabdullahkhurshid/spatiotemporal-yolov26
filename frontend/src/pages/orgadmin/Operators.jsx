import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, Users, Video } from 'lucide-react';
import toast from 'react-hot-toast';
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
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Card from '../../components/ui/Card';
import Menu from '../../components/ui/Menu';
import Avatar from '../../components/ui/Avatar';
import Dialog from '../../components/ui/Dialog';
import DataTable from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, Notice } from '../../components/ui/Feedback';
import { Field, Input, SearchInput } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { cameraTitle } from '../../utils/camera';
import { cn } from '../../utils/cn';

const emptyModal = { open: false, type: 'add', operator: null, name: '', email: '', password: '' };

const OrgAdminOperators = () => {
  const confirm = useConfirm();
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(emptyModal);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, operator: null, selectedCameraIds: [] });

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
    } catch {
      toast.error('Failed to load camera assignments');
    }
  };

  const loadCameras = async () => {
    try {
      const response = await api.get('/cameras');
      setCameras(response.data.data);
    } catch {
      toast.error('Failed to load cameras');
    }
  };

  useEffect(() => {
    loadOperators();
    loadAssignments();
    loadCameras();
  }, []);

  const camerasFor = (operatorId) => assignments.filter((a) => a.operatorId?._id === operatorId).map((a) => a.cameraId).filter(Boolean);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? operators.filter((o) => `${o.name} ${o.email}`.toLowerCase().includes(q)) : operators;
  }, [operators, query]);

  const openAdd = () => {
    setModalError('');
    setModal({ ...emptyModal, open: true });
  };

  const openEdit = (operator) => {
    setModalError('');
    setModal({ open: true, type: 'edit', operator, name: operator.name, email: operator.email, password: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { type, operator, name, email, password } = modal;
    if (!name.trim()) return setModalError('Name is required.');
    if (type === 'add' && (!email || !password)) return setModalError('Email and a temporary password are required.');
    if (password && password.length < 6) return setModalError('Password must be at least 6 characters.');
    setSaving(true);
    setModalError('');
    try {
      if (type === 'add') {
        await createUser({ name: name.trim(), email: email.trim(), password, role: 'operator' });
        toast.success('Operator added — sign-in details were emailed to them');
      } else {
        const payload = { name: name.trim() };
        if (password) payload.password = password;
        await updateUser(operator._id, payload);
        toast.success('Operator updated');
      }
      setModal(emptyModal);
      loadOperators();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Could not save the operator.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (operator) => {
    const ok = await confirm({
      title: `Deactivate ${operator.name}?`,
      description: 'They are signed out everywhere and cannot sign in until you activate them again. Camera assignments are kept.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: `Delete ${operator.name}?`,
      description: `${operator.email} is removed permanently and signed out immediately. Their email can be used for a new account. This cannot be undone.`,
      confirmLabel: 'Delete operator',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await deleteUser(operator._id);
      toast.success(res?.data?.message || 'Operator deleted');
      loadOperators();
      loadAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const openAssign = (operator) => {
    setAssignModal({ open: true, operator, selectedCameraIds: camerasFor(operator._id).map((c) => c._id) });
  };

  const handleAssignCameras = async () => {
    if (!assignModal.operator) return;
    setSaving(true);
    try {
      await assignCamerasToOperator(assignModal.operator._id, assignModal.selectedCameraIds);
      toast.success('Camera access updated');
      setAssignModal({ open: false, operator: null, selectedCameraIds: [] });
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const toggleCamera = (cameraId) =>
    setAssignModal((m) => ({
      ...m,
      selectedCameraIds: m.selectedCameraIds.includes(cameraId) ? m.selectedCameraIds.filter((id) => id !== cameraId) : [...m.selectedCameraIds, cameraId],
    }));

  const columns = [
    {
      key: 'operator',
      header: 'Operator',
      primary: true,
      cell: (op) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={op.name} email={op.email} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{op.name}</p>
            <p className="truncate text-xs text-fg-muted">{op.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (op) => <StatusBadge kind="user" value={op.isActive ? 'active' : 'suspended'} /> },
    {
      key: 'cameras',
      header: 'Camera access',
      cell: (op) => {
        const list = camerasFor(op._id);
        if (!list.length) return <span className="text-sm text-fg-subtle">No cameras</span>;
        return (
          <span className="text-sm text-fg" title={list.map(cameraTitle).join(', ')}>
            {list.slice(0, 2).map(cameraTitle).join(', ')}
            {list.length > 2 && <span className="text-fg-muted"> +{list.length - 2} more</span>}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (op) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" icon={Video} onClick={() => openAssign(op)}>
            Cameras
          </Button>
          <Menu
            width="w-48"
            items={[
              { label: 'Edit details', icon: Pencil, onClick: () => openEdit(op) },
              op.isActive ? { label: 'Deactivate', icon: Pause, onClick: () => handleSuspend(op) } : { label: 'Activate', icon: Play, onClick: () => handleReactivate(op) },
              { divider: true },
              { label: 'Delete operator', icon: Trash2, tone: 'danger', onClick: () => handleDelete(op) },
            ]}
            trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={`More actions for ${op.name}`} size="sm" />}
          />
        </div>
      ),
    },
  ];

  const isAdd = modal.type === 'add';

  return (
    <div>
      <PageHeader
        title="Operators"
        description="People who watch cameras and respond to alerts. Each operator sees only the cameras you assign."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            Add operator
          </Button>
        }
      />

      <Card>
        {operators.length > 0 && (
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" label="Search operators" className="sm:max-w-xs" />
          </div>
        )}
        <DataTable
          caption="Operators"
          columns={columns}
          rows={filtered}
          loading={loading}
          empty={
            <EmptyState
              icon={Users}
              title={query ? 'No operators match your search' : 'No operators yet'}
              description={query ? undefined : 'Add operators so they can monitor cameras and respond to alerts.'}
              action={
                !query && (
                  <Button icon={Plus} onClick={openAdd}>
                    Add operator
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      <Dialog
        open={modal.open}
        onClose={() => setModal(emptyModal)}
        title={isAdd ? 'Add operator' : `Edit ${modal.operator?.name || 'operator'}`}
        description={isAdd ? 'They receive an email with their sign-in details.' : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(emptyModal)}>
              Cancel
            </Button>
            <Button type="submit" form="operator-form" loading={saving}>
              {isAdd ? 'Add operator' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="operator-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" required>
            <Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} autoComplete="off" data-autofocus />
          </Field>
          <Field label="Email" required={isAdd} hint={isAdd ? undefined : 'Email cannot be changed.'}>
            <Input type="email" value={modal.email} disabled={!isAdd} onChange={(e) => setModal({ ...modal, email: e.target.value })} autoComplete="off" />
          </Field>
          <Field
            label={isAdd ? 'Temporary password' : 'New password'}
            required={isAdd}
            optional={!isAdd}
            hint={isAdd ? 'At least 6 characters. Ask them to change it after signing in.' : 'Leave blank to keep the current password.'}
          >
            <Input type="password" value={modal.password} onChange={(e) => setModal({ ...modal, password: e.target.value })} autoComplete="new-password" minLength={6} />
          </Field>
          {modalError && <Notice tone="critical">{modalError}</Notice>}
        </form>
      </Dialog>

      <Dialog
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, operator: null, selectedCameraIds: [] })}
        title="Camera access"
        description={assignModal.operator ? `Choose the cameras ${assignModal.operator.name} can see and respond to.` : undefined}
        footer={
          cameras.length > 0 && (
            <>
              <Button variant="secondary" onClick={() => setAssignModal({ open: false, operator: null, selectedCameraIds: [] })}>
                Cancel
              </Button>
              <Button onClick={handleAssignCameras} loading={saving}>
                Save access
              </Button>
            </>
          )
        }
      >
        {cameras.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No cameras yet"
            description="Add cameras first, then give operators access."
            action={
              <Button as={Link} to="/orgadmin/cameras" variant="secondary">
                Go to cameras
              </Button>
            }
            compact
          />
        ) : (
          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-sm text-fg-muted">
              <span>
                {assignModal.selectedCameraIds.length} of {cameras.length} selected
              </span>
              <button
                type="button"
                className="link text-sm"
                onClick={() =>
                  setAssignModal((m) => ({ ...m, selectedCameraIds: m.selectedCameraIds.length === cameras.length ? [] : cameras.map((c) => c._id) }))
                }
              >
                {assignModal.selectedCameraIds.length === cameras.length ? 'Clear all' : 'Select all'}
              </button>
            </legend>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-md border border-line scrollbar-thin">
              {cameras.map((cam) => {
                const checked = assignModal.selectedCameraIds.includes(cam._id);
                return (
                  <li key={cam._id}>
                    <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2', checked && 'bg-info-soft/60')}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCamera(cam._id)} className="h-4 w-4 rounded accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{cameraTitle(cam)}</span>
                        <span className="block truncate text-xs text-fg-muted">{cam.location}</span>
                      </span>
                      {cam.displayNumber && <span className="font-mono text-2xs text-fg-subtle">{cam.displayNumber}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
      </Dialog>
    </div>
  );
};

export default OrgAdminOperators;
