import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import alertReducer from './slices/alertSlice';
import cameraReducer from './slices/cameraSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    alerts: alertReducer,
    cameras: cameraReducer,
    notifications: notificationReducer,
  },
});
