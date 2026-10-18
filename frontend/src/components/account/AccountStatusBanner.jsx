import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Clock } from 'lucide-react';
import { Notice } from '../ui/Feedback';
import Button from '../ui/Button';
import { daysUntil, formatDate } from '../../utils/format';

/** Account-level warnings: suspended organization, expired or soon-expiring subscription. */
const AccountStatusBanner = ({ flags, organization, subscription, className }) => {
  if (!flags?.hasOrganization) return null;
  const endDate = subscription?.endDate || organization?.subscriptionEndDate;
  const days = daysUntil(endDate);

  if (flags.isOrgSuspended) {
    return (
      <Notice tone="critical" icon={Ban} title="Organization suspended" className={className}>
        Monitoring is paused for your organization. Contact support to restore access.
      </Notice>
    );
  }

  if (flags.isSubscriptionExpired) {
    return (
      <Notice
        tone="critical"
        icon={AlertTriangle}
        title="Subscription expired"
        className={className}
        action={
          <Button as={Link} to="/customer/plans" size="sm" variant="danger">
            Renew plan
          </Button>
        }
      >
        Your plan ended on {formatDate(endDate)}. Cameras are no longer monitored until you renew.
      </Notice>
    );
  }

  if (days != null && days > 0 && days <= 14) {
    return (
      <Notice tone="warning" icon={Clock} title={`Subscription ends in ${days} day${days === 1 ? '' : 's'}`} className={className}>
        Your current term ends on {formatDate(endDate)}. You can renew or change plans once it ends.
      </Notice>
    );
  }

  return null;
};

export default AccountStatusBanner;
