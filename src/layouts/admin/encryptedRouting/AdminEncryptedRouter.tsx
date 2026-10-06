import { createElement, Suspense, useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";
import { PageLoader } from "@/components/ui/PageLoader";
import { AccessDenied, ScreenPermissionProvider } from "@/contexts/ScreenPermissionContext";
import { useHasScreenPermission, type ScreenPermission } from "@/contexts/screenPermission";
import { SIDEBAR_PAGES } from "../sidebarMenu";
import {
  ROUTES,
  MASTER_ALIASES,
  MODULE_ALIASES,
  type ModuleComponent,
  type RouteConfig,
} from "./adminRoutes";

const normalizeRouteKey = (value: string): string =>
  value.trim().replace(/_/g, "-").toLowerCase();

const getCandidates = (
  value: string,
  aliases: Record<string, string[]>,
): string[] => {
  const normalized = normalizeRouteKey(value);

  const directAliases = aliases[value] ?? [];
  const normalizedAliases = aliases[normalized] ?? [];

  return Array.from(
    new Set([
      value,
      normalized,
      ...directAliases,
      ...normalizedAliases,
      ...directAliases.map(normalizeRouteKey),
      ...normalizedAliases.map(normalizeRouteKey),
    ]),
  );
};

const resolveRouteConfig = (
  master: string,
  moduleName: string,
): RouteConfig | undefined => {
  const masterCandidates = getCandidates(master, MASTER_ALIASES);
  const moduleCandidates = getCandidates(moduleName, MODULE_ALIASES);

  for (const masterCandidate of masterCandidates) {
    const routeGroup =
      ROUTES[masterCandidate] ??
      ROUTES[normalizeRouteKey(masterCandidate)];
    if (!routeGroup) {
      continue;
    }

    for (const moduleCandidate of moduleCandidates) {
      const routeConfig =
        routeGroup[moduleCandidate] ??
        routeGroup[normalizeRouteKey(moduleCandidate)];

      if (routeConfig) {
        return routeConfig;
      }
    }
  }

  return undefined;
};

const resolveComponent = (config: RouteConfig | undefined, mode: "view" | "new" | "edit"): ModuleComponent => {
  if (!config) return undefined;

  if (config.component) return config.component;
  if (mode === "edit") return config.editForm ?? config.form;
  if (mode === "new") return config.form;
  return config.list;
};

// The permission of every page the sidebar opens, keyed by the component it
// renders — so an alias route ("staff-audit" for the common audit) that
// renders the same page needs the same permission.
let pagePermissions: Map<ModuleComponent, ScreenPermission> | undefined;

const permissionForRoute = (config: RouteConfig): ScreenPermission | null => {
  if (!pagePermissions) {
    pagePermissions = new Map();
    for (const page of SIDEBAR_PAGES) {
      const [encMaster = "", encModule = ""] = page.path.split("/").filter(Boolean);
      const pageConfig = resolveRouteConfig(
        decryptSegment(encMaster) ?? "",
        decryptSegment(encModule) ?? "",
      );
      const component = pageConfig?.component ?? pageConfig?.list;
      if (!component) continue;
      const known = pagePermissions.get(component);
      pagePermissions.set(
        component,
        known && known.module === page.module
          ? { module: page.module, screens: [...new Set([...known.screens, ...page.screens])] }
          : { module: page.module, screens: page.screens },
      );
    }
  }
  const component = config.component ?? config.list;
  return (component && pagePermissions.get(component)) ?? null;
};

const ACTION_FOR_MODE = { view: "view", new: "add", edit: "edit" } as const;

export default function AdminEncryptedRouter() {
  const { encMaster, encModule, id } = useParams();
  const location = useLocation();
  const hasScreenPermission = useHasScreenPermission();

  const { master, moduleName } = useMemo(() => {
    return {
      master: decryptSegment(encMaster ?? ""),
      moduleName: decryptSegment(encModule ?? ""),
    };
  }, [encMaster, encModule]);

  if (!master || !moduleName) {
    return <Navigate to="/" replace />;
  }

  const moduleRoutes = resolveRouteConfig(master, moduleName);
  if (!moduleRoutes) {
    return <Navigate to="/" replace />;
  }

  const mode: "view" | "new" | "edit" =
    id ? "edit" : location.pathname.includes(`/${encModule}/new`) ? "new" : "view";
  const Component = resolveComponent(moduleRoutes, mode);

  if (!Component) {
    return <Navigate to="/" replace />;
  }

  // A page the sidebar gates needs the same grant here: "view" for the
  // page, "add" for its new form, "edit" for its edit form. Superadmins and
  // pages the sidebar does not list fall through (the API still checks).
  const permission = permissionForRoute(moduleRoutes);
  if (!hasScreenPermission(permission, ACTION_FOR_MODE[mode])) {
    return <AccessDenied />;
  }

  return (
    <ScreenPermissionProvider value={permission}>
      <Suspense fallback={<PageLoader fullHeight />}>
        {createElement(Component)}
      </Suspense>
    </ScreenPermissionProvider>
  );
}
