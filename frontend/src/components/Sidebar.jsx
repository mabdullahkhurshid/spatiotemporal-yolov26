import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { 
  LayoutDashboard, 
  Building2, 
  Camera, 
  AlertTriangle, 
  Users, 
  FileText, 
  ShoppingCart,
  Package,
  CreditCard,
  UserCog,
  LogOut,
  X,
  UserCircle,
} from 'lucide-react';
import { useState } from 'react';

const Sidebar = ({ role, isOpen, setIsOpen }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
  };

  const basePath = role === 'super_admin' ? '/superadmin' : role === 'org_admin' ? '/orgadmin' : '/operator';

  const superAdminLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/organizations', label: 'Organizations', icon: Building2 },
    { path: '/subscription-plans', label: 'Subscription Plans', icon: Package },
    { path: '/users', label: 'Users', icon: UserCog },
    { path: '/orders', label: 'Orders', icon: ShoppingCart },
    { path: '/alerts', label: 'All Alerts', icon: AlertTriangle },
  ];

  const orgAdminLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/cameras', label: 'Cameras', icon: Camera },
    { path: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { path: '/operators', label: 'Operators', icon: Users },
    { path: '/subscription', label: 'Subscription', icon: CreditCard },
    { path: '/reports', label: 'Reports', icon: FileText },
  ];

  const operatorLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/cameras', label: 'Live Cameras', icon: Camera },
    { path: '/alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  const links = role === 'super_admin' ? superAdminLinks : role === 'org_admin' ? orgAdminLinks : operatorLinks;

  return (
    <>
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-800 dark:bg-gray-900 text-white transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-primary-500">🔥 Fire Detection</h1>
              <p className="text-sm text-gray-400 mt-1">AI Monitoring System</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {role === 'org_admin' && (
              <NavLink
                to="/customer/dashboard"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
                onClick={() => setIsOpen(false)}
              >
                <UserCircle size={20} />
                <span>Account</span>
              </NavLink>
            )}

            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={`${basePath}${link.path}`}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                >
                  <Icon size={20} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-gray-700">
            <div className="mb-4">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary-600 rounded">
                {role === 'super_admin' ? 'Super Admin' : role === 'org_admin' ? 'Org Admin' : 'Operator'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
