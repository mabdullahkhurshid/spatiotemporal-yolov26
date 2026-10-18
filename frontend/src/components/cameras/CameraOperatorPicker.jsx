import Avatar from '../ui/Avatar';
import { Skeleton } from '../ui/Feedback';

const CameraOperatorPicker = ({ operators = [], selectedOperatorIds = [], onChange, loading = false, emptyMessage = 'No operators in your organization yet.' }) => {
  const selectedIds = selectedOperatorIds.map((id) => String(id));

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (operators.length === 0) {
    return <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-sm text-fg-muted">{emptyMessage}</p>;
  }

  const toggle = (operatorId) => {
    const id = String(operatorId);
    onChange?.(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  };

  return (
    <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line scrollbar-thin">
      {operators.map((operator) => {
        const checked = selectedIds.includes(String(operator._id));
        return (
          <li key={operator._id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2">
              <input type="checkbox" checked={checked} onChange={() => toggle(operator._id)} className="h-4 w-4 rounded accent-brand-600" />
              <Avatar name={operator.name} email={operator.email} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{operator.name}</span>
                <span className="block truncate text-xs text-fg-muted">{operator.email}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
};

export default CameraOperatorPicker;
