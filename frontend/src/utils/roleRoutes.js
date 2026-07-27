export const PORTAL_ROLES = ['customer', 'org_admin'];

export const isPortalUser = (role) => PORTAL_ROLES.includes(role);

export const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'super_admin':
      return '/superadmin/dashboard';
    case 'org_admin':
      return '/customer/dashboard';
    case 'operator':
      return '/operator/dashboard';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/app';
  }
};

export const storePendingPlanId = (planId) => {
  if (planId) {
    sessionStorage.setItem('pendingPlanId', planId);
  }
};

export const getPendingPlanId = () => sessionStorage.getItem('pendingPlanId');

export const clearPendingPlanId = () => sessionStorage.removeItem('pendingPlanId');

const MARKETING_VIEW_KEY = 'allowMarketingView';

/** Set when the user explicitly opens the marketing site from the portal. */
export const enableMarketingView = () => sessionStorage.setItem(MARKETING_VIEW_KEY, '1');

export const isMarketingViewAllowed = () =>
  sessionStorage.getItem(MARKETING_VIEW_KEY) === '1';

export const clearMarketingView = () => sessionStorage.removeItem(MARKETING_VIEW_KEY);

export const getPostAuthRedirectPath = (role) => {
  const pendingPlanId = getPendingPlanId();
  if (pendingPlanId && isPortalUser(role)) {
    return `/customer/subscribe/${encodeURIComponent(pendingPlanId)}`;
  }
  return getDashboardPathForRole(role);
};
