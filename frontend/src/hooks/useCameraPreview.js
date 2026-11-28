import { useEffect, useState } from 'react';
import { socketService } from '../services/socketService';

// No frame for this long: show the camera as reconnecting (the server restarts its reader by itself).
const STALE_MS = 10000;

// A tile and the live viewer can watch the same camera on the one shared socket: only the last
// of them to stop may leave the room, or the other stops receiving frames.
const watchers = new Map(); // cameraId -> number of mounted hooks

/**
 * Small live preview for camera tiles: JPEG frames pushed over the app's socket
 * (backend services/livePreviewHub.js). Returns { url, stale } where url is an object URL
 * of the latest frame, or null before the first frame.
 */
export function useCameraPreview(cameraId, enabled = true) {
  const [frame, setFrame] = useState({ url: null, at: 0 });
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!enabled || !cameraId) return undefined;
    const id = String(cameraId);
    let current = null;
    let socket = null;

    const onFrame = ({ cameraId: frameCameraId, frame: data }) => {
      if (String(frameCameraId) !== id || !data) return;
      const next = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }));
      if (current) URL.revokeObjectURL(current);
      current = next;
      setFrame({ url: next, at: Date.now() });
      setStale(false);
    };
    const subscribe = () => socket.emit('camera:preview:subscribe', id);

    const stopWaiting = socketService.whenReady((ready) => {
      socket = ready;
      watchers.set(id, (watchers.get(id) || 0) + 1);
      socket.on('camera:preview:frame', onFrame);
      socket.on('connect', subscribe); // rooms are lost on reconnect
      if (socket.connected) subscribe();
    });

    return () => {
      stopWaiting();
      if (socket) {
        socket.off('camera:preview:frame', onFrame);
        socket.off('connect', subscribe);
        const left = (watchers.get(id) || 1) - 1;
        if (left > 0) {
          watchers.set(id, left);
        } else {
          watchers.delete(id);
          socket.emit('camera:preview:unsubscribe', id);
        }
      }
      if (current) URL.revokeObjectURL(current);
      setFrame({ url: null, at: 0 });
    };
  }, [cameraId, enabled]);

  useEffect(() => {
    if (!frame.at) return undefined;
    const timer = setTimeout(() => setStale(true), STALE_MS);
    return () => clearTimeout(timer);
  }, [frame.at]);

  return { url: frame.url, stale };
}
