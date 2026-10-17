import { useSelector } from 'react-redux';

const emptyMetrics = {
  fireConfidence: 0,
  smokeConfidence: 0,
  detectionFrequencyPerMin: 0,
  estimatedSpreadRate: 0,
  incidentStartedAt: null,
  activeIncidentId: null,
};

export function useLiveDetection(cameraId, enabled) {
  const live = useSelector((state) =>
    enabled && cameraId ? state.cameras.liveDetectionById[String(cameraId)] : null
  );

  return {
    detections: live?.detections || [],
    metrics: live?.metrics ? { ...emptyMetrics, ...live.metrics } : emptyMetrics,
    lastUpdated: live?.timestamp || null,
  };
}
