/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";
import { usePermissionLabels } from "@/utils/permissionLabels";

import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { getEncryptedRoute } from "@/utils/routeCache";
import { appendRouteQuery, createCrudRoutePaths } from "@/utils/routePaths";
import { api } from "@/api";
import { userScreenPermissionApi } from "@/helpers/admin";
import { adminEndpoints } from "@/helpers/admin/endpoints";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

import { encodeLocalBodyRouteId } from "./userScreenPermissionForm";
import { Can } from "@/contexts/ScreenPermissionContext";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useOptionFilter, useStatusFilter } from "@/components/filters/useOptionFilter";
import { confirmDeleteWithReason, withDeleteReason } from "@/utils/deleteReason";

const LOCAL_BODY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  screen: "Screen Permission",
  field: "Field Permission",
};

// GET .../userscreenpermissions/summary/ — one row per (local body,
// permission type), grouped server-side.
type SummaryRow = {
  composite_key: string;
  local_body_type: string;
  local_body_id: string;
  local_body_name: string | null;
  mainscreen_ids: string[];
  mainscreen_names: Array<string | null>;
  permission_type: string;
  is_active: boolean;
  legacy: boolean;
};

type GroupedRow = {
  composite_key: string;
  local_body_type: string;
  local_body_id: string;
  local_body_type_label: string;
  local_body_label: string;
  mainscreen_ids: string[];
  mainscreen_names: string[];
  mainscreen_names_joined: string;
  permission_type: string;
  permission_type_label: string;
  is_active: boolean;
  legacy: boolean;
};

/* -----------------------------------------------------------
   COMPONENT
----------------------------------------------------------- */

