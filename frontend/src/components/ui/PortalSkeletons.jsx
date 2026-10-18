import { Skeleton } from './Feedback';

export const CardSkeleton = ({ className = 'h-48' }) => (
  <div className={`rounded-lg border border-line bg-surface p-5 ${className}`}>
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="mt-4 h-4 w-2/3" />
    <Skeleton className="mt-2 h-4 w-1/2" />
  </div>
);

const HeaderSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-7 w-64" />
    <Skeleton className="h-4 w-80 max-w-full" />
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6" aria-hidden="true">
    <HeaderSkeleton />
    <div className="grid gap-6 lg:grid-cols-3">
      <CardSkeleton className="h-72 lg:col-span-2" />
      <CardSkeleton className="h-72" />
    </div>
  </div>
);

export const SubscriptionPageSkeleton = () => (
  <div className="space-y-6" aria-hidden="true">
    <HeaderSkeleton />
    <div className="grid gap-6 lg:grid-cols-3">
      <CardSkeleton className="h-64 lg:col-span-2" />
      <CardSkeleton className="h-64" />
    </div>
    <CardSkeleton className="h-40" />
  </div>
);

export const PlanCardGridSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-3" role="status" aria-label="Loading plans">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
  </div>
);

export const SettingsPageSkeleton = () => (
  <div className="space-y-6" aria-hidden="true">
    <HeaderSkeleton />
    <CardSkeleton className="h-40" />
    <CardSkeleton className="h-32" />
    <CardSkeleton className="h-28" />
  </div>
);
