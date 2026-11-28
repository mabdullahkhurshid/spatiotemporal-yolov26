import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import IconButton from './IconButton';
import { useOverlay } from './useOverlay';

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Accessible modal dialog. Full-height sheet on phones, centred panel from `sm` up.
 */
export const Dialog = ({ open, onClose, title, description, size = 'md', children, footer, className, dismissible = true }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useOverlay(open, dismissible ? onClose : undefined, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(8_12_20/0.55)]" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-xl border border-line bg-surface shadow-overlay sm:rounded-xl',
          SIZES[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-medium text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          {dismissible && <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1" />}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

/** Side panel for details and longer forms. */
export const Drawer = ({ open, onClose, title, description, children, footer, width = 'max-w-md', className }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(8_12_20/0.45)]" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('relative flex h-full w-full animate-slide-in-right flex-col border-l border-line bg-surface shadow-overlay', width, className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-medium text-fg">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-fg-muted">{description}</div>}
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
