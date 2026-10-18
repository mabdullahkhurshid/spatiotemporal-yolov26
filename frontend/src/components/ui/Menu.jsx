import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

/**
 * Dropdown menu with keyboard support (arrows, Home/End, Escape) and click-outside close.
 *   <Menu trigger={(props) => <IconButton {...props} />} items={[{ label, icon, onClick, tone, divider }]} />
 */
const Menu = ({ trigger, items, align = 'right', width = 'w-56', header, className }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    const frame = requestAnimationFrame(() => listRef.current?.querySelector('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const onKeyDown = (e) => {
    const nodes = [...(listRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const index = nodes.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector('[aria-haspopup]')?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const triggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: () => setOpen((v) => !v),
  };

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      {trigger(triggerProps, open)}
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-1.5 animate-pop-in overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-overlay',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            width
          )}
        >
          {header && <div className="border-b border-line px-3 py-2.5">{header}</div>}
          {items.filter(Boolean).map((item, i) =>
            item.divider ? (
              <div key={`d-${i}`} role="separator" className="my-1 border-t border-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:bg-surface-2 focus:outline-none disabled:opacity-50',
                  item.tone === 'danger' ? 'text-critical-fg hover:bg-critical-soft focus:bg-critical-soft' : 'text-fg hover:bg-surface-2'
                )}
              >
                {item.icon && <item.icon size={16} className={item.tone === 'danger' ? '' : 'text-fg-subtle'} aria-hidden="true" />}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-fg-subtle">{item.hint}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Menu;
