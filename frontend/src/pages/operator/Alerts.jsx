import AlertsWorkspace from '../../components/alerts/AlertsWorkspace';

const OperatorAlerts = () => (
  <AlertsWorkspace title="Alerts" description="Detections from the cameras assigned to you. Acknowledge first, then resolve once handled." scope="assigned" />
);

export default OperatorAlerts;
