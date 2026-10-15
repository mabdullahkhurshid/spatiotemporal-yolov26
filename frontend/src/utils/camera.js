export const isCameraOnline = (status) =>
  status === 'ONLINE' || status === 'online';

export const normalizeCameraId = (id) => (id == null ? '' : String(id));

export const findCameraById = (cameras, id) => {
  if (!id) return null;
  const target = normalizeCameraId(id);
  return cameras.find((camera) => normalizeCameraId(camera._id) === target) ?? null;
};