export default function UserScreenPermissionList() {
  const { t } = useTranslation();
  const { moduleLabel } = usePermissionLabels();
  const navigate = useNavigate();

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const geo = useHierarchyFilter();
  const status = useStatusFilter();
  const permissionType = useOptionFilter({
    param: "permission_type",
    label: "Permission Type",
    options: Object.entries(PERMISSION_TYPE_LABELS).map(([value, label]) => ({ label, value })),
  });
  const filterKey = JSON.stringify({ ...geo.applied, ...status.applied });

  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    local_body_type_label: {
      value: null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    mainscreen_names_joined: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
  });

  const { encSuperAdmin, encUserScreenPermission } = getEncryptedRoute();
  const { newPath: permissionNewPath, editPath: permissionEditPath } =
    createCrudRoutePaths(encSuperAdmin, encUserScreenPermission);
  const ENC_NEW_PATH = permissionNewPath;

  const ENC_EDIT_PATH = (
    localBodyType: string,
    localBodyId: string,
    permissionType: string
  ) =>
    appendRouteQuery(permissionEditPath(encodeLocalBodyRouteId(localBodyType, localBodyId)), {
      permission_type: permissionType,
    });

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get<SummaryRow[]>(
          `/${adminEndpoints.userScreenPermissions}/summary/`,
          { params: JSON.parse(filterKey) },
        );
        if (mounted) setSummaryRows(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) notify.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, [t, filterKey]);

  const records = useMemo<GroupedRow[]>(
    () =>
      summaryRows.map((row) => {
        const mainscreenNames = row.mainscreen_names.map((name) =>
          name ? moduleLabel(String(name)) : t("common.unknown"),
        );
        return {
          composite_key: row.composite_key,
          local_body_type: row.local_body_type,
          local_body_id: row.local_body_id,
          local_body_type_label: row.legacy
            ? t("common.legacy", "Legacy")
            : LOCAL_BODY_TYPE_LABELS[row.local_body_type] ?? row.local_body_type,
          local_body_label: row.legacy ? "" : row.local_body_name || row.local_body_id,
          mainscreen_ids: row.mainscreen_ids,
          mainscreen_names: mainscreenNames,
          mainscreen_names_joined: mainscreenNames.join(", "),
          permission_type: row.permission_type,
          permission_type_label: PERMISSION_TYPE_LABELS[row.permission_type] ?? row.permission_type,
          is_active: row.is_active,
          legacy: row.legacy,
        };
      }),
    [summaryRows, t, moduleLabel],
  );

  /* -----------------------------------------------------------
     DELETE RECORD
  ----------------------------------------------------------- */

  const handleDelete = useCallback(async (row: GroupedRow) => {
    if (row.legacy) {
      notify.fire(t("common.error"), t("admin.user_screen_permission.legacy_readonly", "Legacy permissions are read-only."), "info");
      return;
    }

    const reason = await confirmDeleteWithReason();
    if (reason === null) return;

    try {
      await Promise.all(
        row.mainscreen_ids.map((mainscreenId) =>
          userScreenPermissionApi.delete(`delete-by-localbody/${row.local_body_type}/${row.local_body_id}/?mainscreen_id=${mainscreenId}`, withDeleteReason(reason))
        )
      );

      setSummaryRows((current) =>
        current.filter((item) => item.composite_key !== row.composite_key)
      );

      notify.fire(
        t("common.deleted_success"),
        t("admin.user_screen_permission.delete_success"),
        "success"
      );

    } catch (error) {
      console.error("DELETE ERROR:", error);

      notify.fire(
        t("common.error"),
        t("admin.user_screen_permission.delete_failed"),
        "error"
      );
    }
  }, [t]);

  /* -----------------------------------------------------------
     ACTION BUTTONS
  ----------------------------------------------------------- */

  const actionTemplate = (row: GroupedRow) => (
    <RowActionsMenu
      onEdit={
        row.legacy
          ? undefined
          : () =>
              navigate(
                ENC_EDIT_PATH(row.local_body_type, row.local_body_id, row.permission_type)
              )
      }
      onDelete={row.legacy ? undefined : () => void handleDelete(row)}
      editLabel={t("common.edit")}
      deleteLabel={t("common.delete")}
    />
  );

  const indexTemplate = (_: any, { rowIndex }: any) => rowIndex + 1;

  const mainScreenCountTemplate = (row: GroupedRow) => (
    <span title={row.mainscreen_names_joined}>
      {t("admin.user_screen_permission.mainscreen_count", {
        count: row.mainscreen_ids.length,
        defaultValue: `${row.mainscreen_ids.length} Master(s)`,
      })}
    </span>
  );

  /* -----------------------------------------------------------
     GLOBAL SEARCH
  ----------------------------------------------------------- */

  const onGlobalFilterChange = (value: string) => {
    const updated = { ...filters };
    updated["global"].value = value;
    setFilters(updated);
    setGlobalFilterValue(value);
  };

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.user_screen_permission.title")}
        subtitle={t("admin.user_screen_permission.subtitle")}
        actions={
          <Can action="add">
            <Button
              label={t("common.add_item", {
                item: t("admin.user_screen_permission.permission_label"),
              })}
              icon="pi pi-plus"
              className="p-button-success"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </Can>
        }
        className="mb-6"
      />

      <DataTable
        filterPanel={combineFilters(geo, status, permissionType)}
        value={
          permissionType.value
            ? records.filter((row) => row.permission_type === permissionType.value)
            : records
        }
        dataKey="composite_key"
        paginator
        rows={10}
        loading={isLoading}
        filters={filters}
        rowsPerPageOptions={[5, 10, 25, 50]}
        globalFilterFields={["local_body_type_label", "local_body_label", "mainscreen_names_joined", "permission_type_label"]}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={onGlobalFilterChange}
            searchPlaceholder={t("common.search_placeholder")}
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.user_screen_permission.permission_label"),
        })}
        fitWidth
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "6%" }}
        />

        <Column
          header={t("admin.nav.main_screen")}
          body={mainScreenCountTemplate}
          sortable
          sortField="mainscreen_ids.length"
          style={{ width: "20%" }}
        />

        <Column
          field="local_body_type_label"
          header="Local Body Type"
          sortable
          style={{ width: "20%" }}
        />

        <Column
          field="local_body_label"
          header="Local Body"
          sortable
          style={{ width: "26%" }}
          body={(row: GroupedRow) => <span className="break-words">{row.local_body_label}</span>}
        />

        <Column
          field="permission_type_label"
          header="Permission Type"
          sortable
          style={{ width: "18%" }}
        />

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "10%" }}
        />
      </DataTable>
    </div>
  );
}
