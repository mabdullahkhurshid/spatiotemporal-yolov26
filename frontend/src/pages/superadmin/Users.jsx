import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, KeyRound, MoreHorizontal, Pause, Play, Shield, Trash2, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUsers, verifyUser, suspendUser, reactivateUser, resetUserPassword, updateUser, deleteUser } from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Card from '../../components/ui/Card';
import Menu from '../../components/ui/Menu';
import Avatar from '../../components/ui/Avatar';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import DataTable, { Pagination } from '../../components/ui/DataTable';
import { EmptyState, Notice } from '../../components/ui/Feedback';
import { Field, Input, SearchInput, Select } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { formatDate } from '../../utils/format';
import { roleLabel } from '../../utils/accountFormatting';

const PAGE_SIZE = 20;
const ROLE_TONE = { super_admin: 'brand', org_admin: 'info', operator: 'neutral', customer: 'neutral' };

const SuperAdminUsers = () => {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, value: '', error: '' });
  const [roleModal, setRoleModal] = useState({ open: false, user: null, value: '' });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => setPage(1), [query, role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (role === 'all' || u.role === role) &&
        (!q || [u.name, u.email, u.organizationId?.name].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    );
  }, [users, query, role]);

  const act = async (fn, user, success, failure) => {
    try {
      await fn(user._id);
      toast.success(success);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || failure);
    }
  };

  const handleSuspend = async (user) => {
    const ok = await confirm({
      title: `Suspend ${user.name}?`,
      description: 'They are signed out on every device and cannot sign in until reactivated.',
      confirmLabel: 'Suspend user',
      tone: 'danger',
    });
    if (ok) act(suspendUser, user, 'User suspended', 'Failed to suspend');
  };

  const handleDelete = async (user) => {
    const ok = await confirm({
      title: `Delete ${user.name}?`,
      description: `${user.email} is removed permanently and signed out immediately. The email becomes available for a new account. This cannot be undone.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await deleteUser(user._id);
      toast.success(res?.data?.message || 'User deleted');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (passwordModal.value.length < 6) {
      setPasswordModal((m) => ({ ...m, error: 'Use at least 6 characters.' }));
      return;
    }
    setSaving(true);
    try {
      await resetUserPassword(passwordModal.user._id, passwordModal.value);
      toast.success('Password reset — the user has been signed out everywhere');
      setPasswordModal({ open: false, user: null, value: '', error: '' });
    } catch (err) {
      setPasswordModal((m) => ({ ...m, error: err.response?.data?.message || 'Failed to reset password' }));
    } finally {
      setSaving(false);
    }
  };

  const submitRole = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUser(roleModal.user._id, { role: roleModal.value });
      toast.success('Role updated');
      setRoleModal({ open: false, user: null, value: '' });
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'user',
      header: 'User',
      primary: true,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} email={u.email} src={u.avatar} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-fg">
              {u.name}
              {u.role !== 'super_admin' && !u.isVerified && <Badge tone="warning" size="xs">Awaiting approval</Badge>}
            </p>
            <p className="truncate text-xs text-fg-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{roleLabel(u.role)}</Badge> },
    { key: 'org', header: 'Organization', hideBelow: 'lg', cell: (u) => <span className="text-sm text-fg-muted">{u.organizationId?.name || '—'}</span> },
    { key: 'joined', header: 'Joined', hideBelow: 'xl', cell: (u) => <span className="text-sm text-fg-muted">{formatDate(u.createdAt)}</span> },
    { key: 'status', header: 'Status', cell: (u) => <StatusBadge kind="user" value={u.isActive ? 'active' : 'suspended'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (u) =>
        u.role === 'super_admin' ? (
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
            <Shield size={14} aria-hidden="true" /> Protected
          </span>
        ) : (
          <Menu
            width="w-52"
            items={[
              !u.isVerified && { label: 'Approve account', icon: BadgeCheck, onClick: () => act(verifyUser, u, 'Account approved', 'Failed to approve') },
              { label: 'Change role', icon: UserCog, onClick: () => setRoleModal({ open: true, user: u, value: u.role === 'org_admin' ? 'org_admin' : 'operator' }) },
              { label: 'Reset password', icon: KeyRound, onClick: () => setPasswordModal({ open: true, user: u, value: '', error: '' }) },
              u.isActive
                ? { label: 'Suspend', icon: Pause, onClick: () => handleSuspend(u) }
                : { label: 'Reactivate', icon: Play, onClick: () => act(reactivateUser, u, 'User reactivated', 'Failed to reactivate') },
              { divider: true },
              { label: 'Delete user', icon: Trash2, tone: 'danger', onClick: () => handleDelete(u) },
            ]}
            trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={`Actions for ${u.name}`} size="sm" />}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Users" description="Every account on the platform: administrators, operators and customers." />

      <Card>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:px-5">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or organization" label="Search users" className="sm:max-w-sm" />
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="sm:w-48">
            <option value="all">All roles</option>
            <option value="org_admin">Organization admins</option>
            <option value="operator">Operators</option>
            <option value="customer">Customers</option>
            <option value="super_admin">Super admins</option>
          </Select>
        </div>
        <DataTable
          caption="Users"
          columns={columns}
          rows={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          loading={loading}
          empty={<EmptyState icon={UserCog} title="No users match" description="Try a different search or role." />}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      <Dialog
        open={passwordModal.open}
        onClose={() => setPasswordModal({ open: false, user: null, value: '', error: '' })}
        title="Reset password"
        description={passwordModal.user ? `Set a new password for ${passwordModal.user.name}. They will be signed out on every device.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordModal({ open: false, user: null, value: '', error: '' })}>
              Cancel
            </Button>
            <Button type="submit" form="reset-password-form" loading={saving}>
              Reset password
            </Button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={submitPassword}>
          <Field label="New password" required error={passwordModal.error} hint="At least 6 characters.">
            <Input type="password" autoComplete="new-password" value={passwordModal.value} onChange={(e) => setPasswordModal((m) => ({ ...m, value: e.target.value, error: '' }))} data-autofocus />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={roleModal.open}
        onClose={() => setRoleModal({ open: false, user: null, value: '' })}
        title="Change role"
        description={roleModal.user ? `${roleModal.user.name} · ${roleModal.user.email}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoleModal({ open: false, user: null, value: '' })}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" loading={saving} disabled={roleModal.value === roleModal.user?.role}>
              Save role
            </Button>
          </>
        }
      >
        <form id="role-form" onSubmit={submitRole} className="space-y-4">
          <Field label="Role">
            <Select value={roleModal.value} onChange={(e) => setRoleModal((m) => ({ ...m, value: e.target.value }))}>
              <option value="org_admin">Organization admin</option>
              <option value="operator">Operator</option>
            </Select>
          </Field>
          <Notice tone="warning">Role changes take effect immediately and change what this person can see and do.</Notice>
        </form>
      </Dialog>
    </div>
  );
};

export default SuperAdminUsers;
