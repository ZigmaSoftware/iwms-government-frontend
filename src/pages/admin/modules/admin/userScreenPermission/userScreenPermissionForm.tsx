import type { ApiUserScreen, MainScreen, Option, PermissionResponse, PermissionScreen, ScreenMatrixRow, StaffUserType, UserScreenAction, UserScreenColumnRecord } from "./types";
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

const { encAdmins, encUserScreenPermission } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(
  encAdmins,
  encUserScreenPermission,
);

/* -----------------------------------------------------------
   TYPES
----------------------------------------------------------- */


/** Shape returned by the by-staff-format endpoint */


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

const toUserTypeId = (record: {
  usertype_id?: unknown;
  usertype?: { unique_id?: unknown };
}): string => {
  const direct = record.usertype_id;
  if (direct && typeof direct === "object") {
    return toId((direct as { unique_id?: unknown }).unique_id);
  }
  return toId(direct ?? record.usertype?.unique_id);
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

const isContractorRoleId = (value: string): boolean =>
  value.trim().startsWith("CNTUSRTYPE-");

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

export default function UserScreenPermissionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  const staffTypeId = params.id;
  const mainScreenIdFromQuery = searchParams.get("mainscreen_id") ?? "";

  const isEdit = Boolean(staffTypeId);

  const [staffUserTypeId, setStaffUserTypeId] = useState(() =>
    isEdit && staffTypeId ? String(staffTypeId) : ""
  );
  const [mainScreenId, setMainScreenId] = useState(() =>
    isEdit ? String(mainScreenIdFromQuery) : ""
  );
  const [description, setDescription] = useState("");
  const [userTypeId, setUserTypeId] = useState("");
  const [selectedUserTypeCategoryId, setSelectedUserTypeCategoryId] = useState("");

  const [userTypeOptions, setUserTypeOptions] = useState<Option[]>([]);
  const [allRoleOptions, setAllRoleOptions] = useState<Option[]>([]);
  const [staffUserTypes, setStaffUserTypes] = useState<Option[]>([]);
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
  const [formattedPermissionLoading, setFormattedPermissionLoading] = useState(false);

  /* -----------------------------------------------------------
     LOAD DROPDOWNS
  ----------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [userTypesRes, staffUserTypesRes, contractorUserTypesRes, mainScreensRes, userScreensRes, userScreenActionsRes] = await Promise.allSettled([
          adminApi.userTypes.readAll(),
          adminApi.staffUserTypes.readAll(),
          adminApi.contractorUserTypes.readAll(),
          adminApi.mainScreens.readAll(),
          adminApi.userScreens.readAll(),
          adminApi.userScreenActions.readAll(),
        ]);

        if (cancelled) return;

        const userTypesData = userTypesRes.status === "fulfilled" ? (userTypesRes.value as any[]) : [];
        const staffUserTypesData = staffUserTypesRes.status === "fulfilled" ? (staffUserTypesRes.value as any[]) : [];
        const contractorUserTypesData = contractorUserTypesRes.status === "fulfilled" ? (contractorUserTypesRes.value as any[]) : [];
        const mainScreensData = mainScreensRes.status === "fulfilled" ? (mainScreensRes.value as any[]) : [];
        const userScreensData = userScreensRes.status === "fulfilled" ? (userScreensRes.value as any[]) : [];
        const userScreenActionsData = userScreenActionsRes.status === "fulfilled" ? (userScreenActionsRes.value as any[]) : [];

        // Check for 403 errors
        const firstError =
          (staffUserTypesRes.status === "rejected" ? staffUserTypesRes.reason : null) ??
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

        setUserTypeOptions(
          userTypesData.map((x: any) => ({
            value: toId(x.unique_id),
            label: String(x.name ?? ""),
          }))
        );

        const staffRoles = staffUserTypesData.map((x: StaffUserType) => ({
          value: toId(x.unique_id),
          label: String(x.name ?? ""),
          userTypeId: toUserTypeId(x),
        }));
        const contractorRoles = contractorUserTypesData.map((x: any) => ({
          value: toId(x.unique_id),
          label: String(x.name ?? ""),
          userTypeId: toUserTypeId(x),
        }));
        setAllRoleOptions([...staffRoles, ...contractorRoles]);

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
     LOAD FORMATTED PERMISSIONS (replaces useUserScreenPermissionFormattedQuery)
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!staffUserTypeId || !mainScreenId) return;

    let cancelled = false;
    setFormattedPermissionLoading(true);
    setFormattedPermissionData(null);
    setFormattedPermissionError(null);

    adminApi.userScreenPermissions.read(
      `by-staff-format/?staffusertype_id=${encodeURIComponent(staffUserTypeId)}&mainscreen_id=${encodeURIComponent(mainScreenId)}`
    )
      .then((res: any) => {
        if (cancelled) return;
        setFormattedPermissionData(res);
        setFormattedPermissionLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setFormattedPermissionError(err);
        setFormattedPermissionLoading(false);
      });

    return () => { cancelled = true; };
  }, [staffUserTypeId, mainScreenId]);

  useEffect(() => {
    if (!isEdit || !staffUserTypeId) return;

    const matchingRole = allRoleOptions.find(
      (role) => role.value === staffUserTypeId
    );
    const formattedUserTypeId = toId(
      (formattedPermissionData as any)?.usertype_id ??
        (formattedPermissionData as any)?.userTypeId
    );
    const nextUserTypeId = matchingRole?.userTypeId || formattedUserTypeId;

    if (!nextUserTypeId || selectedUserTypeCategoryId === nextUserTypeId) return;

    setSelectedUserTypeCategoryId(nextUserTypeId);
    setUserTypeId(nextUserTypeId);
  }, [
    allRoleOptions,
    formattedPermissionData,
    isEdit,
    selectedUserTypeCategoryId,
    staffUserTypeId,
  ]);

  /* -----------------------------------------------------------
     EDIT MODE
  ----------------------------------------------------------- */

  useEffect(() => {
    if (!isEdit || !staffTypeId) return;

    if (staffUserTypeId !== String(staffTypeId)) {
      setStaffUserTypeId(String(staffTypeId));
      setScreenMatrix([]);
    }

    if (mainScreenIdFromQuery && mainScreenId !== String(mainScreenIdFromQuery)) {
      setMainScreenId(String(mainScreenIdFromQuery));
      setScreenMatrix([]);
    }
  }, [isEdit, mainScreenId, mainScreenIdFromQuery, staffTypeId, staffUserTypeId]);

  /* -----------------------------------------------------------
     LOAD PERMISSIONS
  ----------------------------------------------------------- */

  useEffect(() => {
    if (!staffUserTypeId || !mainScreenId) return;

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
            // FIX: API returns actionIds, not actions
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
            // columnIds are loaded from the dedicated column-permission API
            // in the screenIdsKey effect below — start empty to avoid stale flash.
            columnIds: [],
          });
        });

        actionsByScreen.forEach((existing, screenId) => {
          if (matrix.some((row) => row.userscreen_id === screenId)) return;

          matrix.push({
            userscreen_id: screenId,
            userscreen_name: String(existing.userscreen_name ?? screenId).trim(),
            actions: uniqueIds(existing.actions ?? []),
            columnIds: [],
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
    formattedPermissionLoading,
    mainScreenId,
    navigate,
    staffUserTypeId,
    t,
  ]);

  /* -----------------------------------------------------------
     FETCH COLUMNS FOR EACH SCREEN IN MATRIX
  ----------------------------------------------------------- */

  /**
   * Key that only changes when the set of screen IDs changes,
   * not when actions/columnIds within rows change.
   */
  const screenIdsKey = useMemo(
    () => screenMatrix.map((r) => r.userscreen_id).sort().join(","),
    [screenMatrix]
  );

  useEffect(() => {
    if (!screenIdsKey) {
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
          staffUserTypeId
            ? getColumnPermissions(screenId, staffUserTypeId)
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

        // Build permId map and collect active (checked) column IDs
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

      // Replace columnIds in the matrix with data from the dedicated API
      setScreenMatrix((prev) =>
        prev.map((row) => {
          const entry = entries.find((e) => e.screenId === row.userscreen_id);
          if (!entry) return row;
          return { ...row, columnIds: entry.checkedIds };
        })
      );
    });
  }, [screenIdsKey, staffUserTypeId]);

  /* -----------------------------------------------------------
     FILTER ROLES BY SELECTED USER TYPE CATEGORY
  ----------------------------------------------------------- */

  useEffect(() => {
    if (selectedUserTypeCategoryId) {
      const filtered = allRoleOptions.filter(
        (r) => r.userTypeId === selectedUserTypeCategoryId
      );
      setStaffUserTypes(filtered);
      setUserTypeId(selectedUserTypeCategoryId);
      // Clear the role selection if it no longer belongs to the new usertype
      setStaffUserTypeId((prev) =>
        filtered.some((r) => r.value === prev) ? prev : ""
      );
    } else {
      setStaffUserTypes(allRoleOptions);
      setUserTypeId("");
    }
  }, [selectedUserTypeCategoryId, allRoleOptions]);

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

    if (!staffUserTypeId || !mainScreenId || !userTypeId) {
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

    // Action-only payload — column permissions are handled by the dedicated API below.
    const normalizedScreens = screenMatrix
      .map((screen) => {
        const base: Record<string, unknown> = {
          userscreen_id: toId(screen.userscreen_id),
          actions: uniqueIds(screen.actions).filter(
            (actionId) =>
              validActionIds.size === 0 || validActionIds.has(actionId)
          ),
        };
        // Only include columnIds when the columns have been fetched for this screen.
        // Sending undefined means "no change"; sending [] means "clear all column perms".
        if (screenColumns[screen.userscreen_id] !== undefined) {
          const lockedIds = screenColumns[screen.userscreen_id]
            .filter(isLockedColumn)
            .map((c) => c.unique_id);
          base.columnIds = uniqueIds([...lockedIds, ...screen.columnIds]);
        }
        return base;
      })
      .filter((screen) => Boolean(screen.userscreen_id));

    const isContractorRole = isContractorRoleId(staffUserTypeId);
    const payload = {
      staffusertype_id: isContractorRole ? null : staffUserTypeId,
      contractorusertype_id: isContractorRole ? staffUserTypeId : null,
      permission_for: isContractorRole ? "contractor" : "staff",
      mainscreen_id: mainScreenId,
      description: description.trim(),
      usertype_id: userTypeId,
      screens: normalizedScreens,
    };

    setLoading(true);

    try {
      if (isEdit) {
        await adminApi.userScreenPermissions.action(
          `update-by-staffusertype/${staffUserTypeId}`,
          payload
        );
      } else {
        await adminApi.userScreenPermissions.action(
          `bulk-sync-multi/${staffUserTypeId}`,
          payload
        );
      }

      // Sync column permissions via dedicated API (create or update, no duplicates).
      const colSyncTasks: Promise<unknown>[] = [];
      screenMatrix.forEach((screen) => {
        const availableCols = screenColumns[screen.userscreen_id];
        if (!availableCols) return; // columns not yet loaded — skip

        const permIds = columnPermissionIds[screen.userscreen_id] ?? {};

        availableCols.forEach((col) => {
          const permId = permIds[col.unique_id] ?? null;
          const isChecked = screen.columnIds.includes(col.unique_id);

          if (permId) {
            // Existing permission record — update in-place
            colSyncTasks.push(updateColumnPermission(permId, { is_active: isChecked }));
          } else if (isChecked) {
            // New selection — create (backend uses get_or_create, safe to call)
            colSyncTasks.push(
              createColumnPermission({
                userscreen_id: screen.userscreen_id,
                column_id: col.unique_id,
                staffusertype_id: isContractorRole ? undefined : staffUserTypeId,
                contractorusertype_id: isContractorRole ? staffUserTypeId : undefined,
                usertype_id: userTypeId,
                is_active: true,
              })
            );
          }
        });
      });

      await Promise.all(colSyncTasks);

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
          firstErrorMessage(errorData.staffusertype_id) ||
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
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <Label>{t("admin.nav.user_type")} *</Label>
            <Select
              value={selectedUserTypeCategoryId}
              onValueChange={(value) => {
                setSelectedUserTypeCategoryId(value);
                if (!isEdit) {
                  setStaffUserTypeId("");
                  setScreenMatrix([]);
                  setScreenColumns({});
                  setColumnPermissionIds({});
                  setDescription("");
                }
              }}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.user_type"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {userTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.nav.staff_user_type")} *</Label>
            <Select
              value={staffUserTypeId}
              onValueChange={setStaffUserTypeId}
              disabled={isEdit || !selectedUserTypeCategoryId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.staff_user_type"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {staffUserTypes.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.nav.main_screen")} *</Label>
            <Select
              value={mainScreenId}
              onValueChange={handleMainScreenChange}
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
        {screenMatrix.length > 0 && (
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
                  const cols = screenColumns[row.userscreen_id];
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

                      {/* ── Column permission row (only when columns exist) ── */}
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
                          {/* "Select all columns" checkbox in the All column */}
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
                          {/* Column checkboxes span all remaining action columns */}
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
              loading || !staffUserTypeId || !mainScreenId
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
