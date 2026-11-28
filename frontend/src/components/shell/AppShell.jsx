import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronRight, Menu as MenuIcon, Moon, Sun } from 'lucide-react';
import { fetchAlertStats } from '../../store/slices/alertSlice';
import { applyDarkMode, getInitialDarkMode, setTheme, subscribeToThemeChanges } from '../../utils/theme';
import IconButton from '../ui/IconButton';
import Sidebar from './Sidebar';
import UserMenu from './UserMenu';
import NotificationsMenu from './NotificationsMenu';
import { ALERTS_PATH, pageMetaFor } from './navConfig';

const MONITORING_ROLES = ['org_admin', 'operator', 'super_admin'];

const useDarkMode = () => {
  const [dark, setDark] = useState(getInitialDarkMode);
  useEffect(() => applyDarkMode(dark), [dark]);
  // setTheme broadcasts the change; this listener updates every subscriber, including this one.
  useEffect(() => subscribeToThemeChanges(setDark), []);
  const toggle = () => setTheme(!dark);
  return [dark, toggle];
};

/** Keeps the global "active alerts" count fresh: on mount and whenever socket events change the alert list. */
const useActiveAlertCount = (enabled) => {
  const dispatch = useDispatch();
  const liveAlerts = useSelector((state) => state.alerts.alerts);
  const active = useSelector((state) => state.alerts.stats?.active ?? 0);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(() => dispatch(fetchAlertStats()), 400);
    return () => clearTimeout(timer);
  }, [dispatch, enabled, liveAlerts]);
  return enabled ? active : 0;
};

const ActiveAlertsPill = ({ count, to }) =>
  count > 0 ? (
    <Link
      to={to}
      className="inline-flex h-8 items-center gap-2 rounded-full bg-critical px-3 text-xs font-semibold text-white shadow-xs transition-[filter] duration-150 hover:brightness-95"
    >
      <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" aria-hidden="true" />
      <span className="tabular">{count}</span>
      <span className="hidden sm:inline">active {count === 1 ? 'alert' : 'alerts'}</span>
      <span className="sr-only sm:hidden">active alerts</span>
    </Link>
  ) : null;

/** Shared layout for every signed-in role: sidebar, top bar and the routed page. */
const AppShell = () => {
  const { user } = useSelector((state) => state.auth);
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const monitoring = MONITORING_ROLES.includes(user?.role);
  const activeAlerts = useActiveAlertCount(monitoring);
  const meta = pageMetaFor(user?.role, pathname);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // Close the mobile drawer after navigation.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[80] rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-overlay focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <Sidebar user={user} open={navOpen} onClose={closeNav} activeAlerts={activeAlerts} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
            <IconButton icon={MenuIcon} label="Open navigation" variant="secondary" size="md" onClick={() => setNavOpen(true)} className="lg:hidden" />

            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                {meta.section && (
                  <li className="hidden items-center gap-1.5 text-fg-subtle sm:flex">
                    {meta.section}
                    <ChevronRight size={14} aria-hidden="true" />
                  </li>
                )}
                <li className="truncate font-medium text-fg" aria-current="page">
                  {meta.title}
                </li>
              </ol>
            </nav>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              {monitoring && <ActiveAlertsPill count={activeAlerts} to={ALERTS_PATH[user?.role]} />}
              <IconButton icon={dark ? Sun : Moon} label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleDark} />
              {monitoring && <NotificationsMenu />}
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
              <UserMenu user={user} />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
