import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CreditCard, HelpCircle, LogOut, RefreshCw, Settings, ShoppingCart, User } from 'lucide-react';
import { logout } from '../../store/slices/authSlice';
import { socketService } from '../../services/socketService';
import { useRenewalEligibility } from '../../hooks/useRenewalEligibility';
import { isPortalUser } from '../../utils/roleRoutes';
import Menu from '../ui/Menu';
import Avatar from '../ui/Avatar';
import { ROLE_LABEL } from './navConfig';

const UserMenu = ({ user }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const portal = isPortalUser(user?.role);
  const isOrgAdmin = user?.role === 'org_admin';
  const { canRenew } = useRenewalEligibility({ enabled: isOrgAdmin });

  const signOut = () => {
    socketService.disconnect();
    dispatch(logout());
  };

  const items = [
    portal && { label: 'Profile', icon: User, onClick: () => navigate('/customer/profile') },
    portal && { label: 'Settings', icon: Settings, onClick: () => navigate('/customer/settings') },
    portal && { label: 'Subscription', icon: CreditCard, onClick: () => navigate('/customer/subscription') },
    user?.role === 'customer' && { label: 'Purchase a plan', icon: ShoppingCart, onClick: () => navigate('/customer/plans') },
    isOrgAdmin && canRenew && { label: 'Renew plan', icon: RefreshCw, onClick: () => navigate('/customer/plans') },
    portal && { label: 'Help & support', icon: HelpCircle, onClick: () => navigate('/customer/help') },
    portal && { divider: true },
    { label: 'Sign out', icon: LogOut, tone: 'danger', onClick: signOut },
  ];

  return (
    <Menu
      width="w-64"
      items={items}
      header={
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} email={user?.email} src={user?.avatar} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{user?.name || 'Account'}</p>
            <p className="truncate text-xs text-fg-muted">{user?.email}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">{ROLE_LABEL[user?.role] || user?.role}</p>
          </div>
        </div>
      }
      trigger={(props, open) => (
        <button
          type="button"
          {...props}
          aria-label="Account menu"
          className="flex h-9 items-center gap-2 rounded-md pl-1 pr-1.5 transition-colors hover:bg-surface-2 sm:pr-2"
        >
          <Avatar name={user?.name} email={user?.email} src={user?.avatar} size="sm" className="h-7 w-7" />
          <span className="hidden max-w-[9rem] truncate text-sm font-medium text-fg md:inline">{user?.name}</span>
          <ChevronDown size={14} className={`hidden text-fg-subtle transition-transform md:inline ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    />
  );
};

export default UserMenu;
