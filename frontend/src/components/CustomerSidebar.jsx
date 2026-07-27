import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  CreditCard,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { enableMarketingView } from '../utils/roleRoutes';

const NAV_LINKS = [
  { path: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/customer/plans', label: 'Plans', icon: Package, end: true },
  { path: '/customer/subscription', label: 'My Subscription', icon: CreditCard, end: true },
  { path: '/customer/help', label: 'Help', icon: HelpCircle, end: true },
];

const CustomerSidebar = ({ isOpen, setIsOpen }) => {
  return (
    <>
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">
                🔥
              </span>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">FireGuard AI</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Account Portal</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1" aria-label="Portal navigation">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-amber-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <NavLink
              to="/"
              onClick={() => {
                enableMarketingView();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>Marketing site</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {isOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          aria-label="Close menu overlay"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default CustomerSidebar;
