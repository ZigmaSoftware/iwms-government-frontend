import type { ApiUserScreen, DashboardWidget, LocalBodyType, MainScreen, Option, PermissionResponse, PermissionScreen, PermissionType, ScreenMatrixRow, UserScreenAction, UserScreenColumnRecord } from "./types";
import { useEffect, useState, useMemo, Fragment, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { api } from "@/api";
import {
  getColumnPermissions,
  createColumnPermission,
  updateColumnPermission,
  type ColumnPermissionsResponse,
} from "@/helpers/admin/columnPermissionService";

import { adminApi } from "@/helpers/admin/registry";
import LocalBodySelector, { LOCAL_BODY_TYPES, type LocalBodyValue } from "./LocalBodySelector";
import DashboardWidgetSection from "./DashboardWidgetSection";

const { encAdmins, encUserScreenPermission } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(
  encAdmins,
  encUserScreenPermission,
);

/* -----------------------------------------------------------
   ROUTE ID ENCODING — composite localBodyType:localBodyId key
----------------------------------------------------------- */
const encodeLocalBodyRouteId = (localBodyType: string, localBodyId: string): string =>
  `${localBodyType}__${localBodyId}`;

const decodeLocalBodyRouteId = (routeId: string): { localBodyType: string; localBodyId: string } => {
  const [localBodyType, ...rest] = routeId.split("__");
  return { localBodyType: localBodyType ?? "", localBodyId: rest.join("__") };
};

/** Green lock: primary key, foreign key, or any field whose name ends with _id */
const isLockedColumn = (col: UserScreenColumnRecord): boolean =>
  col.is_primary_key ||
  col.is_foreign_key ||
  col.field_name === "unique_id" ||
  col.field_name.endsWith("_id");

/** Yellow warning: required but not locked */
const isWarningColumn = (col: UserScreenColumnRecord): boolean =>
  col.is_required && !isLockedColumn(col);

const toId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toOrder = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const uniqueIds = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const id = toId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  return normalized;
};

const firstErrorMessage = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
};

/* -----------------------------------------------------------
   HELPER — extract HTTP status from axios-style errors
----------------------------------------------------------- */
const getErrorStatus = (err: unknown): number | null => {
  return (
    (err as { response?: { status?: number } })?.response?.status ?? null
  );
};

const PERMISSION_TYPE_OPTIONS: Array<{ value: PermissionType; label: string }> = [
  { value: "screen", label: "Screen Permission" },
  { value: "field", label: "Field Permission" },
];

