import { billingCycleLabel, formatPrice } from '../../utils/planFormatting';

const variantStyles = {
  landing: {
    card: (plan) =>
      `relative rounded-xl border p-6 shadow-sm flex flex-col ${
        plan.isRecommended
          ? 'border-amber-400 bg-slate-800 ring-1 ring-amber-400/50'
          : 'border-slate-700 bg-slate-800'
      }`,
    title: 'font-semibold text-lg text-white',
    description: 'text-sm text-slate-300 mt-1',
    price: 'mt-4 text-3xl font-bold text-white',
    billing: 'text-xs text-slate-400 mt-1',
    features: 'mt-4 text-sm text-slate-200 space-y-1 flex-1',
    button:
      'mt-6 w-full px-4 py-2 rounded-full bg-amber-500 text-slate-900 font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800',
  },
  portal: {
    card: (plan) =>
      `relative rounded-xl border p-6 shadow-sm flex flex-col bg-white dark:bg-gray-800 ${
        plan.isRecommended
          ? 'border-primary-500 ring-1 ring-primary-500/30'
          : 'border-gray-200 dark:border-gray-700'
      }`,
    title: 'font-semibold text-lg text-gray-900 dark:text-white',
    description: 'text-sm text-gray-600 dark:text-gray-300 mt-1',
    price: 'mt-4 text-3xl font-bold text-gray-900 dark:text-white',
    billing: 'text-xs text-gray-500 dark:text-gray-400 mt-1',
    features: 'mt-4 text-sm text-gray-600 dark:text-gray-300 space-y-1 flex-1',
    button:
      'mt-6 w-full px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
  },
};

const PlanCard = ({
  plan,
  variant = 'landing',
  onSubscribe,
  subscribeLabel = 'Subscribe',
  disabled = false,
}) => {
  const styles = variantStyles[variant] || variantStyles.landing;

  return (
    <div className={styles.card(plan)}>
      {(plan.isPopular || plan.isRecommended) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-2">
          {plan.isPopular && (
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-slate-900">
              Popular
            </span>
          )}
          {plan.isRecommended && (
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-500 text-white">
              Recommended
            </span>
          )}
        </div>
      )}

      <h3 className={styles.title}>{plan.name || 'Subscription Plan'}</h3>

      <p className={styles.description}>
        {plan.description || plan.slug || 'Subscription plan'}
      </p>

      <p className={styles.price}>{formatPrice(plan.price, plan.currency)}</p>

      <p className={styles.billing}>
        Billed {billingCycleLabel(plan.billingCycle)}
        {plan.durationMonths ? ` · ${plan.durationMonths} month term` : ''}
      </p>

      <ul className={styles.features}>
        <li>Max cameras: {plan.maxCameras ?? 'N/A'}</li>
        <li>Max operators: {plan.maxOperators ?? 'N/A'}</li>
        <li>
          Alert retention:{' '}
          {plan.alertRetentionDays != null ? `${plan.alertRetentionDays} days` : 'N/A'}
        </li>
        <li>
          Storage: {plan.storageLimit != null ? `${plan.storageLimit} GB` : 'N/A'}
        </li>
        <li>Support: {plan.supportPriority || 'Standard'}</li>
      </ul>

      <button
        type="button"
        onClick={() => onSubscribe?.(plan._id)}
        disabled={disabled || !plan._id}
        className={styles.button}
      >
        {subscribeLabel}
      </button>
    </div>
  );
};

export default PlanCard;
