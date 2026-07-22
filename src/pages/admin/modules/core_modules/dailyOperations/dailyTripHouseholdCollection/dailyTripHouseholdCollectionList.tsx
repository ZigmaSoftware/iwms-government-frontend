import type { DailyTripHouseholdCollectionRecord, NamedRef } from "./types";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { dailyTripHouseholdCollectionApi } from "@/helpers/admin";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { exportRecordsToExcel, getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { downloadRecordsPdf } from "@/utils/exportPdf";


const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  "Not Available": "bg-red-100 text-red-800",
  "Collect Later": "bg-orange-100 text-orange-800",
  // Legacy values kept so historical rows still render with a colour.
  "Not Collected": "bg-red-100 text-red-800",
  Skipped: "bg-orange-100 text-orange-800",
  Missed: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS = ["Pending", "Collected", "Not Available", "Collect Later"];

const COLLECTION_TYPE_LABELS: Record<string, string> = {
  household_collection: "Household Collection",
  bulk_waste_collection: "Bulk Waste Collection",
};

const Badge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"
    }`}
  >
    {value ?? "-"}
  </span>
);

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const text = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === ""
    ? "-"
    : String(value);

const nestedText = (obj: NamedRef, keys: string[]): string => {
  if (!obj || typeof obj !== "object") return "-";
  for (const key of keys) {
    const value = obj[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "-";
};

const extractError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  const first = Object.values(data as object)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === "string") return first;
  return null;
};

export default function DailyTripHouseholdCollectionList() {
  const { t } = useTranslation();

  const [allRecords, setAllRecords] = useState<
    DailyTripHouseholdCollectionRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [dateFilter, setDateFilter] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _assignment: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_type: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _customer: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  const buildParams = useCallback(() => {
    const params: Record<string, string> = { ...hierarchyParams };
    if (dateFilter) params.date = dateFilter;
    return params;
  }, [dateFilter, hierarchyParams]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    (
      dailyTripHouseholdCollectionApi.readAll({
        params: buildParams(),
      }) as Promise<DailyTripHouseholdCollectionRecord[]>
    )
      .then((data) => {
        if (mounted) setAllRecords(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (mounted)
          Swal.fire({
            icon: "error",
            title: t("common.error"),
            text: extractError(err) ?? String(err),
          });
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [buildParams, t]);

  const rows = useMemo(() => allRecords.map((rec) => ({
    ...rec,
    _assignment:
      nestedText(rec.trip_assignment as NamedRef, [
        "trip_plan_display_code",
        "unique_id",
      ]) || rec.trip_assignment_id || "",
    _customer: nestedText(rec.customer as NamedRef, ["customer_name"]) || "",
    _trip_date: nestedText(rec.trip_assignment as NamedRef, ["trip_date"]),
    _collection_type:
      COLLECTION_TYPE_LABELS[String(rec.collection_type ?? "")] ??
      text(rec.collection_type),
    _location: rec.hierarchy?.location_name
      ?? nestedText(rec.customer as NamedRef, ["location_name"]),
  })), [allRecords]);

  const data = rows;

  const globalFields = [
    "unique_id", "_assignment", "_collection_type", "_customer", "_location",
    "status", "_trip_date",
  ] as const;

  const filteredRows = useMemo(() => rows.filter((row) => {
    const search = globalFilterValue.trim().toLowerCase();
    if (search && !globalFields.some((field) => String(row[field] ?? "").toLowerCase().includes(search))) {
      return false;
    }
    return Object.entries(filters).every(([field, filter]) => {
      const filterValue = "value" in filter ? filter.value : null;
      if (field === "global" || !filterValue) return true;
      return String((row as Record<string, unknown>)[field] ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    });
  }), [filters, globalFilterValue, rows]);

  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + Number(row.collected_weight_kg ?? 0), 0);
    const daily = filteredRows.reduce(
      (sum, row) => sum + (row._trip_date === today ? Number(row.collected_weight_kg ?? 0) : 0),
      0,
    );
    return { daily: daily.toFixed(2), overall: total.toFixed(2), records: filteredRows.length };
  }, [filteredRows, today]);

  const exportRows = filteredRows.map((row) => ({
    ID: row.unique_id,
    "Trip Assignment": row._assignment,
    "Trip Date": row._trip_date,
    "Collection Type": row._collection_type,
    Customer: row._customer,
    "Local Body": row._location,
    Sequence: row.sequence ?? "-",
    "Weight (kg)": row.collected_weight_kg ?? "-",
    Status: row.status ?? "-",
    Reason: row.status_reason ?? "-",
    "Collected At": row.collected_at ?? "-",
  }));

  const handleExcelDownload = () =>
    exportRecordsToExcel(exportRows, getAdminScreenExcelFilename("all"), "Household Collections");

  const handlePdfDownload = () => {
    try {
      downloadRecordsPdf({
        title: "Household Collection Events",
        filename: "household_collection_events.pdf",
        rows: exportRows,
        columns: Object.keys(exportRows[0] ?? {}).map((key) => ({ key, label: key })),
      });
    } catch (error) {
      Swal.fire(t("common.error"), error instanceof Error ? error.message : "PDF export failed.", "error");
    }
  };

  const onFilter = (e: DataTableFilterEvent) =>
    setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  const updateRecord = (uniqueId: string, patch: Partial<DailyTripHouseholdCollectionRecord>) => {
    setAllRecords((records) =>
      records.map((record) =>
        record.unique_id === uniqueId
          ? { ...record, ...patch }
          : record,
      ),
    );
  };

  const saveStatus = async (row: DailyTripHouseholdCollectionRecord) => {
    const status = String(row.status ?? "Pending");
    const reason = String(row.status_reason ?? "").trim();
    if ((status === "Not Available" || status === "Collect Later") && !reason) {
      Swal.fire("Missing reason", "Reason is required for Not Available and Collect Later.", "warning");
      return;
    }
    try {
      await dailyTripHouseholdCollectionApi.update(row.unique_id, {
        status,
        status_reason: reason || null,
        is_collected: status === "Collected",
        collected_at: status === "Collected" ? row.collected_at : null,
        collected_weight_kg: status === "Collected" ? row.collected_weight_kg : null,
      });
      Swal.fire("Saved", "Household collection status updated.", "success");
    } catch (err) {
      Swal.fire("Error", extractError(err) ?? "Unable to update household collection status.", "error");
    }
  };

  const renderHeader = () => (
    <div className="space-y-4">
      <HierarchyFilterBar onChange={setHierarchyParams} />
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-4 py-2">Daily: {summary.daily}</span>
        <span className="rounded-full bg-slate-100 px-4 py-2">Overall: {summary.overall}</span>
        <span className="rounded-full bg-slate-100 px-4 py-2">Records: {summary.records}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button label="Download Excel" icon="pi pi-file-excel" className="p-button-outlined p-button-sm" disabled={!exportRows.length} onClick={handleExcelDownload} />
          <Button label="Download PDF" icon="pi pi-file-pdf" className="p-button-outlined p-button-sm" disabled={!exportRows.length} onClick={handlePdfDownload} />
        </div>
        <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1">
          <InputText type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="border-none text-sm" />
          <i className="pi pi-search text-gray-500" />
          <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Search household collections..." className="border-none text-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Household Collection Points
          </h1>
          <p className="text-sm text-gray-500">
            Per-household collection status within daily trip assignments
          </p>
        </div>
      </div>

      <DataTable
        exportable={false}
        value={data}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && data.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage="No household collection records found."
        globalFilterFields={[
          "unique_id",
          "_assignment",
          "_collection_type",
          "_customer",
          "_location",
          "status",
          "_trip_date",
        ]}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={(_: any, { rowIndex }: any) => rowIndex + 1}
          style={{ width: 60 }}
        />
        <Column
          field="unique_id"
          header="ID"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 150 }}
        />
        <Column
          field="_assignment"
          header="Trip Assignment"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
          body={(row) =>
            nestedText(row.trip_assignment as NamedRef, [
              "trip_plan_display_code",
              "unique_id",
            ])
          }
        />
        <Column
          field="_collection_type"
          header="Collection Type"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 160 }}
        />
        <Column
          field="_customer"
          header="Customer"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 160 }}
          body={(row) =>
            nestedText(row.customer as NamedRef, ["customer_name"])
          }
        />
        <Column
          field="_location"
          header="Location"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 180 }}
          body={(row: DailyTripHouseholdCollectionRecord) => {
            const locationName = row.hierarchy?.location_name
              ?? nestedText(row.customer as NamedRef, ["location_name"]);
            if (locationName && locationName !== "-") {
              return (
                <span className="text-sm text-gray-800">
                  {locationName}
                  {row.hierarchy?.location_level && (
                    <span className="ml-1 text-xs text-indigo-500 font-medium">
                      ({row.hierarchy.location_level})
                    </span>
                  )}
                </span>
              );
            }
            return <span className="text-sm text-gray-400">—</span>;
          }}
        />
        <Column field="_trip_date" header="Trip Date" sortable filter showFilterMatchModes={false} style={{ minWidth: 110 }} />
        <Column
          field="sequence"
          header="Seq"
          sortable
          style={{ width: 70 }}
          body={(row) => text(row.sequence)}
        />
        <Column
          field="collected_weight_kg"
          header="Weight (kg)"
          sortable
          style={{ minWidth: 110 }}
          body={(row: DailyTripHouseholdCollectionRecord) =>
            row.collected_weight_kg != null ? (
              <span className="font-semibold text-gray-800">
                {Number(row.collected_weight_kg).toFixed(2)}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )
          }
        />
        <Column
          field="status"
          header="Status"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 180 }}
          body={(row: DailyTripHouseholdCollectionRecord) => (
            <div className="flex items-center gap-2">
              <Badge value={row.status} />
              <select
                value={row.status ?? "Pending"}
                onChange={(event) =>
                  updateRecord(row.unique_id, {
                    status: event.target.value,
                    is_collected: event.target.value === "Collected",
                  })
                }
                className="h-8 rounded-md border border-gray-300 px-2 text-xs"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )}
        />
        <Column
          field="status_reason"
          header="Reason"
          style={{ minWidth: 260 }}
          body={(row: DailyTripHouseholdCollectionRecord) => (
            <input
              value={String(row.status_reason ?? "")}
              onChange={(event) => updateRecord(row.unique_id, { status_reason: event.target.value })}
              placeholder={row.status === "Not Available" ? "Household not available today..." : row.status === "Collect Later" ? "I will collect today later..." : "Optional reason"}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
            />
          )}
        />
        <Column
          header="Save"
          style={{ width: 90 }}
          body={(row: DailyTripHouseholdCollectionRecord) => (
            <button
              type="button"
              onClick={() => saveStatus(row)}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              Save
            </button>
          )}
        />
        <Column
          field="collected_at"
          header="Collected At"
          sortable
          style={{ minWidth: 150 }}
          body={(row: DailyTripHouseholdCollectionRecord) =>
            text(row.collected_at)
          }
        />
        <Column
          field="waste_collection_id"
          header="Waste Collection"
          style={{ minWidth: 160 }}
          body={(row: DailyTripHouseholdCollectionRecord) =>
            row.waste_collection_id ? (
              <span className="text-xs font-mono text-gray-600">
                {String(row.waste_collection_id)}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )
          }
        />
      </DataTable>
    </div>
  );
}