export default function UserScreenPermissionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  const routeId = params.id;
  const mainScreenIdFromQuery = searchParams.get("mainscreen_id") ?? "";

  const isEdit = Boolean(routeId);
  const decodedRoute = useMemo(
    () => (routeId ? decodeLocalBodyRouteId(String(routeId)) : { localBodyType: "", localBodyId: "" }),
    [routeId],
  );

  const [localBody, setLocalBody] = useState<LocalBodyValue>({
    stateId: "",
    districtId: "",
    areaTypeId: "",
    localBodyType: (decodedRoute.localBodyType as LocalBodyType) || "",
    localBodyId: decodedRoute.localBodyId || "",
  });
  const [permissionType, setPermissionType] = useState<PermissionType>(() =>
    searchParams.get("permission_type") === "field" ? "field" : "screen"
  );
  const [mainScreenId, setMainScreenId] = useState(() =>
    isEdit ? String(mainScreenIdFromQuery) : ""
  );
  const [description, setDescription] = useState("");
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(false);

  const [mainScreens, setMainScreens] = useState<Option[]>([]);
  const [allUserScreens, setAllUserScreens] = useState<ApiUserScreen[]>([]);
  const [actions, setActions] = useState<Option[]>([]);

  const [screenMatrix, setScreenMatrix] = useState<ScreenMatrixRow[]>([]);

  /** Columns available per screen id (fetched from backend, keyed by userscreen_id) */
  const [screenColumns, setScreenColumns] = useState<
    Record<string, UserScreenColumnRecord[]>
  >({});

  /**
   * Permission IDs from the dedicated column-permission API.
   * Shape: screenId → columnId → permissionId
   * Used to update existing records instead of creating duplicates.
   */
  const [columnPermissionIds, setColumnPermissionIds] = useState<
    Record<string, Record<string, string>>
  >({});

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  /* Formatted permissions state */
  const [formattedPermissionData, setFormattedPermissionData] = useState<any>(null);
  const [formattedPermissionError, setFormattedPermissionError] = useState<any>(null);

  const hasLocalBody = Boolean(localBody.localBodyType && localBody.localBodyId);

  /* -----------------------------------------------------------
     EDIT MODE — resolve the selected Local Body's own state/
     district/area_type so LocalBodySelector's cascading dropdowns
     can pre-fill (it only has localBodyType/localBodyId from the
     route; the parent hierarchy chain isn't encoded there).
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!isEdit || !decodedRoute.localBodyType || !decodedRoute.localBodyId) return;
    let cancelled = false;

    const resolveHierarchy = async () => {
      const entityConfig = LOCAL_BODY_TYPES.find((t) => t.value === decodedRoute.localBodyType);
      if (!entityConfig) return;
      try {
        const records = (await adminApi[entityConfig.entity].readAll()) as Array<Record<string, unknown>>;
        if (cancelled || !Array.isArray(records)) return;
        const record = records.find((r) => String(r.unique_id) === decodedRoute.localBodyId);
        if (!record) return;

        const normalize = (value: unknown): string => {
          if (!value) return "";
          if (typeof value === "object" && "unique_id" in (value as Record<string, unknown>)) {
            return String((value as { unique_id?: string }).unique_id ?? "");
          }
          return String(value);
        };

        setLocalBody((prev) => ({
          ...prev,
          stateId: normalize(record.state_id),
          districtId: normalize(record.district_id),
          areaTypeId: normalize(record.area_type_id),
        }));
      } catch {
        // Non-fatal — the local body ownership itself still works via
        // localBodyType/localBodyId; only the dropdown pre-fill is lost.
      }
    };

    void resolveHierarchy();
    return () => {
      cancelled = true;
    };
  }, [isEdit, decodedRoute.localBodyType, decodedRoute.localBodyId]);

  /* -----------------------------------------------------------
     LOAD DROPDOWNS (screens/actions catalog)
  ----------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [mainScreensRes, userScreensRes, userScreenActionsRes] = await Promise.allSettled([
          adminApi.mainScreens.readAll(),
          adminApi.userScreens.readAll(),
          adminApi.userScreenActions.readAll(),
        ]);

        if (cancelled) return;

        const mainScreensData = mainScreensRes.status === "fulfilled" ? (mainScreensRes.value as any[]) : [];
        const userScreensData = userScreensRes.status === "fulfilled" ? (userScreensRes.value as any[]) : [];
        const userScreenActionsData = userScreenActionsRes.status === "fulfilled" ? (userScreenActionsRes.value as any[]) : [];

        const firstError =
          (mainScreensRes.status === "rejected" ? mainScreensRes.reason : null) ??
          (userScreensRes.status === "rejected" ? userScreensRes.reason : null) ??
          (userScreenActionsRes.status === "rejected" ? userScreenActionsRes.reason : null);

        if (firstError) {
          if (getErrorStatus(firstError) === 403) {
            Swal.fire({
              icon: "error",
              title: t("common.access_denied"),
              text: t("common.no_permission"),
              confirmButtonText: t("common.ok"),
            }).then(() => navigate(ENC_LIST_PATH));
            return;
          }
          Swal.fire(t("common.error"), t("common.load_failed"), "error");
        }

        setMainScreens(
          mainScreensData.map((x: MainScreen) => ({
            value: toId(x.unique_id),
            label: String(x.mainscreen_name ?? ""),
          }))
        );

        setAllUserScreens(Array.isArray(userScreensData) ? (userScreensData as ApiUserScreen[]) : []);

        setActions(
          userScreenActionsData.map((x: UserScreenAction) => ({
            value: toId(x.unique_id),
            label: String(x.action_name ?? ""),
          }))
        );
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* -----------------------------------------------------------
     LOAD FORMATTED PERMISSIONS
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!hasLocalBody || !mainScreenId) return;

    let cancelled = false;
    setFormattedPermissionData(null);
    setFormattedPermissionError(null);

    const query = new URLSearchParams({
      local_body_type: localBody.localBodyType,
      local_body_id: localBody.localBodyId,
      mainscreen_id: mainScreenId,
      permission_type: permissionType,
    });
    if (localBody.stateId) query.set("state_id", localBody.stateId);
    if (localBody.districtId) query.set("district_id", localBody.districtId);
    if (localBody.areaTypeId) query.set("area_type_id", localBody.areaTypeId);

    adminApi.userScreenPermissions.read(`by-staff-format/?${query.toString()}`)
      .then((res: any) => {
        if (cancelled) return;
        setFormattedPermissionData(res);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setFormattedPermissionError(err);
      });

    return () => { cancelled = true; };
  }, [hasLocalBody, localBody.localBodyType, localBody.localBodyId, localBody.stateId, localBody.districtId, localBody.areaTypeId, mainScreenId, permissionType]);

  /* -----------------------------------------------------------
     LOAD DASHBOARD WIDGETS FOR THE SELECTED LOCAL BODY
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!hasLocalBody) {
      setWidgets([]);
      return;
    }

    let cancelled = false;
    setLoadingWidgets(true);

    adminApi.dashboardWidgetPermissions
      .readAll({
        params: {
          local_body_type: localBody.localBodyType,
          local_body_id: localBody.localBodyId,
          permission_owner_kind: "super_admin",
          limit: 6000,
          offset: 0,
        },
      })
      .then((res: any) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : [];
        setWidgets(
          rows.map((row: any) => ({
            widgetName: String(row.widget_name ?? row.widgetName ?? ""),
            isEnabled: Boolean(row.is_enabled ?? row.isEnabled ?? false),
            orderNo: Number(row.order_no ?? row.orderNo ?? 0),
          })).filter((widget: DashboardWidget) => widget.widgetName)
        );
      })
      .catch(() => {
        if (!cancelled) Swal.fire(t("common.error"), "Failed to load dashboard widgets.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingWidgets(false);
      });

    return () => { cancelled = true; };
  }, [hasLocalBody, localBody.localBodyType, localBody.localBodyId, t]);

  /* -----------------------------------------------------------
     LOAD PERMISSIONS INTO MATRIX
  ----------------------------------------------------------- */

  useEffect(() => {
    if (!hasLocalBody || !mainScreenId) return;

    if (formattedPermissionError) {
      const err = formattedPermissionError;
      if (getErrorStatus(err) === 403) {
        Swal.fire({
          icon: "error",
          title: t("common.access_denied"),
          text: t("common.no_permission"),
          confirmButtonText: t("common.ok"),
        }).then(() => navigate(ENC_LIST_PATH));
        return;
      }
    }

    try {
      const formatted: PermissionResponse = (formattedPermissionData ??
        ({
          screens: [],
          description: "",
        } satisfies PermissionResponse)) as PermissionResponse;

      const actionsByScreen = new Map<string, PermissionScreen>();
      formatted.screens.forEach((scr: PermissionScreen) => {
        const screenId = toId(scr.userscreen_id);
        if (!screenId) return;

        actionsByScreen.set(screenId, {
          userscreen_id: screenId,
          userscreen_name: String(scr.userscreen_name ?? "").trim(),
          actions: uniqueIds(scr.actionIds ?? scr.actions ?? []),
          columnIds: uniqueIds(scr.columnIds ?? []),
        });
      });

      const selectedMainScreens = allUserScreens
        .filter((screen) => !screen.is_deleted)
        .filter(
          (screen) =>
            toId(screen.mainscreen_id) === mainScreenId ||
            toId((screen as any).mainscreen?.unique_id) === mainScreenId
        )
        .sort((a, b) => toOrder(a.order_no) - toOrder(b.order_no));

      const matrix: ScreenMatrixRow[] = [];

      selectedMainScreens.forEach((screen) => {
        const screenId = toId(screen.unique_id);
        if (!screenId) return;

        const existing = actionsByScreen.get(screenId);
        matrix.push({
          userscreen_id: screenId,
          userscreen_name: String(
            screen.userscreen_name ?? existing?.userscreen_name ?? screenId
          ).trim(),
          actions: uniqueIds(existing?.actions ?? []),
          columnIds: uniqueIds(existing?.columnIds ?? []),
        });
      });

      actionsByScreen.forEach((existing, screenId) => {
        if (matrix.some((row) => row.userscreen_id === screenId)) return;

        matrix.push({
          userscreen_id: screenId,
          userscreen_name: String(existing.userscreen_name ?? screenId).trim(),
          actions: uniqueIds(existing.actions ?? []),
          columnIds: uniqueIds(existing.columnIds ?? []),
        });
      });

      setDescription(formatted.description || "");
      setScreenMatrix(matrix);
    } catch (err) {
      console.error("Permission Load Failed:", err);

      if (getErrorStatus(err) === 403) {
        Swal.fire({
          icon: "error",
          title: t("common.access_denied"),
          text: t("common.no_permission"),
          confirmButtonText: t("common.ok"),
        }).then(() => navigate(ENC_LIST_PATH));
        return;
      }

      Swal.fire(
        t("common.error"),
        t("admin.user_screen_permission.load_matrix_failed"),
        "error"
      );
    }
  }, [
    allUserScreens,
    formattedPermissionData,
    formattedPermissionError,
    hasLocalBody,
    mainScreenId,
    navigate,
    t,
  ]);

  /* -----------------------------------------------------------
     FETCH COLUMNS FOR EACH SCREEN IN MATRIX
  ----------------------------------------------------------- */

  const screenIdsKey = useMemo(
    () => screenMatrix.map((r) => r.userscreen_id).sort().join(","),
    [screenMatrix]
  );

  useEffect(() => {
    if (!screenIdsKey || permissionType !== "field") {
      setScreenColumns({});
      setColumnPermissionIds({});
      return;
    }

    const ids = screenIdsKey.split(",").filter(Boolean);

    Promise.all(
      ids.map(async (screenId) => {
        const [colResult, permResult] = await Promise.allSettled([
          api.get<UserScreenColumnRecord[]>(
            `/permissions/userscreen/${screenId}/columns/`
          ),
          hasLocalBody
            ? getColumnPermissions(screenId, localBody.localBodyId, {
                localBodyType: localBody.localBodyType,
              })
            : Promise.resolve<ColumnPermissionsResponse>({
                userscreen_id: screenId,
                column_permissions: [],
              }),
        ]);

        const cols: UserScreenColumnRecord[] =
          colResult.status === "fulfilled" && Array.isArray(colResult.value.data)
            ? colResult.value.data
            : [];

        const permData: ColumnPermissionsResponse =
          permResult.status === "fulfilled"
            ? permResult.value
            : { userscreen_id: screenId, column_permissions: [] };

        const permIds: Record<string, string> = {};
        const checkedIds: string[] = [];
        permData.column_permissions.forEach((cp) => {
          permIds[cp.userscreencolumn_id] = cp.userscreencolumnpermission_id;
          if (cp.is_active) checkedIds.push(cp.userscreencolumn_id);
        });

        return { screenId, cols, permIds, checkedIds } as const;
      })
    ).then((entries) => {
      const colsMap: Record<string, UserScreenColumnRecord[]> = {};
      const permIdsMap: Record<string, Record<string, string>> = {};

      entries.forEach(({ screenId, cols, permIds }) => {
        colsMap[screenId] = cols;
        permIdsMap[screenId] = permIds;
      });

      setScreenColumns(colsMap);
      setColumnPermissionIds(permIdsMap);

      setScreenMatrix((prev) =>
        prev.map((row) => {
          const entry = entries.find((e) => e.screenId === row.userscreen_id);
          if (!entry) return row;
          return { ...row, columnIds: entry.checkedIds };
        })
      );
    });
  }, [screenIdsKey, hasLocalBody, localBody.localBodyId, localBody.localBodyType, permissionType]);

  /* -----------------------------------------------------------
     TOGGLE ACTIONS
  ----------------------------------------------------------- */

  const handleActionToggle = (
    screenId: string,
    actionId: string,
    checked: boolean
  ) => {
    setScreenMatrix((prev) =>
      prev.map((row) =>
        row.userscreen_id === screenId
          ? {
              ...row,
              actions: checked
                ? uniqueIds([...row.actions, actionId])
                : row.actions.filter((a) => a !== actionId),
            }
          : row
      )
    );
  };

  const handleSelectAll = (screenId: string, checked: boolean) => {
    const allActions = actions.map((a) => a.value);
    setScreenMatrix((prev) =>
      prev.map((row) =>
        row.userscreen_id === screenId
          ? { ...row, actions: checked ? allActions : [] }
          : row
      )
    );
  };

  /* -----------------------------------------------------------
     TOGGLE COLUMNS
  ----------------------------------------------------------- */

  const handleColumnToggle = (
    screenId: string,
    columnId: string,
    checked: boolean,
    col: UserScreenColumnRecord
  ) => {
    if (isLockedColumn(col)) return;
    setScreenMatrix((prev) =>
      prev.map((row) =>
        row.userscreen_id === screenId
          ? {
              ...row,
              columnIds: checked
                ? uniqueIds([...row.columnIds, columnId])
                : row.columnIds.filter((c) => c !== columnId),
            }
          : row
      )
    );
  };

  const handleSelectAllColumns = (screenId: string, checked: boolean) => {
    const cols = screenColumns[screenId] ?? [];
    const allIds = cols.map((c) => c.unique_id);
    const lockedIds = cols.filter(isLockedColumn).map((c) => c.unique_id);
    setScreenMatrix((prev) =>
      prev.map((row) =>
        row.userscreen_id === screenId
          ? { ...row, columnIds: checked ? allIds : lockedIds }
          : row
      )
    );
  };

  const handleMainScreenChange = (nextMainScreenId: string) => {
    if (nextMainScreenId === mainScreenId) return;
    setDescription("");
    setScreenMatrix([]);
    setScreenColumns({});
    setColumnPermissionIds({});
    setMainScreenId(nextMainScreenId);
  };

  /* -----------------------------------------------------------
     SUBMIT
  ----------------------------------------------------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!hasLocalBody || !mainScreenId) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    if (screenMatrix.length === 0) {
      Swal.fire(
        t("common.warning"),
        t("admin.user_screen_permission.no_screens"),
        "warning"
      );
      return;
    }

    const validActionIds = new Set(
      actions.map((item) => toId(item.value)).filter(Boolean)
    );

    const normalizedScreens = screenMatrix
      .map((screen) => {
        const base: Record<string, unknown> = {
          userscreen_id: toId(screen.userscreen_id),
          actions: uniqueIds(screen.actions).filter(
            (actionId) =>
              validActionIds.size === 0 || validActionIds.has(actionId)
          ),
        };
        if (permissionType === "field" && screenColumns[screen.userscreen_id] !== undefined) {
          const lockedIds = screenColumns[screen.userscreen_id]
            .filter(isLockedColumn)
            .map((c) => c.unique_id);
          base.columnIds = uniqueIds([...lockedIds, ...screen.columnIds]);
        }
        return base;
      })
      .filter((screen) => Boolean(screen.userscreen_id));

    const payload = {
      stateId: localBody.stateId || null,
      districtId: localBody.districtId || null,
      areaTypeId: localBody.areaTypeId || null,
      localBodyType: localBody.localBodyType,
      localBodyId: localBody.localBodyId,
      permissionType,
      mainScreenId: mainScreenId,
      description: description.trim(),
      screens: normalizedScreens,
    };

    setLoading(true);

    try {
      // Always use the create/upsert action: its create() diff already
      // creates/updates/removes rows correctly for whichever permission_type
      // is currently selected. "update-by-localbody" (update_only=True) would
      // incorrectly reject a Local Body's first-ever save of the *other*
      // permission_type (e.g. Field Permission when only Screen Permission
      // rows exist so far) since Screen/Field are independent row sets.
      const actionPath = `bulk-sync-multi-localbody/${localBody.localBodyType}/${localBody.localBodyId}`;
      await adminApi.userScreenPermissions.action(actionPath, payload);

      await adminApi.dashboardWidgetPermissions.action(
        `bulk-sync-by-localbody/${localBody.localBodyType}/${localBody.localBodyId}`,
        {
          stateId: localBody.stateId || undefined,
          districtId: localBody.districtId || undefined,
          areaTypeId: localBody.areaTypeId || undefined,
          widgets,
        },
      );

      // Sync column permissions (Field Permission only) via dedicated API.
      if (permissionType === "field") {
        const colSyncTasks: Promise<unknown>[] = [];
        screenMatrix.forEach((screen) => {
          const availableCols = screenColumns[screen.userscreen_id];
          if (!availableCols) return;

          const permIds = columnPermissionIds[screen.userscreen_id] ?? {};

          availableCols.forEach((col) => {
            const permId = permIds[col.unique_id] ?? null;
            const isChecked = screen.columnIds.includes(col.unique_id);

            if (permId) {
              colSyncTasks.push(updateColumnPermission(permId, { is_active: isChecked }));
            } else if (isChecked) {
              colSyncTasks.push(
                createColumnPermission({
                  userscreen_id: screen.userscreen_id,
                  column_id: col.unique_id,
                  local_body_type: localBody.localBodyType,
                  local_body_id: localBody.localBodyId,
                  state_id: localBody.stateId || undefined,
                  district_id: localBody.districtId || undefined,
                  area_type_id: localBody.areaTypeId || undefined,
                  is_active: true,
                })
              );
            }
          });
        });

        await Promise.all(colSyncTasks);
      }

      if (isEdit) {
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(ENC_LIST_PATH);
    } catch (err: unknown) {
      if (getErrorStatus(err) === 403) {
        Swal.fire({
          icon: "error",
          title: t("common.access_denied"),
          text: t("common.no_permission"),
          confirmButtonText: t("common.ok"),
        });
        return;
      }

      const errorData =
        (err as { response?: { data?: Record<string, unknown> } })?.response
          ?.data ?? {};

      Swal.fire(
        t("common.save_failed"),
        firstErrorMessage(errorData.detail) ||
          firstErrorMessage(errorData.local_body_id) ||
          firstErrorMessage(errorData.mainscreen_id) ||
          firstErrorMessage(errorData.screens) ||
          firstErrorMessage((errorData as any).columnIds) ||
          t("common.save_failed_desc"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */

  if (loadingData) {
    return (
      <ComponentCard title={t("common.loading")}>
        <div className="flex justify-center items-center py-12 text-gray-500">
          {t("admin.user_screen_permission.loading_message")}
        </div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", {
              item: t("admin.user_screen_permission.permission_label"),
            })
          : t("common.add_item", {
              item: t("admin.user_screen_permission.permission_label"),
            })
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <Label>Permission Type *</Label>
          <Select
            value={permissionType}
            onValueChange={(value) => {
              setPermissionType(value as PermissionType);
              setScreenColumns({});
              setColumnPermissionIds({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Permission Type" />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Government Hierarchy
          </h4>
          <LocalBodySelector value={localBody} onChange={setLocalBody} />
        </div>

        {hasLocalBody && (
          <div className="mb-6">
            {loadingWidgets ? (
              <div className="text-sm text-gray-500">Loading dashboard widgets...</div>
            ) : (
              <DashboardWidgetSection widgets={widgets} onChange={setWidgets} />
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <Label>{t("admin.nav.main_screen")} *</Label>
            <Select
              value={mainScreenId}
              onValueChange={handleMainScreenChange}
              disabled={!hasLocalBody}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.main_screen"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {mainScreens.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* COLUMN LEGEND */}
        {permissionType === "field" && screenMatrix.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <input type="checkbox" checked disabled className="w-3.5 h-3.5 accent-green-600" readOnly />
              <span className="text-gray-500">Key / FK field — always required</span>
            </span>
            <span className="flex items-center gap-1.5">
              <input type="checkbox" defaultChecked className="w-3.5 h-3.5 accent-amber-500" readOnly />
              <span className="text-amber-700">⚠ Important field — hide with care</span>
            </span>
            <span className="flex items-center gap-1.5">
              <input type="checkbox" defaultChecked className="w-3.5 h-3.5 accent-blue-600" readOnly />
              <span>Optional field</span>
            </span>
          </div>
        )}

        {/* PERMISSION TABLE */}
        {screenMatrix.length > 0 && (
          <div className="mt-3 border rounded-lg overflow-x-auto bg-white">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    {t("common.s_no")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    {t("admin.nav.user_screen")}
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    {t("admin.user_screen_permission.all")}
                  </th>
                  {actions.map((act) => (
                    <th
                      key={act.value}
                      className="px-4 py-3 text-center text-sm font-semibold"
                    >
                      {act.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screenMatrix.map((row, i) => {
                  const allActionsChecked = row.actions.length === actions.length;
                  const cols = permissionType === "field" ? screenColumns[row.userscreen_id] : undefined;
                  const allColsChecked =
                    cols && cols.length > 0
                      ? row.columnIds.length === cols.length
                      : false;
                  const someColsChecked =
                    cols && cols.length > 0 && row.columnIds.length > 0;

                  return (
                    <Fragment key={row.userscreen_id}>
                      {/* ── Action row ── */}
                      <tr className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {row.userscreen_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={allActionsChecked}
                            onChange={(e) =>
                              handleSelectAll(row.userscreen_id, e.target.checked)
                            }
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        {actions.map((act) => (
                          <td key={act.value} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.actions.includes(act.value)}
                              onChange={(e) =>
                                handleActionToggle(
                                  row.userscreen_id,
                                  act.value,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>

                      {/* ── Column permission row (Field Permission mode only) ── */}
                      {cols && cols.length > 0 && (
                        <tr className="border-b bg-slate-50/60">
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2">
                            <span className="text-xs font-semibold text-slate-500 pl-2">
                              Columns
                            </span>
                            {someColsChecked && (
                              <span className="ml-2 text-xs text-blue-600 font-medium">
                                ({row.columnIds.length}/{cols.length})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={allColsChecked}
                              onChange={(e) =>
                                handleSelectAllColumns(
                                  row.userscreen_id,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                              title="Select all columns"
                            />
                          </td>
                          <td
                            colSpan={actions.length}
                            className="px-4 py-2"
                          >
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                              {cols.map((col) => {
                                const locked = isLockedColumn(col);
                                const warning = !locked && isWarningColumn(col);
                                const checked = locked || row.columnIds.includes(col.unique_id);

                                if (locked) {
                                  return (
                                    <label
                                      key={col.unique_id}
                                      title="Required key field — always visible"
                                      className="flex items-center gap-1.5 text-xs cursor-not-allowed"
                                    >
                                      <input
                                        type="checkbox"
                                        checked
                                        disabled
                                        className="w-3.5 h-3.5 accent-green-600"
                                      />
                                      <span className="text-gray-400">
                                        {col.display_name || col.field_name}
                                      </span>
                                    </label>
                                  );
                                }

                                if (warning) {
                                  return (
                                    <label
                                      key={col.unique_id}
                                      title="Important field — hiding it may affect functionality"
                                      className="flex items-center gap-1.5 text-xs cursor-pointer group"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                          handleColumnToggle(
                                            row.userscreen_id,
                                            col.unique_id,
                                            e.target.checked,
                                            col
                                          )
                                        }
                                        className="w-3.5 h-3.5 cursor-pointer accent-amber-500"
                                      />
                                      <span className="text-amber-700 group-hover:text-amber-900">
                                        {col.display_name || col.field_name}
                                      </span>
                                      <span className="text-amber-500 text-[10px] leading-none">⚠</span>
                                    </label>
                                  );
                                }

                                return (
                                  <label
                                    key={col.unique_id}
                                    className="flex items-center gap-1.5 text-xs cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        handleColumnToggle(
                                          row.userscreen_id,
                                          col.unique_id,
                                          e.target.checked,
                                          col
                                        )
                                      }
                                      className="w-3.5 h-3.5 cursor-pointer accent-blue-600"
                                    />
                                    <span className="text-gray-700 group-hover:text-gray-900">
                                      {col.display_name || col.field_name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {screenMatrix.length === 0 && mainScreenId && (
          <div className="mt-6 p-8 border rounded-lg bg-gray-50 text-center text-gray-500">
            {t("admin.user_screen_permission.no_screens")}
          </div>
        )}

        {mainScreenId && (
          <div className="mt-6">
            <Label>{t("common.description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.description_optional")}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="submit"
            disabled={
              loading || !hasLocalBody || !mainScreenId
            }
          >
            {loading
              ? t("common.saving")
              : isEdit
              ? t("common.update")
              : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => navigate(ENC_LIST_PATH)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}

export { encodeLocalBodyRouteId, decodeLocalBodyRouteId };
