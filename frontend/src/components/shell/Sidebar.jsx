import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import Logo from '../ui/Logo';
import IconButton from '../ui/IconButton';
import { NAV, isNavItemActive } from './navConfig';
import { enableMarketingView } from '../../utils/roleRoutes';

const orgNameOf = (user) =>
  (user?.organizationId && typeof user.organizationId === 'object' && user.organizationId.name) || user?.organizationName || null;

const NavItem = ({ item, active, activeAlerts, onNavigate }) => {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
          active ? 'bg-sidebar-hover text-sidebar-fg' : 'text-sidebar-muted hover:bg-sidebar-hover/70 hover:text-sidebar-fg'
        )}
      >
        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-400" aria-hidden="true" />}
        <Icon size={17} aria-hidden="true" className={active ? 'text-brand-300' : 'text-sidebar-muted group-hover:text-sidebar-fg'} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.alerts && activeAlerts > 0 && (
          <span className="tabular rounded-full bg-critical px-1.5 py-px text-2xs font-semibold text-white" aria-label={`${activeAlerts} active alerts`}>
            {activeAlerts > 99 ? '99+' : activeAlerts}
          </span>
        )}
      </Link>
    </li>
  );
};

const Sidebar = ({ user, open, onClose, activeAlerts }) => {
  const { pathname } = useLocation();
  const groups = NAV[user?.role] || [];
  const orgName = orgNameOf(user);

  // Close the drawer with Escape on small screens.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col bg-sidebar text-sidebar-fg transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0',
          open ? 'translate-x-0 shadow-overlay' : '-translate-x-full'
        )}
        aria-label="Primary"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
          <Link to={NAV[user?.role]?.[0]?.items?.[0]?.to || '/'} onClick={onClose} className="rounded-md">
            <Logo tone="light" />
          </Link>
          <IconButton icon={X} label="Close navigation" variant="sidebar" size="sm" onClick={onClose} className="lg:hidden" />
        </div>

        {orgName && (
          <div className="mx-3 mb-2 rounded-md border border-sidebar-line px-3 py-2.5">
            <p className="text-xs text-sidebar-muted">Organization</p>
            <p className="mt-0.5 truncate text-sm font-medium text-sidebar-fg" title={orgName}>
              {orgName}
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.label} className="mt-6 first:mt-2">
              <p className="mb-2 px-3 text-xs font-medium text-sidebar-muted">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to} item={item} active={isNavItemActive(item, pathname)} activeAlerts={activeAlerts} onNavigate={onClose} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-line px-3 py-3">
          <Link
            to="/"
            onClick={() => {
              enableMarketingView();
              onClose();
            }}
            className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-hover/70 hover:text-sidebar-fg"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Product website
          </Link>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 animate-fade-in bg-[rgb(8_12_20/0.5)] lg:hidden" aria-hidden="true" onClick={onClose} />}
    </>
  );
};

export default Sidebar;
