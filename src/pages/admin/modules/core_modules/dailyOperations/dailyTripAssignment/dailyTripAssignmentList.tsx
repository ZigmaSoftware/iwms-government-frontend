import type { DailyTripAssignmentRecord } from "./types";
import type { CollectionTypeKey } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
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
import { jsPDF } from "jspdf";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { dailyTripAssignmentApi } from "@/helpers/admin";
import { api } from "@/api";
import { adminEndpoints } from "@/helpers/admin/endpoints";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { exportRecordsToExcel, getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { drawQrCode } from "@/utils/exportPdf";

type SchedulerStatus = {
  enabled?: boolean;
  is_enabled?: boolean;
  run_time?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_mode?: string | null;
  last_auto_run_at?: string | null;
  last_error?: string | null;
  is_running?: boolean;
};

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

const BreakdownCell = ({ row }: { row: DailyTripAssignmentRecord }) => {
  const bd = row.breakdown_info;
  if (!bd) return <span className="text-xs text-gray-300">—</span>;

  const isApproved = bd.approval_status === "APPROVED";
  const isPending  = bd.approval_status === "PENDING";

  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isApproved ? "bg-green-100 text-green-700" :
        isPending  ? "bg-orange-100 text-orange-700" :
                     "bg-red-100 text-red-700"
      }`}>
        {isApproved ? "✓ Replaced" : isPending ? "⚠ Pending" : "✕ Rejected"}
      </span>
      {isApproved && bd.replacement_vehicle_no && (
        <div className="text-[10px] text-gray-600 leading-tight">
          <span className="font-medium">Veh:</span> {bd.replacement_vehicle_no}
        </div>
      )}
      {isApproved && (bd.replacement_driver || bd.replacement_operator) && (
        <div className="text-[10px] text-gray-600 leading-tight">
          {bd.replacement_driver && <span><span className="font-medium">Drv:</span> {bd.replacement_driver}</span>}
          {bd.replacement_driver && bd.replacement_operator && <span className="mx-1">·</span>}
          {bd.replacement_operator && <span><span className="font-medium">Opr:</span> {bd.replacement_operator}</span>}
        </div>
      )}
    </div>
  );
};


const COLLECTION_TYPE_STYLES: Record<CollectionTypeKey, string> = {
  bin:       "bg-blue-100 text-blue-800",
  household: "bg-green-100 text-green-800",
  bulk:      "bg-amber-100 text-amber-800",
  mixed:     "bg-purple-100 text-purple-800",
  unknown:   "bg-gray-100 text-gray-500",
};

const COLLECTION_TYPE_LABELS: Record<CollectionTypeKey, string> = {
  bin:       "Bin Collection",
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

const toDateInputValue = (date = new Date()): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatTime12Hour = (time?: string): string => {
  if (!time) return "—";
  const [hourStr, minuteStr = "00"] = time.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${minuteStr.padStart(2, "0")} ${period}`;
};

// Bin-collection stops and household stops are tracked in separate arrays, so
// the visible "point count" must switch on the trip's actual collection type
// rather than always reading collection_points (which is empty/irrelevant for
// household-only trips).
const getPointCount = (rec: DailyTripAssignmentRecord): number => {
  const binCount = Array.isArray(rec.collection_points) ? rec.collection_points.length : 0;
  const householdCount = Array.isArray(rec.household_collection_points) ? rec.household_collection_points.length : 0;
  const key = getCollectionTypeKey(rec);
  if (key === "household") return householdCount;
  if (key === "bin") return binCount;
  if (key === "mixed") return binCount + householdCount;
  return binCount || householdCount;
};

// Location = whichever local-body level the assignment (or its plan) is scoped to.
const LOCATION_LEVELS: Array<{ key: string; nameKeys: string[]; tag: string }> = [
  { key: "corporation", nameKeys: ["corporation_name", "name"], tag: "Corporation" },
  { key: "municipality", nameKeys: ["municipality_name", "name"], tag: "Municipality" },
  { key: "town_panchayat", nameKeys: ["town_panchayat_name", "name"], tag: "Town Panchayat" },
  { key: "panchayat_union", nameKeys: ["union_name", "name"], tag: "Panchayat Union" },
  { key: "panchayat", nameKeys: ["panchayat_name", "name"], tag: "PLB" },
];

