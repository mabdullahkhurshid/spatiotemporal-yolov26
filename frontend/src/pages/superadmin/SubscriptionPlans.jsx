import { useEffect, useState } from 'react';
import { Layers, Link2, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  reactivateSubscriptionPlan,
  deleteSubscriptionPlan,
  assignPlanToOrganization,
  getOrganizations,
} from '../../services/apiEndpoints';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Card from '../../components/ui/Card';
import Menu from '../../components/ui/Menu';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import DataTable from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/Feedback';
import { Field, Input, Select, Switch, Textarea } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { formatCurrency } from '../../utils/format';

const CYCLE_LABEL = { monthly: 'month', quarterly: 'quarter', yearly: 'year', custom: 'term' };

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

const FormSection = ({ title, children }) => (
  <fieldset className="space-y-4">
    <legend className="eyebrow mb-3">{title}</legend>
    {children}
  </fieldset>
);

const PlanForm = ({ form, setForm, onSubmit }) => {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  return (
    <form id="plan-form" onSubmit={onSubmit} className="space-y-7">
      <FormSection title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Professional" data-autofocus />
          </Field>
          <Field label="Slug" optional hint="Generated from the name if empty.">
            <Input value={form.slug} onChange={set('slug')} placeholder="professional" />
          </Field>
        </div>
        <Field label="Description" optional hint="Shown on pricing cards.">
          <Textarea rows={2} value={form.description} onChange={set('description')} placeholder="Warehouses, campuses and multi-floor facilities" />
        </Field>
      </FormSection>

      <FormSection title="Pricing">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price" required className="sm:col-span-2">
            <Input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} />
          </Field>
          <Field label="Currency">
            <Input value={form.currency} onChange={set('currency')} maxLength={3} className="uppercase" />
          </Field>
          <Field label="Months">
            <Input type="number" min={1} value={form.durationMonths} onChange={set('durationMonths')} />
          </Field>
        </div>
        <Field label="Billing cycle">
          <Select value={form.billingCycle} onChange={set('billingCycle')}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Limits">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Cameras">
            <Input type="number" min={1} value={form.maxCameras} onChange={set('maxCameras')} />
          </Field>
          <Field label="Operators">
            <Input type="number" min={0} value={form.maxOperators} onChange={set('maxOperators')} />
          </Field>
          <Field label="Alert history (days)">
            <Input type="number" min={1} value={form.alertRetentionDays} onChange={set('alertRetentionDays')} />
          </Field>
          <Field label="Storage (GB)">
            <Input type="number" min={0} value={form.storageLimit} onChange={set('storageLimit')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Presentation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support level">
            <Select value={form.supportPriority} onChange={set('supportPriority')}>
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
              <option value="premium">Premium</option>
            </Select>
          </Field>
          <Field label="Display order" hint="Lower numbers appear first.">
            <Input type="number" min={0} value={form.displayOrder} onChange={set('displayOrder')} />
          </Field>
        </div>
        <div className="space-y-4 rounded-md border border-line p-4">
          <Switch label="Most popular" description="Adds a “Most popular” label on pricing pages." checked={form.isPopular} onChange={(v) => setForm((f) => ({ ...f, isPopular: v }))} />
          <Switch label="Recommended" description="Highlights this plan on pricing pages." checked={form.isRecommended} onChange={(v) => setForm((f) => ({ ...f, isRecommended: v }))} />
        </div>
      </FormSection>
    </form>
  );
};

