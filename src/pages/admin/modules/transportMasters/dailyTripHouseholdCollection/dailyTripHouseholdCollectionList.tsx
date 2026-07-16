import type { DailyTripHouseholdCollectionRecord, NamedRef } from "./types";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { dailyTripHouseholdCollectionApi } from "@/helpers/admin";


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
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _assignment: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_type: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _customer: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    (
      dailyTripHouseholdCollectionApi.readAll({
        params: {},
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
  }, [t]);

  const rows = allRecords.map((rec) => ({
    ...rec,
    _assignment:
      nestedText(rec.trip_assignment as NamedRef, [
        "trip_plan_display_code",
        "unique_id",
      ]) || rec.trip_assignment_id || "",
    _customer: nestedText(rec.customer as NamedRef, ["customer_name"]) || "",
    _collection_type:
      COLLECTION_TYPE_LABELS[String(rec.collection_type ?? "")] ??
      text(rec.collection_type),
    _location:
      nestedText(rec.panchayat as NamedRef, ["panchayat_name"]) !== "-"
        ? nestedText(rec.panchayat as NamedRef, ["panchayat_name"])
        : "",
  }));

  const data = rows;

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

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: "Search household collections...",
    });

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
            if (row.panchayat && (row.panchayat as any).panchayat_name) {
              return (
                <span className="text-sm text-gray-800">
                  {String((row.panchayat as any).panchayat_name)}
                  <span className="ml-1 text-xs text-indigo-500 font-medium">
                    (PLB)
                  </span>
                </span>
              );
            }
            return <span className="text-sm text-gray-400">—</span>;
          }}
        />
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
