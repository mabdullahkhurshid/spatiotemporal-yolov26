import { Routes, Route, Navigate, useParams } from "react-router-dom";

import { useSelector, useDispatch } from "react-redux";

import { lazy, Suspense, useEffect, useState } from "react";

import { restoreSession } from "./store/slices/authSlice";
import { getAccessToken, purgeLegacyStoredTokens } from "./services/tokenStore";

import { socketService } from "./services/socketService";

// Eager: the most common first page, so it paints without waiting on a second chunk.
import LandingPage from "./pages/public/LandingPage";



// Auth pages

const Login = lazy(() => import("./pages/auth/Login"));

const Register = lazy(() => import("./pages/auth/Register"));

const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));

const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

const OAuthCallback = lazy(() => import("./pages/auth/OAuthCallback"));

const SetPassword = lazy(() => import("./pages/auth/SetPassword"));



// Layouts

const SuperAdminLayout = lazy(() => import("./layouts/SuperAdminLayout"));

const OrgAdminLayout = lazy(() => import("./layouts/OrgAdminLayout"));

const OperatorLayout = lazy(() => import("./layouts/OperatorLayout"));

const CustomerLayout = lazy(() => import("./layouts/CustomerLayout"));



// Super Admin pages

const SuperAdminDashboard = lazy(() => import("./pages/superadmin/Dashboard"));

const SuperAdminOrganizations = lazy(() => import("./pages/superadmin/Organizations"));

const SuperAdminSubscriptionPlans = lazy(() => import("./pages/superadmin/SubscriptionPlans"));

const SuperAdminUsers = lazy(() => import("./pages/superadmin/Users"));

const SuperAdminOrders = lazy(() => import("./pages/superadmin/Orders"));

const SuperAdminAlerts = lazy(() => import("./pages/superadmin/Alerts"));



// Org Admin pages

const OrgAdminDashboard = lazy(() => import("./pages/orgadmin/Dashboard"));

const OrgAdminCameras = lazy(() => import("./pages/orgadmin/Cameras"));

const OrgAdminAlerts = lazy(() => import("./pages/orgadmin/Alerts"));

const OrgAdminOperators = lazy(() => import("./pages/orgadmin/Operators"));

const OrgAdminReports = lazy(() => import("./pages/orgadmin/Reports"));

const OrgAdminSubscription = lazy(() => import("./pages/orgadmin/Subscription"));



// Operator pages

const OperatorDashboard = lazy(() => import("./pages/operator/Dashboard"));

const OperatorCameras = lazy(() => import("./pages/operator/Cameras"));

const OperatorAlerts = lazy(() => import("./pages/operator/Alerts"));



// Public & customer portal pages


const CustomerDashboard = lazy(() => import("./pages/customer/Dashboard"));

const CustomerPlansPage = lazy(() => import("./pages/customer/PlansPage"));

const CustomerSubscriptionPage = lazy(() => import("./pages/customer/SubscriptionPage"));

const CustomerHelpPage = lazy(() => import("./pages/customer/HelpPage"));
const ContactSupportPage = lazy(() => import("./pages/customer/ContactSupportPage"));

const CustomerSettingsPage = lazy(() => import("./pages/customer/SettingsPage"));

const ProfileViewPage = lazy(() => import("./pages/customer/ProfileViewPage"));

const ProfileEditPage = lazy(() => import("./pages/customer/ProfileEditPage"));

const SubscribePage = lazy(() => import("./pages/customer/SubscribePage"));
const DowngradePrepPage = lazy(() => import("./pages/customer/DowngradePrepPage"));

import { getDashboardPathForRole, PORTAL_ROLES } from "./utils/roleRoutes";



const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
  </div>
);

// <Navigate> does not interpolate route params, so carry :planId over explicitly.
const LegacySubscribeRedirect = () => {
  const { planId } = useParams();
  return <Navigate to={`/customer/subscribe/${planId}`} replace />;
};

const ProtectedRoute = ({ children, allowedRoles }) => {

  const { user, isAuthenticated } = useSelector((state) => state.auth);



  if (!isAuthenticated) {

    return <Navigate to="/login" replace />;

  }



  if (allowedRoles && !allowedRoles.includes(user?.role)) {

    return <Navigate to={getDashboardPathForRole(user?.role)} replace />;

  }



  return children;

};



