const UsageBar = ({ label, used, limit, icon: Icon }) => {
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {Icon && <Icon size={16} />}
          <span>{label}</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {used} / {limit ?? '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default UsageBar;
