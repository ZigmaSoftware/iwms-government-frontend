import type { TripPlanRecord } from "./types";
import type { DailyTripAssignmentRecord } from "./types";
import type { CollectionTypeKey } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { dailyTripAssignmentApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import { normalizeList } from "@/utils/forms";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

const Badge = ({ value, styleMap }: { value?: string; styleMap: Record<string, string> }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styleMap[value ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
    {value ?? "—"}
  </span>
);


const COLLECTION_TYPE_STYLES: Record<CollectionTypeKey, string> = {
  bin:       "bg-blue-100 text-blue-800",
  household: "bg-green-100 text-green-800",
  both:      "bg-purple-100 text-purple-800",
  unknown:   "bg-gray-100 text-gray-500",
};

const COLLECTION_TYPE_LABELS: Record<CollectionTypeKey, string> = {
  bin:       "Bin Collection",
  household: "Household",
  both:      "Bin + Household",
  unknown:   "Unknown",
};

const getCollectionTypeKey = (rec: DailyTripAssignmentRecord): CollectionTypeKey => {
  const ct = rec.collection_types ?? {
    has_bin:       rec.trip_plan?.has_bin  ?? false,
    has_household: rec.trip_plan?.has_household ?? false,
  };
  if (ct.has_bin && ct.has_household) return "both";
  if (ct.has_bin)       return "bin";
  if (ct.has_household) return "household";
  return "unknown";
};

const CollectionTypeBadge = ({ rec }: { rec: DailyTripAssignmentRecord }) => {
  const key = getCollectionTypeKey(rec);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLLECTION_TYPE_STYLES[key]}`}>
      {COLLECTION_TYPE_LABELS[key]}
    </span>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractError = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

const normalizeId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeId(record.unique_id ?? record.id ?? record.value);
  }
  return String(value).trim();
};

const getPanchayatName = (record: any, plan?: TripPlanRecord): string =>
  String(
    record?.panchayat?.panchayat_name ??
      record?.panchayat?.name ??
      record?.trip_plan?.panchayat?.panchayat_name ??
      plan?.panchayat?.panchayat_name ??
      plan?.panchayat?.name ??
      record?.panchayat_id ??
      plan?.panchayat_id ??
      ""
  ).trim();

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyTripAssignmentList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;

  const { encScheduleMasters, encDailyTripAssignment } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encDailyTripAssignment,
  );

  const {
    companyUniqueId, projectId, projects, companies,
    isSuperAdmin, setProjectId, onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true,
    initialCompanyId: restoredState?.companyUniqueId,
    initialProjectId: restoredState?.projectId,
  });

  const [allAssignments, setAllAssignments] = useState<DailyTripAssignmentRecord[]>([]);
  const [tripPlanLookup, setTripPlanLookup] = useState<Record<string, TripPlanRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [collectionTypeFilter, setCollectionTypeFilter] = useState<"all" | CollectionTypeKey>("all");
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _trip_plan: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _staff: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    trip_date: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ── load assignments ── */
  useEffect(() => {
    if (!companyUniqueId && !isSuperAdmin) { setAllAssignments([]); return; }
    let mounted = true;
    setIsLoading(true);
    const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
    if (projectId) params.project_id = projectId;
    Promise.all([
      dailyTripAssignmentApi.readAll({ params }) as Promise<DailyTripAssignmentRecord[]>,
      adminApi.tripPlans.readAll({ params }) as Promise<any>,
    ])
      .then(([assignmentData, tripPlanData]) => {
        if (!mounted) return;
        setAllAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        const lookup: Record<string, TripPlanRecord> = {};
        normalizeList(tripPlanData).forEach((plan: TripPlanRecord) => {
          const id = normalizeId(plan.unique_id ?? plan.id);
          if (id) lookup[id] = plan;
        });
        setTripPlanLookup(lookup);
      })
      .catch((err) => { if (mounted) Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) }); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [companyUniqueId, projectId, t]);

  /* ── enrich + filter rows ── */
  const rows = (() => {
    if (!companyUniqueId && !isSuperAdmin) return [];
    return allAssignments
      .filter((row) => {
        const rc = normalizeId(row.company_id ?? row.company_unique_id);
        const rp = normalizeId(row.project_id ?? row.project_unique_id);
        if (!(!companyUniqueId || rc === companyUniqueId)) return false;
        if (!(!projectId || rp === projectId)) return false;
        if (collectionTypeFilter !== "all" && getCollectionTypeKey(row) !== collectionTypeFilter) return false;
        return true;
      })
      .map((rec) => ({
        ...rec,
        _trip_plan: rec.trip_plan?.display_code ?? rec.trip_plan_id ?? "",
        _staff: rec.effective_staff?.display_code ?? rec.staff_template?.display_code ?? rec.staff_template_id ?? "",
        _location: rec.panchayat?.panchayat_name ?? rec.panchayat_id ?? "",
        _waste: (rec.waste_type as any)?.waste_type_name ?? rec.waste_type_id ?? "",
        _collection_type: getCollectionTypeKey(rec),
      }));
  })();

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  /* ── column templates ── */
  const statusTemplate = (row: DailyTripAssignmentRecord) => (
    <Badge value={row.status} styleMap={STATUS_STYLES} />
  );

  const actionTemplate = (row: DailyTripAssignmentRecord) => {
    const rowId = row.unique_id ?? String((row as any).id ?? "");
    return (
      <div className="flex justify-center">
        <button
          title={t("common.edit")}
          onClick={() =>
            navigate(ENC_EDIT_PATH(rowId), {
              state: {
                companyUniqueId: (row.company_unique_id ?? row.company_id) as string | undefined,
                projectId: (row.project_unique_id ?? row.project_id) as string | undefined,
              },
            })
          }
          disabled={!rowId || row.status === "Completed" || row.status === "Cancelled"}
          className="text-blue-600 hover:text-blue-800 disabled:opacity-30"
        >
          <PencilIcon className="size-5" />
        </button>
      </div>
    );
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: "Search assignments...",
    });

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Daily Trip Assignments</h1>
          <p className="text-sm text-gray-500">Manage scheduled trip assignments by date and panchayat</p>
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
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <select
            value={collectionTypeFilter}
            onChange={(e) => setCollectionTypeFilter(e.target.value as "all" | CollectionTypeKey)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="bin">Bin Collection</option>
            <option value="household">Household</option>
            <option value="both">Bin + Household</option>
          </select>

          <Button
            label="New Assignment"
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && rows.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No trip assignments found. Select a company and project to load data."
        globalFilterFields={["unique_id", "_trip_plan", "_staff", "_location", "_waste", "status", "approval_status", "trip_date"]}
      >
        <Column header={t("common.s_no")} body={(_: any, { rowIndex }: any) => rowIndex + 1} style={{ width: 60 }} />
        <Column field="unique_id" header="ID" filter showFilterMatchModes={false} style={{ minWidth: 160 }} />
        <Column
          field="_trip_plan"
          header="Trip Plan"
          body={(row: DailyTripAssignmentRecord) => row.trip_plan?.display_code ?? row.trip_plan_id ?? "—"}
          filter showFilterMatchModes={false}
        />
        <Column
          field="_staff"
          header="Effective Staff"
          body={(row: DailyTripAssignmentRecord) =>
            row.effective_staff?.display_code
              ? <span className="font-medium text-amber-700">{row.effective_staff.display_code}</span>
              : (row.staff_template?.display_code ?? row.staff_template_id ?? "—")
          }
          filter showFilterMatchModes={false}
        />
        <Column
          field="_location"
          header="Location"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
          body={(row: DailyTripAssignmentRecord) => {
            if (row.panchayat?.panchayat_name) {
              return (
                <span className="text-sm text-gray-800">
                  {row.panchayat.panchayat_name}
                  <span className="ml-1 text-xs text-indigo-500 font-medium">(PLB)</span>
                </span>
              );
            }
            return <span className="text-sm text-gray-400">—</span>;
          }}
        />
        {/* <Column
          field="_waste"
          header="Waste Type"
          body={(row: DailyTripAssignmentRecord) => (row.waste_type as any)?.waste_type_name ?? row.waste_type_id ?? "—"}
        /> */}
        <Column
          field="_collection_type"
          header="Collection Type"
          body={(row: DailyTripAssignmentRecord) => <CollectionTypeBadge rec={row} />}
          style={{ minWidth: 150 }}
        />
        <Column field="trip_date" header="Trip Date" filter showFilterMatchModes={false} style={{ minWidth: 110 }} />
        <Column field="scheduled_time" header="Scheduled Time" style={{ minWidth: 110 }} />
        <Column
          field="status"
          header="Status"
          body={statusTemplate}
          filter showFilterMatchModes={false}
          style={{ minWidth: 160 }}
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 80 }} />
      </DataTable>
    </div>
  );
}
