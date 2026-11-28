import { Check } from 'lucide-react';
import { billingCycleLabel } from '../../utils/planFormatting';
import { formatCurrency } from '../../utils/format';
import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const PER = { monthly: 'month', quarterly: 'quarter', yearly: 'year', custom: 'term' };
const SUPPORT = { standard: 'Standard support', priority: 'Priority support', premium: 'Premium support with SLA' };

const features = (plan) =>
  [
    plan.maxCameras != null && `Up to ${plan.maxCameras} cameras`,
    plan.maxOperators != null && `Up to ${plan.maxOperators} operators`,
    'Real-time fire & smoke detection',
    plan.alertRetentionDays != null && `${plan.alertRetentionDays}-day alert history`,
    plan.storageLimit != null && `${plan.storageLimit} GB snapshot storage`,
    SUPPORT[plan.supportPriority] || 'Standard support',
  ].filter(Boolean);

/** Pricing card used on the public pricing section and in the account portal. */
const PlanCard = ({ plan, onSubscribe, subscribeLabel = 'Subscribe', disabled = false, capacityHint = '' }) => {
  const highlighted = plan.isRecommended;
  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border bg-surface p-6 transition-shadow',
        highlighted ? 'border-brand-500 shadow-overlay ring-1 ring-brand-500' : 'border-line hover:shadow-overlay'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-fg">{plan.name || 'Plan'}</h3>
        <div className="flex flex-wrap justify-end gap-1.5">
          {plan.isPopular && <Badge tone="warning">Most popular</Badge>}
          {plan.isRecommended && <Badge tone="brand">Recommended</Badge>}
        </div>
      </div>
      <p className="mt-1.5 min-h-[2.5rem] text-sm text-fg-muted">{plan.description || 'Fire and smoke monitoring for your site.'}</p>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="tabular text-4xl font-semibold tracking-tight text-fg">{formatCurrency(plan.price, plan.currency)}</span>
        <span className="text-sm text-fg-muted">/ {PER[plan.billingCycle] || 'month'}</span>
      </p>
      <p className="mt-1 text-xs text-fg-subtle">
        Billed {billingCycleLabel(plan.billingCycle)}
        {plan.durationMonths ? ` · ${plan.durationMonths}-month term` : ''}
      </p>

      <Button
        variant={highlighted ? 'primary' : 'secondary'}
        size="lg"
        className="mt-6 w-full"
        onClick={() => onSubscribe?.(plan._id)}
        disabled={disabled || !plan._id}
      >
        {subscribeLabel}
      </Button>
      {capacityHint && <p className="mt-2 text-center text-xs font-medium text-warning-fg">{capacityHint}</p>}

      <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-sm">
        {features(plan).map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-fg">
            <Check size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
};

export default PlanCard;
