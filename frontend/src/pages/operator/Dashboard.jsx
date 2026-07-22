import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlerts } from '../../store/slices/alertSlice';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { Camera, AlertTriangle, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const OperatorDashboard = () => {
  const dispatch = useDispatch();
  const { cameras } = useSelector((state) => state.cameras);
  const { alerts } = useSelector((state) => state.alerts);

  useEffect(() => {
    dispatch(fetchCameras());
    dispatch(fetchAlerts({ limit: 10 }));
  }, [dispatch]);

  const onlineCameras = cameras.filter((c) => c.status === 'online').length;
  const activeAlerts = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Operator Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Monitor live cameras and alerts</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cameras</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{cameras.length}</p>
            </div>
            <div className="bg-blue-500 p-3 rounded-lg">
              <Camera className="text-white" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Online Cameras</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{onlineCameras}</p>
            </div>
            <div className="bg-green-500 p-3 rounded-lg">
              <Activity className="text-white" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Alerts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{activeAlerts}</p>
            </div>
            <div className="bg-red-500 p-3 rounded-lg">
              <AlertTriangle className="text-white" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts > 0 && (
        <div className="card border-l-4 border-red-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-600">🚨 Active Alerts</h2>
            <Link to="/operator/alerts" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {alerts
              .filter((a) => a.status === 'active')
              .slice(0, 5)
              .map((alert) => (
                <div
                  key={alert._id}
                  className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100">
                        {alert.cameraId?.label || 'Unknown Camera'}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Fire Confidence: {alert.fireConfidence}% | Smoke: {alert.smokeConfidence}%
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        alert.intensityLevel === 'critical'
                          ? 'bg-red-600 text-white'
                          : alert.intensityLevel === 'high'
                          ? 'bg-orange-500 text-white'
                          : 'bg-yellow-500 text-white'
                      }`}
                    >
                      {alert.intensityLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/operator/cameras" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
              <Camera className="text-blue-600 dark:text-blue-400" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">View Live Cameras</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monitor all cameras in real-time</p>
            </div>
          </div>
        </Link>

        <Link to="/operator/alerts" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">View All Alerts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Check alert history and status</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default OperatorDashboard;
