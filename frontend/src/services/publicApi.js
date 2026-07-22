import api from './api';

export const getPublicSubscriptionPlans = () => api.get('/public/subscription-plans');

