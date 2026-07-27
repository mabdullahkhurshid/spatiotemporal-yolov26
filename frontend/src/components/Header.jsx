import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, Moon, Sun, UserCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchNotifications, markAsRead } from '../store/slices/notificationSlice';
import {
  applyDarkMode,
  getInitialDarkMode,
  setTheme,
  subscribeToThemeChanges,
} from '../utils/theme';

const Header = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { notifications, unreadCount } = useSelector((state) => state.notifications);
  const isOrgAdmin = user?.role === 'org_admin';
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  useEffect(() => {
    applyDarkMode(darkMode);
  }, [darkMode]);

  useEffect(() => subscribeToThemeChanges(setDarkMode), []);

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;
      setTheme(next);
      return next;
    });
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      dispatch(markAsRead(notification._id));
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Fire Detection System
          </h2>
        </div>

        <div className="flex items-center space-x-4">
          {isOrgAdmin && (
            <Link
              to="/customer/dashboard"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <UserCircle size={18} />
              <span className="hidden sm:inline">Account</span>
            </Link>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No notifications</div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
