import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Menu } from 'lucide-react';
import CustomerProfileMenu from './CustomerProfileMenu';

const PAGE_TITLES = {
  '/customer/dashboard': {
    title: 'Dashboard',
    subtitle: 'Your account overview',
  },
  '/customer/plans': {
    title: 'Plans',
    subtitle: 'Browse subscription plans',
  },
  '/customer/subscribe': {
    title: 'Subscribe',
    subtitle: 'Complete your purchase',
  },
  '/customer/subscription': {
    title: 'My Subscription',
    subtitle: 'Plan and billing details',
  },
  '/customer/profile': {
    title: 'Your Profile',
    subtitle: 'View your account details',
  },
  '/customer/profile/edit': {
    title: 'Edit Profile',
    subtitle: 'Update your personal information',
  },
  '/customer/settings': {
    title: 'Settings',
    subtitle: 'Manage your account preferences',
  },
  '/customer/help': {
    title: 'Help & FAQ',
    subtitle: 'Answers and support',
  },
  '/customer/help/contact': {
    title: 'Contact Support',
    subtitle: 'Send us a message',
  },
};

const getPageMeta = (pathname) => {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  if (pathname.startsWith('/customer/subscribe/')) {
    return PAGE_TITLES['/customer/subscribe'];
  }

  return {
    title: 'Account Portal',
    subtitle: 'Manage your FireGuard AI account',
  };
};

const CustomerHeader = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { title, subtitle } = getPageMeta(pathname);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden mt-0.5 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {user && (
          <div className="flex-shrink-0">
            <CustomerProfileMenu user={user} />
          </div>
        )}
      </div>
    </header>
  );
};

export default CustomerHeader;
