// Dates, currency and status colors live in utils/format.js and components/ui (StatusBadge).
export const roleLabel = (role) => {
  const labels = {
    customer: 'Customer',
    org_admin: 'Organization admin',
    operator: 'Operator',
    super_admin: 'Super admin',
  };
  return labels[role] || role || 'Account';
};
