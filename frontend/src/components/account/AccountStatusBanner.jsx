import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Clock } from 'lucide-react';

const AccountStatusBanner = ({ flags, organization, subscription }) => {
  if (!flags?.hasOrganization) return null;

  const endDate = subscription?.endDate || organization?.subscriptionEndDate;
  const expiryDate = endDate ? new Date(endDate) : null;
  const daysUntilExpiry =
    expiryDate && !Number.isNaN(expiryDate.getTime())
      ? Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  if (flags.isOrgSuspended) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex gap-3">
        <Ban className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">Organization suspended</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Your organization has been suspended. Contact support to restore access to the org
            dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (flags.isSubscriptionExpired) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex gap-3">
        <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">Subscription expired</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Your subscription ended on {expiryDate?.toLocaleDateString() || '—'}. Renew your plan
            to restore full access.
          </p>
          <Link
            to="/customer/plans"
            className="inline-flex mt-3 text-sm font-semibold text-red-800 dark:text-red-200 underline"
          >
            Renew plan
          </Link>
        </div>
      </div>
    );
  }

  if (daysUntilExpiry != null && daysUntilExpiry <= 14 && daysUntilExpiry > 0) {
    return (
      <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 flex gap-3">
        <Clock className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-yellow-800 dark:text-yellow-200">
            Subscription expiring soon
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Your plan expires in {daysUntilExpiry} day{daysUntilExpiry === 1 ? '' : 's'} (
            {expiryDate.toLocaleDateString()}). You can renew after {expiryDate.toLocaleDateString()}.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AccountStatusBanner;
