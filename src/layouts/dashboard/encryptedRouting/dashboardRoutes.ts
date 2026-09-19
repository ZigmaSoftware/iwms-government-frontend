import { lazy, type ComponentType } from "react";

const OverallDashboard = lazy(() => import("@/pages/dashboard/pages/OverallDashboard"));

const Vehicle = lazy(() => import("@/pages/dashboard/pages/Vehicle"));
const ResourceManagement = lazy(() => import("@/pages/dashboard/pages/ResourceManagement"));
const Grievances = lazy(() => import("@/pages/dashboard/pages/Grievances"));
const Reports = lazy(() => import("@/pages/dashboard/pages/Reports"));
const BinMonitoring = lazy(() => import("@/pages/dashboard/pages/BinMonitoring"));

export type DashboardComponent = ComponentType | undefined;

export const ROUTES: Record<string, DashboardComponent> = {
  "dashboard-overall": OverallDashboard,
  "dashboard-vehicle": Vehicle,
  "dashboard-resources": ResourceManagement,
  "dashboard-grievances": Grievances,
  "dashboard-reports": Reports,
  "dashboard-bins": BinMonitoring,
};
