import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  LEGACY_MODULE_NAMES,
  LEGACY_SCREEN_NAMES,
  PERMISSION_CATALOG,
} from "@/generated/permissionCatalog";
import { SIDEBAR_SECTIONS } from "@/layouts/admin/sidebarMenu";

/**
 * Display names for permission modules and screens, so the permission and
 * audit pages say "Daily Operations" / "Daily Trip Plan" — exactly what the
 * sidebar says, in the user's language — instead of the stored keys
 * ("daily-operations" / "daily-trip-plan").
 *
 * Lookup order: the sidebar's own translated label, then the backend
 * catalog's label (src/generated/permissionCatalog.ts), then the raw key.
 * Names from before the catalog was renamed after the sidebar (still in
 * older audit records) are mapped to their current names first.
 */

// module -> sidebar heading nameKey; "module|screen" -> sidebar entry nameKey.
const MODULE_NAME_KEYS = new Map<string, string>();
const SCREEN_NAME_KEYS = new Map<string, string>();

for (const { items } of SIDEBAR_SECTIONS) {
  for (const item of items) {
    const entries = item.subItems?.length ? item.subItems : [item];
    const module = entries.find((entry) => entry.module)?.module;
    if (module && !MODULE_NAME_KEYS.has(module)) {
      MODULE_NAME_KEYS.set(module, item.nameKey);
    }
    for (const entry of entries) {
      // A merged entry ("Reference Data" = modules + its tabs) names only its
      // first screen, the one the page opens on.
      if (!entry.module || !entry.screens?.length) continue;
      const key = `${entry.module}|${entry.screens[0]}`;
      if (!SCREEN_NAME_KEYS.has(key)) SCREEN_NAME_KEYS.set(key, entry.nameKey);
    }
  }
}

type CatalogModule = { label: string; screens: Record<string, { label: string }> };
const CATALOG = PERMISSION_CATALOG as unknown as Record<string, CatalogModule>;

const catalogScreenLabel = (screen: string, module?: string | null) => {
  if (module) return CATALOG[module]?.screens[screen]?.label;
  for (const entry of Object.values(CATALOG)) {
    if (entry.screens[screen]) return entry.screens[screen].label;
  }
  return undefined;
};

const moduleOfScreen = (screen: string) =>
  Object.keys(CATALOG).find((name) => CATALOG[name].screens[screen]) ??
  [...SCREEN_NAME_KEYS.keys()].find((key) => key.endsWith(`|${screen}`))?.split("|")[0];

export function usePermissionLabels() {
  const { t } = useTranslation();

  const moduleLabel = useCallback(
    (raw?: string | null): string => {
      if (!raw) return "";
      const name = LEGACY_MODULE_NAMES[raw] ?? raw;
      const nameKey = MODULE_NAME_KEYS.get(name);
      return nameKey ? t(nameKey) : CATALOG[name]?.label ?? name;
    },
    [t],
  );

  const screenLabel = useCallback(
    (rawScreen?: string | null, rawModule?: string | null): string => {
      if (!rawScreen) return "";
      const screen = LEGACY_SCREEN_NAMES[rawScreen] ?? rawScreen;
      // The screen's own module wins: a screen may have moved module.
      const owner =
        moduleOfScreen(screen) ?? (rawModule && (LEGACY_MODULE_NAMES[rawModule] ?? rawModule));
      const nameKey = owner ? SCREEN_NAME_KEYS.get(`${owner}|${screen}`) : undefined;
      return nameKey ? t(nameKey) : catalogScreenLabel(screen, owner) ?? screen;
    },
    [t],
  );

  return { moduleLabel, screenLabel };
}
