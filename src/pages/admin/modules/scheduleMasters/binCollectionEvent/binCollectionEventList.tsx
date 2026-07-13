import type { BinCERecord } from "./types";
import type { TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { PencilIcon } from "@/icons";
import { binCollectionEventApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";


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

const today = new Date().toISOString().split("T")[0];

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

export default function BinCollectionEventList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encScheduleMasters, encBinCollectionEvent } = getEncryptedRoute();
  const { newPath: NEW_PATH } = createCrudRoutePaths(encScheduleMasters, encBinCollectionEvent);
  const { editPath: VIEW_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encBinCollectionEvent,
  );

  const [records, setRecords] = useState<BinCERecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _trip_plan: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _collection_point: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _bin: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _waste_type: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _panchayat: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _status: { value: null, matchMode: FilterMatchMode.CONTAINS },
    collection_date: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const loadRecords = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { ...hierarchyParams };
    const dateFilter = filters.collection_date?.value;
    if (dateFilter) params.collection_date = dateFilter;
    binCollectionEventApi
      .readAll({ params })
      .then((data) => setRecords(Array.isArray(data) ? (data as BinCERecord[]) : []))
      .catch((error) => {
        setRecords([]);
        Swal.fire(t("common.error"), extractError(error) ?? t("common.fetch_failed"), "error");
      })
      .finally(() => setLoading(false));
  }, [filters.collection_date?.value, hierarchyParams, t]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const rows = useMemo(
    () =>
      records.map((r) => ({
        ...r,
        _trip_plan: r.trip_plan?.display_code ?? r.trip_assignment_id ?? "-",
        _collection_point: r.collection_point?.cp_name ?? r.collection_point_id ?? "-",
        _bin: r.bin?.bin_name ?? "-",
        _waste_type: r.waste_type?.waste_type_name ?? "-",
        _vehicle: r.vehicle?.vehicle_no ?? "-",
        _panchayat: r.panchayat_name ?? r.panchayat_id ?? "-",
        _status: r.status ?? "-",
        collection_date: r.collection_date ?? "",
      })),
    [records],
  );

  /* ── apply filters locally to get the visible subset ─────────────────────
     PrimeReact filters internally but doesn't expose the result. We replicate
     the same CONTAINS logic so the summary pills always match what's on screen. */
  const GLOBAL_FIELDS = ["_trip_plan", "_collection_point", "_bin", "_waste_type", "_panchayat", "_status", "collection_date"] as const;
  type FilterableField = (typeof GLOBAL_FIELDS)[number];
  const isFilterableField = (field: string): field is FilterableField =>
    (GLOBAL_FIELDS as readonly string[]).includes(field);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      for (const [field, filter] of Object.entries(filters)) {
        const val = filter.value;
        if (!val) continue;
        const needle = String(val).toLowerCase();
        if (field === "global") {
          const hit = GLOBAL_FIELDS.some((f) => String(row[f] ?? "").toLowerCase().includes(needle));
          if (!hit) return false;
        } else if (isFilterableField(field)) {
          if (!String(row[field] ?? "").toLowerCase().includes(needle)) return false;
        }
      }
      return true;
    });
  }, [rows, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── summary stats — computed from filtered rows only ── */
  const { dailyWeight, overallWeight, totalRecords } = useMemo(() => {
    let daily = 0;
    let overall = 0;
    filteredRows.forEach((r) => {
      const w = Number(r.collected_weight_kg ?? 0);
      overall += w;
      if (r.collection_date === today) daily += w;
    });
    return {
      dailyWeight: daily.toFixed(2),
      overallWeight: overall.toFixed(2),
      totalRecords: filteredRows.length,
    };
  }, [filteredRows]);

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Bin Collection Events</h1>
          <p className="text-sm text-gray-500">Scan audit log — one record per operator bin scan</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Daily / Overall / Records — same pattern as Panchayat Base Collection */}
      <div className="flex gap-3 text-sm">
        <span className="bg-slate-100 px-4 py-2 rounded-full">Daily: {dailyWeight}</span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">Overall: {overallWeight}</span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">Records: {totalRecords}</span>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1">
          <InputText
            type="date"
            value={filters.collection_date.value ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                collection_date: { value: e.target.value, matchMode: FilterMatchMode.CONTAINS },
              }))
            }
            className="p-inputtext-sm border-none text-sm"
          />
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={(e) => {
              setGlobalFilterValue(e.target.value);
              setFilters((f) => ({ ...f, global: { value: e.target.value, matchMode: FilterMatchMode.CONTAINS } }));
            }}
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
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        onFilter={(e: DataTableFilterEvent) => setFilters(e.filters as TableFilters)}
        globalFilterFields={["_trip_plan", "_collection_point", "_bin", "_waste_type", "_panchayat", "_status", "collection_date"]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No bin collection events found"
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 60 }} />
        <Column field="_trip_plan" header="Trip Plan" filter showFilterMatchModes={false} />
        <Column field="_collection_point" header="Collection Point" filter showFilterMatchModes={false} />
        <Column field="_panchayat" header="PLB" filter showFilterMatchModes={false} />
        <Column field="_bin" header="Bin" filter showFilterMatchModes={false} />
        <Column field="_waste_type" header="Waste Type" filter showFilterMatchModes={false} />
        <Column field="_vehicle" header="Vehicle" />
        <Column
          field="_status"
          header="Status"
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
          filter
          showFilterMatchModes={false}
          body={(row: BinCERecord) => formatDate(row.collection_date)}
          style={{ width: 120 }}
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
