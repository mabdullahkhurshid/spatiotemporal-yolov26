export const formatAccountDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatAccountCurrency = (amount, currency = 'USD') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const accountStatusBadgeClass = (status) => {
  switch (status) {
    case 'active':
    case 'approved':
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'expired':
    case 'cancelled':
    case 'rejected':
    case 'SUSPENDED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'pending':
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

export const roleLabel = (role) => {
  const labels = {
    customer: 'Customer',
    org_admin: 'Organization Admin',
    operator: 'Operator',
    super_admin: 'Super Admin',
  };
  return labels[role] || role;
};
