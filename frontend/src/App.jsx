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
import PendingVerification from "./pages/auth/PendingVerification";

// Layouts
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import OrgAdminLayout from "./layouts/OrgAdminLayout";
import OperatorLayout from "./layouts/OperatorLayout";

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

// Operator pages
import OperatorDashboard from "./pages/operator/Dashboard";
import OperatorCameras from "./pages/operator/Cameras";
import OperatorAlerts from "./pages/operator/Alerts";

// Public page
import LandingPage from "./pages/public/LandingPage";

// Protected Route
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const [authChecked, setAuthChecked] = useState(false);

  // Restore auth from localStorage
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

  // Socket connection handler
  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect(localStorage.getItem("accessToken"));
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, user]);

  if (!authChecked) {
    return null; // prevents flicker during auth restore
  }

  const isUnverifiedOrgUser =
    user &&
    (user.role === "org_admin" || user.role === "operator") &&
    user.isVerified !== true;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <Login />
          ) : user?.role === "super_admin" ? (
            <Navigate to="/superadmin/dashboard" replace />
          ) : user?.role === "org_admin" ? (
            <Navigate to="/orgadmin/dashboard" replace />
          ) : (
            <Navigate to="/operator/dashboard" replace />
          )
        }
      />

      <Route
        path="/register"
        element={
          !isAuthenticated ? <Register /> : <Navigate to="/app" replace />
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
      <Route path="/pending-verification" element={<PendingVerification />} />

      {/* Super Admin */}
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
        <Route
          path="subscription-plans"
          element={<SuperAdminSubscriptionPlans />}
        />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="orders" element={<SuperAdminOrders />} />
        <Route path="alerts" element={<SuperAdminAlerts />} />
      </Route>

      {/* Org Admin */}
      <Route
        path="/orgadmin/*"
        element={
          isUnverifiedOrgUser ? (
            <Navigate to="/pending-verification" replace />
          ) : (
            <ProtectedRoute allowedRoles={["org_admin"]}>
              <OrgAdminLayout />
            </ProtectedRoute>
          )
        }
      >
        <Route path="dashboard" element={<OrgAdminDashboard />} />
        <Route path="cameras" element={<OrgAdminCameras />} />
        <Route path="alerts" element={<OrgAdminAlerts />} />
        <Route path="operators" element={<OrgAdminOperators />} />
        <Route path="reports" element={<OrgAdminReports />} />
      </Route>

      {/* Operator */}
      <Route
        path="/operator/*"
        element={
          isUnverifiedOrgUser ? (
            <Navigate to="/pending-verification" replace />
          ) : (
            <ProtectedRoute allowedRoles={["operator"]}>
              <OperatorLayout />
            </ProtectedRoute>
          )
        }
      >
        <Route path="dashboard" element={<OperatorDashboard />} />
        <Route path="cameras" element={<OperatorCameras />} />
        <Route path="alerts" element={<OperatorAlerts />} />
      </Route>

      {/* Authenticated root redirect */}
      <Route
        path="/app"
        element={
          isAuthenticated ? (
            isUnverifiedOrgUser ? (
              <Navigate to="/pending-verification" replace />
            ) : user?.role === "super_admin" ? (
              <Navigate to="/superadmin/dashboard" replace />
            ) : user?.role === "org_admin" ? (
              <Navigate to="/orgadmin/dashboard" replace />
            ) : (
              <Navigate to="/operator/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
