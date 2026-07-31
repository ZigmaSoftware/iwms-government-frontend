import type { WasteCollection } from "./types";
import { ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCrudRoutePaths } from "@/utils/routePaths";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";

import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { getEncryptedRoute } from "@/utils/routeCache";
import { adminApi } from "@/helpers/admin/registry";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { exportRecordsToExcel, getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { downloadRecordsPdf } from "@/utils/exportPdf";
import { capitalize } from "@/utils/capitalize";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────


const formatDate = (val?: string) => {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Trip-plan-style 12hr clock — accepts "HH:MM" or "HH:MM:SS".
const formatTime12Hour = (time?: string): string => {
  if (!time) return "";
  const [hourStr, minuteStr = "00"] = time.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${minuteStr.padStart(2, "0")} ${period}`;
};

const formatCollectionDateTime = (row: WasteCollection) => {
  const date = formatDate(row.collection_date);
  const time = formatTime12Hour(row.collection_time);
  return time ? `${date}, ${time}` : date;
};

// Same status vocabulary + styling as dailyTripHouseholdCollectionList.tsx's STATUS_STYLES
// — the canonical household-stop status used across the app.
const COLLECTION_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  "Not Available": "bg-red-100 text-red-800",
  "Collect Later": "bg-orange-100 text-orange-800",
};

const CollectionStatusBadge = ({ value }: { value?: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLLECTION_STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
    {value || "-"}
  </span>
);

const toRecordList = (value: unknown): WasteCollection[] => {
  if (Array.isArray(value)) return value as WasteCollection[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: WasteCollection[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["collection_date", "status", "total_quantity"]);

// ─── Component ────────────────────────────────────────────────────────────────

export default function WasteCollectedDataList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encDailyOperations, encWasteCollectedData } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encDailyOperations,
    encWasteCollectedData,
  );

  const [rawRows, setRawRows] = useState<WasteCollection[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [imageRow, setImageRow] = useState<WasteCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [dateFilter, setDateFilter] = useState("");

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const filterParams = {
    ...hierarchyParams,
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  /* ── load data ── */
  const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setLoading(true);
    try {
      const response = await adminApi.wasteCollections.readAllwithPaginated(page, limit, {
        params: {
          ...filterParams,
          ...(search ? { search } : {}),
          ...(orderingParam ? { ordering: orderingParam } : {}),
        },
      });
      setRawRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: String(err) });
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 whenever a non-pagination filter changes.
  useEffect(() => {
    setFirst(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyParams, dateFilter]);

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, hierarchyParams, dateFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  /* ── KPI pills: computed from the CURRENT PAGE only — the backend has no
     dedicated summary aggregate for this resource, so these are deliberately
     labeled "(page)" rather than implying dataset-wide totals (mirrors
     dailyTripLogList.tsx). ── */
  const today = new Date().toISOString().slice(0, 10);
  const overallWeight = rawRows.reduce((sum, row) => sum + Number(row.total_quantity ?? 0), 0);
  const dailyWeight = rawRows.reduce(
    (sum, row) => sum + (row.collection_date === today ? Number(row.total_quantity ?? 0) : 0),
    0,
  );

  const buildExportRows = (records: WasteCollection[]) =>
    records.map((row) => ({
      Customer: row.customer_name,
      Mobile: row.contact_no ?? "-",
      "Collection Date": formatCollectionDateTime(row),
      "Dry Waste (kg)": row.dry_waste,
      "Wet Waste (kg)": row.wet_waste,
      "Mixed Waste (kg)": row.mixed_waste,
      "Sanitary Waste (kg)": row.sanitary_waste,
      "Total Quantity (kg)": row.total_quantity,
      Status: row.status ?? "-",
      District: row.district_name ?? "-",
      "Area Type": row.area_type_name ?? "-",
      "Local Body": row.location_name ?? "-",
      Ward: row.ward_name ?? row.ward_id ?? "-",
      Vehicle: row.vehicle?.vehicle_no ?? "-",
    }));

  const handleExcelDownload = async () => {
    setIsExporting(true);
    try {
      const all = await adminApi.wasteCollections.readAllForExport({
        params: {
          ...filterParams,
          ...(searchTerm ? { search: searchTerm } : {}),
        },
      });
      const exportRows = buildExportRows(toRecordList(all));
      if (!exportRows.length) {
        Swal.fire(t("common.warning", "Warning"), t("common.no_records_to_export", "No records to export."), "warning");
        return;
      }
      exportRecordsToExcel(exportRows, getAdminScreenExcelFilename("all"), "Household Collection Events");
    } catch (error) {
      Swal.fire(t("common.error"), error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfDownload = async () => {
    setIsExporting(true);
    try {
      const all = await adminApi.wasteCollections.readAllForExport({
        params: {
          ...filterParams,
          ...(searchTerm ? { search: searchTerm } : {}),
        },
      });
      const exportRows = buildExportRows(toRecordList(all));
      if (!exportRows.length) {
        Swal.fire(t("common.warning", "Warning"), t("common.no_records_to_export", "No records to export."), "warning");
        return;
      }
      downloadRecordsPdf({
        title: "Household Collection Events",
        filename: "household_collection_events.pdf",
        rows: exportRows,
        columns: Object.keys(exportRows[0] ?? {}).map((key) => ({ key, label: key })),
      });
    } catch (error) {
      Swal.fire(t("common.error"), error instanceof Error ? error.message : "PDF export failed.", "error");
    } finally {
      setIsExporting(false);
    }
  };

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

  /* ── status toggle ── */
  const statusTemplate = (row: WasteCollection) => {
    const updateStatus = async (value: boolean) => {
      try {
        await adminApi.wasteCollections.update(row.unique_id, { is_active: value });
        setRawRows((prev) =>
          prev.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      }
    };
    return <Switch checked={!!row.is_active} onCheckedChange={updateStatus} />;
  };

  const actionTemplate = (row: WasteCollection) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("admin.waste_collected_data.view_image", "View captured image")}
        onClick={() => setImageRow(row)}
        className="text-emerald-600 hover:text-emerald-800"
      >
        <ImageIcon className="size-5" />
      </button>
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: WasteCollection, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  const renderHeader = () => (
    <div className="space-y-4">
      <HierarchyFilterBar onChange={setHierarchyParams} />
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-4 py-2">Daily (page): {dailyWeight.toFixed(2)}</span>
        <span className="rounded-full bg-slate-100 px-4 py-2">Overall (page): {overallWeight.toFixed(2)}</span>
        <span className="rounded-full bg-slate-100 px-4 py-2">Records (page): {rawRows.length}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button label={isExporting ? "Downloading…" : "Download Excel"} icon="pi pi-file-excel" className="p-button-outlined p-button-sm" disabled={isExporting || totalRecords === 0} onClick={() => void handleExcelDownload()} />
          <Button label={isExporting ? "Generating…" : "Download PDF"} icon="pi pi-file-pdf" className="p-button-outlined p-button-sm" disabled={isExporting || totalRecords === 0} onClick={() => void handlePdfDownload()} />
        </div>
        <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1">
          <InputText type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="border-none text-sm" />
          <i className="pi pi-search text-gray-500" />
          <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder={t("admin.household_collection_event.search_placeholder")} className="border-none text-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.household_collection_event.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.household_collection_event.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label={t("admin.household_collection_event.add_new")}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        exportable={false}
        value={rawRows}
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
        loading={loading && rawRows.length === 0}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("admin.household_collection_event.empty_message")}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "60px" }} />
        <Column
          field="customer_name"
          header={t("admin.household_collection_event.customer_name")}
          body={(row: WasteCollection) => capitalize(row.customer_name) || "-"}
        />
        <Column
          field="contact_no"
          header={t("common.mobile")}
          body={(row: WasteCollection) => row.contact_no || "-"}
        />
        <Column
          field="collection_date"
          header={t("admin.household_collection_event.collection_date", "Collection Date")}
          body={formatCollectionDateTime}
          sortable={SORTABLE_FIELDS.has("collection_date")}
          style={{ minWidth: 170 }}
        />
        <Column
          field="dry_waste"
          header={t("admin.household_collection_event.dry_waste")}
        />
        <Column
          field="wet_waste"
          header={t("admin.household_collection_event.wet_waste")}
        />
        <Column
          field="mixed_waste"
          header={t("admin.household_collection_event.mixed_waste")}
        />
        <Column
          field="sanitary_waste"
          header={t("admin.household_collection_event.sanitary_waste")}
        />
        <Column
          field="total_quantity"
          header={t("admin.household_collection_event.quantity")}
          sortable={SORTABLE_FIELDS.has("total_quantity")}
        />
        <Column
          field="status"
          header={t("admin.household_collection_event.status")}
          body={(row: WasteCollection) => <CollectionStatusBadge value={row.status} />}
          sortable={SORTABLE_FIELDS.has("status")}
        />
        <Column
          field="district_name"
          header={t("common.district")}
          body={(row: WasteCollection) => capitalize(row.district_name) || "-"}
        />
        <Column
          field="area_type_name"
          header={t("common.area_type")}
          body={(row: WasteCollection) => row.area_type_name || "-"}
        />
        <Column
          field="location_name"
          header={t("common.location")}
          body={(row: WasteCollection) =>
            row.location_name
              ? `${capitalize(row.location_name)}${row.location_level ? ` (${row.location_level})` : ""}`
              : "-"
          }
        />
        <Column
          field="vehicle"
          header={t("common.vehicle", "Vehicle")}
          body={(row: WasteCollection) => row.vehicle?.vehicle_no ?? "-"}
        />
        <Column
          field="is_active"
          header={t("common.status")}
          body={statusTemplate}
          style={{ width: "120px" }}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "120px", textAlign: "center" }}
        />
      </DataTable>

      <Dialog
        open={!!imageRow}
        onOpenChange={(open) => {
          if (!open) setImageRow(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("admin.waste_collected_data.captured_images", "Captured images")}
              {imageRow?.customer_name ? ` — ${capitalize(imageRow.customer_name)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 p-1 max-h-[70vh] overflow-y-auto sm:grid-cols-3">
            {(imageRow?.capture_images ?? []).map((img, index) => (
              <a
                key={`${img.url}-${index}`}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="block"
                title={t("common.view")}
              >
                <img
                  src={img.url}
                  alt={`${t("admin.waste_collected_data.captured_images", "Captured image")} ${index + 1}`}
                  className="h-40 w-full rounded-lg border object-cover"
                  loading="lazy"
                />
                {img.weight != null && img.weight !== "" && (
                  <div className="mt-1 text-center text-xs text-gray-500">
                    {img.weight} kg
                  </div>
                )}
              </a>
            ))}
            {!(imageRow?.capture_images?.length) && (
              <div className="col-span-full py-6 text-center text-sm text-gray-500">
                {t("admin.waste_collected_data.no_images", "No captured images found")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
