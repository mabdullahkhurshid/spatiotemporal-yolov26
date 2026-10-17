import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import { socketService } from '../services/socketService';
import {
  ChevronDown,
  LogOut,
  HelpCircle,
  Eye,
  Edit2,
  ShoppingCart,
  LayoutDashboard,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useRenewalEligibility } from '../hooks/useRenewalEligibility';

const MenuItem = ({ icon: Icon, label, onClick, variant = 'default' }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
      variant === 'danger'
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    <Icon size={16} aria-hidden="true" />
    {label}
  </button>
);

const MenuDivider = () => (
  <hr className="my-1 border-gray-200 dark:border-gray-700" aria-hidden="true" />
);

const CustomerProfileMenu = ({ user, onPurchasePlan }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOrgAdmin = user?.role === 'org_admin';
  const isCustomer = user?.role === 'customer';
  const { canRenew } = useRenewalEligibility({ enabled: isOrgAdmin });

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    socketService.disconnect();
    dispatch(logout());
  };

  const goTo = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const displayName = user?.name || user?.email || 'Account';
  const initial =
    user?.name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';

  const roleLabel =
    user?.role === 'org_admin'
      ? 'Organization Admin'
      : user?.role === 'customer'
        ? 'Customer'
        : user?.role?.replace('_', ' ') || 'Account';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-1 pr-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white text-sm font-semibold"
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
        <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg z-50"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-amber-400">
              {roleLabel}
            </span>
          </div>

          <div className="py-1">
            <MenuItem icon={Eye} label="View Profile" onClick={() => goTo('/customer/profile')} />
            <MenuItem
              icon={Edit2}
              label="Edit Profile"
              onClick={() => goTo('/customer/profile/edit')}
            />
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => goTo('/customer/settings')}
            />
          </div>

          <MenuDivider />

          {isCustomer && (
            <MenuItem
              icon={ShoppingCart}
              label="Purchase Plan"
              onClick={() => {
                if (onPurchasePlan) {
                  setMenuOpen(false);
                  onPurchasePlan();
                  return;
                }
                goTo('/customer/subscribe');
              }}
            />
          )}

          {isOrgAdmin && canRenew && (
            <MenuItem
              icon={RefreshCw}
              label="Renew plan"
              onClick={() => goTo('/customer/plans')}
            />
          )}

          {isOrgAdmin && (
            <MenuItem
              icon={LayoutDashboard}
              label="Open Org Dashboard"
              onClick={() => goTo('/orgadmin/dashboard')}
            />
          )}

          <MenuItem icon={HelpCircle} label="Help" onClick={() => goTo('/customer/help')} />

          <MenuDivider />

          <MenuItem icon={LogOut} label="Logout" onClick={handleLogout} variant="danger" />
        </div>
      )}
    </div>
  );
};

export default CustomerProfileMenu;
