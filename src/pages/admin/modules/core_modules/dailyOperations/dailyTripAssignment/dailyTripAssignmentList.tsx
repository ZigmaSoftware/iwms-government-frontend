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
import { binApi, customerCreationApi, dailyTripAssignmentApi } from "@/helpers/admin";
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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

  const handlePdfDownload = async () => {
    if (!exportSource.length) return;
    setIsExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let hasPage = false;

      const addPage = () => {
        if (hasPage) pdf.addPage();
        hasPage = true;
      };
      const drawDetails = (
        title: string,
        subtitle: string,
        details: Array<[string, unknown]>,
        qrValue?: string,
      ) => {
        addPage();
        const qrBottom = 18 + 34; // QR box spans y: 18 -> 52
        const qrLeft = 158;
        const labelX = 18;
        const valueX = 62;
        const fullValueWidth = 125; // 62 -> 187
        const narrowValueWidth = qrLeft - valueX - 4; // keep clear of the QR column

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text(title, 18, 20);
        pdf.setFontSize(10);
        pdf.text(subtitle || "-", 18, 29, { maxWidth: qrValue ? 130 : 175 });
        if (qrValue) drawQrCode(pdf, qrValue, qrLeft, 18, 34);
        let y = Math.max(52, qrValue ? qrBottom + 6 : 52);
        pdf.setFontSize(9.5);
        const lineHeight = 4.2; // ~9.5pt font, mm per line
        const labelWidth = valueX - labelX - 4; // keep the label clear of the value column
        details.forEach(([label, rawValue]) => {
          const value = rawValue === null || rawValue === undefined || rawValue === ""
            ? "-"
            : String(rawValue);
          const wrapWidth = qrValue && y < qrBottom ? narrowValueWidth : fullValueWidth;
          pdf.setFont("helvetica", "bold");
          const labelLines = pdf.splitTextToSize(`${label}:`, labelWidth) as string[];
          pdf.setFont("helvetica", "normal");
          const valueLines = pdf.splitTextToSize(value, wrapWidth) as string[];
          const rowHeight = Math.max(8, Math.max(labelLines.length, valueLines.length) * lineHeight + 3);
          if (y + rowHeight > 282) {
            pdf.addPage();
            y = 20;
          }
          pdf.setFont("helvetica", "bold");
          pdf.text(labelLines, labelX, y);
          pdf.setFont("helvetica", "normal");
          pdf.text(valueLines, valueX, y);
          y += rowHeight;
        });
      };

      for (const row of exportSource) {
        const assignmentWasteTypes = (row.waste_types_detail ?? [])
          .map((item) => item.waste_type_name)
          .filter(Boolean)
          .join(", ");
        const householdWasteTypes = (row.household_waste_types ?? [])
          .map((item) => item.waste_type_name)
          .filter(Boolean)
          .join(", ");

        drawDetails(
          "Daily Trip Plan — Route Summary",
          row.unique_id,
          [
            ["Trip Plan", row._trip_plan],
            ["Local Body", row._location],
            ["Collection Type", row._collection_type_label],
            ["Waste Types", assignmentWasteTypes || householdWasteTypes],
            ["Household Waste Types", householdWasteTypes],
            ["Effective Staff", row._staff],
            ["Operator / Driver", row._staff_names],
            ["Vehicle", row._vehicle],
            ["Total Route Stops", row._collection_point_count],
            ["Bin Stops", row.collection_points?.length ?? 0],
            ["Household / Bulk Stops", row.household_collection_points?.length ?? 0],
            ["Trip Date", row.trip_date],
            ["Scheduled Time", formatTime12Hour(row.scheduled_time)],
            ["Actual Start", row.actual_start_time],
            ["Actual End", row.actual_end_time],
            ["Status", row.status],
            ["Approval", row.approval_status],
            ["Remarks", row.remarks],
          ],
          JSON.stringify({ daily_trip_assignment_id: row.unique_id }),
        );

        for (const stop of row.household_collection_points ?? []) {
          let customer: Record<string, any> = stop.customer ?? {};
          const customerId = stop.customer_id ?? stop.customer?.unique_id;
          if (customerId) {
            try {
              customer = await customerCreationApi.read(customerId) as Record<string, any>;
            } catch {
              // The inline assignment payload still provides the essential fallback details.
            }
          }
          const address = [
            customer.building_no,
            customer.street,
            customer.area,
            customer.pincode,
          ].filter(Boolean).join(", ");
          const localBody = customer.corporation_name
            ?? customer.municipality_name
            ?? customer.town_panchayat_name
            ?? customer.panchayat_union_name
            ?? customer.panchayat_name
            ?? "-";
          const familyMembers = Array.isArray(customer.family_members)
            ? customer.family_members
                .map((member: Record<string, unknown>) => member.member_name ?? member.name)
                .filter(Boolean)
                .join(", ")
            : "-";
          const customerWasteTypes = Array.isArray(customer.waste_types)
            ? customer.waste_types
                .map((wasteType: Record<string, unknown>) => wasteType.waste_type_name ?? wasteType.name)
                .filter(Boolean)
                .join(", ")
            : "-";

          drawDetails(
            stop.collection_type === "bulk_waste_collection"
              ? "Bulk-Waste Customer Stop"
              : "Household Customer Stop",
            `${stop.sequence ?? "-"}. ${customer.customer_name ?? customerId ?? "Customer"}`,
            [
              ["Customer ID", customer.unique_id ?? customerId],
              ["Customer Name", customer.customer_name],
              ["Contact Number", customer.contact_no],
              ["Property", customer.property_name],
              ["Sub Property", customer.sub_property_name],
              ["Address", address],
              ["Apartment / Block / Flat", [customer.apartment_name, customer.block_no, customer.flat_no].filter(Boolean).join(" / ")],
              ["Local Body", localBody],
              ["District", customer.district_name],
              ["Latitude / Longitude", [customer.latitude, customer.longitude].filter(Boolean).join(", ")],
              ["ID Proof Type", customer.id_proof_type],
              ["ID Number", customer.id_no],
              ["Property Area (sq. ft.)", customer.sqft],
              ["Water Consumption (LPD)", customer.water_consumption_lpd],
              ["Expected Waste (kg/day)", customer.waste_collection_kg_per_day],
              ["Waste Types", customerWasteTypes],
              ["Member Count", customer.member_count],
              ["Family Members", familyMembers],
              ["Bulk-Waste Generator", customer.is_bulkwaste_generator ? "Yes" : "No"],
              ["Sequence", stop.sequence],
              ["Collection Status", stop.status],
              ["Collected", stop.is_collected ? "Yes" : "No"],
              ["Collected Weight (kg)", stop.collected_weight_kg],
              ["Wet / Dry / Mixed / Sanitary (kg)", [stop.wet_waste, stop.dry_waste, stop.mixed_waste, stop.sanitary_waste].map((value) => value ?? 0).join(" / ")],
            ],
            JSON.stringify({ id: customer.unique_id ?? customerId }),
          );
        }

        for (const stop of row.collection_points ?? []) {
          let bin: Record<string, any> = stop.bin ?? {};
          const binId = stop.bin_id ?? stop.bin?.unique_id;
          if (binId) {
            try {
              bin = await binApi.read(binId) as Record<string, any>;
            } catch {
              // Fall back to the assignment's inline bin and collection-point details.
            }
          }
          const collectionPoint = stop.collection_point ?? {};
          drawDetails(
            "Secondary Bin Collection Stop",
            `${stop.sequence ?? "-"}. ${collectionPoint.cp_name ?? bin.collection_point_name ?? "Collection Point"}`,
            [
              ["Collection Point ID", collectionPoint.unique_id ?? stop.collection_point_id],
              ["Collection Point", collectionPoint.cp_name ?? bin.collection_point_name],
              ["Bin ID", bin.unique_id ?? binId],
              ["Bin Name", bin.bin_name ?? stop.bin?.bin_name],
              ["Bin Type", bin.bin_type],
              ["Bin Capacity", bin.bin_capacity],
              ["Waste Type", bin.wastetype_name ?? stop.waste_type_name],
              ["Local Body", bin.location_name ?? row._location],
              ["Latitude / Longitude", [collectionPoint.latitude ?? bin.latitude, collectionPoint.longitude ?? bin.longitude].filter(Boolean).join(", ")],
              ["Sequence", stop.sequence],
              ["Collection Status", stop.status],
              ["Collected", stop.is_collected ? "Yes" : "No"],
              ["Collected Weight (kg)", stop.collected_weight_kg],
              ["Collected At", stop.collected_at],
              ["Status Reason", stop.status_reason],
            ],
            String(bin.unique_id ?? binId ?? collectionPoint.unique_id ?? stop.collection_point_id),
          );
        }
      }
      pdf.save("daily_trip_plans_detailed.pdf");
    } catch (error) {
      Swal.fire(
        t("common.error"),
        error instanceof Error ? error.message : "Failed to generate the detailed trip-plan PDF.",
        "error",
      );
    } finally {
      setIsExportingPdf(false);
    }
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
          <Button label={isExportingPdf ? "Generating PDF…" : "Download PDF"} icon="pi pi-file-pdf" className="p-button-outlined" disabled={isExportingPdf || !exportSource.length} onClick={handlePdfDownload} />

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
