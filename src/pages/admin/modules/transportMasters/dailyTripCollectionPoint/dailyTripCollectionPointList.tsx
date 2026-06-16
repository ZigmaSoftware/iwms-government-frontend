import type { DailyTripCollectionPointRecord } from "./types";
import type { NamedRef } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable react-hooks/set-state-in-effect */
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
import type { DataTableFilterMeta } from "primereact/datatable";
import { PencilIcon } from "@/icons";
import { dailyTripCollectionPointApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { getEncryptedRoute } from "@/utils/routeCache";


const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  Skipped: "bg-red-100 text-red-800",
};

const Badge = ({ value }: { value?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
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
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  return typeof first === "string" ? first : null;
};

export default function DailyTripCollectionPointList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const { encScheduleMasters, encDailyTripCollectionPoint } = getEncryptedRoute();
  const { newPath: NEW_PATH } = createCrudRoutePaths(encScheduleMasters, encDailyTripCollectionPoint);
  const { editPath: EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encDailyTripCollectionPoint,
  );

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

  const [records, setRecords] = useState<DailyTripCollectionPointRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _trip: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_point: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _bin: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
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
    dailyTripCollectionPointApi
      .readAll({ params })
      .then((data) => setRecords(Array.isArray(data) ? data as DailyTripCollectionPointRecord[] : []))
      .catch((error: unknown) => {
        setRecords([]);
        Swal.fire(t("common.error"), extractError(error) ?? t("common.load_failed"), "error");
      })
      .finally(() => setLoading(false));
  }, [companyUniqueId, projectId, t]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const rows = useMemo(
    () =>
      records
        .filter((row) => {
          const rowCompany = normalizeId(row.company_id ?? row.company_unique_id);
          const rowProject = normalizeId(row.project_id ?? row.project_unique_id);
          return (!rowCompany || rowCompany === companyUniqueId) && (!projectId || !rowProject || rowProject === projectId);
        })
        .map((row) => {
          const tripAssign = row.trip_assignment as NamedRef;
          const tripPlan = (tripAssign?.trip_plan as NamedRef) ?? (tripAssign?.trip_plan_id as NamedRef);
          const collectionPt = row.collection_point as NamedRef;
          const binObj = row.bin as NamedRef;
          const wasteType = (binObj?.waste_type as NamedRef) ?? null;
          
          return {
            ...row,
            _trip: nestedText(tripPlan, ["display_code", "unique_id"]) !== "-"
              ? nestedText(tripPlan, ["display_code", "unique_id"])
              : nestedText(tripAssign, ["unique_id"]) !== "-" ? nestedText(tripAssign, ["unique_id"]) : text(row.trip_assignment_id),
            _collection_point: nestedText(collectionPt, ["cp_name", "collection_point_name", "name"]) !== "-"
              ? nestedText(collectionPt, ["cp_name", "collection_point_name", "name"])
              : text(row.collection_point_id),
            _bin: nestedText(binObj, ["bin_name", "name"]) !== "-"
              ? nestedText(binObj, ["bin_name", "name"])
              : text(row.bin_id),
            _waste_type: nestedText(wasteType, ["waste_type_name", "name"]),
          };
        }),
    [companyUniqueId, projectId, records],
  );

  const onFilter = (event: DataTableFilterEvent) =>
    setFilters(event.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Daily Trip Collection Points</h1>
          <p className="text-sm text-gray-500">Manage collection points assigned to daily trips</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={companyUniqueId || ""}
            onChange={(event) => onCompanyChange(event.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.value} value={company.value}>{company.label}</option>
            ))}
          </select>
          <select
            value={projectId || ""}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.value} value={project.value}>{project.label}</option>
            ))}
          </select>
          <Button
            label="New Collection Point"
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading && rows.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={
          <div className="flex justify-end items-center">
            <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
              <i className="pi pi-search text-gray-500" />
              <InputText
                value={globalFilterValue}
                onChange={onGlobalFilterChange}
                placeholder="Search trip collection points..."
                className="p-inputtext-sm !border-0 !shadow-none !outline-none"
              />
            </div>
          </div>
        }
        stripedRows
        showGridlines
        emptyMessage="No daily trip collection points found."
        globalFilterFields={["unique_id", "_trip", "_collection_point", "_bin", "_waste_type", "status"]}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={(_, options: { rowIndex: number }) => options.rowIndex + 1} style={{ width: 60 }} />
        <Column field="unique_id" header="ID" sortable filter showFilterMatchModes={false} style={{ minWidth: 150 }} />
        <Column field="_trip" header="Trip" sortable filter showFilterMatchModes={false} style={{ minWidth: 170 }} />
        <Column field="_collection_point" header="Collection Point" sortable filter showFilterMatchModes={false} style={{ minWidth: 180 }} />
        <Column field="_bin" header="Bin" sortable filter showFilterMatchModes={false} />
        <Column field="_waste_type" header="Waste Type" sortable />
        <Column field="sequence" header="Seq" sortable style={{ width: 90 }} />
        <Column field="collected_weight_kg" header="Weight (kg)" sortable body={(row: DailyTripCollectionPointRecord) => text(row.collected_weight_kg)} />
        <Column field="status" header="Status" body={(row: DailyTripCollectionPointRecord) => <Badge value={row.status} />} sortable filter showFilterMatchModes={false} />
        <Column
          header={t("common.actions")}
          body={(row: DailyTripCollectionPointRecord) => (
            <div className="flex justify-center">
              <button
                onClick={() => navigate(EDIT_PATH(row.unique_id), {
                  state: { companyUniqueId: row.company_id ?? companyUniqueId, projectId: row.project_id ?? projectId },
                })}
                className="text-blue-600 hover:text-blue-800"
                title={t("common.edit")}
              >
                <PencilIcon className="size-5" />
              </button>
            </div>
          )}
          style={{ width: 120 }}
        />
      </DataTable>
    </div>
  );
}
