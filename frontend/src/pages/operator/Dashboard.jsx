import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlerts } from '../../store/slices/alertSlice';
import { fetchCameras } from '../../store/slices/cameraSlice';
import { getMe } from '../../store/slices/authSlice';
import { Camera, AlertTriangle, Activity, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import CameraGrid from '../../components/cameras/CameraGrid';
import CameraFullscreenModal from '../../components/cameras/CameraFullscreenModal';
import { findCameraById, isCameraOnline } from '../../utils/camera';

const getOrganizationName = (user) => {
  if (!user) return null;
  if (typeof user.organizationId === 'object' && user.organizationId?.name) {
    return user.organizationId.name;
  }
  return user.organizationName || null;
};

const OperatorDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { cameras } = useSelector((state) => state.cameras);
  const { alerts } = useSelector((state) => state.alerts);
  const [fullscreenCameraId, setFullscreenCameraId] = useState(null);
  const fullscreenCamera = findCameraById(cameras, fullscreenCameraId);

  useEffect(() => {
    dispatch(fetchCameras());
    dispatch(fetchAlerts({ limit: 10 }));
  }, [dispatch]);

  useEffect(() => {
    if (!getOrganizationName(user)) {
      dispatch(getMe());
    }
  }, [dispatch, user]);

  const onlineCameras = cameras.filter((c) => isCameraOnline(c.status)).length;
  const activeAlerts = alerts.filter((a) => a.status === 'active').length;
  const organizationName = getOrganizationName(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Operator Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome, {user?.name || 'Operator'}. Monitor live cameras and alerts
          {organizationName ? ` for ${organizationName}` : ''}.
        </p>
      </div>

      <div className="card border-l-4 border-indigo-600">
        <div className="flex items-start gap-4">
          <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-lg">
            <Building2 className="text-indigo-600 dark:text-indigo-400" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Your role</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">Operator</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Organization:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {organizationName || 'Loading organization...'}
              </span>
            </p>
          </div>
        </div>
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

      {/* Assigned cameras preview */}
      {cameras.length > 0 ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Cameras</h2>
            {cameras.length > 4 && (
              <Link
                to="/operator/cameras"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View all →
              </Link>
            )}
          </div>
          <CameraGrid
            cameras={cameras.slice(0, 4)}
            loading={false}
            compact
            columnsClassName="grid-cols-2 sm:grid-cols-4"
            onOpenCamera={(camera) => setFullscreenCameraId(camera._id)}
          />
          {cameras.length <= 4 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/operator/cameras"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Open live cameras →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <Camera className="text-gray-400" size={24} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No cameras assigned</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Ask your organization admin to assign cameras so you can monitor live streams here.
          </p>
        </div>
      )}

      <CameraFullscreenModal
        camera={fullscreenCamera}
        open={Boolean(fullscreenCameraId && fullscreenCamera)}
        onClose={() => setFullscreenCameraId(null)}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/operator/cameras" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
              <Camera className="text-blue-600 dark:text-blue-400" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">View Live Cameras</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monitor assigned cameras in real-time</p>
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
