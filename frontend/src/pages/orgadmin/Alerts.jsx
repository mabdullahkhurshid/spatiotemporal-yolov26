import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { acknowledgeAlert, fetchAlerts, markFalseAlarm, resolveAlert } from '../../store/slices/alertSlice';

const OrgAdminAlerts = () => {
  const dispatch = useDispatch();
  const { alerts, loading } = useSelector((state) => state.alerts);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    dispatch(fetchAlerts({ limit: 100 }));
  }, [dispatch]);

  const filteredAlerts =
    statusFilter === 'all' ? alerts : alerts.filter((a) => a.status === statusFilter);

  const handleAcknowledge = (id) => {
    dispatch(acknowledgeAlert({ id }));
  };

  const handleResolve = (id) => {
    dispatch(resolveAlert({ id }));
  };

  const handleFalseAlarm = (id) => {
    dispatch(markFalseAlarm({ id }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View and manage fire/smoke alerts for your organization.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="false_alarm">False Alarm</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading alerts...</p>
          ) : filteredAlerts.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No alerts found.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">Camera</th>
                  <th className="text-left py-3 px-4">Fire %</th>
                  <th className="text-left py-3 px-4">Smoke %</th>
                  <th className="text-left py-3 px-4">Intensity</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 text-sm">{alert.cameraId?.label || 'Unknown Camera'}</td>
                    <td className="py-3 px-4 text-sm">{alert.fireConfidence}%</td>
                    <td className="py-3 px-4 text-sm">{alert.smokeConfidence}%</td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          alert.intensityLevel === 'critical'
                            ? 'bg-red-600 text-white'
                            : alert.intensityLevel === 'high'
                            ? 'bg-orange-500 text-white'
                            : 'bg-yellow-500 text-white'
                        }`}
                      >
                        {alert.intensityLevel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm capitalize">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          alert.status === 'active'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : alert.status === 'resolved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : alert.status === 'acknowledged'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {alert.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}
                    </td>
                    <td className="py-3 px-4 text-xs space-x-2">
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledge(alert._id)}
                          className="px-2 py-1 rounded bg-yellow-500 text-white text-xs"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolve(alert._id)}
                          className="px-2 py-1 rounded bg-green-600 text-white text-xs"
                        >
                          Resolve
                        </button>
                      )}
                      {alert.status !== 'false_alarm' && (
                        <button
                          onClick={() => handleFalseAlarm(alert._id)}
                          className="px-2 py-1 rounded bg-gray-600 text-white text-xs"
                        >
                          False Alarm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgAdminAlerts;
