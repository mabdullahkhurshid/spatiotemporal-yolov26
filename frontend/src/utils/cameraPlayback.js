import { useEffect, useState } from 'react';
import api from '../services/api';

const apiBase = import.meta.env.VITE_API_URL || '/api';

/**
 * Resolve a browser-playable URL for live view.
 * RTSP/ONVIF uses the authenticated MJPEG proxy; MJPEG uses streamUrl directly.
 * `streamToken` is a short-lived, camera-scoped token (never the access token).
 */
export function getCameraPlaybackSource(camera, streamToken) {
  if (!camera?.streamUrl) {
    return { mode: 'none', url: null };
  }

  const type = camera.cameraType || 'ip_rtsp';
  if (type === 'http_mjpeg') {
    return { mode: 'video', url: camera.streamUrl };
  }

  if (!streamToken) {
    return { mode: 'mjpeg', url: null };
  }

  const base = apiBase.replace(/\/$/, '');
  return {
    mode: 'mjpeg',
    url: `${base}/cameras/${camera._id}/stream/mjpeg?streamToken=${encodeURIComponent(streamToken)}`,
  };
}

/** Fetches a stream token when the proxy is needed and returns { mode, url, error }. */
export function useCameraPlayback(camera, enabled = true) {
  const needsProxy = Boolean(camera?.streamUrl) && (camera?.cameraType || 'ip_rtsp') !== 'http_mjpeg';
  const cameraId = camera?._id;
  const [state, setState] = useState({ token: null, error: null });

  useEffect(() => {
    if (!enabled || !needsProxy || !cameraId) {
      setState({ token: null, error: null });
      return undefined;
    }
    let cancelled = false;
    api
      .get(`/cameras/${cameraId}/stream-token`)
      .then((res) => !cancelled && setState({ token: res.data.data.token, error: null }))
      .catch((err) =>
        !cancelled && setState({ token: null, error: err.response?.data?.message || 'Live view unavailable' })
      );
    return () => {
      cancelled = true;
    };
  }, [enabled, needsProxy, cameraId]);

  return { ...getCameraPlaybackSource(camera, state.token), error: state.error };
}
