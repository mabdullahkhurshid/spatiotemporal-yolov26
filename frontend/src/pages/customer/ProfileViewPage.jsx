import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, Pencil } from 'lucide-react';
import { getUser } from '../../services/apiEndpoints';
import ProfileHero from '../../components/profile/ProfileHero';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Feedback';
import { isPortalUser } from '../../utils/roleRoutes';
import { roleLabel } from '../../utils/accountFormatting';
import { formatDate } from '../../utils/format';

const Row = ({ label, children }) => (
  <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[12rem_1fr] sm:gap-4 sm:px-5">
    <dt className="text-sm text-fg-muted">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-fg">{children}</dd>
  </div>
);

const ProfileViewPage = () => {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useSelector((state) => state.auth);
  const userId = authUser?._id || authUser?.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(authUser?.role)) {
      navigate('/login', { replace: true });
      return undefined;
    }
    if (!userId) return undefined;
    let isMounted = true;
    getUser(userId)
      .then((response) => isMounted && setProfile(response.data.data))
      .catch(() => isMounted && setProfile(authUser))
      .finally(() => isMounted && setLoading(false));
    return () => {
      isMounted = false;
    };
  }, [authUser, isAuthenticated, navigate, userId]);

  const p = profile || authUser;
  const orgName = (typeof p?.organizationId === 'object' && p.organizationId?.name) || authUser?.organizationName;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="How you appear to your team and in alert history." className="mb-0" />

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
          <ProfileHero
            name={p?.name}
            email={p?.email}
            avatar={p?.avatar}
            role={p?.role || authUser?.role}
            actions={
              <Button as={Link} to="/customer/profile/edit" variant="secondary" icon={Pencil}>
                Edit profile
              </Button>
            }
          />

          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line">
              <Row label="Full name">{p?.name || '—'}</Row>
              <Row label="Email">{p?.email || '—'}</Row>
              <Row label="Phone">{p?.phone || <span className="text-fg-subtle">Not provided</span>}</Row>
              <Row label="Role">{roleLabel(p?.role)}</Row>
              {orgName && <Row label="Organization">{orgName}</Row>}
              <Row label="Account status">
                <StatusBadge kind="user" value={p?.isActive === false ? 'suspended' : 'active'} />
              </Row>
              <Row label="Member since">{formatDate(p?.createdAt)}</Row>
            </dl>
          </Card>

          {authUser?.role === 'org_admin' && (
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-fg-muted">Manage cameras, operators and alerts for {orgName || 'your organization'}.</p>
              <Button as={Link} to="/orgadmin/dashboard" variant="secondary" iconRight={ArrowRight}>
                Open monitoring
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ProfileViewPage;
