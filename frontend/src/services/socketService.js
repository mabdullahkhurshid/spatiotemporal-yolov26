import { io } from 'socket.io-client';
import { store } from '../store/store';
import { addAlert, updateAlert } from '../store/slices/alertSlice';
import { fetchCameras, setLiveDetection, updateCameraStatus } from '../store/slices/cameraSlice';
import { addNotification } from '../store/slices/notificationSlice';
import { getAccessToken } from './tokenStore';
import { refreshAccessToken } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.readyCallbacks = new Set();
  }

  connect(token) {
    // Reuse the existing socket even while it is still connecting; a second io() call would open a
    // duplicate connection and deliver every event twice.
    if (this.socket) {
      if (this.socket.connected) {
        // e.g. customer just became org_admin at checkout: join the new org room.
        this.joinCurrentOrganization();
      } else if (!this.socket.active) {
        this.socket.connect();
      }
      return;
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      // Read the latest in-memory token on every (re)connect so refreshed access tokens are used.
      auth: (cb) => cb({ token: getAccessToken() || token }),
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    const waiting = [...this.readyCallbacks];
    this.readyCallbacks.clear();
    waiting.forEach((callback) => callback(this.socket));

    this.authRetried = false;

    let connectedBefore = false;
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.authRetried = false;
      this.joinCurrentOrganization();
      // Status changes while disconnected (e.g. a server restart) were missed: reload the cameras shown.
      if (connectedBefore && store.getState().cameras.cameras.length) store.dispatch(fetchCameras());
      connectedBefore = true;
    });

    // Access tokens are short-lived; a reconnect after expiry is rejected, so refresh once and retry.
    this.socket.on('connect_error', async (err) => {
      if (err?.message !== 'Not authorized' || this.authRetried || !this.socket) return;
      this.authRetried = true;
      try {
        await refreshAccessToken();
        this.socket?.connect();
      } catch {
        // Session is gone; the API interceptor will send the user to /login on the next request.
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

    this.socket.on('alert:updated', (data) => {
      if (!data?.alertId || !data.status) return;
      store.dispatch(updateAlert({ _id: data.alertId, status: data.status }));
    });

    // Heatmap / false-alarm likelihood from the explainer arrives a few seconds after alert:new.
    this.socket.on('alert:explained', (data) => {
      if (!data?.alertId || !data.explanation) return;
      store.dispatch(updateAlert({ _id: data.alertId, explanation: data.explanation }));
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

  /** Runs `callback(socket)` now if connected-or-connecting, else once connect() creates the socket. */
  whenReady(callback) {
    if (this.socket) {
      callback(this.socket);
      return () => {};
    }
    this.readyCallbacks.add(callback);
    return () => this.readyCallbacks.delete(callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // user.organizationId is a populated organization object after login/getMe, or an id string.
  joinCurrentOrganization() {
    const { user } = store.getState().auth;
    const orgId = user?.organizationId?._id || user?.organizationId;
    if (this.socket && orgId) {
      this.socket.emit('join:organization', String(orgId));
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
