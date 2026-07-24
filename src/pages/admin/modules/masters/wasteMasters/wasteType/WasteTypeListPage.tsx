import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { wasteTypeApi } from "@/helpers/admin";
import { capitalize } from "@/utils/capitalize";
import type { WasteTypeListRecord } from "./types";

const WASTE_TYPE_COLUMN_FIELDS: Record<string, string[]> = {
  waste_type_name: ["waste_type_name", "name"],
  is_active: ["is_active"],
  default_team: ["default_team"],
};

export default function WasteTypeListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [allWasteTypes, setAllWasteTypes] = useState<WasteTypeListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: {
      value: null as string | null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    waste_type_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
  });

  const { encWasteMasters, encWasteTypes } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encWasteMasters,
    encWasteTypes,
  );

  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "waste-types",
    WASTE_TYPE_COLUMN_FIELDS,
  );

  useEffect(() => {
    let mounted = true;

    const loadWasteTypes = async () => {
      setIsLoading(true);
      try {
        const data = await wasteTypeApi.readAll();
        if (mounted) setAllWasteTypes(data as WasteTypeListRecord[]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadWasteTypes();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = Array.isArray(allWasteTypes) ? allWasteTypes : [];

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as DataTableFilterMeta);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("common.waste_type"),
      }),
    });

  const indexTemplate = (
    _: WasteTypeListRecord,
    { rowIndex }: { rowIndex: number },
  ) => rowIndex + 1;

  const actionTemplate = (row: WasteTypeListRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const statusTemplate = (row: WasteTypeListRecord) => {
    const updateStatus = async (value: boolean) => {
      try {
        setPendingStatusId(String(row.unique_id));
        setIsUpdating(true);
        await wasteTypeApi.update(
          row.unique_id,
          filterPayload({ is_active: value }) as { is_active: boolean }
        );
        setAllWasteTypes((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error) {
        console.error("Failed to update waste type status", error);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === String(row.unique_id)}
        onCheckedChange={updateStatus}
      />
    );
  };


  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("common.waste_type")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", { item: t("common.waste_type") })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("common.waste_type") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        globalFilterFields={[
          "unique_id",
          "waste_type_name",
        ]}
        emptyMessage={t("common.no_items_found", {
          item: t("common.waste_type"),
        })}
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        {/* <Column
          field="unique_id"
          header="Unique ID"
          sortable
          body={(row: WasteTypeListRecord) => toDisplay(row.unique_id)}
        /> */}
        {showCol("waste_type_name") && (
          <Column
            field="waste_type_name"
            header={t("common.item_name", { item: t("common.waste_type") })}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: WasteTypeListRecord) => capitalize(row.waste_type_name)}
          />
        )}
        {showCol("default_team") && (
          <Column
            header="Default Team"
            body={(row: WasteTypeListRecord) => row.default_team_name || "-"}
          />
        )}
        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "140px" }}
          />
        )}
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
