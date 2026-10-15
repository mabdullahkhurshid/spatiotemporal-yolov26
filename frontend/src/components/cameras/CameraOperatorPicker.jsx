const CameraOperatorPicker = ({
  operators = [],
  selectedOperatorIds = [],
  onChange,
  loading = false,
  emptyMessage = 'No operators in your organization yet.',
}) => {
  const selectedIds = selectedOperatorIds.map((id) => String(id));

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading operators...</p>;
  }

  if (operators.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
  }

  const toggleOperator = (operatorId) => {
    const id = String(operatorId);
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    onChange?.(next);
  };

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      {operators.map((operator) => (
        <label
          key={operator._id}
          className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(String(operator._id))}
            onChange={() => toggleOperator(operator._id)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="truncate">
            {operator.name}
            <span className="text-gray-500 dark:text-gray-400 ml-1">({operator.email})</span>
          </span>
        </label>
      ))}
    </div>
  );
};

export default CameraOperatorPicker;
