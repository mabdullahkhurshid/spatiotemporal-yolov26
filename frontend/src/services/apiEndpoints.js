import api from './api';

// Organizations (Super Admin)
export const getOrganizations = (params) => api.get('/organizations', { params });
export const getOrganization = (id) => api.get(`/organizations/${id}`);
export const createOrganization = (data) => api.post('/organizations', data);
export const updateOrganization = (id, data) => api.put(`/organizations/${id}`, data);
export const deleteOrganization = (id) => api.delete(`/organizations/${id}`);
export const approveOrganization = (id) => api.put(`/organizations/${id}/approve`);
export const rejectOrganization = (id, rejectionReason) => api.put(`/organizations/${id}/reject`, { rejectionReason });
export const suspendOrganization = (id) => api.put(`/organizations/${id}/suspend`);

// Subscription Plans (Super Admin)
export const getSubscriptionPlans = (params) => api.get('/subscription-plans', { params });
export const getSubscriptionPlan = (id) => api.get(`/subscription-plans/${id}`);
export const createSubscriptionPlan = (data) => api.post('/subscription-plans', data);
export const updateSubscriptionPlan = (id, data) => api.put(`/subscription-plans/${id}`, data);
export const deactivateSubscriptionPlan = (id) => api.put(`/subscription-plans/${id}/deactivate`);
export const assignPlanToOrganization = (planId, organizationId) =>
  api.put(`/subscription-plans/${planId}/assign/${organizationId}`);

// Users (Super Admin / Org Admin)
export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const verifyUser = (id) => api.put(`/users/${id}/verify`);
export const suspendUser = (id) => api.put(`/users/${id}/suspend`);
export const reactivateUser = (id) => api.put(`/users/${id}/reactivate`);
export const resetUserPassword = (id, password) => api.put(`/users/${id}/reset-password`, { password });

// Operator camera assignments (Org Admin)
export const getOperatorAssignments = (params) => api.get('/operator-assignments', { params });
export const assignCamerasToOperator = (operatorId, cameraIds, replace = true) =>
  api.post('/operator-assignments', { operatorId, cameraIds, replace });
export const removeOperatorAssignment = (assignmentId) => api.delete(`/operator-assignments/${assignmentId}`);
export const getMyAssignedCameras = () => api.get('/operator-assignments/my-cameras');
