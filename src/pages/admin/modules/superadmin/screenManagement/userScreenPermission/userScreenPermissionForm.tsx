import type { ApiUserScreen, DashboardWidget, LocalBodyType, MainScreen, Option, PermissionType, UserScreenAction, UserScreenColumnRecord } from "./types";
import { useCallback, useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
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
import {
  createColumnPermission,
  updateColumnPermission,
} from "@/helpers/admin/columnPermissionService";

import { adminApi } from "@/helpers/admin/registry";
import LocalBodySelector, { LOCAL_BODY_TYPES, type LocalBodyValue } from "./LocalBodySelector";
import DashboardWidgetSection from "./DashboardWidgetSection";
import PermissionSection, { type PermissionSectionData } from "./PermissionSection";
import { userScreenPermissionSchema } from "@/schemas/superadmin/screenManagement/userScreenPermission.schema";
import { toSwalMessage } from "@/lib/zodErrors";
import { capitalize } from "@/utils/capitalize";

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

const toId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
  /**
   * One entry per MainScreen "section" on the form. In edit mode this is
   * bootstrapped from every MainScreen that already has permissions saved
   * for this Local Body + Permission Type (see the bootstrap effect below).
   * Either mode lets the user add/remove MainScreens via the UI below.
   */
  const [mainScreenIds, setMainScreenIds] = useState<string[]>([]);
  /** Value of the "add another MainScreen" selector */
  const [addSectionValue, setAddSectionValue] = useState("");
  /** Edit mode only: true while the existing MainScreen set is being fetched */
  const [loadingExistingSections, setLoadingExistingSections] = useState(isEdit);

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(false);

  const [mainScreens, setMainScreens] = useState<Option[]>([]);
  const [allUserScreens, setAllUserScreens] = useState<ApiUserScreen[]>([]);
  const [actions, setActions] = useState<Option[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  /** Per-section data (screen matrix, columns, description), keyed by mainScreenId. Written by PermissionSection, read at submit time. */
  const sectionDataRef = useRef<Record<string, PermissionSectionData>>({});

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
     EDIT MODE — bootstrap mainScreenIds from every MainScreen that
     already has saved permissions for this Local Body + Permission
     Type, so the edit form opens with all of them as sections.
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!isEdit || !hasLocalBody) return;
    let cancelled = false;
    setLoadingExistingSections(true);

    adminApi.userScreenPermissions
      .readAll({
        params: {
          local_body_type: localBody.localBodyType,
          local_body_id: localBody.localBodyId,
          permission_type: permissionType,
          limit: 6000,
          offset: 0,
        },
      })
      .then((rows: any) => {
        if (cancelled) return;
        const ids = uniqueIds(
          (Array.isArray(rows) ? rows : []).map((r: any) => r.mainscreen_id)
        );
        setMainScreenIds(ids);
      })
      .catch(() => {
        // Non-fatal — the user can still add MainScreens manually below.
      })
      .finally(() => {
        if (!cancelled) setLoadingExistingSections(false);
      });

    return () => { cancelled = true; };
  }, [isEdit, hasLocalBody, localBody.localBodyType, localBody.localBodyId, permissionType]);

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
     ADD / REMOVE MAINSCREEN SECTIONS
  ----------------------------------------------------------- */

  const availableMainScreens = useMemo(
    () => mainScreens.filter((opt) => !mainScreenIds.includes(opt.value)),
    [mainScreens, mainScreenIds]
  );

  const handleAddSection = (nextMainScreenId: string) => {
    if (!nextMainScreenId || mainScreenIds.includes(nextMainScreenId)) return;
    setMainScreenIds((prev) => [...prev, nextMainScreenId]);
    setAddSectionValue("");
  };

  const handleRemoveSection = (targetMainScreenId: string) => {
    setMainScreenIds((prev) => prev.filter((id) => id !== targetMainScreenId));
    delete sectionDataRef.current[targetMainScreenId];
  };

  const handleSectionDataChange = useCallback(
    (id: string, data: PermissionSectionData) => {
      sectionDataRef.current[id] = data;
    },
    []
  );

  const handleAccessDenied = useCallback(() => {
    Swal.fire({
      icon: "error",
      title: t("common.access_denied"),
      text: t("common.no_permission"),
      confirmButtonText: t("common.ok"),
    }).then(() => navigate(ENC_LIST_PATH));
  }, [navigate, t]);

  /* -----------------------------------------------------------
     SUBMIT
  ----------------------------------------------------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = userScreenPermissionSchema.safeParse({
      localBodyType: localBody.localBodyType,
      localBodyId: localBody.localBodyId,
      mainScreenIds,
    });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const missingScreens = mainScreenIds.some(
      (id) => (sectionDataRef.current[id]?.screenMatrix.length ?? 0) === 0
    );
    if (missingScreens) {
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

    setLoading(true);

    try {
      // Always use the create/upsert action: its create() diff already
      // creates/updates/removes rows correctly for whichever permission_type
      // is currently selected. "update-by-localbody" (update_only=True) would
      // incorrectly reject a Local Body's first-ever save of the *other*
      // permission_type (e.g. Field Permission when only Screen Permission
      // rows exist so far) since Screen/Field are independent row sets.
      const actionPath = `bulk-sync-multi-localbody/${localBody.localBodyType}/${localBody.localBodyId}`;

      for (const mainScreenId of mainScreenIds) {
        const sectionData = sectionDataRef.current[mainScreenId];
        if (!sectionData) continue;

        const normalizedScreens = sectionData.screenMatrix
          .map((screen) => {
            const base: Record<string, unknown> = {
              userscreen_id: toId(screen.userscreen_id),
              actions: uniqueIds(screen.actions).filter(
                (actionId) =>
                  validActionIds.size === 0 || validActionIds.has(actionId)
              ),
            };
            if (
              permissionType === "field" &&
              sectionData.screenColumns[screen.userscreen_id] !== undefined
            ) {
              const lockedIds = sectionData.screenColumns[screen.userscreen_id]
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
          mainScreenId,
          description: sectionData.description.trim(),
          screens: normalizedScreens,
        };

        await adminApi.userScreenPermissions.action(actionPath, payload);
      }

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
        mainScreenIds.forEach((mainScreenId) => {
          const sectionData = sectionDataRef.current[mainScreenId];
          if (!sectionData) return;

          sectionData.screenMatrix.forEach((screen) => {
            const availableCols = sectionData.screenColumns[screen.userscreen_id];
            if (!availableCols) return;

            const permIds = sectionData.columnPermissionIds[screen.userscreen_id] ?? {};

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
            onValueChange={(value) => setPermissionType(value as PermissionType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Permission Type" />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {capitalize(opt.label)}
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

        {isEdit && loadingExistingSections && (
          <div className="mt-6 p-8 border rounded-lg bg-gray-50 text-center text-gray-500">
            {t("admin.user_screen_permission.loading_message")}
          </div>
        )}

        {!(isEdit && loadingExistingSections) && mainScreenIds.length === 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <Label>{t("admin.nav.main_screen")} *</Label>
              <Select
                value={addSectionValue}
                onValueChange={handleAddSection}
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
                      {capitalize(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!(isEdit && loadingExistingSections) && mainScreenIds.map((id) => (
          <PermissionSection
            key={id}
            mainScreenId={id}
            mainScreenLabel={
              mainScreens.find((opt) => opt.value === id)?.label
                ? capitalize(mainScreens.find((opt) => opt.value === id)!.label)
                : id
            }
            permissionType={permissionType}
            localBody={localBody}
            hasLocalBody={hasLocalBody}
            allUserScreens={allUserScreens}
            actions={actions}
            canRemove
            onRemove={() => handleRemoveSection(id)}
            onDataChange={handleSectionDataChange}
            onAccessDenied={handleAccessDenied}
          />
        ))}

        {!(isEdit && loadingExistingSections) && mainScreenIds.length > 0 && (
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <div>
              <Label>{t("admin.user_screen_permission.add_another_main_screen")}</Label>
              <Select
                value={addSectionValue}
                onValueChange={handleAddSection}
                disabled={!hasLocalBody || availableMainScreens.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableMainScreens.length === 0
                        ? t("admin.user_screen_permission.all_main_screens_added")
                        : t("common.select_item_placeholder", {
                            item: t("admin.nav.main_screen"),
                          })
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableMainScreens.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {capitalize(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="submit"
            disabled={
              loading ||
              !hasLocalBody ||
              mainScreenIds.length === 0 ||
              (isEdit && loadingExistingSections)
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
