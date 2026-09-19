import { createElement, Suspense, useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";
import { PageLoader } from "@/components/ui/PageLoader";
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

export default function AdminEncryptedRouter() {
  const { encMaster, encModule, id } = useParams();
  const location = useLocation();

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

  return (
    <Suspense fallback={<PageLoader fullHeight />}>
      {createElement(Component)}
    </Suspense>
  );
}
