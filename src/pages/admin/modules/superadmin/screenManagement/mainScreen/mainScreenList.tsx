import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
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
import { mainScreenApi } from "@/helpers/admin";

import type { MainScreen } from "@/pages/admin/modules/superadmin/screenManagement/shared/adminTypes"; // Correct import

const toRecordList = (value: unknown): MainScreen[] => {
  if (Array.isArray(value)) return value as MainScreen[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as MainScreen[];
    if (Array.isArray(record.data)) return record.data as MainScreen[];
  }
  return [];
};

export default function MainScreenList() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<MainScreen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const navigate = useNavigate();
  const { encAdmins, encMainScreen } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encAdmins,
    encMainScreen,
  );

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const response = await mainScreenApi.readAll();
      setRecords(toRecordList(response));
    } catch {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------
      STATUS SWITCH
  ------------------------------ */
  const statusTemplate = (row: MainScreen) => {
    const updateStatus = async (value: boolean) => {
      setUpdatingStatusId(row.unique_id);
      try {
        await mainScreenApi.update(row.unique_id, {
          mainscreen_name: row.mainscreen_name,
          mainscreentype_id: row.mainscreentype_id,
          icon_name: row.icon_name,
          order_no: row.order_no,
          description: row.description,
          is_active: value,
        });
        setRecords((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id
              ? { ...item, is_active: value }
              : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setUpdatingStatusId(null);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={updatingStatusId === row.unique_id}
        onCheckedChange={updateStatus}
      />
    );
  };

  /* ------------------------------
      ACTION BUTTONS
  ------------------------------ */
  const actionTemplate = (row: MainScreen) => (
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

  /* ------------------------------
      Search
  ------------------------------ */
  const onGlobalFilterChange = (e: any) => {
    const val = e.target.value;
    const _filters = { ...filters };
    _filters["global"].value = val;

    setFilters(_filters);
    setGlobalFilterValue(val);
  };

  /* ------------------------------
      Table Header
  ------------------------------ */
  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder"),
    });

  return (
    <div className="px-3 py-3 w-full "> 
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.main_screen")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.main_screen"),
              })}
            </p>
          </div>

          <Button
            label={t("common.add_item", { item: t("admin.nav.main_screen") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>

        <DataTable
          value={records}
          paginator
          rows={10}
          loading={isLoading}
          filters={filters}
          rowsPerPageOptions={[5, 10, 25, 50]}
          globalFilterFields={[
            "mainscreen_name",
            "mainscreentype_name",
            "icon_name",
            "description",
          ]}
          header={header}
          stripedRows
          showGridlines
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.main_screen"),
          })}
          className="p-datatable-sm"
        >
          <Column
            header={t("common.s_no")}
            body={(_, { rowIndex }) => rowIndex + 1}
            style={{ width: 80 }}
          />

          <Column
            field="mainscreen_name"
            header={t("common.item_name", { item: t("admin.nav.main_screen") })}
            sortable
          />
          <Column
            field="mainscreentype_name"
            header={t("admin.nav.main_screen_type")}
            sortable
          />
          <Column field="icon_name" header={t("common.icon_name")} sortable />
          <Column field="order_no" header={t("common.order_no")} sortable />
          <Column field="description" header={t("common.description")} sortable />

          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: 120 }}
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
