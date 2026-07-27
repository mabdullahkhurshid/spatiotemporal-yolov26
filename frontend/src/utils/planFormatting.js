export const billingCycleLabel = (cycle) => {
  const labels = {
    monthly: 'monthly',
    quarterly: 'quarterly',
    yearly: 'yearly',
    custom: 'per term',
  };
  return labels[cycle] || 'monthly';
};

export const formatPrice = (price, currency = 'USD') => {
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice)) {
    return 'Contact us';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(numericPrice);
  } catch {
    return `${numericPrice.toFixed(2)} ${currency || 'USD'}`;
  }
};
