import type { DailyTripHouseholdCollectionRecord, NamedRef } from "./types";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { dailyTripHouseholdCollectionApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";


const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  Skipped: "bg-red-100 text-red-800",
  Missed: "bg-orange-100 text-orange-800",
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
  const location = useLocation();
  const restoredState = location.state as {
    companyUniqueId?: string;
    projectId?: string;
  } | null;

  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    setProjectId,
    onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true,
    initialCompanyId: restoredState?.companyUniqueId,
    initialProjectId: restoredState?.projectId,
  });

  const [allRecords, setAllRecords] = useState<
    DailyTripHouseholdCollectionRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    company_name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    project_name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _assignment: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _customer: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    if (!companyUniqueId && !isSuperAdmin) {
      setAllRecords([]);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
    if (projectId) params.project_id = projectId;
    (
      dailyTripHouseholdCollectionApi.readAll({
        params,
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
  }, [companyUniqueId, projectId, t]);

  const rows = allRecords.map((rec) => ({
    ...rec,
    _assignment:
      nestedText(rec.trip_assignment as NamedRef, [
        "trip_plan_display_code",
        "unique_id",
      ]) || rec.trip_assignment_id || "",
    _customer: nestedText(rec.customer as NamedRef, ["customer_name"]) || "",
    _location:
      nestedText(rec.panchayat as NamedRef, ["panchayat_name"]) !== "-"
        ? nestedText(rec.panchayat as NamedRef, ["panchayat_name"])
        : nestedText(rec.ward as NamedRef, ["ward_name"]),
    company_name: text(
      (rec as any).company_name ??
        (rec as any).company_id?.name ??
        rec.company_id
    ),
    project_name: text(
      (rec as any).project_name ??
        (rec as any).project_id?.name ??
        rec.project_id
    ),
  }));

  const data = (() => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];
    return rows.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
      return (
        (!companyUniqueId || rowCompanyId === companyUniqueId) &&
        (!projectId || rowProjectId === projectId)
      );
    });
  })();

  const onFilter = (e: DataTableFilterEvent) =>
    setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
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
        <div className="flex items-center gap-3">
          <select
            value={companyUniqueId || ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={
              (!companyUniqueId && !isSuperAdmin) || projects.length === 0
            }
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
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
          "company_name",
          "project_name",
          "_assignment",
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
          field="company_name"
          header="Company"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 140 }}
        />
        <Column
          field="project_name"
          header="Project"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 140 }}
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
          header="Location (PLB / Ward)"
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
            if (row.ward && (row.ward as any).ward_name) {
              return (
                <span className="text-sm text-gray-800">
                  {String((row.ward as any).ward_name)}
                  <span className="ml-1 text-xs text-teal-500 font-medium">
                    (Ward)
                  </span>
                </span>
              );
            }
            return <span className="text-sm text-gray-400">-</span>;
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
          style={{ minWidth: 110 }}
          body={(row: DailyTripHouseholdCollectionRecord) => (
            <Badge value={row.status} />
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
