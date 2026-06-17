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

import type { StaffUserType } from "../types/admin.types";

/* -----------------------------------------------------------
   COMPONENT
----------------------------------------------------------- */

export default function UserScreenPermissionList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [permissionRows, setPermissionRows] = useState<StaffUserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    staffusertype_name: {
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
    staffTypeId: string,
    mainScreenId: string
  ) =>
    appendRouteQuery(permissionEditPath(staffTypeId), {
      mainscreen_id: mainScreenId,
    });

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      setIsLoading(true);
      try {
        const data = await userScreenPermissionApi.readAll({
          params: { limit: 6000, offset: 0 },
        });
        if (mounted) setPermissionRows(data as StaffUserType[]);
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

  const records = useMemo<StaffUserType[]>(() => {
      const groupedObj: Record<string, any> = permissionRows.reduce((acc, item) => {
        const staffTypeId = String(item.staffusertype_id ?? "");
        const screenId = String(item.mainscreen_id ?? "");
        const key = `${staffTypeId}__${screenId}`;

        if (!acc[key]) {
          acc[key] = {
            unique_id: staffTypeId,
            composite_key: key,
            usertype_name: item.usertype_name ?? "",
            staffusertype_name: item.staffusertype_name ?? t("common.unknown"),
            mainscreen_name: item.mainscreen_name ?? t("common.unknown"),
            mainscreen_id: screenId,
            is_active: item.is_active,
            screens: [],
          };
        }

        acc[key].screens.push({
          screen: item.userscreen_name,
          action: item.userscreenaction_name,
          order: item.order_no,
        });

        return acc;
      }, {} as Record<string, any>);

      return Object.values(groupedObj);
  }, [permissionRows, t]);

  /* -----------------------------------------------------------
     DELETE RECORD
  ----------------------------------------------------------- */

  const handleDelete = useCallback(async (row: any) => {
    const confirmDelete = await Swal.fire({
      title: t("common.confirm_title"),
      text: t("admin.user_screen_permission.confirm_delete"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      const deletePath = `delete-by-staffusertype/${row.unique_id}/?mainscreen_id=${row.mainscreen_id}`;

      await userScreenPermissionApi.delete(deletePath);
      setPermissionRows((current) =>
        current.filter((item) => {
          const sameStaffType = String(item.staffusertype_id ?? "") === String(row.unique_id);
          const sameMainScreen = String(item.mainscreen_id ?? "") === String(row.mainscreen_id ?? "");
          return !(sameStaffType && sameMainScreen);
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

  const actionTemplate = (row: any) => (
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() =>
          navigate(
            ENC_EDIT_PATH(
              row.unique_id,
              String(row.mainscreen_id ?? "")
            )
          )
        }
      >
        <PencilIcon className="size-5" />
      </button>

      <button
        title={t("common.delete")}
        className="text-red-600 hover:text-red-800"
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
        globalFilterFields={["staffusertype_name", "mainscreen_name", "usertype_name"]}
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
          field="usertype_name"
          header={t("admin.nav.user_type")}
          sortable
        />

        <Column
          field="staffusertype_name"
          header={t("admin.nav.staff_user_type")}
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