const SuperAdminSubscriptionPlans = () => {
  const confirm = useConfirm();
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
    getOrganizations()
      .then((res) => setOrganizations(res.data.data.filter((o) => o.status === 'ACTIVE')))
      .catch(() => toast.error('Failed to load organizations'));
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
    try {
      if (modal === 'create') {
        await createSubscriptionPlan(parsePlanPayload(form));
        toast.success('Plan created');
      } else if (modal?.type === 'edit') {
        await updateSubscriptionPlan(modal.plan._id, parsePlanPayload(form));
        toast.success('Plan updated');
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
    const ok = await confirm({
      title: `Deactivate ${plan.name}?`,
      description: 'It disappears from pricing pages. Organizations already on this plan keep access until their term ends.',
      confirmLabel: 'Deactivate plan',
      tone: 'danger',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: `Delete ${plan.name} permanently?`,
      description: 'Plans that any organization, subscription or order still references cannot be deleted. Deactivate them instead.',
      confirmLabel: 'Delete plan',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteSubscriptionPlan(plan._id);
      toast.success('Plan deleted');
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'This plan cannot be deleted');
    }
  };

  const handleAssign = async () => {
    if (!modal?.plan || !assignOrgId) return;
    setSaving(true);
    try {
      await assignPlanToOrganization(modal.plan._id, assignOrgId);
      toast.success('Plan assigned');
      closeModal();
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Plan',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-fg">
            {p.name}
            {p.isPopular && <Badge tone="warning" size="xs">Most popular</Badge>}
            {p.isRecommended && <Badge tone="brand" size="xs">Recommended</Badge>}
          </p>
          {p.description && <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-fg-muted">{p.description}</p>}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      cell: (p) => (
        <span className="tabular whitespace-nowrap text-sm">
          <span className="font-medium text-fg">{formatCurrency(p.price, p.currency)}</span>
          <span className="text-fg-muted"> / {CYCLE_LABEL[p.billingCycle] || 'term'}</span>
        </span>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      hideBelow: 'lg',
      cell: (p) => (
        <span className="tabular text-sm text-fg-muted">
          {p.maxCameras} cameras · {p.maxOperators} operators
        </span>
      ),
    },
    { key: 'orgs', header: 'Organizations', align: 'right', hideBelow: 'lg', cell: (p) => <span className="tabular text-sm">{p.organizationsUsing ?? 0}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge kind="plan" value={p.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(p)}>
            Edit
          </Button>
          <Menu
            width="w-56"
            items={[
              p.isActive && { label: 'Assign to organization', icon: Link2, onClick: () => openAssign(p) },
              p.isActive ? { label: 'Deactivate', icon: Pause, onClick: () => handleDeactivate(p) } : { label: 'Reactivate', icon: Play, onClick: () => handleReactivate(p) },
              { divider: true },
              { label: 'Delete permanently', icon: Trash2, tone: 'danger', onClick: () => handleDelete(p) },
            ]}
            trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={`More actions for ${p.name}`} size="sm" />}
          />
        </div>
      ),
    },
  ];

  const editing = modal === 'create' || modal?.type === 'edit';

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Plans shown on the pricing page and available at checkout."
        actions={
          <Button icon={Plus} onClick={openCreate}>
            New plan
          </Button>
        }
      />

      <Card>
        <DataTable
          caption="Subscription plans"
          columns={columns}
          rows={plans}
          loading={loading}
          rowClassName={(p) => (p.isActive ? undefined : 'opacity-70')}
          empty={
            <EmptyState
              icon={Layers}
              title="No plans yet"
              description="Create a plan so customers can subscribe."
              action={
                <Button icon={Plus} onClick={openCreate}>
                  New plan
                </Button>
              }
            />
          }
        />
      </Card>

      <Dialog
        open={editing}
        onClose={closeModal}
        title={modal === 'create' ? 'New plan' : `Edit ${modal?.plan?.name || 'plan'}`}
        description={modal?.type === 'edit' ? 'Limit changes are checked against organizations already on this plan.' : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="plan-form" loading={saving}>
              {modal === 'create' ? 'Create plan' : 'Save changes'}
            </Button>
          </>
        }
      >
        <PlanForm form={form} setForm={setForm} onSubmit={handleSave} />
      </Dialog>

      <Dialog
        open={modal?.type === 'assign'}
        onClose={closeModal}
        title={`Assign ${modal?.plan?.name || 'plan'}`}
        description="Moves an active organization onto this plan and updates its limits."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!assignOrgId} loading={saving}>
              Assign plan
            </Button>
          </>
        }
      >
        <Field label="Organization">
          <Select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)} data-autofocus>
            <option value="">Select an organization…</option>
            {organizations.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>
    </div>
  );
};

export default SuperAdminSubscriptionPlans;
