import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Mail, Phone, Calendar, Edit2, Shield, LayoutDashboard } from "lucide-react";
import { getUser } from "../../services/apiEndpoints";
import ProfileHero from "../../components/profile/ProfileHero";
import { isPortalUser } from "../../utils/roleRoutes";

const ProfileViewPage = () => {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useSelector((state) => state.auth);
  const userId = authUser?._id || authUser?.id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(authUser?.role)) {
      navigate("/login", { replace: true });
      return;
    }

    if (!userId) return;

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await getUser(userId);
        if (isMounted) {
          setProfile(response.data.data);
        }
      } catch {
        if (isMounted) {
          setProfile(authUser);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser, isAuthenticated, navigate, userId]);

  const displayProfile = profile || authUser;
  const isOrgAdmin = authUser?.role === "org_admin";

  const infoItems = [
    {
      icon: Mail,
      label: "Email",
      value: displayProfile?.email || "—",
    },
    {
      icon: Phone,
      label: "Phone",
      value: displayProfile?.phone || "Not provided",
    },
    {
      icon: Shield,
      label: "Account Status",
      value: displayProfile?.isActive === false ? "Inactive" : "Active",
    },
    {
      icon: Calendar,
      label: "Member Since",
      value: displayProfile?.createdAt
        ? new Date(displayProfile.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—",
    },
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="card overflow-hidden p-0 animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700" />
          <div className="px-6 pb-6 -mt-12">
            <div className="h-32 w-32 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mt-4" />
          </div>
        </div>
        <div className="card animate-pulse h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ProfileHero
        name={displayProfile?.name}
        email={displayProfile?.email}
        avatar={displayProfile?.avatar}
        role={displayProfile?.role || authUser?.role}
        actions={
          <>
            <Link
              to="/customer/profile/edit"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Edit2 size={16} />
              Edit Profile
            </Link>
            {isOrgAdmin && (
              <Link
                to="/orgadmin/dashboard"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2"
              >
                <LayoutDashboard size={16} />
                Org Dashboard
              </Link>
            )}
          </>
        }
      />

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60"
            >
              <Icon className="text-primary-600 mt-0.5 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white break-words mt-0.5">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileViewPage;
