import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { AccessDenied } from "@/contexts/ScreenPermissionContext";
import { useHasScreenPermission } from "@/contexts/screenPermission";
import { permissionFor } from "@/generated/permissionCatalog";
import { SIDEBAR_PAGES } from "./sidebarMenu";

const DASHBOARD = permissionFor("dashboard", "dashboard");

/**
 * The admin landing page (/admin) is the Dashboard sidebar entry, so it needs
 * the dashboard "view" grant like any other page. Without it the user is
 * taken to the first sidebar page they can open instead.
 */
export default function AdminHomeGate({ children }: { children: ReactNode }) {
  const hasScreenPermission = useHasScreenPermission();

  if (hasScreenPermission(DASHBOARD, "view")) return <>{children}</>;

  const firstPage = SIDEBAR_PAGES.find(
    (page) => page.path !== "/admin" && hasScreenPermission(page, "view"),
  );
  return firstPage ? <Navigate to={firstPage.path} replace /> : <AccessDenied />;
}
