export const CHECKOUT_MODE = {
  FIRST_PURCHASE: 'first_purchase',
  RENEWAL: 'renewal',
  BLOCKED_ACTIVE: 'blocked_active',
  BLOCKED_SUSPENDED: 'blocked_suspended',
};

export const ACTIVE_SUBSCRIPTION_MESSAGE =
  'You already have an active subscription. You can change plans after it expires.';

/**
 * Derive portal checkout mode from GET /users/me/account-summary payload.
 */
export const deriveCheckoutMode = (accountSummary) => {
  const flags = accountSummary?.flags;
  if (!flags) {
    return CHECKOUT_MODE.FIRST_PURCHASE;
  }

  if (flags.isOrgSuspended) {
    return CHECKOUT_MODE.BLOCKED_SUSPENDED;
  }

  if (flags.hasActiveSubscription) {
    return CHECKOUT_MODE.BLOCKED_ACTIVE;
  }

  if (flags.hasOrganization) {
    return CHECKOUT_MODE.RENEWAL;
  }

  return CHECKOUT_MODE.FIRST_PURCHASE;
};

export const isCapacityCheckoutError = (message) => {
  if (!message || typeof message !== 'string') {
    return false;
  }
  return (
    message.includes('cameras and your organization has') ||
    message.includes('operators and your organization has')
  );
};

export const isSuspendedCheckoutError = (message) => {
  if (!message || typeof message !== 'string') {
    return false;
  }
  return message.includes('organization is suspended');
};

/**
 * Compare live usage from account summary with a plan's limits.
 * Missing usage (first purchase) is treated as a fit.
 */
export const getPlanCapacityGaps = (plan, usage) => {
  if (!usage) {
    return {
      camerasOver: false,
      operatorsOver: false,
      camerasUsed: 0,
      operatorsUsed: 0,
      maxCameras: Number(plan?.maxCameras ?? 0),
      maxOperators: Number(plan?.maxOperators ?? 0),
    };
  }

  const camerasUsed = Number(usage.camerasUsed ?? 0);
  const operatorsUsed = Number(usage.operatorsUsed ?? 0);
  const maxCameras = Number(plan?.maxCameras ?? 0);
  const maxOperators = Number(plan?.maxOperators ?? 0);

  return {
    camerasOver: camerasUsed > maxCameras,
    operatorsOver: operatorsUsed > maxOperators,
    camerasUsed,
    operatorsUsed,
    maxCameras,
    maxOperators,
  };
};

export const planFitsUsage = (plan, usage) => {
  const gaps = getPlanCapacityGaps(plan, usage);
  return !gaps.camerasOver && !gaps.operatorsOver;
};
