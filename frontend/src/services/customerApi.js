import api from './api';

export const getAccountSummary = () => api.get('/users/me/account-summary');
