import type {
  AccessSnapshot,
  PermissionAuditRecord,
  SnapshotItem,
} from "./types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { usePermissionLabels } from "@/utils/permissionLabels";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { permissionAuditApi } from "@/helpers/admin";

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const METHOD_COLORS: Record<string, string> = {
  POST: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400",
  PUT: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  PATCH: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  DELETE: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

export const MethodBadge = ({ method }: { method?: string | null }) =>
  method ? (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${
        METHOD_COLORS[method] ??
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      }`}
    >
      {method}
    </span>
  ) : (
    <span>-</span>
  );

const COLUMN_STATE_LABELS: Record<string, string> = {
  VISIBLE: "Visible",
  EDITABLE: "Editable",
  READ_ONLY: "Read Only",
  MANDATORY: "Mandatory",
};

/** "kept" was held before and after the save; "granted" / "revoked" are
 *  what this save changed. */
type Status = "kept" | "granted" | "revoked";

type Chip = SnapshotItem & { status: Status };

type ScreenRow = { key: string; name: string; permissions: Chip[] };

type ModuleRow = {
  key: string;
  name: string;
  screens: ScreenRow[];
  changed: boolean;
};

const EMPTY: AccessSnapshot = { app_modules: [], modules: [], widgets: [] };

/** Screen -> the permissions it grants: its actions and visible columns. A
 *  citizen app screen has neither: the screen itself is the permission. */
const screenGrants = (
  screen: AccessSnapshot["modules"][number]["screens"][number],
): SnapshotItem[] => {
  const columns = (screen.columns ?? []).map((column) => ({
    // A column's state is part of the grant, so Visible -> Read Only reads
    // as one revoked and one granted chip.
    id: `column:${column.id}:${column.state ?? ""}`,
    name: column.state
      ? `${column.name} · ${COLUMN_STATE_LABELS[column.state] ?? column.state}`
      : column.name,
  }));
  const grants = [...screen.actions, ...columns];
  return grants.length > 0 ? grants : [{ id: screen.id, name: screen.name }];
};

/** The permissions held after the save, plus the ones it revoked. */
const mergePermissions = (
  before: SnapshotItem[],
  after: SnapshotItem[],
): Chip[] => {
  const beforeIds = new Set(before.map((i) => i.id));
  const afterIds = new Set(after.map((i) => i.id));
  return [
    ...after.map((i) => ({
      ...i,
      status: (beforeIds.has(i.id) ? "kept" : "granted") as Status,
    })),
    ...before
      .filter((i) => !afterIds.has(i.id))
      .map((i) => ({ ...i, status: "revoked" as Status })),
  ];
};

/** Module -> screen -> permissions, across both sides of the save. */
const buildModules = (
  oldSnap: AccessSnapshot,
  newSnap: AccessSnapshot,
): ModuleRow[] => {
  const modules = new Map<
    string,
    {
      name: string;
      screens: Map<
        string,
        { name: string; old: SnapshotItem[]; next: SnapshotItem[] }
      >;
    }
  >();
  const add = (snap: AccessSnapshot, side: "old" | "next") => {
    (snap.modules ?? []).forEach((module) => {
      const key = module.id ?? module.name;
      const entry = modules.get(key) ?? {
        name: module.name,
        screens: new Map(),
      };
      module.screens.forEach((screen) => {
        const row = entry.screens.get(screen.id) ?? {
          name: screen.name,
          old: [],
          next: [],
        };
        row[side] = screenGrants(screen);
        entry.screens.set(screen.id, row);
      });
      modules.set(key, entry);
    });
  };
  // New first, so modules and screens keep the order the owner now has.
  add(newSnap, "next");
  add(oldSnap, "old");

  return [...modules.entries()].map(([key, module]) => {
    const screens = [...module.screens.entries()].map(([screenKey, row]) => ({
      key: screenKey,
      name: row.name,
      permissions: mergePermissions(row.old, row.next),
    }));
    return {
      key,
      name: module.name,
      screens,
      changed: screens.some((s) =>
        s.permissions.some((p) => p.status !== "kept"),
      ),
    };
  });
};

const CHIP_STYLES: Record<Status, string> = {
  kept: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  granted:
    "border-green-200 bg-green-50 font-medium text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400",
  revoked:
    "border-red-200 bg-red-50 text-red-700 line-through dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

const PermissionChips = ({ items }: { items: Chip[] }) =>
  items.length === 0 ? (
    <span className="text-xs text-muted-foreground">—</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={`${item.status}:${item.id}`}
          className={`rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[item.status]}`}
        >
          {item.name}
        </span>
      ))}
    </div>
  );

const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="min-w-0">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="break-words font-medium">{children}</div>
  </div>
);

const GrantGroup = ({
  title,
  items,
}: {
  title: string;
  items: Chip[];
}) => (
  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="bg-gray-100 px-3 py-2 font-semibold dark:bg-gray-800">
      {title}
    </div>
    <div className="p-2">
      <PermissionChips items={items} />
    </div>
  </div>
);

const AccessPermissions = ({ record }: { record: PermissionAuditRecord }) => {
  const { t } = useTranslation();
  const { moduleLabel, screenLabel } = usePermissionLabels();

  const oldSnap = record.old_permissions ?? EMPTY;
  const newSnap = record.new_permissions ?? EMPTY;
  const modules = useMemo(
    () => buildModules(oldSnap, newSnap),
    [oldSnap, newSnap],
  );
  const apps = mergePermissions(
    oldSnap.app_modules ?? [],
    newSnap.app_modules ?? [],
  );
  const widgets = mergePermissions(
    oldSnap.widgets ?? [],
    newSnap.widgets ?? [],
  );
  const changed = (chips: Chip[]) => chips.some((p) => p.status !== "kept");

  // Only what the save changed by default; the checkbox shows everything
  // the owner holds.
  const [showUnchanged, setShowUnchanged] = useState(false);
  const visibleModules = showUnchanged
    ? modules
    : modules.filter((m) => m.changed);
  const showApps = apps.length > 0 && (showUnchanged || changed(apps));
  const showWidgets =
    widgets.length > 0 && (showUnchanged || changed(widgets));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={`rounded-full border px-2 ${CHIP_STYLES.granted}`}>
              +
            </span>
            {t("admin.permission_audit.granted", "Granted")} (
            {record.granted_count ?? 0})
          </span>
          <span className="flex items-center gap-1">
            <span className={`rounded-full border px-2 ${CHIP_STYLES.revoked}`}>
              −
            </span>
            {t("admin.permission_audit.revoked", "Revoked")} (
            {record.revoked_count ?? 0})
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(e) => setShowUnchanged(e.target.checked)}
          />
          {t("admin.permission_audit.show_unchanged", "Show unchanged modules")}
        </label>
      </div>

      {showApps && (
        <GrantGroup
          title={t("admin.permission_audit.app_access", "App Access")}
          items={apps}
        />
      )}

      {showWidgets && (
        <GrantGroup
          title={t(
            "admin.permission_audit.dashboard_widgets",
            "Dashboard Widgets",
          )}
          items={widgets}
        />
      )}

      {visibleModules.length === 0 && !showApps && !showWidgets && (
        <p className="text-sm text-muted-foreground">
          {showUnchanged
            ? t("admin.permission_audit.no_permissions", "No permissions")
            : t(
                "admin.permission_audit.no_module_changes",
                "No permission changes in this save",
              )}
        </p>
      )}

      {visibleModules.map((module) => (
        <div
          key={module.key}
          className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="bg-gray-100 px-3 py-2 font-semibold dark:bg-gray-800">
            {moduleLabel(module.name)}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-muted-foreground dark:bg-gray-900">
                <th className="w-1/4 p-2 font-medium">
                  {t("admin.permission_audit.sub_screen")}
                </th>
                <th className="p-2 font-medium">
                  {t("admin.permission_audit.permissions", "Permissions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {module.screens.map((screen) => (
                <tr
                  key={screen.key}
                  className="border-t border-gray-100 align-top dark:border-gray-800"
                >
                  <td className="p-2">{screenLabel(screen.name, module.name)}</td>
                  <td className="p-2">
                    <PermissionChips items={screen.permissions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

const stateLabel = (active?: boolean | null) => {
  if (active === true) return "Active";
  if (active === false) return "Inactive";
  return "-";
};

/** A single per-grant change (rows from before saves were snapshotted). */
const SingleChange = ({ record }: { record: PermissionAuditRecord }) => {
  const { t } = useTranslation();
  const { moduleLabel, screenLabel } = usePermissionLabels();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-700">
        <Field label={t("admin.permission_audit.main_screen")}>
          {record.mainscreen_name ? moduleLabel(record.mainscreen_name) : "-"}
        </Field>
        <Field label={t("admin.permission_audit.sub_screen")}>
          {record.userscreen_name
            ? screenLabel(record.userscreen_name, record.mainscreen_name)
            : "-"}
        </Field>
        <Field label={t("admin.permission_audit.action")}>
          {record.userscreenaction_name ?? "-"}
        </Field>
      </div>
      <div className="rounded-md border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="p-2 text-left font-medium">
                {t("admin.permission_audit.field", "Field")}
              </th>
              <th className="p-2 text-left font-medium">
                {t("admin.permission_audit.previous_state")}
              </th>
              <th className="p-2 text-left font-medium">
                {t("admin.permission_audit.new_state")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="p-2">{t("admin.permission_audit.active", "Active")}</td>
              <td className="p-2">{stateLabel(record.previous_is_active)}</td>
              <td className="p-2">{stateLabel(record.is_active)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Detail dialog. The list rows carry no snapshots, so an access-save row
 *  is re-read from the detail endpoint for its before/after. */
export default function PermissionAuditDetail({
  record,
  onClose,
}: {
  record: PermissionAuditRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The last detail fetched, keyed by row id so a stale response for a
  // previously opened row is never shown.
  const [loaded, setLoaded] = useState<{
    id: number;
    data: PermissionAuditRecord | null;
    failed: boolean;
  } | null>(null);

  const isAccessSave =
    record?.granted_count != null || record?.revoked_count != null;
  const recordId = record?.id;

  useEffect(() => {
    if (recordId == null || !isAccessSave) return;
    let mounted = true;
    permissionAuditApi
      .read(recordId)
      .then((data) => {
        if (mounted) {
          setLoaded({ id: recordId, data: data as PermissionAuditRecord, failed: false });
        }
      })
      .catch(() => {
        if (mounted) setLoaded({ id: recordId, data: null, failed: true });
      });
    return () => {
      mounted = false;
    };
  }, [recordId, isAccessSave]);

  const current = loaded && loaded.id === recordId ? loaded : null;
  const detail = current?.data ?? null;
  const loadFailed = Boolean(current?.failed);
  const shown = detail ?? record;

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-6 py-4 pr-12 dark:border-gray-700">
          <DialogTitle>{t("admin.permission_audit.detail_title")}</DialogTitle>
        </DialogHeader>

        {shown && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-900">
              <Field label={t("admin.permission_audit.source", "Granted From")}>
                {shown.source_label ?? "-"}
              </Field>
              <Field label={t("admin.permission_audit.granted_to", "Granted To")}>
                {shown.target_name ?? shown.role_display ?? "-"}
              </Field>
              <Field label={t("admin.permission_audit.local_body", "Local Body")}>
                {shown.local_body_name ?? "-"}
              </Field>
              <Field label={t("admin.permission_audit.http_method", "Method")}>
                <MethodBadge method={shown.http_method} />
              </Field>
              <Field label={t("admin.permission_audit.action_type")}>
                {shown.action_type ?? "-"}
              </Field>
              <Field label={t("admin.permission_audit.updated_by")}>
                {shown.updated_by_name ?? "-"}
              </Field>
              <Field label={t("admin.permission_audit.timestamp")}>
                {formatDateTime(shown.timestamp)}
              </Field>
            </div>

            {!isAccessSave ? (
              <SingleChange record={shown} />
            ) : detail ? (
              <AccessPermissions record={detail} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {loadFailed
                  ? t("common.fetch_failed")
                  : t("common.loading", "Loading...")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
