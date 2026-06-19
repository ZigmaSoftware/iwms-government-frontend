import type { TableFilters, TripPlanCPRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { PencilIcon } from "@/icons";
import { tripPlanCollectionPointApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { getEncryptedRoute } from "@/utils/routeCache";


const COLLECTION_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "bin_collection", label: "Bin Collection" },
  { value: "household_collection", label: "Household Collection" },
];

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

export default function TripPlanCollectionPointList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const { encScheduleMasters, encTripPlanCollectionPoints } = getEncryptedRoute();
  const { newPath: NEW_PATH, editPath: EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encTripPlanCollectionPoints,
  );

  const [records, setRecords] = useState<TripPlanCPRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectionTypeFilter, setCollectionTypeFilter] = useState("");
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _trip_plan: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _identifier: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _detail: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const loadRecords = useCallback(() => {
    if (!companyUniqueId && !isSuperAdmin) {
      setRecords([]);
      return;
    }
    setLoading(true);
    const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
    if (projectId) params.project_id = projectId;
    if (collectionTypeFilter) params.collection_type = collectionTypeFilter;
    tripPlanCollectionPointApi
      .readAll({ params })
      .then((data) => setRecords(Array.isArray(data) ? (data as TripPlanCPRecord[]) : []))
      .catch((error) => {
        setRecords([]);
        Swal.fire(t("common.error"), extractError(error) ?? t("common.fetch_failed"), "error");
      })
      .finally(() => setLoading(false));
  }, [companyUniqueId, projectId, collectionTypeFilter, t, isSuperAdmin]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const isBinView = collectionTypeFilter === "bin_collection";
  const isHouseholdView = collectionTypeFilter === "household_collection";

  const rows = useMemo(
    () =>
      records.map((r) => ({
        ...r,
        _trip_plan: r.trip_plan?.display_code ?? r.trip_plan_id ?? "-",
        _collection_type_label:
          r.collection_type === "bin_collection"
            ? "Bin Collection"
            : r.collection_type === "household_collection"
              ? "Household Collection"
              : r.collection_type ?? "-",
        // bin collection display fields
        _collection_point: r.collection_point?.cp_name ?? r.collection_point_id ?? "-",
        _bin: r.bin?.bin_name ?? r.bin_id ?? "-",
        // household display fields
        _customer: r.customer?.customer_name ?? r.customer_id ?? "-",
        _customer_location: "-",
        // generic identifier/detail for combined view
        _identifier:
          r.collection_type === "bin_collection"
            ? (r.collection_point?.cp_name ?? r.collection_point_id ?? "-")
            : (r.customer?.customer_name ?? r.customer_id ?? "-"),
        _detail:
          r.collection_type === "bin_collection"
            ? (r.bin?.bin_name ?? r.bin_id ?? "-")
            : "-",
      })),
    [records],
  );

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Trip Plan Collection Points</h1>
          <p className="text-sm text-gray-500">Manage stop list for each trip plan</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isSuperAdmin && (
            <>
              <select
                value={companyUniqueId || ""}
                onChange={(e) => onCompanyChange(e.target.value)}
                disabled={companies.length === 0}
                className="rounded border px-3 py-2 text-sm"
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
                disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </>
          )}
          {/* Collection Type filter */}
          <select
            value={collectionTypeFilter}
            onChange={(e) => setCollectionTypeFilter(e.target.value)}
            className="rounded border px-3 py-2 text-sm font-medium"
          >
            {COLLECTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            label="Add Stop"
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={(e) => {
              setGlobalFilterValue(e.target.value);
              setFilters((f) => ({
                ...f,
                global: { value: e.target.value, matchMode: FilterMatchMode.CONTAINS },
              }));
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
        globalFilterFields={["_trip_plan", "_identifier", "_detail", "_collection_type_label"]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No trip plan collection points found"
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 60 }}
        />
        <Column field="_trip_plan" header="Trip Plan" filter showFilterMatchModes={false} />

        {/* Collection Type column — hidden when a specific type is already filtered */}
        {!collectionTypeFilter && (
          <Column
            field="_collection_type_label"
            header="Collection Type"
            body={(row) => (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  row.collection_type === "bin_collection"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {row._collection_type_label}
              </span>
            )}
            style={{ width: 160 }}
          />
        )}

        {/* Bin Collection columns */}
        {(isBinView || !collectionTypeFilter) && (
          <>
            {(isBinView || !isHouseholdView) && (
              <Column
                field={isBinView ? "_collection_point" : "_identifier"}
                header={isBinView ? "Collection Point" : "Collection Point / Customer"}
                filter
                showFilterMatchModes={false}
              />
            )}
            {isBinView && (
              <Column field="_bin" header="Bin" filter showFilterMatchModes={false} />
            )}
          </>
        )}

        {/* Household Collection columns */}
        {isHouseholdView && (
          <>
            <Column field="_customer" header="Customer" filter showFilterMatchModes={false} />
            <Column field="_customer_location" header="Location" style={{ width: 150 }} />
          </>
        )}

        {/* Combined detail column for "All Types" view */}
        {!collectionTypeFilter && (
          <Column field="_detail" header="Detail" filter showFilterMatchModes={false} />
        )}

        <Column field="sequence" header="Sequence" style={{ width: 100 }} />
        <Column
          header="Active"
          body={(row: TripPlanCPRecord) => (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                row.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {row.is_active ? "Yes" : "No"}
            </span>
          )}
          style={{ width: 90 }}
        />
        <Column
          header={t("common.actions")}
          style={{ width: 100 }}
          body={(row: TripPlanCPRecord) => (
            <button
              title={t("common.edit")}
              onClick={() =>
                navigate(EDIT_PATH(row.unique_id), {
                  state: { record: row, companyUniqueId, projectId },
                })
              }
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
