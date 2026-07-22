import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlerts, fetchAlertStats } from '../../store/slices/alertSlice';
import { Building2, AlertTriangle, ShoppingCart, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import { useState } from 'react';

const SuperAdminDashboard = () => {
  const dispatch = useDispatch();
  const { stats } = useSelector((state) => state.alerts);
  const [dashboardStats, setDashboardStats] = useState({
    organizations: 0,
    orders: 0,
    totalAlerts: 0,
    activeAlerts: 0,
  });

  useEffect(() => {
    dispatch(fetchAlertStats());
    loadDashboardData();
  }, [dispatch]);

  const loadDashboardData = async () => {
    try {
      const [orgsRes, ordersRes, alertsRes] = await Promise.all([
        api.get('/organizations'),
        api.get('/orders'),
        api.get('/alerts'),
      ]);

      setDashboardStats({
        organizations: orgsRes.data.count || 0,
        orders: ordersRes.data.count || 0,
        totalAlerts: alertsRes.data.count || 0,
        activeAlerts: alertsRes.data.data?.filter((a) => a.status === 'active').length || 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const statCards = [
    {
      title: 'Organizations',
      value: dashboardStats.organizations,
      icon: Building2,
      color: 'bg-blue-500',
    },
    {
      title: 'Pending Orders',
      value: dashboardStats.orders,
      icon: ShoppingCart,
      color: 'bg-yellow-500',
    },
    {
      title: 'Total Alerts',
      value: dashboardStats.totalAlerts,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
    {
      title: 'Active Alerts',
      value: dashboardStats.activeAlerts,
      icon: AlertTriangle,
      color: 'bg-primary-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">System overview and analytics</p>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Alert Statistics</h2>
          {stats && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Active', value: stats.active || 0 },
                { name: 'Resolved', value: stats.resolved || 0 },
                { name: 'False Alarms', value: stats.falseAlarms || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">System Overview</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">Average Fire Confidence</span>
              <span className="text-2xl font-bold text-primary-600">
                {stats?.avgFireConfidence?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">Average Smoke Confidence</span>
              <span className="text-2xl font-bold text-primary-600">
                {stats?.avgSmokeConfidence?.toFixed(1) || 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
