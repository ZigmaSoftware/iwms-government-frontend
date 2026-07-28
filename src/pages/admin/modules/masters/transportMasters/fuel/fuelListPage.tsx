import type { Fuel } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
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
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { fuelApi } from "@/helpers/admin";
import { capitalize } from "@/utils/capitalize";

// ─── Types ────────────────────────────────────────────────────────────────────


const FUEL_COLUMN_FIELDS: Record<string, string[]> = {
  fuel_type: ["fuel_type", "fuel"],
  is_active: ["is_active", "active_status", "status"],
};

const SORTABLE_FIELDS = new Set(["fuel_type"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toRecordList = (value: unknown): Fuel[] => {
  if (Array.isArray(value)) return value as Fuel[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: Fuel[] }).results;
  }
  return [];
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FuelList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "transport-master",
    "fuel",
    FUEL_COLUMN_FIELDS
  );

  const [rows, setRows] = useState<Fuel[]>([]);
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
  const { encTransportMaster, encFuel } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encFuel,
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setIsLoading(true);
    try {
      const response = await fuelApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(orderingParam ? { ordering: orderingParam } : {}),
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

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  // ── Pagination / sort handlers ────────────────────────────────────────────
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

  const onExportRequest = async () => toRecordList(await fuelApi.readAllForExport());

  // ── Status toggle ─────────────────────────────────────────────────────────
  const statusTemplate = (row: Fuel) => {
    const updateStatus = async (value: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await fuelApi.update(
          row.unique_id,
          filterPayload({
            fuel_type: row.fuel_type,
            description: row.description,
            is_active: value,
          }) as Record<string, unknown>
        );
        setRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (err) {
        console.error("Failed to update status:", err);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={updateStatus}
      />
    );
  };

  // ── Action buttons ────────────────────────────────────────────────────────
  const actionTemplate = (row: Fuel) => (
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: Fuel, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  // ── Table header ──────────────────────────────────────────────────────────
  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.fuel.search_placeholder"),
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.fuel.title")}
          </h1>
          <p className="text-gray-500 text-sm">{t("admin.fuel.subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Add button */}
          <Button
            label={t("admin.fuel.add")}
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
        loading={isLoading}
        rowsPerPageOptions={[5, 10, 25, 50]}
        header={header}
        emptyMessage={t("admin.fuel.empty_message")}
        stripedRows
        showGridlines
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />

        {showCol("fuel_type") && (
          <Column
            field="fuel_type"
            header={t("admin.fuel.fuel_type")}
            sortable={SORTABLE_FIELDS.has("fuel_type")}
            body={(row: Fuel) => capitalize(row.fuel_type)}
            style={{ minWidth: "200px" }}
          />
        )}

        {showCol("is_active") && (
          <Column
            field="is_active"
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "150px" }}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px" }}
        />
      </DataTable>
    </div>
  );
}
