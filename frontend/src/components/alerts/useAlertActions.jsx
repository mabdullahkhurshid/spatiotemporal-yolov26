import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { acknowledgeAlert, markFalseAlarm, resolveAlert } from '../../store/slices/alertSlice';
import { useConfirm } from '../ui/confirmContext';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { cn } from '../../utils/cn';
import { RESOLUTION_OPTIONS, cameraName } from './alertUtils';

/**
 * Alert lifecycle actions shared by the alerts page, dashboards and the detail drawer.
 * Render `dialogs` once in the component that uses the hook.
 */
export const useAlertActions = () => {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const [pending, setPending] = useState(null); // { id, action }
  const [resolving, setResolving] = useState(null); // alert being resolved
  const [resolution, setResolution] = useState('EXTINGUISHED');
  const [note, setNote] = useState('');

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

  const falseAlarm = async (alert) => {
    const result = await confirm({
      title: 'Mark as false alarm?',
      description: `The alert from ${cameraName(alert)} will be closed and counted as a false alarm in reports.`,
      confirmLabel: 'Mark false alarm',
      withNote: true,
      noteLabel: 'What triggered it?',
      notePlaceholder: 'e.g. welding work, steam from kitchen, sunlight reflection',
    });
    if (!result) return false;
    return run(alert, 'false_alarm', markFalseAlarm({ id: alert._id, note: result.note || undefined }), 'Marked as false alarm');
  };

  const isPending = (alert, action) => pending?.id === alert._id && (!action || pending.action === action);

  const dialogs = (
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
  );

  return { acknowledge, requestResolve, falseAlarm, isPending, dialogs };
};

export default useAlertActions;
