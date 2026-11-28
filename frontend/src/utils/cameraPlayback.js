import { useEffect, useState } from 'react';
import api from '../services/api';

const apiBase = import.meta.env.VITE_API_URL || '/api';

/**
 * Resolve a browser-playable URL for live view.
 * RTSP/ONVIF uses the authenticated MJPEG proxy; MJPEG uses streamUrl directly.
 * `streamToken` is a short-lived, camera-scoped token (never the access token).
 */
// Demo cameras have no streamUrl on the client; the server reads them from MediaMTX.
const hasStream = (camera) => Boolean(camera?.streamUrl) || ['demo_feed', 'webcam'].includes(camera?.cameraType);

export function getCameraPlaybackSource(camera, streamToken) {
  if (!hasStream(camera)) {
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

const RETRY_MS = 5000;

/**
 * Fetches a stream token when the proxy is needed and returns { mode, url, error, onError }.
 * Pass `onError` to the <img>/<video>: a stream that is not up yet (or drops) then shows an
 * error and reconnects with a fresh token instead of leaving a blank frame.
 */
export function useCameraPlayback(camera, enabled = true) {
  const needsProxy = hasStream(camera) && (camera?.cameraType || 'ip_rtsp') !== 'http_mjpeg';
  const cameraId = camera?._id;
  const [state, setState] = useState({ token: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

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
  }, [enabled, needsProxy, cameraId, attempt]);

  useEffect(() => {
    if (!failed || !enabled) return undefined;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed, enabled]);

  const source = getCameraPlaybackSource(camera, state.token);
  return {
    ...source,
    url: failed ? null : source.url,
    error: state.error || (failed ? 'Live stream unavailable. Reconnecting…' : null),
    onError: () => setFailed(true),
  };
}
