import type { TripPlanRecord } from "./types";
import type { DailyTripAssignmentRecord } from "./types";
import type { CollectionTypeKey } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { dailyTripAssignmentApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import { normalizeList } from "@/utils/forms";
import { api } from "@/api";
import { adminEndpoints } from "@/helpers/admin/endpoints";

type SchedulerStatus = {
  enabled?: boolean;
  is_enabled?: boolean;
  run_time?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  is_running?: boolean;
};

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
  bulk:      "bg-amber-100 text-amber-800",
  mixed:     "bg-purple-100 text-purple-800",
  unknown:   "bg-gray-100 text-gray-500",
};

const COLLECTION_TYPE_LABELS: Record<CollectionTypeKey, string> = {
  bin:       "Secondary Collection",
  household: "Household Collection",
  bulk:      "Bulk Waste Collection",
  mixed:     "Mixed Collection",
  unknown:   "Unknown",
};

const getCollectionTypeKey = (rec: DailyTripAssignmentRecord): CollectionTypeKey => {
  const ct = rec.collection_types ?? {
    has_bin:       rec.trip_plan?.has_bin  ?? false,
    has_household: rec.trip_plan?.has_household ?? false,
    has_bulk:      rec.trip_plan?.has_bulk ?? false,
  };
  const enabled = [ct.has_bin, ct.has_household, ct.has_bulk].filter(Boolean).length;
  if (enabled > 1) return "mixed";
  if (ct.has_bin)       return "bin";
  if (ct.has_household) return "household";
  if (ct.has_bulk) return "bulk";
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

  const { encScheduleMasters, encDailyTripAssignment } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encDailyTripAssignment,
  );

  const [allAssignments, setAllAssignments] = useState<DailyTripAssignmentRecord[]>([]);
  const [tripPlanLookup, setTripPlanLookup] = useState<Record<string, TripPlanRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isSavingSchedulerConfig, setIsSavingSchedulerConfig] = useState(false);
  const [schedulerRunTime, setSchedulerRunTime] = useState("04:00");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
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
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assignmentData, tripPlanData] = await Promise.all([
        dailyTripAssignmentApi.readAll() as Promise<DailyTripAssignmentRecord[]>,
        adminApi.tripPlans.readAll() as Promise<any>,
      ]);
      setAllAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      const lookup: Record<string, TripPlanRecord> = {};
      normalizeList(tripPlanData).forEach((plan: TripPlanRecord) => {
        const id = normalizeId(plan.unique_id ?? plan.id);
        if (id) lookup[id] = plan;
      });
      setTripPlanLookup(lookup);
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  /* ── background auto-schedule status + config ── */
  const loadSchedulerStatus = useCallback(() => {
    dailyTripAssignmentApi
      .action<SchedulerStatus>("scheduler-status")
      .then((status) => {
        setSchedulerStatus(status);
        if (status.run_time) setSchedulerRunTime(status.run_time.slice(0, 5));
        if (typeof status.enabled === "boolean") setSchedulerEnabled(status.enabled);
        else if (typeof status.is_enabled === "boolean") setSchedulerEnabled(status.is_enabled);
      })
      .catch(() => setSchedulerStatus(null));
  }, []);

  useEffect(() => loadSchedulerStatus(), [loadSchedulerStatus]);

  const saveSchedulerConfig = async () => {
    if (!schedulerRunTime) {
      Swal.fire({ icon: "warning", title: t("admin.daily_trip_assignment.select_time", "Select auto-generation time") });
      return;
    }
    setIsSavingSchedulerConfig(true);
    try {
      const { data } = await api.patch(adminEndpoints.schedulerConfig, {
        run_time: schedulerRunTime,
        is_enabled: schedulerEnabled,
      });
      setSchedulerRunTime(String(data.run_time ?? schedulerRunTime).slice(0, 5));
      setSchedulerEnabled(Boolean(data.is_enabled ?? schedulerEnabled));
      loadSchedulerStatus();
      Swal.fire({
        icon: "success",
        title: t("admin.daily_trip_assignment.scheduler_updated", "Scheduler updated"),
        text: `Daily trip plans will auto-generate at ${String(data.run_time ?? schedulerRunTime).slice(0, 5)}.`,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? "Failed to update scheduler time" });
    } finally {
      setIsSavingSchedulerConfig(false);
    }
  };

  /* ── manually run the daily trip job scheduler (for today) ── */
  const handleGenerateDaily = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: t("admin.daily_trip_assignment.generate_title", "Generate Daily Trips"),
      text: t(
        "admin.daily_trip_assignment.generate_prompt",
        `Run the job scheduler now for ${todayStr}? This creates today's trips from active, approved auto-assign plans. Already-generated trips are skipped.`,
      ),
      showCancelButton: true,
      confirmButtonText: t("admin.daily_trip_assignment.generate_run", "Generate"),
    });
    if (!isConfirmed) return;

    setGenerating(true);
    try {
      const res: any = await dailyTripAssignmentApi.action(
        "generate-daily",
        { date: todayStr },
      );
      await Swal.fire({
        icon: "success",
        title: t("common.success"),
        text: res?.message ?? `Created ${res?.created ?? 0}, skipped ${res?.skipped ?? 0}.`,
      });
      await loadAssignments();
      loadSchedulerStatus();
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
    } finally {
      setGenerating(false);
    }
  };

  /* ── enrich + filter rows ── */
  const rows = (() => {
    return allAssignments
      .filter((row) => {
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
            navigate(ENC_EDIT_PATH(rowId))
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
            value={collectionTypeFilter}
            onChange={(e) => setCollectionTypeFilter(e.target.value as "all" | CollectionTypeKey)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="bin">Secondary Collection</option>
            <option value="household">Household Collection</option>
            <option value="bulk">Bulk Waste Collection</option>
            <option value="mixed">Mixed Collection</option>
          </select>

          <Button
            label={generating
              ? t("admin.daily_trip_assignment.generating", "Generating…")
              : t("admin.daily_trip_assignment.generate_button", "Generate Daily Trips")}
            icon="pi pi-bolt"
            className="p-button-help"
            loading={generating}
            disabled={generating}
            onClick={handleGenerateDaily}
          />

          <Button
            label="New Assignment"
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* ── Auto-schedule config bar ── */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">
            {t("admin.daily_trip_assignment.auto_schedule", "Auto Schedule")}
          </span>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            {t("admin.daily_trip_assignment.run_time", "Generation time (IST)")}
            <input
              type="time"
              value={schedulerRunTime}
              onChange={(e) => setSchedulerRunTime(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={schedulerEnabled}
              onChange={(e) => setSchedulerEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            {t("admin.daily_trip_assignment.scheduler_enabled", "Enabled")}
          </label>
          <Button
            label={isSavingSchedulerConfig
              ? t("common.saving", "Saving…")
              : t("admin.daily_trip_assignment.save_schedule", "Save Schedule")}
            icon="pi pi-clock"
            className="p-button-sm p-button-secondary"
            loading={isSavingSchedulerConfig}
            disabled={isSavingSchedulerConfig}
            onClick={saveSchedulerConfig}
          />
          {schedulerStatus && (
            <span className="ml-auto text-xs text-gray-500">
              {schedulerStatus.is_running
                ? t("admin.daily_trip_assignment.scheduler_running", "Scheduler running…")
                : (schedulerStatus.enabled ?? schedulerStatus.is_enabled)
                  ? `${t("admin.daily_trip_assignment.next_run", "Next run")}: ${
                      schedulerStatus.next_run_at
                        ? new Date(schedulerStatus.next_run_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                        : "—"
                    }`
                  : t("admin.daily_trip_assignment.scheduler_disabled", "Auto-schedule disabled")}
            </span>
          )}
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
        emptyMessage="No trip assignments found."
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
