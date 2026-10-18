/* Status vocabulary shared by badges, filters and labels. */
// One status language for the whole product.
export const STATUS = {
  alert: {
    active: { tone: 'critical', label: 'Active', dot: true, pulse: true },
    acknowledged: { tone: 'warning', label: 'Acknowledged', dot: true },
    resolved: { tone: 'success', label: 'Resolved', dot: true },
    false_alarm: { tone: 'neutral', label: 'False alarm', dot: true },
  },
  severity: {
    critical: { tone: 'critical-solid', label: 'Critical' },
    high: { tone: 'critical', label: 'High' },
    medium: { tone: 'warning', label: 'Medium' },
    low: { tone: 'neutral', label: 'Low' },
  },
  camera: {
    online: { tone: 'success', label: 'Online', dot: true },
    offline: { tone: 'neutral', label: 'Offline', dot: true },
    maintenance: { tone: 'warning', label: 'Maintenance', dot: true },
  },
  org: {
    active: { tone: 'success', label: 'Active', dot: true },
    pending: { tone: 'warning', label: 'Pending', dot: true },
    suspended: { tone: 'critical', label: 'Suspended', dot: true },
    rejected: { tone: 'neutral', label: 'Rejected', dot: true },
  },
  subscription: {
    active: { tone: 'success', label: 'Active', dot: true },
    expired: { tone: 'critical', label: 'Expired', dot: true },
    cancelled: { tone: 'neutral', label: 'Cancelled', dot: true },
    pending: { tone: 'warning', label: 'Pending', dot: true },
  },
  order: {
    approved: { tone: 'success', label: 'Approved' },
    pending: { tone: 'warning', label: 'Pending' },
    rejected: { tone: 'critical', label: 'Rejected' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
  },
  incident: {
    active: { tone: 'critical', label: 'Ongoing', dot: true, pulse: true },
    ended: { tone: 'neutral', label: 'Ended', dot: true },
  },
  user: {
    active: { tone: 'success', label: 'Active', dot: true },
    suspended: { tone: 'neutral', label: 'Deactivated', dot: true },
  },
  plan: {
    active: { tone: 'success', label: 'Active', dot: true },
    inactive: { tone: 'neutral', label: 'Inactive', dot: true },
  },
};

const humanize = (value) =>
  String(value || 'unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export const statusMeta = (kind, value) =>
  STATUS[kind]?.[String(value || "").toLowerCase()] || { tone: "neutral", label: humanize(value) };

export const statusLabel = (kind, value) => STATUS[kind]?.[String(value || '').toLowerCase()]?.label || humanize(value);
