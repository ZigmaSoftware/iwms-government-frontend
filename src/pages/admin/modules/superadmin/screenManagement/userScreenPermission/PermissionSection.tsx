import type {
  ApiUserScreen,
  Option,
  PermissionResponse,
  PermissionScreen,
  PermissionType,
  ScreenMatrixRow,
  UserScreenColumnRecord,
} from "./types";
import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/api";
import {
  getColumnPermissions,
  type ColumnPermissionsResponse,
} from "@/helpers/admin/columnPermissionService";
import { adminApi } from "@/helpers/admin/registry";
import type { LocalBodyValue } from "./LocalBodySelector";

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

const getErrorStatus = (err: unknown): number | null => {
  return (
    (err as { response?: { status?: number } })?.response?.status ?? null
  );
};

export type PermissionSectionData = {
  screenMatrix: ScreenMatrixRow[];
  screenColumns: Record<string, UserScreenColumnRecord[]>;
  columnPermissionIds: Record<string, Record<string, string>>;
  description: string;
};

type PermissionSectionProps = {
  mainScreenId: string;
  mainScreenLabel: string;
  permissionType: PermissionType;
  localBody: LocalBodyValue;
  hasLocalBody: boolean;
  allUserScreens: ApiUserScreen[];
  actions: Option[];
  canRemove: boolean;
  onRemove: () => void;
  onDataChange: (mainScreenId: string, data: PermissionSectionData) => void;
  onAccessDenied: () => void;
};

export default function PermissionSection({
  mainScreenId,
  mainScreenLabel,
  permissionType,
  localBody,
  hasLocalBody,
  allUserScreens,
  actions,
  canRemove,
  onRemove,
  onDataChange,
  onAccessDenied,
}: PermissionSectionProps) {
  const { t } = useTranslation();

  const [description, setDescription] = useState("");
  const [screenMatrix, setScreenMatrix] = useState<ScreenMatrixRow[]>([]);
  const [screenColumns, setScreenColumns] = useState<
    Record<string, UserScreenColumnRecord[]>
  >({});
  const [columnPermissionIds, setColumnPermissionIds] = useState<
    Record<string, Record<string, string>>
  >({});

  const [formattedPermissionData, setFormattedPermissionData] =
    useState<any>(null);
  const [formattedPermissionError, setFormattedPermissionError] =
    useState<any>(null);

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

    adminApi.userScreenPermissions
      .read(`by-staff-format/?${query.toString()}`)
      .then((res: any) => {
        if (cancelled) return;
        setFormattedPermissionData(res);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setFormattedPermissionError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasLocalBody,
    localBody.localBodyType,
    localBody.localBodyId,
    localBody.stateId,
    localBody.districtId,
    localBody.areaTypeId,
    mainScreenId,
    permissionType,
  ]);

  /* -----------------------------------------------------------
     LOAD PERMISSIONS INTO MATRIX
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!hasLocalBody || !mainScreenId) return;

    if (formattedPermissionError) {
      if (getErrorStatus(formattedPermissionError) === 403) {
        onAccessDenied();
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
        onAccessDenied();
        return;
      }
    }
  }, [
    allUserScreens,
    formattedPermissionData,
    formattedPermissionError,
    hasLocalBody,
    mainScreenId,
    onAccessDenied,
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
  }, [
    screenIdsKey,
    hasLocalBody,
    localBody.localBodyId,
    localBody.localBodyType,
    permissionType,
  ]);

  /* -----------------------------------------------------------
     NOTIFY PARENT OF DATA CHANGES (for submit)
  ----------------------------------------------------------- */
  const onDataChangeRef = useRef(onDataChange);
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    onDataChangeRef.current(mainScreenId, {
      screenMatrix,
      screenColumns,
      columnPermissionIds,
      description,
    });
  }, [mainScreenId, screenMatrix, screenColumns, columnPermissionIds, description]);

  /* -----------------------------------------------------------
     TOGGLE HANDLERS
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

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */
  return (
    <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {mainScreenLabel}
        </h4>
        {canRemove && (
          <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
            {t("common.remove")}
          </Button>
        )}
      </div>

      {/* COLUMN LEGEND */}
      {permissionType === "field" && screenMatrix.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
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
                  <th key={act.value} className="px-4 py-3 text-center text-sm font-semibold">
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
                  cols && cols.length > 0 ? row.columnIds.length === cols.length : false;
                const someColsChecked = cols && cols.length > 0 && row.columnIds.length > 0;

                return (
                  <Fragment key={row.userscreen_id}>
                    {/* ── Action row ── */}
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{row.userscreen_name}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allActionsChecked}
                          onChange={(e) => handleSelectAll(row.userscreen_id, e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      {actions.map((act) => (
                        <td key={act.value} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.actions.includes(act.value)}
                            onChange={(e) =>
                              handleActionToggle(row.userscreen_id, act.value, e.target.checked)
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
                          <span className="text-xs font-semibold text-slate-500 pl-2">Columns</span>
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
                            onChange={(e) => handleSelectAllColumns(row.userscreen_id, e.target.checked)}
                            className="w-4 h-4 cursor-pointer accent-blue-600"
                            title="Select all columns"
                          />
                        </td>
                        <td colSpan={actions.length} className="px-4 py-2">
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
                                        handleColumnToggle(row.userscreen_id, col.unique_id, e.target.checked, col)
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
                                      handleColumnToggle(row.userscreen_id, col.unique_id, e.target.checked, col)
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

      {screenMatrix.length === 0 && (
        <div className="mt-3 p-8 border rounded-lg bg-gray-50 text-center text-gray-500">
          {t("admin.user_screen_permission.no_screens")}
        </div>
      )}

      <div className="mt-4">
        <Label>{t("common.description")}</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("common.description_optional")}
        />
      </div>
    </div>
  );
}
