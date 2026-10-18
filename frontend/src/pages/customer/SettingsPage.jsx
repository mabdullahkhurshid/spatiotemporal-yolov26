import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { KeyRound, LogOut, Monitor, Moon, Pencil, Sun } from 'lucide-react';
import { getMe, logoutAllDevices } from '../../store/slices/authSlice';
import { isPortalUser } from '../../utils/roleRoutes';
import { getThemePreference, setThemePreference, subscribeToThemeChanges } from '../../utils/theme';
import { roleLabel } from '../../utils/accountFormatting';
import { SettingsPageSkeleton } from '../../components/ui/PortalSkeletons';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { Notice } from '../../components/ui/Feedback';
import { useConfirm } from '../../components/ui/confirmContext';
import { cn } from '../../utils/cn';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const Row = ({ title, description, children }) => (
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div className="min-w-0">
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useSelector((state) => state.auth);
  const [theme, setThemeState] = useState(getThemePreference);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isPortalUser(user?.role)) {
      dispatch(getMe())
        .unwrap()
        .catch(() => {
          // keep the cached profile if the refresh fails
        })
        .finally(() => isMounted && setLoadingProfile(false));
    } else {
      setLoadingProfile(false);
    }
    return () => {
      isMounted = false;
    };
  }, [dispatch, user?.role]);

  // Keep the selector in sync when the theme is toggled from the top bar.
  useEffect(() => subscribeToThemeChanges(() => setThemeState(getThemePreference())), []);

  const chooseTheme = (value) => {
    setThemePreference(value);
    setThemeState(value);
  };

  const handleSignOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Sign out of all devices?',
      description: 'Every browser and device signed in to your account, including this one, will need to sign in again.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (!ok) return;
    setSigningOutAll(true);
    try {
      await dispatch(logoutAllDevices()).unwrap();
      toast.success('Signed out of all devices');
      navigate('/login');
    } catch (error) {
      toast.error(error || 'Could not sign out other devices');
      setSigningOutAll(false);
    }
  };

  if (loadingProfile) return <SettingsPageSkeleton />;
  const needsPasswordSetup = Boolean(user?.needsPasswordSetup);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account, security and appearance preferences." className="mb-0" />

      <Card>
        <CardHeader title="Account" />
        <div className="divide-y divide-line">
          <Row title="Email" description={user?.email} />
          <Row title="Role" description={roleLabel(user?.role)} />
          <Row title="Profile" description="Name, phone number and photo.">
            <Button as={Link} to="/customer/profile/edit" variant="secondary" size="sm" icon={Pencil}>
              Edit profile
            </Button>
          </Row>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sign-in & security" />
        <div className="divide-y divide-line">
          {needsPasswordSetup ? (
            <div className="px-4 py-4 sm:px-5">
              <Notice
                tone="warning"
                title="No password set"
                action={
                  <Button as={Link} to="/auth/set-password" size="sm">
                    Set password
                  </Button>
                }
              >
                You sign in with Google. Set a password to also sign in with your email.
              </Notice>
            </div>
          ) : (
            <Row title="Password" description="We'll email you a secure link to choose a new password.">
              <Button as={Link} to="/forgot-password" variant="secondary" size="sm" icon={KeyRound}>
                Change password
              </Button>
            </Row>
          )}
          <Row title="Active sessions" description="You stay signed in separately on each device. Sign out everywhere if a device is lost or shared.">
            <Button variant="danger-ghost" size="sm" icon={LogOut} loading={signingOutAll} onClick={handleSignOutEverywhere}>
              Sign out of all devices
            </Button>
          </Row>
        </div>
      </Card>

      <Card>
        <CardHeader title="Appearance" />
        <CardBody>
          <fieldset>
            <legend className="mb-3 text-sm text-fg-muted">Theme</legend>
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors',
                    theme === value ? 'border-brand-500 bg-info-soft text-fg' : 'border-line-strong text-fg-muted hover:bg-surface-2'
                  )}
                >
                  <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => chooseTheme(value)} className="sr-only" />
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-fg-subtle">System follows your device&apos;s light or dark setting.</p>
          </fieldset>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsPage;
