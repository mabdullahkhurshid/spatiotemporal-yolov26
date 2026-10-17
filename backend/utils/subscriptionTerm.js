const Camera = require('../models/Camera');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

/**
 * True only when org and subscription documents agree the paid term is currently in force.
 * Past end dates always mean not active, even if status strings were not synced yet.
 */
const isSubscriptionTermActive = ({ organization, subscription, now = new Date() }) => {
  if (!organization || organization.status !== 'ACTIVE') {
    return false;
  }

  const orgEnd = organization.subscriptionEndDate
    ? new Date(organization.subscriptionEndDate)
    : null;
  if (orgEnd && orgEnd < now) {
    return false;
  }

  if (organization.subscriptionStatus !== 'active') {
    return false;
  }

  if (!subscription) {
    return false;
  }

  if (subscription.status !== 'active') {
    return false;
  }

  const subEnd = subscription.endDate ? new Date(subscription.endDate) : null;
  if (!subEnd || subEnd <= now) {
    return false;
  }

  return true;
};

const isOrganizationRenewable = ({ organization, subscription, now = new Date() }) => {
  if (!organization || organization.isDeleted) {
    return false;
  }
  if (organization.status === 'SUSPENDED') {
    return false;
  }
  return !isSubscriptionTermActive({ organization, subscription, now });
};

/** Org admin may shrink usage (cameras) while subscription lapsed but org is not suspended. */
const isExpiredDeprovisionEligible = ({ user, organization, subscription, now = new Date() }) => {
  if (!user || user.role !== 'org_admin') {
    return false;
  }
  if (!organization || organization.isDeleted) {
    return false;
  }
  if (organization.status !== 'ACTIVE') {
    return false;
  }
  return !isSubscriptionTermActive({ organization, subscription, now });
};

const getOrganizationUsageCounts = async (organizationId) => {
  const [cameraCount, operatorCount] = await Promise.all([
    Camera.countDocuments({ organizationId, isDeleted: false }),
    User.countDocuments({
      organizationId,
      role: 'operator',
      isDeleted: false,
      isActive: true,
    }),
  ]);

  return { cameraCount, operatorCount };
};

/**
 * Persist expired status on org and subscription when end dates are in the past.
 */
const syncExpiredSubscriptionState = async (organization) => {
  if (!organization) {
    return { organization, subscription: null };
  }

  const now = new Date();
  let orgChanged = false;

  if (
    organization.subscriptionEndDate &&
    new Date(organization.subscriptionEndDate) < now &&
    organization.subscriptionStatus !== 'expired'
  ) {
    organization.subscriptionStatus = 'expired';
    orgChanged = true;
  }

  const subscription = await Subscription.findOne({ organizationId: organization._id });
  let subChanged = false;

  if (
    subscription &&
    subscription.endDate &&
    new Date(subscription.endDate) < now &&
    subscription.status === 'active'
  ) {
    subscription.status = 'expired';
    subChanged = true;
  }

  if (orgChanged) {
    await organization.save();
  }
  if (subChanged) {
    await subscription.save();
  }

  return { organization, subscription };
};

module.exports = {
  isSubscriptionTermActive,
  isOrganizationRenewable,
  isExpiredDeprovisionEligible,
  getOrganizationUsageCounts,
  syncExpiredSubscriptionState,
};
