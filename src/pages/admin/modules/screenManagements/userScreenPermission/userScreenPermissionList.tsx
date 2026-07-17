import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon, TrashBinIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { appendRouteQuery, createCrudRoutePaths } from "@/utils/routePaths";
import { userScreenPermissionApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";

import { encodeLocalBodyRouteId } from "./userScreenPermissionForm";

const LOCAL_BODY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const LOCAL_BODY_ENTITY_BY_TYPE: Record<string, keyof typeof adminApi> = {
  corporation: "corporations",
  municipality: "municipalities",
  town_panchayat: "townPanchayats",
  panchayat_union: "panchayatUnions",
  panchayat: "panchayats",
};

const localBodyRecordLabel = (record: Record<string, unknown>): string =>
  String(
    record.corporation_name ??
      record.municipality_name ??
      record.town_panchayat_name ??
      record.panchayat_union_name ??
      record.panchayat_name ??
      record.name ??
      record.unique_id ??
      "",
  );

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  screen: "Screen Permission",
  field: "Field Permission",
};

type GroupedRow = {
  composite_key: string;
  local_body_type: string;
  local_body_id: string;
  local_body_type_label: string;
  local_body_label: string;
  mainscreen_name: string;
  mainscreen_id: string;
  permission_type: string;
  permission_type_label: string;
  is_active: boolean;
  legacy: boolean;
  screens: Array<{ screen: unknown; action: unknown; order: unknown }>;
};

/* -----------------------------------------------------------
   COMPONENT
----------------------------------------------------------- */

