import { lazy } from "react";

// Auth
export const Auth = lazy(() => import("@/pages/Auth"));
export const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
export const VerifyOTP = lazy(() => import("@/pages/auth/VerifyOTP"));
export const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

// Local body / district / state portals
export const LocalBodyAuth = lazy(() => import("@/pages/LocalBodyAuth"));
export const LocalBodyDashboard = lazy(() => import("@/pages/localbody/LocalBodyDashboard"));
export const DistrictAuth = lazy(() => import("@/pages/DistrictAuth"));
export const DistrictDashboard = lazy(() => import("@/pages/district/DistrictDashboard"));
export const StateAuth = lazy(() => import("@/pages/StateAuth"));
export const StateLeaderDashboard = lazy(() => import("@/pages/state/StateLeaderDashboard"));
export const StateDashboard = lazy(() => import("@/pages/state/StateDashboard"));

// Public
export const PublicGrievance = lazy(() => import("@/pages/PublicGrievance"));
export const NotFound = lazy(() => import("@/pages/dashboard/pages/NotFound"));

// Dashboard
export const HomeDashboard = lazy(() =>
  import("@/pages/dashboard/pages/Dashboard/HomeDashboard").then((m) => ({ default: m.HomeDashboard })),
);
export const Dashboard = lazy(() => import("@/pages/dashboard/pages/Dashboard"));
export const DashboardEncryptedRouter = lazy(
  () => import("@/layouts/dashboard/encryptedRouting/DashboardEncryptedRouter"),
);

// Admin
export const AdminLayout = lazy(() =>
  import("@/layouts/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
export const AdminDashboard = lazy(
  () => import("@/pages/admin/dashboards/AdminDashboard"),
);
export const SuperadminDashboard = lazy(
  () => import("@/pages/admin/dashboards/SuperadminDashboard"),
);
export const AdminHomeGate = lazy(() => import("@/layouts/admin/AdminHomeGate"));
export const AdminEncryptedRouter = lazy(() => import("@/layouts/admin/encryptedRouting/AdminEncryptedRouter"));
export const CommonAuditList = lazy(
  () => import("@/pages/admin/modules/superadmin/audits/commonAudit/commonAuditList"),
);
export const DailyTripLogReportPage = lazy(
  () => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripLog/DailyTripLogReportPage"),
);
