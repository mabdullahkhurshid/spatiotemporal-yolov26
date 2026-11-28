import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { pauseCamera, resumeCamera } from '../services/apiEndpoints';
import { updateCameraStatus } from '../store/slices/cameraSlice';
import { cameraTitle } from '../utils/camera';
import { formatDateTime, formatTime } from '../utils/format';

export const PAUSE_OPTIONS = [
  { label: 'Pause for 15 minutes', minutes: 15 },
  { label: 'Pause for 1 hour', minutes: 60 },
  { label: 'Pause for 4 hours', minutes: 240 },
  { label: 'Pause until I resume', minutes: null },
];

/** "Back live at 4:30 PM" / "Paused until resumed" for a paused camera. */
export const pausedLabel = (camera) => {
  if (!camera?.pausedUntil) return 'Paused until resumed';
  const until = new Date(camera.pausedUntil);
  const sameDay = until.toDateString() === new Date().toDateString();
  return `Back live at ${sameDay ? formatTime(until) : formatDateTime(until)}`;
};

/** Pause / resume calls for one camera; the store is updated from the response (the socket event follows). */
export function useCameraPause(camera) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);

  const run = async (request, message) => {
    setBusy(true);
    try {
      const { data } = await request();
      dispatch(updateCameraStatus({ cameraId: data.data._id, status: data.data.status, pausedUntil: data.data.pausedUntil || null }));
      toast.success(message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not change the camera');
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    pause: (minutes) => run(() => pauseCamera(camera._id, minutes), `${cameraTitle(camera)} paused`),
    resume: () => run(() => resumeCamera(camera._id), `${cameraTitle(camera)} is going live`),
  };
}