export default function UserScreenPermissionList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [permissionRows, setPermissionRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localBodyLabels, setLocalBodyLabels] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    local_body_type_label: {
      value: null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    mainscreen_name: {
      value: null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
  });


  const { encAdmins, encUserScreenPermission } = getEncryptedRoute();
  const { newPath: permissionNewPath, editPath: permissionEditPath } =
    createCrudRoutePaths(encAdmins, encUserScreenPermission);
  const ENC_NEW_PATH = permissionNewPath;

  const ENC_EDIT_PATH = (
    localBodyType: string,
    localBodyId: string,
    mainScreenId: string,
    permissionType: string
  ) =>
    appendRouteQuery(permissionEditPath(encodeLocalBodyRouteId(localBodyType, localBodyId)), {
      mainscreen_id: mainScreenId,
      permission_type: permissionType,
    });

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      setIsLoading(true);
      try {
        const data = await userScreenPermissionApi.readAll({
          params: { limit: 6000, offset: 0 },
        });
        if (mounted) setPermissionRows(data as any[]);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    let mounted = true;

    const loadLocalBodyLabels = async () => {
      try {
        const entities = Object.values(LOCAL_BODY_ENTITY_BY_TYPE);
        const results = await Promise.allSettled(
          entities.map((entity) => adminApi[entity].readAll()),
        );
        if (!mounted) return;

        const labels: Record<string, string> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled" || !Array.isArray(result.value)) return;
          (result.value as Array<Record<string, unknown>>).forEach((record) => {
            const id = String(record.unique_id ?? "");
            if (id) labels[id] = localBodyRecordLabel(record);
          });
        });
        setLocalBodyLabels(labels);
      } catch {
        // Non-fatal — falls back to showing the raw id.
      }
    };

    void loadLocalBodyLabels();
    return () => {
      mounted = false;
    };
  }, []);

  const records = useMemo<GroupedRow[]>(() => {
      const groupedObj: Record<string, GroupedRow> = permissionRows.reduce((acc, item) => {
        const localBodyType = String(item.local_body_type ?? "");
        const localBodyId = String(item.local_body_id ?? "");
        const screenId = String(item.mainscreen_id ?? "");
        const permissionType = String(item.permission_type ?? "screen");
        const isLegacy = !localBodyType || !localBodyId;
        const key = isLegacy
          ? `legacy__${item.unique_id}__${screenId}`
          : `${localBodyType}__${localBodyId}__${screenId}__${permissionType}`;

        if (!acc[key]) {
          acc[key] = {
            composite_key: key,
            local_body_type: localBodyType,
            local_body_id: localBodyId,
            local_body_type_label: isLegacy
              ? t("common.legacy", "Legacy")
              : LOCAL_BODY_TYPE_LABELS[localBodyType] ?? localBodyType,
            local_body_label: isLegacy
              ? ""
              : localBodyLabels[localBodyId] || localBodyId,
            mainscreen_name: item.mainscreen_name ?? t("common.unknown"),
            mainscreen_id: screenId,
            permission_type: permissionType,
            permission_type_label: PERMISSION_TYPE_LABELS[permissionType] ?? permissionType,
            is_active: item.is_active,
            legacy: isLegacy,
            screens: [],
          };
        }

        acc[key].screens.push({
          screen: item.userscreen_name,
          action: item.userscreenaction_name,
          order: item.order_no,
        });

        return acc;
      }, {} as Record<string, GroupedRow>);

      return Object.values(groupedObj);
  }, [permissionRows, localBodyLabels, t]);

  /* -----------------------------------------------------------
     DELETE RECORD
  ----------------------------------------------------------- */

  const handleDelete = useCallback(async (row: GroupedRow) => {
    if (row.legacy) {
      Swal.fire(t("common.error"), t("admin.user_screen_permission.legacy_readonly", "Legacy permissions are read-only."), "info");
      return;
    }

    const confirmDelete = await Swal.fire({
      title: t("common.confirm_title"),
      text: t("admin.user_screen_permission.confirm_delete"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      const deletePath = `delete-by-localbody/${row.local_body_type}/${row.local_body_id}/?mainscreen_id=${row.mainscreen_id}`;

      await userScreenPermissionApi.delete(deletePath);
      setPermissionRows((current) =>
        current.filter((item) => {
          const sameLocalBody =
            String(item.local_body_type ?? "") === row.local_body_type &&
            String(item.local_body_id ?? "") === row.local_body_id;
          const sameMainScreen = String(item.mainscreen_id ?? "") === String(row.mainscreen_id ?? "");
          return !(sameLocalBody && sameMainScreen);
        })
      );

      Swal.fire(
        t("common.deleted_success"),
        t("admin.user_screen_permission.delete_success"),
        "success"
      );

    } catch (error) {
      console.error("DELETE ERROR:", error);

      Swal.fire(
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
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
        disabled={row.legacy}
        onClick={() =>
          navigate(
            ENC_EDIT_PATH(
              row.local_body_type,
              row.local_body_id,
              String(row.mainscreen_id ?? ""),
              row.permission_type
            )
          )
        }
      >
        <PencilIcon className="size-5" />
      </button>

      <button
        title={t("common.delete")}
        className="text-red-600 hover:text-red-800 disabled:opacity-40"
        disabled={row.legacy}
        onClick={() => handleDelete(row)}
      >
        <TrashBinIcon className="size-5" />
      </button>

    </div>
  );

  const indexTemplate = (_: any, { rowIndex }: any) => rowIndex + 1;

  /* -----------------------------------------------------------
     GLOBAL SEARCH
  ----------------------------------------------------------- */

  const onGlobalFilterChange = (e: any) => {
    const value = e.target.value;
    const updated = { ...filters };
    updated["global"].value = value;
    setFilters(updated);
    setGlobalFilterValue(value);
  };

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder"),
  });

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {t("admin.user_screen_permission.title")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t("admin.user_screen_permission.subtitle")}
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <Button
            label={t("common.add_item", {
              item: t("admin.user_screen_permission.permission_label"),
            })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={records}
        dataKey="composite_key"
        paginator
        rows={10}
        loading={isLoading}
        filters={filters}
        rowsPerPageOptions={[5, 10, 25, 50]}
        globalFilterFields={["local_body_type_label", "local_body_label", "mainscreen_name", "permission_type_label"]}
        header={header}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.user_screen_permission.permission_label"),
        })}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: 80 }}
        />

        <Column
          field="mainscreen_name"
          header={t("admin.nav.main_screen")}
          sortable
        />

        <Column
          field="local_body_type_label"
          header="Local Body Type"
          sortable
        />

        <Column
          field="local_body_label"
          header="Local Body"
          sortable
        />

        <Column
          field="permission_type_label"
          header="Permission Type"
          sortable
        />

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: 150 }}
        />
      </DataTable>
    </div>
  );
}
