import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Moon, Sun, Lock, Mail, User, ExternalLink } from 'lucide-react';
import { getMe } from '../../store/slices/authSlice';
import { isPortalUser } from '../../utils/roleRoutes';
import {
  applyDarkMode,
  getInitialDarkMode,
  setTheme,
  subscribeToThemeChanges,
} from '../../utils/theme';
import { SettingsPageSkeleton } from '../../components/ui/PortalSkeletons';

const SettingsPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const refreshUser = async () => {
      try {
        await dispatch(getMe()).unwrap();
      } catch {
        // Keep cached user if refresh fails
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    if (isPortalUser(user?.role)) {
      refreshUser();
    } else {
      setLoadingProfile(false);
    }

    return () => {
      isMounted = false;
    };
  }, [dispatch, user?.role]);

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

  const needsPasswordSetup = Boolean(user?.needsPasswordSetup);
  const roleLabel =
    user?.role === 'org_admin'
      ? 'Organization Admin'
      : user?.role === 'customer'
        ? 'Customer'
        : user?.role?.replace('_', ' ') || 'Account';

  if (loadingProfile) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <User size={20} className="text-primary-600" />
          Account
        </h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
            <Mail size={18} className="text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                {user?.email || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
            <User size={18} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{roleLabel}</p>
            </div>
          </div>
        </div>

        <Link
          to="/customer/profile/edit"
          className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-amber-400 hover:underline"
        >
          Edit profile
          <ExternalLink size={14} />
        </Link>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Lock size={20} className="text-primary-600" />
          Password
        </h2>

        {needsPasswordSetup ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You signed in with Google. Set a password if you also want to sign in with email and
              password.
            </p>
            <Link to="/auth/set-password" className="btn-primary inline-flex mt-3 text-sm">
              Set Password
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              To change your password, use the forgot-password flow. A reset link will be sent to
              your email.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Reset Password
            </Link>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {darkMode ? (
            <Moon size={20} className="text-primary-600" />
          ) : (
            <Sun size={20} className="text-primary-600" />
          )}
          Appearance
        </h2>

        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Dark mode</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Toggle between light and dark theme
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            role="switch"
            aria-checked={darkMode}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
              darkMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
