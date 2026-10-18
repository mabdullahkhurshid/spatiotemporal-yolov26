import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Check, Eye, MoreHorizontal, Pause, Play, RefreshCw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getOrganizations,
  getOrganization,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  unsuspendOrganization,
  deleteOrganization,
} from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Card from '../../components/ui/Card';
import Menu from '../../components/ui/Menu';
import Avatar from '../../components/ui/Avatar';
import Dialog, { Drawer } from '../../components/ui/Dialog';
import DataTable from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Field, SearchInput, Select, Textarea } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import UsageBar from '../../components/account/UsageBar';
import { formatDate, formatRelative } from '../../utils/format';

const SuperAdminOrganizations = () => {
  const confirm = useConfirm();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, org: null, reason: '' });
  const [detail, setDetail] = useState({ open: false, org: null, loading: false });

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getOrganizations(statusFilter ? { status: statusFilter } : {});
      setOrganizations(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? organizations.filter((o) => [o.name, o.email, o.admin?.name, o.admin?.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      : organizations;
  }, [organizations, query]);

  const openDetail = async (org) => {
    setDetail({ open: true, org: null, loading: true });
    try {
      const response = await getOrganization(org._id);
      setDetail({ open: true, org: response.data.data, loading: false });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load organization details');
      setDetail({ open: false, org: null, loading: false });
    }
  };

  const afterChange = (org) => {
    loadOrganizations();
    if (detail.org?._id === org._id) openDetail(org);
  };

  const run = async (fn, org, success, failure) => {
    try {
      await fn(org._id);
      toast.success(success);
      afterChange(org);
    } catch (error) {
      toast.error(error.response?.data?.message || failure);
    }
  };

  const handleApprove = (org) => run(approveOrganization, org, 'Organization approved', 'Failed to approve');

  const handleSuspend = async (org) => {
    const ok = await confirm({
      title: `Suspend ${org.name}?`,
      description: 'Its users lose access and cameras stop being monitored until you lift the suspension.',
      confirmLabel: 'Suspend organization',
      tone: 'danger',
    });
    if (ok) run(suspendOrganization, org, 'Organization suspended', 'Failed to suspend');
  };

  const handleUnsuspend = (org) => run(unsuspendOrganization, org, 'Suspension lifted', 'Failed to lift suspension');

  const handleDelete = async (org) => {
    const ok = await confirm({
      title: `Delete ${org.name}?`,
      description: 'The organization is removed from the platform and its users can no longer sign in to it.',
      confirmLabel: 'Delete organization',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteOrganization(org._id);
      toast.success('Organization deleted');
      if (detail.org?._id === org._id) setDetail({ open: false, org: null, loading: false });
      loadOrganizations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const handleReject = async (e) => {
    e?.preventDefault();
    const { org, reason } = rejectModal;
    if (!org) return;
    try {
      await rejectOrganization(org._id, reason || 'Rejected by Super Admin');
      toast.success('Organization rejected');
      setRejectModal({ open: false, org: null, reason: '' });
      loadOrganizations();
      if (detail.org?._id === org._id) setDetail({ open: false, org: null, loading: false });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  const actionsFor = (org) => [
    { label: 'View details', icon: Eye, onClick: () => openDetail(org) },
    org.status === 'PENDING' && { label: 'Approve', icon: Check, onClick: () => handleApprove(org) },
    org.status === 'PENDING' && { label: 'Reject', icon: X, onClick: () => setRejectModal({ open: true, org, reason: '' }) },
    org.status === 'ACTIVE' && { label: 'Suspend', icon: Pause, onClick: () => handleSuspend(org) },
    org.status === 'SUSPENDED' && { label: 'Lift suspension', icon: Play, onClick: () => handleUnsuspend(org) },
    { divider: true },
    { label: 'Delete organization', icon: Trash2, tone: 'danger', onClick: () => handleDelete(org) },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Organization',
      primary: true,
      cell: (o) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-subtle">
            <Building2 size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{o.name}</p>
            <p className="truncate text-xs text-fg-muted">{o.admin?.name ? `${o.admin.name} · ${o.admin.email}` : o.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (o) => <span className="text-sm">{o.subscriptionPlanId?.name || '—'}</span> },
    {
      key: 'term',
      header: 'Subscription',
      hideBelow: 'lg',
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="subscription" value={o.subscriptionStatus} />
          {o.subscriptionEndDate && <span className="text-xs text-fg-subtle">Ends {formatDate(o.subscriptionEndDate)}</span>}
        </div>
      ),
    },
    { key: 'operators', header: 'Operators', align: 'right', hideBelow: 'xl', cell: (o) => <span className="tabular text-sm">{o.operatorCount ?? 0}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge kind="org" value={o.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (o) => (
        <div className="flex justify-end gap-1.5">
          {o.status === 'PENDING' && (
            <Button size="sm" icon={Check} onClick={() => handleApprove(o)}>
              Approve
            </Button>
          )}
          <Menu width="w-52" items={actionsFor(o)} trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={`Actions for ${o.name}`} size="sm" />} />
        </div>
      ),
    },
  ];

  const org = detail.org;
  const admin = org?.admin || org?.adminId;

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Every customer organization on the platform, with plan, subscription and account status."
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={loadOrganizations}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:px-5">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search organization or admin" label="Search organizations" className="sm:max-w-sm" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className="sm:w-48">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        <DataTable
          caption="Organizations"
          columns={columns}
          rows={filtered}
          loading={loading && organizations.length === 0}
          onRowClick={openDetail}
          empty={<EmptyState icon={Building2} title={query || statusFilter ? 'No organizations match' : 'No organizations yet'} description="Organizations appear here once a customer purchases a plan." />}
        />
      </Card>

      <Drawer
        open={detail.open}
        onClose={() => setDetail({ open: false, org: null, loading: false })}
        title={org?.name || 'Organization'}
        description={org && <span className="flex flex-wrap items-center gap-2"><StatusBadge kind="org" value={org.status} /> <span className="text-fg-subtle">Created {formatRelative(org.createdAt)}</span></span>}
        footer={
          org && (
            <Menu
              align="right"
              width="w-52"
              items={actionsFor(org).filter((i) => i.label !== 'View details')}
              trigger={(props) => (
                <Button {...props} variant="secondary" icon={MoreHorizontal}>
                  Actions
                </Button>
              )}
            />
          )
        }
      >
        {detail.loading || !org ? (
          <div className="space-y-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="eyebrow mb-3">Administrator</h3>
              <div className="flex items-center gap-3">
                <Avatar name={admin?.name} email={admin?.email} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{admin?.name || 'No admin assigned'}</p>
                  <p className="truncate text-sm text-fg-muted">{admin?.email || org.email}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-3">Plan & usage</h3>
              <p className="mb-4 text-sm text-fg">
                <span className="font-medium">{org.subscriptionPlanId?.name || 'No plan'}</span>
                {org.subscriptionEndDate && <span className="text-fg-muted"> · term ends {formatDate(org.subscriptionEndDate)}</span>}
              </p>
              <div className="space-y-4">
                <UsageBar label="Cameras" used={org.stats?.cameras ?? 0} limit={org.stats?.maxCameras} />
                <UsageBar label="Operators" used={org.stats?.operators ?? 0} limit={org.stats?.maxOperators} />
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-3">Operators ({org.operators?.length || 0})</h3>
              {org.operators?.length ? (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {org.operators.map((op) => (
                    <li key={op._id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={op.name} email={op.email} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{op.name}</p>
                        <p className="truncate text-xs text-fg-muted">{op.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">No operators yet.</p>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <Dialog
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, org: null, reason: '' })}
        title={`Reject ${rejectModal.org?.name || 'organization'}?`}
        description="The applicant will see this reason."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal({ open: false, org: null, reason: '' })}>
              Cancel
            </Button>
            <Button type="submit" form="reject-form" variant="danger">
              Reject organization
            </Button>
          </>
        }
      >
        <form id="reject-form" onSubmit={handleReject}>
          <Field label="Reason" optional>
            <Textarea rows={3} value={rejectModal.reason} onChange={(e) => setRejectModal((m) => ({ ...m, reason: e.target.value }))} placeholder="e.g. Incomplete organization details" data-autofocus />
          </Field>
        </form>
      </Dialog>
    </div>
  );
};

export default SuperAdminOrganizations;
