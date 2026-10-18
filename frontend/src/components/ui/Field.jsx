import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Label + control + hint/error, wired with htmlFor / aria-describedby / aria-invalid.
 *   <Field label="Email" hint="…" error={errors.email} required><Input type="email" /></Field>
 */
export const Field = ({ label, hint, error, required, optional, children, className, id: idProp }) => {
  const autoId = useId();
  const id = idProp || children?.props?.id || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || children.props.required,
      })
    : children;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-0.5 text-critical-fg" aria-hidden="true">*</span>}
          {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-critical-fg">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1.5 text-xs text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

const control =
  'block w-full rounded-md border bg-surface text-sm text-fg shadow-xs transition-colors placeholder:text-fg-subtle focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-subtle';
const stateClass = (invalid) =>
  invalid
    ? 'border-critical focus:border-critical focus:ring-critical/20'
    : 'border-line-strong focus:border-brand-500 focus:ring-brand-500/25';

export const Input = forwardRef(function Input({ className, icon: Icon, ...props }, ref) {
  const invalid = props['aria-invalid'];
  if (!Icon) return <input ref={ref} className={cn(control, stateClass(invalid), 'h-9 px-3', className)} {...props} />;
  // With an icon, layout classes (width, flex) belong on the wrapper so it sizes correctly in rows.
  return (
    <div className={cn('relative w-full min-w-0 flex-1', className)}>
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      <input ref={ref} className={cn(control, stateClass(invalid), 'h-9 pl-9 pr-3')} {...props} />
    </div>
  );
});

export const SearchInput = forwardRef(function SearchInput({ className, label = 'Search', ...props }, ref) {
  return <Input ref={ref} type="search" icon={Search} aria-label={label} className={className} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className?.includes('w-') ? '' : 'w-full')}>
      <select
        ref={ref}
        className={cn(control, stateClass(props['aria-invalid']), 'h-9 appearance-none pl-3 pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, stateClass(props['aria-invalid']), 'px-3 py-2', className)} {...props} />;
});

/** Toggle switch (role="switch") with a visible label. */
export const Switch = ({ checked, onChange, label, description, disabled, id: idProp }) => {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-surface-3'
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
};
