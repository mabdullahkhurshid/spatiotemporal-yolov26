import { Routes, Route, Navigate } from "react-router-dom";

import { useSelector, useDispatch } from "react-redux";

import { useEffect, useState } from "react";

import { setUser, logout, getMe } from "./store/slices/authSlice";

import { socketService } from "./services/socketService";



// Auth pages

import Login from "./pages/auth/Login";

import Register from "./pages/auth/Register";

import ForgotPassword from "./pages/auth/ForgotPassword";

import ResetPassword from "./pages/auth/ResetPassword";

import OAuthCallback from "./pages/auth/OAuthCallback";

import SetPassword from "./pages/auth/SetPassword";



// Layouts

import SuperAdminLayout from "./layouts/SuperAdminLayout";

import OrgAdminLayout from "./layouts/OrgAdminLayout";

import OperatorLayout from "./layouts/OperatorLayout";

import CustomerLayout from "./layouts/CustomerLayout";



// Super Admin pages

import SuperAdminDashboard from "./pages/superadmin/Dashboard";

import SuperAdminOrganizations from "./pages/superadmin/Organizations";

import SuperAdminSubscriptionPlans from "./pages/superadmin/SubscriptionPlans";

import SuperAdminUsers from "./pages/superadmin/Users";

import SuperAdminOrders from "./pages/superadmin/Orders";

import SuperAdminAlerts from "./pages/superadmin/Alerts";



// Org Admin pages

import OrgAdminDashboard from "./pages/orgadmin/Dashboard";

import OrgAdminCameras from "./pages/orgadmin/Cameras";

import OrgAdminAlerts from "./pages/orgadmin/Alerts";

import OrgAdminOperators from "./pages/orgadmin/Operators";

import OrgAdminReports from "./pages/orgadmin/Reports";

import OrgAdminSubscription from "./pages/orgadmin/Subscription";



// Operator pages

import OperatorDashboard from "./pages/operator/Dashboard";

import OperatorCameras from "./pages/operator/Cameras";

import OperatorAlerts from "./pages/operator/Alerts";



// Public & customer portal pages

import LandingPage from "./pages/public/LandingPage";

import CustomerDashboard from "./pages/customer/Dashboard";

import CustomerPlansPage from "./pages/customer/PlansPage";

import CustomerSubscriptionPage from "./pages/customer/SubscriptionPage";

import CustomerHelpPage from "./pages/customer/HelpPage";
import ContactSupportPage from "./pages/customer/ContactSupportPage";

import CustomerSettingsPage from "./pages/customer/SettingsPage";

import ProfileViewPage from "./pages/customer/ProfileViewPage";

import ProfileEditPage from "./pages/customer/ProfileEditPage";

import SubscribePage from "./pages/customer/SubscribePage";
import DowngradePrepPage from "./pages/customer/DowngradePrepPage";

import { getDashboardPathForRole, PORTAL_ROLES } from "./utils/roleRoutes";



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

    const token = localStorage.getItem("accessToken");

    const userData = localStorage.getItem("user");



    if (token && userData) {

      try {

        const parsedUser = JSON.parse(userData);

        dispatch(setUser(parsedUser));



        socketService.connect(token);



        if (!user) {

          dispatch(getMe());

        }

      } catch (error) {

        console.error("Auth restore error:", error);

        dispatch(logout());

      }

    }



    setAuthChecked(true);

  }, [dispatch]);



  useEffect(() => {

    if (isAuthenticated && user) {

      socketService.connect(localStorage.getItem("accessToken"));

    } else {

      socketService.disconnect();

    }

  }, [isAuthenticated, user]);



  if (!authChecked) {

    return null;

  }



  return (

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

      <Route path="/subscribe/:planId" element={<Navigate to="/customer/subscribe/:planId" replace />} />

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

  );

}



export default App;


