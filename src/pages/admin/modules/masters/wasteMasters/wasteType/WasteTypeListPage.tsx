import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
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

const SORTABLE_FIELDS = new Set(["waste_type_name"]);

const toRecordList = (value: unknown): WasteTypeListRecord[] => {
  if (Array.isArray(value)) return value as WasteTypeListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: WasteTypeListRecord[] }).results;
  }
  return [];
};

export default function WasteTypeListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WasteTypeListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

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

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await wasteTypeApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: any) {
      Swal.fire(
        "Error",
        String(
          error?.response?.data?.detail ?? error?.message ?? "Failed to load Waste Type",
        ),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onExportRequest = async () => toRecordList(await wasteTypeApi.readAllForExport());

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
        setRows((current) =>
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
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        onExportRequest={onExportRequest}
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
