import { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from './Dialog';
import Button from './Button';
import { ConfirmContext } from './confirmContext';

/**
 * Accessible replacement for window.confirm.
 *   const confirm = useConfirm();
 *   if (await confirm({ title, description, confirmLabel, tone: 'danger' })) { ... }
 * With `withNote`, resolves to { note } (string) instead of `true`.
 */
export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const [note, setNote] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setNote(options.defaultNote || '');
    setState(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const danger = state?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title || 'Are you sure?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {state?.cancelLabel || 'Cancel'}
            </Button>
            <Button
              variant={danger ? 'danger' : 'primary'}
              data-autofocus={danger ? undefined : true}
              onClick={() => close(state?.withNote ? { note: note.trim() } : true)}
            >
              {state?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {danger && (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-critical-soft text-critical-fg">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            {state?.description && <p className="text-sm text-fg-muted">{state.description}</p>}
            {state?.withNote && (
              <div>
                <label htmlFor="confirm-note" className="label">
                  {state.noteLabel || 'Note'} <span className="font-normal text-fg-subtle">(optional)</span>
                </label>
                <textarea
                  id="confirm-note"
                  data-autofocus
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={state.notePlaceholder}
                  className="input-field resize-none"
                />
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
};
