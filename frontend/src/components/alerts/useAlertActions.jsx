import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { acknowledgeAlert, markFalseAlarm, resolveAlert } from '../../store/slices/alertSlice';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { cn } from '../../utils/cn';
import { FALSE_ALARM_CAUSE_OPTIONS, RESOLUTION_OPTIONS, cameraName } from './alertUtils';

/**
 * Alert lifecycle actions shared by the alerts page, dashboards and the detail drawer.
 * Render `dialogs` once in the component that uses the hook.
 */
export const useAlertActions = () => {
  const dispatch = useDispatch();
  const [pending, setPending] = useState(null); // { id, action }
  const [resolving, setResolving] = useState(null); // alert being resolved
  const [resolution, setResolution] = useState('EXTINGUISHED');
  const [note, setNote] = useState('');
  const [dismissing, setDismissing] = useState(null); // alert being marked false alarm
  const [cause, setCause] = useState('');
  const [falseNote, setFalseNote] = useState('');

  const run = async (alert, action, thunk, success) => {
    setPending({ id: alert._id, action });
    try {
      await dispatch(thunk).unwrap();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Action failed. Please try again.');
      return false;
    } finally {
      setPending(null);
    }
  };

  const acknowledge = (alert) => run(alert, 'acknowledge', acknowledgeAlert({ id: alert._id }), `Acknowledged · ${cameraName(alert)}`);

  const requestResolve = (alert) => {
    setResolution('EXTINGUISHED');
    setNote('');
    setResolving(alert);
  };

  const submitResolve = async (e) => {
    e?.preventDefault();
    const alert = resolving;
    const ok = await run(
      alert,
      'resolve',
      resolveAlert({ id: alert._id, resolutionType: resolution, note: note.trim() || undefined }),
      `Resolved · ${cameraName(alert)}`
    );
    if (ok) setResolving(null);
  };

  const falseAlarm = (alert) => {
    setCause('');
    setFalseNote('');
    setDismissing(alert);
  };

  const submitFalseAlarm = async (e) => {
    e?.preventDefault();
    const alert = dismissing;
    const ok = await run(
      alert,
      'false_alarm',
      markFalseAlarm({ id: alert._id, note: falseNote.trim() || undefined, cause: cause || undefined }),
      'Marked as false alarm'
    );
    if (ok) setDismissing(null);
  };

  const isPending = (alert, action) => pending?.id === alert._id && (!action || pending.action === action);

  const dialogs = (
    <>
      <Dialog
        open={Boolean(dismissing)}
        onClose={() => setDismissing(null)}
        title="Mark as false alarm?"
        description={dismissing ? `The alert from ${cameraName(dismissing)} will be closed and counted as a false alarm in reports.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDismissing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="false-alarm-form" loading={pending?.action === 'false_alarm'}>
              Mark false alarm
            </Button>
          </>
        }
      >
        <form id="false-alarm-form" onSubmit={submitFalseAlarm} className="space-y-5">
          <fieldset>
            <legend className="label">
              What triggered it? <span className="font-normal text-fg-subtle">(optional, helps the system learn)</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FALSE_ALARM_CAUSE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-md border p-2.5 transition-colors',
                    cause === option.value ? 'border-brand-500 bg-info-soft' : 'border-line-strong hover:bg-surface-2'
                  )}
                >
                  <input
                    type="radio"
                    name="false-alarm-cause"
                    value={option.value}
                    checked={cause === option.value}
                    onChange={() => setCause(option.value)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{option.label}</span>
                    {option.hint && <span className="mt-0.5 block text-xs text-fg-muted">{option.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Note" optional hint="Visible in the alert history.">
            <Textarea
              rows={3}
              value={falseNote}
              onChange={(e) => setFalseNote(e.target.value)}
              placeholder="e.g. welding work, steam from kitchen, sunlight reflection"
              data-autofocus
            />
          </Field>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title="Resolve alert"
        description={resolving ? `${cameraName(resolving)} — record how this alert was handled.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button type="submit" form="resolve-alert-form" loading={pending?.action === 'resolve'}>
              Resolve alert
            </Button>
          </>
        }
      >
        <form id="resolve-alert-form" onSubmit={submitResolve} className="space-y-5">
          <fieldset>
            <legend className="label">Outcome</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESOLUTION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-md border p-3 transition-colors',
                    resolution === option.value ? 'border-brand-500 bg-info-soft' : 'border-line-strong hover:bg-surface-2'
                  )}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={option.value}
                    checked={resolution === option.value}
                    onChange={() => setResolution(option.value)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    data-autofocus={option.value === 'EXTINGUISHED' ? true : undefined}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Note" optional hint="Visible in the alert history.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done on site?" />
          </Field>
        </form>
      </Dialog>
    </>
  );

  return { acknowledge, requestResolve, falseAlarm, isPending, dialogs };
};

export default useAlertActions;
