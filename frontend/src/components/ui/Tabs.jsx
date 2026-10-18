import { useRef } from 'react';
import { cn } from '../../utils/cn';

/**
 * Underline tabs used as view filters. Arrow keys move between tabs (roving focus).
 *   <Tabs value={tab} onChange={setTab} items={[{ value, label, count, tone }]} />
 */
const Tabs = ({ items, value, onChange, label = 'Views', className }) => {
  const listRef = useRef(null);

  const onKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const index = items.findIndex((t) => t.value === value);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    onChange(items[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className={cn('-mb-px overflow-x-auto scrollbar-thin', className)}>
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex min-w-max gap-5 border-b border-line">
        {items.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors',
                selected ? 'border-brand-600 text-fg dark:border-brand-400' : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'tabular min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-2xs font-semibold',
                    tab.tone === 'critical' && tab.count > 0
                      ? 'bg-critical text-white'
                      : selected
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'bg-surface-2 text-fg-muted'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Tabs;