const locationInfo = (record: DailyTripAssignmentRecord): { name: string; tag: string } | null => {
  for (const level of LOCATION_LEVELS) {
    const obj = (record as any)[level.key] ?? (record.trip_plan as any)?.[level.key];
    if (!obj) continue;
    const name = level.nameKeys.map((k) => obj?.[k]).find((v) => v);
    if (name) return { name: String(name), tag: level.tag };
  }
  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyTripAssignmentList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encScheduleOperations, encDailyTripAssignment } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleOperations,
    encDailyTripAssignment,
  );

  const [allAssignments, setAllAssignments] = useState<DailyTripAssignmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [isSavingSchedulerConfig, setIsSavingSchedulerConfig] = useState(false);
  const [schedulerDate, setSchedulerDate] = useState(toDateInputValue());
  const [schedulerRunTime, setSchedulerRunTime] = useState("04:00");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [collectionTypeFilter, setCollectionTypeFilter] = useState<"all" | CollectionTypeKey>("all");
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _trip_plan: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _staff: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _staff_names: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _vehicle: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_type_label: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_point_count: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    trip_date: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    scheduled_time: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ── load assignments ── */
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const assignmentData = await (dailyTripAssignmentApi.readAll({
        params: hierarchyParams,
      }) as Promise<DailyTripAssignmentRecord[]>);
      setAllAssignments(Array.isArray(assignmentData) ? assignmentData : []);
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [hierarchyParams, t]);

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

  const runSchedulerNow = async () => {
    setIsSchedulerRunning(true);
    try {
      const result = await dailyTripAssignmentApi.action<Record<string, unknown>, { date: string }>(
        "run-scheduler",
        { date: schedulerDate },
      );
      Swal.fire({
        icon: "success",
        title: "Scheduler completed",
        text: String(
          result.message ??
            `Created: ${result.created ?? result.assignments_created ?? 0}, skipped: ${result.skipped ?? result.assignments_existing ?? 0}`,
        ),
      });
      loadSchedulerStatus();
      loadAssignments();
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? "Scheduler failed" });
    } finally {
      setIsSchedulerRunning(false);
    }
  };

  const saveSchedulerConfig = async () => {
    if (!schedulerRunTime) {
      Swal.fire({ icon: "warning", title: "Select auto-generation time" });
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
        title: "Scheduler updated",
        text: `Daily trip plans will auto-generate at ${String(data.run_time ?? schedulerRunTime).slice(0, 5)}.`,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? "Failed to update scheduler time" });
    } finally {
      setIsSavingSchedulerConfig(false);
    }
  };

  /* ── enrich + filter rows ── */
  const rows = (() => {
    return allAssignments
      .filter((row) => {
        if (schedulerDate && row.trip_date !== schedulerDate) return false;
        if (collectionTypeFilter !== "all" && getCollectionTypeKey(row) !== collectionTypeFilter) return false;
        return true;
      })
      .map((rec) => ({
        ...rec,
        _trip_plan: rec.trip_plan?.display_code ?? rec.trip_plan_id ?? "",
        _staff: rec.effective_staff?.display_code ?? rec.staff_template?.display_code ?? rec.staff_template_id ?? "",
        _staff_names: [
          (rec.effective_staff ?? rec.staff_template)?.operator,
          (rec.effective_staff ?? rec.staff_template)?.driver,
        ].filter(Boolean).join(" "),
        _vehicle: rec.vehicle?.vehicle_no ?? "",
        _location: locationInfo(rec)?.name ?? "",
        _collection_type: getCollectionTypeKey(rec),
        _collection_type_label: COLLECTION_TYPE_LABELS[getCollectionTypeKey(rec)],
        _collection_point_count: String(getPointCount(rec)),
      }));
  })();

  const exportSource = rows.filter((row) => {
    const search = globalFilterValue.trim().toLowerCase();
    if (search && ![
      row.unique_id, row._trip_plan, row._staff, row._staff_names, row._vehicle,
      row._location, row._collection_type_label, row.status,
      row.trip_date, row.scheduled_time,
    ].some((value) => String(value ?? "").toLowerCase().includes(search))) {
      return false;
    }
    return Object.entries(filters).every(([field, filter]) => {
      const filterValue = "value" in filter ? filter.value : null;
      if (field === "global" || !filterValue) return true;
      return String((row as Record<string, unknown>)[field] ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    });
  });

  const excelRows = exportSource.map((row) => ({
    ID: row.unique_id,
    "Trip Plan": row._trip_plan,
    "Local Body": row._location,
    "Collection Type": row._collection_type_label,
    "Effective Staff": row._staff,
    "Operator / Driver": row._staff_names,
    Vehicle: row._vehicle,
    "Collection Points": row._collection_point_count,
    "Trip Date": row.trip_date,
    "Start Time": formatTime12Hour(row.scheduled_time),
    Status: row.status ?? "-",
  }));

  const handleExcelDownload = () =>
    exportRecordsToExcel(excelRows, getAdminScreenExcelFilename("all"), "Daily Trip Plans");

  const handlePdfDownload = () => {
    if (!exportSource.length) return;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    exportSource.forEach((row, index) => {
      if (index > 0) pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Daily Trip Plan", 18, 20);
      pdf.setFontSize(10);
      pdf.text(row.unique_id ?? "-", 18, 29);
      drawQrCode(pdf, JSON.stringify({ daily_trip_assignment_id: row.unique_id }), 158, 18, 34);
      const details: Array<[string, unknown]> = [
        ["Trip Plan", row._trip_plan],
        ["Local Body", row._location],
        ["Collection Type", row._collection_type_label],
        ["Effective Staff", row._staff],
        ["Operator / Driver", row._staff_names],
        ["Vehicle", row._vehicle],
        ["Collection Points", row._collection_point_count],
        ["Trip Date", row.trip_date],
        ["Start Time", formatTime12Hour(row.scheduled_time)],
        ["Status", row.status],
      ];
      let y = 58;
      pdf.setFontSize(10);
      details.forEach(([label, value]) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(`${label}:`, 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(value ?? "-"), 60, y, { maxWidth: 125 });
        y += 10;
      });
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Scan the QR code to identify this daily trip assignment.", 18, 180);
      pdf.setTextColor(0, 0, 0);
    });
    pdf.save("daily_trip_plans.pdf");
  };

  const hasActiveFilters =
    Object.keys(hierarchyParams).length > 0 ||
    collectionTypeFilter !== "all" ||
    schedulerDate !== toDateInputValue();

  const clearListFilters = () => {
    setHierarchyParams({});
    setCollectionTypeFilter("all");
    setSchedulerDate(toDateInputValue());
    setFilterResetKey((key) => key + 1);
  };

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
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Daily Trip Plans</h1>
          <p className="text-sm text-gray-500">Manage daily trip plans with assigned collection points</p>
        </div>
        <div className="flex items-center gap-3">
          <Button label="Download Excel" icon="pi pi-file-excel" className="p-button-outlined" disabled={!excelRows.length} onClick={handleExcelDownload} />
          <Button label="Download PDF" icon="pi pi-file-pdf" className="p-button-outlined" disabled={!exportSource.length} onClick={handlePdfDownload} />

          <Button
            label={isSchedulerRunning ? "Running..." : "Run Scheduler"}
            icon="pi pi-clock"
            className="p-button-outlined"
            disabled={isSchedulerRunning}
            onClick={runSchedulerNow}
          />

          <Button
            label="New Daily Trip Plan"
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
        <HierarchyFilterBar key={filterResetKey} className="contents" showClear={false} onChange={setHierarchyParams} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Collection Type</label>
          <select
            value={collectionTypeFilter}
            onChange={(event) => setCollectionTypeFilter(event.target.value as "all" | CollectionTypeKey)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="bin">Bin Collection</option>
            <option value="household">Household Collection</option>
            <option value="bulk">Bulk Waste Collection</option>
            <option value="mixed">Mixed Collection</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Trip Date</label>
          <input
            type="date"
            value={schedulerDate}
            onChange={(event) => setSchedulerDate(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            title="Trip date filter and manual scheduler date"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={clearListFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="pi pi-filter-slash text-xs" />
            Clear All Filters
          </button>
        </div>
      </div>

      {/* ── Auto-generate config bar ── */}
      <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-800">Auto Generate Daily Trips</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={schedulerEnabled}
              onChange={(event) => setSchedulerEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            Auto generate at
            <input
              type="time"
              value={schedulerRunTime}
              onChange={(event) => setSchedulerRunTime(event.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
          </label>
          <Button
            label={isSavingSchedulerConfig ? "Saving..." : "Save Schedule"}
            icon="pi pi-save"
            className="p-button-sm p-button-outlined"
            disabled={isSavingSchedulerConfig}
            onClick={saveSchedulerConfig}
          />
          <span className="text-gray-400">|</span>
          <span>Job: {schedulerStatus?.enabled ?? schedulerStatus?.is_enabled ? "Enabled" : "Disabled"} at {schedulerStatus?.run_time ?? schedulerRunTime}</span>
          {schedulerStatus?.next_run_at && (
            <span>Next run: {new Date(schedulerStatus.next_run_at).toLocaleString()}</span>
          )}
          {schedulerStatus?.last_run_at && (
            <span>
              Last run: {new Date(schedulerStatus.last_run_at).toLocaleString()}
              {schedulerStatus.last_run_mode ? ` (${schedulerStatus.last_run_mode})` : ""}
            </span>
          )}
          {schedulerStatus?.last_auto_run_at && (
            <span>Last auto: {new Date(schedulerStatus.last_auto_run_at).toLocaleString()}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          This is the cron-like generation time. Trip start time is managed separately on the Trip Plan or Daily Trip record.
        </p>
        {schedulerStatus?.last_error && (
          <p className="mt-2 font-medium text-red-600">{schedulerStatus.last_error}</p>
        )}
      </div>

      <DataTable
        exportable={false}
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
        globalFilterFields={[
          "unique_id",
          "_trip_plan",
          "_staff",
          "_staff_names",
          "_vehicle",
          "_location",
          "_collection_type_label",
          "_collection_point_count",
          "status",
          "approval_status",
          "trip_date",
          "scheduled_time",
        ]}
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
          field="_staff_names"
          header="Operator / Driver"
          body={(row: DailyTripAssignmentRecord) => {
            const staff = row.effective_staff ?? row.staff_template;
            return (
              <span className="text-sm text-gray-800">
                <div>Operator: {staff?.operator ?? "—"}</div>
                <div>Driver: {staff?.driver ?? "—"}</div>
              </span>
            );
          }}
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
        />
        <Column
          field="_vehicle"
          header="Vehicle"
          body={(row: DailyTripAssignmentRecord) => row.vehicle?.vehicle_no ?? "—"}
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 120 }}
        />
        <Column
          field="_location"
          header="Location"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
          body={(row: DailyTripAssignmentRecord) => {
            const info = locationInfo(row);
            if (!info) return <span className="text-sm text-gray-400">—</span>;
            return (
              <span className="text-sm text-gray-800">
                {info.name}
                <span className="ml-1 text-xs text-indigo-500 font-medium">({info.tag})</span>
              </span>
            );
          }}
        />
        <Column
          field="_collection_type_label"
          header="Collection Type"
          body={(row: DailyTripAssignmentRecord) => <CollectionTypeBadge rec={row} />}
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 150 }}
        />
        <Column
          field="_collection_point_count"
          header="Collection Points"
          body={(row: DailyTripAssignmentRecord) => getPointCount(row)}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ width: 150 }}
        />
        <Column field="trip_date" header="Trip Date" filter showFilterMatchModes={false} style={{ minWidth: 110 }} />
        <Column
          field="scheduled_time"
          header="Start Time"
          body={(row: DailyTripAssignmentRecord) => formatTime12Hour(row.scheduled_time)}
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 110 }}
        />
        <Column
          field="status"
          header="Status"
          body={statusTemplate}
          filter showFilterMatchModes={false}
          style={{ minWidth: 160 }}
        />
        <Column
          header="Breakdown"
          body={(row: DailyTripAssignmentRecord) => <BreakdownCell row={row} />}
          style={{ minWidth: 180 }}
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 80 }} />
      </DataTable>
    </div>
  );
}
