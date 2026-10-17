import { io } from 'socket.io-client';
import { store } from '../store/store';
import { addAlert, updateAlert } from '../store/slices/alertSlice';
import { setLiveDetection, updateCameraStatus } from '../store/slices/cameraSlice';
import { addNotification } from '../store/slices/notificationSlice';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      const { user } = store.getState().auth;
      if (user?.organizationId) {
        this.socket.emit('join:organization', user.organizationId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Alert events
    this.socket.on('alert:new', (data) => {
      if (!data?.alert) return;
      store.dispatch(addAlert(data.alert));
      store.dispatch(addNotification({
        type: 'alert',
        title: `Fire Alert: ${data.alert.cameraId?.label}`,
        message: `Fire detected with ${data.alert.fireConfidence}% confidence`,
        priority: data.alert.intensityLevel === 'critical' ? 'critical' : 'high',
      }));
    });

    this.socket.on('alert:resolved', (data) => {
      if (!data?.alertId) return;
      store.dispatch(updateAlert({ _id: data.alertId, status: 'resolved' }));
    });

    this.socket.on('alert:false_alarm', (data) => {
      if (!data?.alertId) return;
      store.dispatch(updateAlert({ _id: data.alertId, status: 'false_alarm' }));
    });

    // Camera status events
    this.socket.on('camera:status:update', (data) => {
      store.dispatch(updateCameraStatus(data));
    });

    this.socket.on('detection:live', (data) => {
      if (!data?.cameraId) return;
      store.dispatch(
        setLiveDetection({
          cameraId: data.cameraId,
          detections: data.detections,
          metrics: data.metrics,
          timestamp: data.timestamp,
        })
      );
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinOrganization(organizationId) {
    if (this.socket) {
      this.socket.emit('join:organization', organizationId);
    }
  }

  leaveOrganization(organizationId) {
    if (this.socket) {
      this.socket.emit('leave:organization', organizationId);
    }
  }
}

export const socketService = new SocketService();
