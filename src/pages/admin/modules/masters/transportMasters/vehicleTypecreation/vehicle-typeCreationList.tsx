import type { VehicleTypeRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { vehicleTypeApi } from "@/helpers/admin";
import { capitalize } from "@/utils/capitalize";

// ─── Types ────────────────────────────────────────────────────────────────────


const VEHICLE_TYPE_COLUMN_FIELDS: Record<string, string[]> = {
  vehicleType: ["vehicleType", "vehicle_type"],
  is_active: ["is_active", "status", "active_status"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const toRecordList = (value: unknown): VehicleTypeRecord[] => {
  if (Array.isArray(value)) return value as VehicleTypeRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: VehicleTypeRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["vehicleType"]);

// ─── Component ────────────────────────────────────────────────────────────────

export default function VehicleTypeCreationList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-type",
    VEHICLE_TYPE_COLUMN_FIELDS
  );

  const [rows, setRows] = useState<VehicleTypeRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  // ── Routes ────────────────────────────────────────────────────────────────
  const { encTransportMaster, encVehicleType } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encVehicleType,
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await vehicleTypeApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: unknown) {
      Swal.fire({ icon: "error", title: t("common.error"), text: String(error) });
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

  const onExportRequest = async () => toRecordList(await vehicleTypeApi.readAllForExport());

  // ── Status toggle ─────────────────────────────────────────────────────────
  const statusTemplate = (row: VehicleTypeRecord) => {
    const updateStatus = async (value: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await vehicleTypeApi.update(
          row.unique_id,
          filterPayload({
            vehicleType: row.vehicleType,
            description: row.description,
            is_active: value,
          }) as Record<string, unknown>
        );
        setRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error) {
        console.error("Failed to update vehicle type status:", error);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={updateStatus}
      />
    );
  };

  // ── Action buttons ────────────────────────────────────────────────────────
  const actionTemplate = (row: VehicleTypeRecord) => (
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

  const indexTemplate = (
    _: VehicleTypeRecord,
    { rowIndex }: { rowIndex: number }
  ) => rowIndex + 1;

  // ── Table header ──────────────────────────────────────────────────────────
  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.vehicle_type.search_placeholder"),
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.vehicle_type.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.vehicle_type.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Add button */}
          <Button
            label={t("admin.vehicle_type.add")}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* Table */}
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
        loading={isLoading && rows.length === 0}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.vehicle_type.empty_message")}
        onExportRequest={onExportRequest}
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />

        {showCol("vehicleType") && (
          <Column
            field="vehicleType"
            header={t("admin.vehicle_type.label")}
            sortable={SORTABLE_FIELDS.has("vehicleType")}
            body={(row: VehicleTypeRecord) => capitalize(row.vehicleType)}
            style={{ minWidth: "200px" }}
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
