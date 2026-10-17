const apiBase = import.meta.env.VITE_API_URL || '/api';

/**
 * Resolve a browser-playable URL for live view.
 * RTSP/ONVIF uses authenticated MJPEG proxy; MJPEG uses streamUrl directly.
 */
export function getCameraPlaybackSource(camera) {
  if (!camera?.streamUrl) {
    return { mode: 'none', url: null };
  }

  const type = camera.cameraType || 'ip_rtsp';
  if (type === 'http_mjpeg') {
    return { mode: 'video', url: camera.streamUrl };
  }

  const token = localStorage.getItem('accessToken');
  const base = apiBase.replace(/\/$/, '');
  const url = `${base}/cameras/${camera._id}/stream/mjpeg${
    token ? `?accessToken=${encodeURIComponent(token)}` : ''
  }`;
  return { mode: 'mjpeg', url };
}
