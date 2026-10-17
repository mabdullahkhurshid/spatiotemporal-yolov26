import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlerts, fetchAlertStats } from '../../store/slices/alertSlice';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { getIncidents } from '../../services/apiEndpoints';
import { isCameraOnline } from '../../utils/camera';
import { Camera, AlertTriangle, Activity, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const OrgAdminDashboard = () => {
  const dispatch = useDispatch();
  const { stats } = useSelector((state) => state.alerts);
  const { cameras } = useSelector((state) => state.cameras);
  const { alerts } = useSelector((state) => state.alerts);
  const [activeIncidents, setActiveIncidents] = useState([]);

  useEffect(() => {
    dispatch(fetchAlertStats());
    dispatch(fetchCameras());
    dispatch(fetchAlerts({ limit: 10 }));
    getIncidents({ status: 'active', limit: 20 })
      .then((res) => setActiveIncidents(res.data.data || []))
      .catch(() => setActiveIncidents([]));
  }, [dispatch]);

  const onlineCameras = cameras.filter((c) => isCameraOnline(c.status)).length;
  const activeAlerts = alerts.filter((a) => a.status === 'active').length;

  const statCards = [
    {
      title: 'Total Cameras',
      value: cameras.length,
      icon: Camera,
      color: 'bg-blue-500',
    },
    {
      title: 'Online Cameras',
      value: onlineCameras,
      icon: Activity,
      color: 'bg-green-500',
    },
    {
      title: 'Active Alerts',
      value: activeAlerts,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
    {
      title: 'Total Alerts',
      value: alerts.length,
      icon: AlertTriangle,
      color: 'bg-primary-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organization Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Monitor your organization's fire detection system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeIncidents.length > 0 && (
        <div className="card border border-red-200 dark:border-red-900/50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Flame className="text-red-500" size={22} />
            Active fire/smoke incidents
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">Camera ID</th>
                  <th className="text-left py-3 px-4">Camera</th>
                  <th className="text-left py-3 px-4">Started</th>
                  <th className="text-left py-3 px-4">Freq / min</th>
                  <th className="text-left py-3 px-4">Spread est.</th>
                </tr>
              </thead>
              <tbody>
                {activeIncidents.map((inc) => (
                  <tr key={inc._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 text-xs font-mono">{inc.cameraId?._id || inc.cameraId}</td>
                    <td className="py-3 px-4">
                      {inc.cameraId?.displayNumber || inc.cameraId?.label || 'Camera'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {inc.startedAt ? new Date(inc.startedAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4">{Number(inc.detectionFrequencyPerMin || 0).toFixed(0)}</td>
                    <td className="py-3 px-4">{Number(inc.estimatedSpreadRate || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Alerts</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4">Camera</th>
                <th className="text-left py-3 px-4">Fire Confidence</th>
                <th className="text-left py-3 px-4">Intensity</th>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 5).map((alert) => (
                <tr key={alert._id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4">{alert.cameraId?.label || 'N/A'}</td>
                  <td className="py-3 px-4">{alert.fireConfidence}%</td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4">{new Date(alert.timestamp).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        alert.status === 'active'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : alert.status === 'resolved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrgAdminDashboard;