function App() {

  const dispatch = useDispatch();

  const { isAuthenticated, user } = useSelector((state) => state.auth);



  const [authChecked, setAuthChecked] = useState(false);



  useEffect(() => {
    purgeLegacyStoredTokens();
    // A cached profile means this browser had a session; the httpOnly refresh cookie decides if it is still valid.
    if (localStorage.getItem("user")) {
      dispatch(restoreSession()).finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect(getAccessToken());
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, user]);



  if (!authChecked) {

    return null;

  }



  return (

    <Suspense fallback={<PageLoader />}>
    <Routes>

      <Route path="/" element={<LandingPage />} />



      <Route

        path="/login"

        element={

          !isAuthenticated ? (

            <Login />

          ) : (

            <Navigate to={getDashboardPathForRole(user?.role)} replace />

          )

        }

      />



      <Route

        path="/register"

        element={

          !isAuthenticated ? (

            <Register />

          ) : (

            <Navigate to={getDashboardPathForRole(user?.role)} replace />

          )

        }

      />



      <Route

        path="/forgot-password"

        element={

          !isAuthenticated ? <ForgotPassword /> : <Navigate to="/app" replace />

        }

      />



      <Route

        path="/reset-password"

        element={

          !isAuthenticated ? <ResetPassword /> : <Navigate to="/app" replace />

        }

      />



      <Route path="/auth/callback" element={<OAuthCallback />} />



      <Route

        path="/auth/set-password"

        element={

          isAuthenticated ? (

            <SetPassword />

          ) : (

            <Navigate to="/login" replace />

          )

        }

      />



      {/* Legacy customer routes */}

      <Route path="/profile" element={<Navigate to="/customer/profile" replace />} />

      <Route path="/profile/edit" element={<Navigate to="/customer/profile/edit" replace />} />

      <Route path="/subscribe/:planId" element={<LegacySubscribeRedirect />} />

      <Route path="/subscribe" element={<Navigate to="/customer/subscribe" replace />} />



      {/* Customer portal */}

      <Route

        path="/customer"

        element={

          <ProtectedRoute allowedRoles={PORTAL_ROLES}>

            <CustomerLayout />

          </ProtectedRoute>

        }

      >

        <Route index element={<Navigate to="/customer/dashboard" replace />} />

        <Route path="dashboard" element={<CustomerDashboard />} />

        <Route path="plans" element={<CustomerPlansPage />} />

        <Route path="downgrade-prep" element={<DowngradePrepPage />} />

        <Route path="subscription" element={<CustomerSubscriptionPage />} />

        <Route path="help" element={<CustomerHelpPage />} />
        <Route path="help/contact" element={<ContactSupportPage />} />

        <Route path="settings" element={<CustomerSettingsPage />} />

        <Route path="profile" element={<ProfileViewPage />} />

        <Route path="profile/edit" element={<ProfileEditPage />} />

        <Route

          path="subscribe"

          element={

            <ProtectedRoute allowedRoles={PORTAL_ROLES}>

              <SubscribePage />

            </ProtectedRoute>

          }

        />

        <Route

          path="subscribe/:planId"

          element={

            <ProtectedRoute allowedRoles={PORTAL_ROLES}>

              <SubscribePage />

            </ProtectedRoute>

          }

        />

      </Route>



      <Route

        path="/superadmin/*"

        element={

          <ProtectedRoute allowedRoles={["super_admin"]}>

            <SuperAdminLayout />

          </ProtectedRoute>

        }

      >

        <Route path="dashboard" element={<SuperAdminDashboard />} />

        <Route path="organizations" element={<SuperAdminOrganizations />} />

        <Route path="subscription-plans" element={<SuperAdminSubscriptionPlans />} />

        <Route path="users" element={<SuperAdminUsers />} />

        <Route path="orders" element={<SuperAdminOrders />} />

        <Route path="alerts" element={<SuperAdminAlerts />} />

      </Route>



      <Route

        path="/orgadmin/*"

        element={

          <ProtectedRoute allowedRoles={["org_admin"]}>

            <OrgAdminLayout />

          </ProtectedRoute>

        }

      >

        <Route path="dashboard" element={<OrgAdminDashboard />} />

        <Route path="cameras" element={<OrgAdminCameras />} />

        <Route path="alerts" element={<OrgAdminAlerts />} />

        <Route path="operators" element={<OrgAdminOperators />} />

        <Route path="reports" element={<OrgAdminReports />} />

        <Route path="subscription" element={<OrgAdminSubscription />} />

      </Route>



      <Route

        path="/operator/*"

        element={

          <ProtectedRoute allowedRoles={["operator"]}>

            <OperatorLayout />

          </ProtectedRoute>

        }

      >

        <Route path="dashboard" element={<OperatorDashboard />} />

        <Route path="cameras" element={<OperatorCameras />} />

        <Route path="alerts" element={<OperatorAlerts />} />

      </Route>



      <Route

        path="/app"

        element={

          isAuthenticated ? (

            <Navigate to={getDashboardPathForRole(user?.role)} replace />

          ) : (

            <Navigate to="/login" replace />

          )

        }

      />



      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>

    </Suspense>

  );

}



export default App;


