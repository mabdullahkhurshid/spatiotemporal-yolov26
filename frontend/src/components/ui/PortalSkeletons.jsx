export const CardSkeleton = ({ className = 'h-48' }) => (
  <div className={`card animate-pulse ${className}`}>
    <div className="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="mt-4 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="mt-2 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
  </div>
);

export const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6" aria-hidden="true">
    <div className="card animate-pulse h-36 bg-gray-200 dark:bg-gray-700 border-0" />
    <div className="grid gap-4 sm:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <CardSkeleton className="h-32" />
      <CardSkeleton className="h-32" />
      <CardSkeleton className="h-32 sm:col-span-2" />
    </div>
  </div>
);

export const SubscriptionPageSkeleton = () => (
  <div className="max-w-5xl mx-auto space-y-6" aria-hidden="true">
    <div className="space-y-2">
      <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-64" />
    </div>
    <CardSkeleton className="h-40" />
    <CardSkeleton className="h-56" />
  </div>
);

export const PlanCardGridSkeleton = ({ count = 3 }) => (
  <div
    className="grid grid-cols-1 md:grid-cols-3 gap-6"
    role="status"
    aria-label="Loading subscription plans"
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="card animate-pulse space-y-4">
        <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>
    ))}
  </div>
);

export const SettingsPageSkeleton = () => (
  <div className="max-w-2xl mx-auto space-y-6" aria-hidden="true">
    <CardSkeleton className="h-52" />
    <CardSkeleton className="h-40" />
    <CardSkeleton className="h-32" />
  </div>
);
