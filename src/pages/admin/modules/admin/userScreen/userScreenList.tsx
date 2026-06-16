import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { type ChangeEvent, useEffect, useState } from "react";
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

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { userScreenApi } from "@/helpers/admin";

import type { UserScreen } from "../types/admin.types"; 

export default function UserScreenList() {
  const { t } = useTranslation();
  const [screens, setScreens] = useState<UserScreen[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    userscreen_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const { encAdmins, encUserScreen } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encAdmins,
    encUserScreen,
  );

  useEffect(() => {
    let mounted = true;

    const loadScreens = async () => {
      setIsLoading(true);
      try {
        const data = await userScreenApi.readAll();
        if (mounted) setScreens(data as UserScreen[]);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadScreens();

    return () => {
      mounted = false;
    };
  }, [t]);

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const _filters = { ...filters };
    _filters.global.value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const indexTemplate = (_: UserScreen, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const statusTemplate = (row: UserScreen) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);

      try {
        await userScreenApi.update(row.unique_id, { is_active: value });
        setScreens((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setPendingStatusId(null);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={pendingStatusId === String(row.unique_id)}
        onCheckedChange={updateStatus}
      />
    );
  };

  const actionTemplate = (row: UserScreen) => (
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>

      {/* <button
        title="Delete"
        className="text-red-600 hover:text-red-800"
        onClick={() => handleDelete(row.unique_id)}
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.user_screen"),
      }),
    });

  return (
    <div className="px-3 py-3 w-full">
      
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.user_screen")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.user_screen"),
              })}
            </p>
          </div>

          <Button
            label={t("common.add_item", {
              item: t("admin.nav.user_screen"),
            })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>

        <DataTable
          value={screens}
          paginator
          rows={10}
          loading={isLoading}
          filters={filters}
          globalFilterFields={[
            "userscreen_name",
            "mainscreen_name",
            "folder_name",
          ]}
          rowsPerPageOptions={[5, 10, 25, 50]}
          stripedRows
          showGridlines
          className="p-datatable-sm"
          header={header}
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.user_screen"),
          })}
        >
          <Column
            header={t("common.s_no")}
            body={indexTemplate}
            style={{ width: "70px" }}
          />
          <Column
            field="mainscreen_name"
            header={t("admin.nav.main_screen")}
            sortable
            style={{ minWidth: "150px" }}
          />
          <Column
            field="userscreen_name"
            header={t("admin.nav.user_screen")}
            sortable
            style={{ minWidth: "150px" }}
          />
          <Column
            field="folder_name"
            header={t("common.folder")}
            sortable
            style={{ minWidth: "120px" }}
          />
          <Column
            field="icon_name"
            header={t("common.icon")}
            sortable
            style={{ minWidth: "100px" }}
          />
          <Column
            field="order_no"
            header={t("common.order")}
            sortable
            style={{ width: "100px" }}
          />
          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "120px" }}
          />
          <Column
            header={t("common.actions")}
            body={actionTemplate}
            style={{ width: "150px" }}
          />
        </DataTable>
     
    </div>
  );
}
