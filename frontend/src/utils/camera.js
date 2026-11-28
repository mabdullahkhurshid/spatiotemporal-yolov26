export const isCameraOnline = (status) =>
  status === 'ONLINE' || status === 'online';

export const isCameraPaused = (status) => status === 'paused';

export const normalizeCameraId = (id) => (id == null ? '' : String(id));

export const findCameraById = (cameras, id) => {
  if (!id) return null;
  const target = normalizeCameraId(id);
  return cameras.find((camera) => normalizeCameraId(camera._id) === target) ?? null;
};

export const cameraTitle = (camera) =>
  (camera && typeof camera === 'object' && (camera.name || camera.label || camera.displayNumber)) || 'Unnamed camera';
