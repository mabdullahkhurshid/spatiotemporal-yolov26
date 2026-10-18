import { cn } from '../../utils/cn';

const BAR = { critical: 'bg-critical', smoke: 'bg-slate-400', brand: 'bg-brand-600' };

/** Labelled 0–100% meter. Smoke uses neutral gray, fire uses the critical color. */
const ConfidenceMeter = ({ label, value, tone = 'brand', compact = false, inverted = false }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
      <span className={cn('shrink-0', inverted ? 'text-white/60' : 'text-fg-muted', compact ? 'w-10 text-xs' : 'w-12 text-sm')}>{label}</span>
      <span
        role="meter"
        aria-label={`${label} confidence`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn('relative flex-1 overflow-hidden rounded-full', inverted ? 'bg-white/10' : 'bg-surface-3', compact ? 'h-1.5' : 'h-2')}
      >
        <span className={cn('absolute inset-y-0 left-0 rounded-full', BAR[tone])} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('tabular shrink-0 text-right font-medium', inverted ? 'text-white' : 'text-fg', compact ? 'w-9 text-xs' : 'w-11 text-sm')}>{Math.round(pct)}%</span>
    </div>
  );
};

export default ConfidenceMeter;
