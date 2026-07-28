import type { BinCERecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { PencilIcon } from "@/icons";
import { binCollectionEventApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { exportRecordsToExcel, getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { downloadRecordsPdf } from "@/utils/exportPdf";
import { capitalize } from "@/utils/capitalize";

const extractError = (error: unknown): string | null => {
  const data = (error as any)?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

const formatDate = (val?: string) => {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Trip-plan-style 12hr clock, applied to a full timestamp (created_at) since
// this event only carries a collection *date*, not a separate time field.
const formatTime12Hour = (val?: string): string => {
  if (!val) return "";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return "";
  const hour = date.getHours();
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${period}`;
};

const formatCollectionDateTime = (row: BinCERecord) => {
  const date = formatDate(row.collection_date);
  const time = formatTime12Hour(row.created_at);
  return time ? `${date}, ${time}` : date;
};

const STATUS_STYLES: Record<string, string> = {
  Collected: "bg-green-100 text-green-800",
  "Not Collected": "bg-red-100 text-red-800",
  "Collect Later": "bg-amber-100 text-amber-800",
};

const StatusBadge = ({ value }: { value?: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
    {value || "-"}
  </span>
);

const toRecordList = (value: unknown): BinCERecord[] => {
  if (Array.isArray(value)) return value as BinCERecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: BinCERecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["collection_date", "status"]);

type SummaryState = { overallWeight: string; dailyWeight: string; count: number };
const EMPTY_SUMMARY: SummaryState = { overallWeight: "0", dailyWeight: "0", count: 0 };

const enrichRow = (r: BinCERecord) => ({
  ...r,
  _trip_plan: r.trip_plan?.display_code ?? r.trip_assignment_id ?? "-",
  _collection_point: r.collection_point?.cp_name ?? r.collection_point_id ?? "-",
  _bin: r.bin?.bin_name ?? "-",
  _waste_type: r.waste_type?.waste_type_name ?? "-",
  _vehicle: r.vehicle?.vehicle_no ?? "-",
  _location: r.location_name ?? r.panchayat_name ?? r.panchayat_id ?? "-",
  _ward: r.ward_name ?? r.ward_id ?? "-",
  _status: r.status ?? "-",
  collection_date: r.collection_date ?? "",
});

export default function BinCollectionEventList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encDailyOperations, encBinCollectionEvent } = getEncryptedRoute();
  const { newPath: NEW_PATH } = createCrudRoutePaths(encDailyOperations, encBinCollectionEvent);
  const { editPath: VIEW_PATH } = createCrudRoutePaths(
    encDailyOperations,
    encBinCollectionEvent,
  );

  const [rawRows, setRawRows] = useState<BinCERecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [collectionDateFilter, setCollectionDateFilter] = useState("");
  const [summary, setSummary] = useState<SummaryState>(EMPTY_SUMMARY);

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const filterParams = {
    ...hierarchyParams,
    ...(collectionDateFilter ? { collection_date: collectionDateFilter } : {}),
  };

  const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setLoading(true);
    try {
      const response = await binCollectionEventApi.readAllwithPaginated(page, limit, {
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
    } catch (error) {
      setRawRows([]);
      Swal.fire(t("common.error"), extractError(error) ?? t("common.fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await binCollectionEventApi.action<SummaryState>("summary", undefined, {
        params: {
          ...filterParams,
          ...(searchTerm ? { search: searchTerm } : {}),
        },
      });
      setSummary({
        overallWeight: response?.overallWeight ?? "0",
        dailyWeight: response?.dailyWeight ?? "0",
        count: response?.count ?? 0,
      });
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  };

  // Reset to page 1 whenever a non-pagination filter changes.
  useEffect(() => {
    setFirst(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyParams, collectionDateFilter]);

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, hierarchyParams, collectionDateFilter]);

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyParams, collectionDateFilter, searchTerm]);

  const rows = useMemo(() => rawRows.map(enrichRow), [rawRows]);

  const handleExcelDownload = async () => {
    setIsExporting(true);
    try {
      const all = await binCollectionEventApi.readAllForExport({ params: filterParams });
      const exportRows = toRecordList(all).map(enrichRow).map((row) => ({
        "Trip Plan": row._trip_plan,
        "Collection Point": row._collection_point,
        "Local Body": row._location,
        Ward: row._ward,
        Bin: row._bin,
        "Waste Type": row._waste_type,
        Vehicle: row._vehicle,
        Status: row._status,
        Reason: row.status_reason || row.notes || "-",
        "Weight (kg)": row.collected_weight_kg ?? "-",
        "Collection Date": formatCollectionDateTime(row),
      }));
      exportRecordsToExcel(
        exportRows,
        getAdminScreenExcelFilename("all"),
        "Bin Collection Events",
      );
    } catch (error) {
      Swal.fire(t("common.error"), extractError(error) ?? "Export failed.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfDownload = async () => {
    setIsExporting(true);
    try {
      const all = await binCollectionEventApi.readAllForExport({ params: filterParams });
      const exportRows = toRecordList(all).map(enrichRow).map((row) => ({
        "Trip Plan": row._trip_plan,
        "Collection Point": row._collection_point,
        "Local Body": row._location,
        Ward: row._ward,
        Bin: row._bin,
        "Waste Type": row._waste_type,
        Vehicle: row._vehicle,
        Status: row._status,
        Reason: row.status_reason || row.notes || "-",
        "Weight (kg)": row.collected_weight_kg ?? "-",
        "Collection Date": formatCollectionDateTime(row),
      }));
      downloadRecordsPdf({
        title: "Secondary Bin Collection Events",
        filename: "secondary_bin_collection_events.pdf",
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

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(event.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Bin Collection Events</h1>
          <p className="text-sm text-gray-500">Scan audit log — one record per operator bin scan</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label="Download Excel"
            icon="pi pi-file-excel"
            className="p-button-outlined p-button-sm"
            disabled={isExporting}
            onClick={() => void handleExcelDownload()}
          />
          <Button
            label="Download PDF"
            icon="pi pi-file-pdf"
            className="p-button-outlined p-button-sm"
            disabled={isExporting}
            onClick={() => void handlePdfDownload()}
          />
          <Button
            label="Add Bin Collection Event"
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(NEW_PATH)}
          />
        </div>
      </div>

      {/* Hierarchy filter — capped to the caller's own corporation subtree */}
      <HierarchyFilterBar onChange={setHierarchyParams} />

      {/* Daily / Overall / Records — server-computed via the summary action so
          totals stay correct once the list itself is paginated. */}
      <div className="flex gap-3 text-sm">
        <span className="bg-slate-100 px-4 py-2 rounded-full">Daily: {Number(summary.dailyWeight).toFixed(2)}</span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">Overall: {Number(summary.overallWeight).toFixed(2)}</span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">Records: {summary.count}</span>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1">
          <InputText
            type="date"
            value={collectionDateFilter}
            onChange={(e) => setCollectionDateFilter(e.target.value)}
            className="p-inputtext-sm border-none text-sm"
          />
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("common.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        exportable={false}
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
        loading={loading}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No bin collection events found"
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 60 }} />
        <Column field="_trip_plan" header="Trip Plan" />
        <Column field="_collection_point" header="Collection Point" />
        <Column
          field="_location"
          header="Local Body"
          body={(row: BinCERecord) =>
            row.location_name
              ? `${capitalize(row.location_name)}${row.location_level ? ` (${row.location_level})` : ""}`
              : "-"
          }
        />
        <Column field="_bin" header="Bin" />
        <Column field="_waste_type" header="Waste Type" />
        <Column field="_vehicle" header="Vehicle" />
        <Column
          field="status"
          header="Status"
          sortable={SORTABLE_FIELDS.has("status")}
          body={(row: BinCERecord) => <StatusBadge value={row.status} />}
          style={{ minWidth: 130 }}
        />
        <Column
          field="status_reason"
          header="Reason"
          body={(row: BinCERecord) => row.status_reason || row.notes || "-"}
          style={{ minWidth: 220 }}
        />
        <Column
          header="Weight (kg)"
          body={(row: BinCERecord) => row.collected_weight_kg ?? "-"}
          style={{ width: 110 }}
        />
        <Column
          field="collection_date"
          header="Collection Date"
          sortable={SORTABLE_FIELDS.has("collection_date")}
          body={formatCollectionDateTime}
          style={{ width: 170 }}
        />
        <Column
          header={t("common.actions")}
          style={{ width: 90 }}
          body={(row: BinCERecord) => (
            <button
              title="Edit"
              onClick={() => navigate(VIEW_PATH(row.unique_id ?? ""))}
              className="text-blue-600 hover:text-blue-800"
            >
              <PencilIcon className="size-5" />
            </button>
          )}
        />
      </DataTable>
    </div>
  );
}
