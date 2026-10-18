export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
export const STATUS_RANK = { active: 2, acknowledged: 1 };

export const RESOLUTION_OPTIONS = [
  { value: 'EXTINGUISHED', label: 'Fire extinguished', hint: 'The fire was put out on site.' },
  { value: 'EVACUATED', label: 'Area evacuated', hint: 'People were moved to safety; follow-up pending.' },
  { value: 'TEST_DRILL', label: 'Test or drill', hint: 'Planned exercise or system test.' },
  { value: 'OTHER', label: 'Other', hint: 'Describe what happened in the note.' },
];

export const RESOLUTION_LABEL = Object.fromEntries(RESOLUTION_OPTIONS.map((o) => [o.value, o.label]).concat([['FALSE_ALARM', 'False alarm']]));

export const cameraOf = (alert) => (alert?.cameraId && typeof alert.cameraId === 'object' ? alert.cameraId : null);

export const cameraName = (alert) => {
  const cam = cameraOf(alert);
  return cam?.name || cam?.label || 'Unknown camera';
};

export const cameraLocation = (alert) => cameraOf(alert)?.location || '';

export const orgName = (alert) =>
  alert?.organizationId && typeof alert.organizationId === 'object' ? alert.organizationId.name : '';

export const isOpen = (alert) => alert?.status === 'active' || alert?.status === 'acknowledged';

/** Open alerts first (active before acknowledged), then by severity, then newest. */
export const compareByUrgency = (a, b) =>
  (STATUS_RANK[b.status] || 0) - (STATUS_RANK[a.status] || 0) ||
  (SEVERITY_RANK[b.intensityLevel] || 0) - (SEVERITY_RANK[a.intensityLevel] || 0) ||
  new Date(b.timestamp) - new Date(a.timestamp);

export const compareByNewest = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);

export const PERIODS = [
  { value: '24h', label: 'Last 24 hours', ms: 24 * 3600 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 3600 * 1000 },
  { value: '30d', label: 'Last 30 days', ms: 30 * 24 * 3600 * 1000 },
  { value: 'all', label: 'All time', ms: null },
];
