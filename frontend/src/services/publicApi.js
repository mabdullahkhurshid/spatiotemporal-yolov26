import api from './api';

export const getPublicSubscriptionPlans = () => api.get('/public/subscription-plans');

export const submitContactMessage = (data) => api.post('/public/contact', data);

