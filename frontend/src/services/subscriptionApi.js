import api from './api';

export const checkoutSubscription = (data) =>
  api.post('/subscriptions/checkout', data);

export const getMySubscription = () => api.get('/subscriptions/me');
