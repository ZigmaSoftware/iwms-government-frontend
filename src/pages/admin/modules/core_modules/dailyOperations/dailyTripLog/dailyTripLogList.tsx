import type { DailyTripLogRecord } from "./types";
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
import { InputTextarea } from "primereact/inputtextarea";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { MultiSelect } from "primereact/multiselect";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { dailyTripLogApi, wasteTypeApi } from "@/helpers/admin";
import { api } from "@/api";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { exportRecordsToExcel, getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { formatCollectionTime } from "./collectionTime";


const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-800",
  Verified: "bg-green-100 text-green-800",
};

const COLLECTION_STATUS_STYLES: Record<string, string> = {
  "Not Started": "bg-red-50 text-red-600",
  "In Progress": "bg-yellow-50 text-yellow-700",
  "Completed": "bg-green-100 text-green-700",
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

const CollectionStatusBadge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      COLLECTION_STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-500"
    }`}
  >
    {value ?? "-"}
  </span>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{children}</p>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-gray-500 w-36 shrink-0">{label}</span>
    <span className="font-medium text-gray-800">{value ?? "-"}</span>
  </div>
);

const extractError = (error: any): string | null => {
  const data = error?.response?.data;
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

const computeCollectedWeight = (collectionPoints?: DailyTripLogRecord["collection_points"]): number => {
  return (collectionPoints ?? []).reduce((sum, cp) => {
    if (cp?.collected_weight_kg === null || cp?.collected_weight_kg === undefined) {
      return sum;
    }
    const weight = Number(cp.collected_weight_kg);
    return sum + (Number.isFinite(weight) ? weight : 0);
  }, 0);
};

/* ─────────────────────────────────────────────────────
   Trip Log Modal  (mode="view" | "verify")
───────────────────────────────────────────────────── */
function TripLogModal({
  row,
  mode,
  onClose,
  onConfirm,
  isLoading,
}: {
  row: DailyTripLogRecord;
  mode: "view" | "verify";
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  isLoading: boolean;
}) {
  const [remarks, setRemarks] = useState(row.remarks ?? "");
  const cps = row.collection_points ?? [];
  const collectedCount = cps.filter((cp) => cp.is_collected).length;
  const hhCollections = row.household_collections ?? [];
  const hhCollectedCount = hhCollections.filter((hh) => hh.is_collected).length;
  const st = row.staff_template;
  const wasteTypeName =
    Array.isArray(row.waste_types_detail) && row.waste_types_detail.length > 0
      ? row.waste_types_detail.map((wt) => wt.waste_type_name).filter(Boolean).join(", ")
      : "-";
  const wasteTypeBreakdown = Array.isArray(row.waste_type_breakdown) ? row.waste_type_breakdown : [];
  const collectedWeightFromPoints = computeCollectedWeight(cps);
  const hasPointWeights = cps.some(
    (cp) => cp?.collected_weight_kg !== null && cp?.collected_weight_kg !== undefined
  );
  const weight = hasPointWeights
    ? `${collectedWeightFromPoints.toFixed(2)} kg`
    : row.collected_weight_kg != null
    ? `${Number(row.collected_weight_kg).toFixed(2)} kg`
    : "-";

  const footer = (
    <div className="flex justify-end gap-2 pt-2">
      <Button
        label={mode === "verify" ? "Cancel" : "Close"}
        className="p-button-text p-button-secondary"
        onClick={onClose}
        disabled={isLoading}
      />
      {mode === "verify" && (
        <Button
          label="Verify"
          icon="pi pi-check"
          className="p-button-success"
          loading={isLoading}
          onClick={() => onConfirm(remarks)}
        />
      )}
    </div>
  );

  const title = mode === "verify" ? "Verify Trip Log" : "Trip Log Details";
  const statusColor: Record<string, string> = {
    Draft: "text-gray-600",
    Submitted: "text-blue-600",
    Verified: "text-green-600",
  };

  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div className="flex items-start justify-between gap-4 pr-4">
          <div>
            <p className="text-lg font-bold text-gray-800">{title}</p>
            <p className="text-xs text-gray-400 font-normal mt-0.5">{row.unique_id}</p>
          </div>
          <span
            className={`mt-1 text-xs font-semibold uppercase tracking-wide ${
              statusColor[row.log_status ?? ""] ?? "text-gray-500"
            }`}
          >
            {row.log_status}
          </span>
        </div>
      }
      footer={footer}
      style={{ width: "580px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Trip details */}
        <div>
          <SectionLabel>Trip Details</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <InfoRow
              label="Trip Assignment"
              value={row.trip_assignment?.display_code ?? row.trip_assignment_id}
            />
            <InfoRow label="Date" value={row.trip_date} />
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-36 shrink-0">Collection Status</span>
              <CollectionStatusBadge value={row.collection_status} />
            </div>
            <InfoRow label="Waste Type" value={wasteTypeName} />
            {wasteTypeBreakdown.length > 0 && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-500 w-36 shrink-0">Waste Breakdown</span>
                <div className="flex flex-col gap-0.5">
                  {wasteTypeBreakdown.map((item, index) => (
                    <span key={index} className="text-gray-800">
                      {item.waste_type_name ?? "—"}: {item.collected_weight_kg ?? "—"} kg
                    </span>
                  ))}
                </div>
              </div>
            )}
            <InfoRow label="Bin Weight" value={weight} />
            {row.household_collected_weight_kg != null && (
              <InfoRow
                label="Household Weight"
                value={`${Number(row.household_collected_weight_kg).toFixed(2)} kg`}
              />
            )}
            {row.actual_start_time && <InfoRow label="Start Time" value={row.actual_start_time} />}
            {row.actual_end_time && <InfoRow label="End Time" value={row.actual_end_time} />}
            {(row.vehicle as any)?.vehicle_no && (
              <InfoRow label="Vehicle" value={(row.vehicle as any).vehicle_no} />
            )}

          </div>
        </div>

        <Divider className="!my-0" />

        {/* Location — from the geo masters (district / ULB-RLB / local body) */}
        <div>
          <SectionLabel>Location</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {row.location?.state && <InfoRow label="State" value={row.location.state} />}
            <InfoRow label="District" value={row.location?.district ?? "-"} />
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-36 shrink-0">Classification</span>
              {row.location?.classification ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    row.location.classification.toLowerCase().includes("urban")
                      ? "bg-sky-100 text-sky-800"
                      : "bg-lime-100 text-lime-800"
                  }`}
                >
                  {row.location.classification}
                  <span className="ml-1 font-normal opacity-70">
                    ({row.location.classification.toLowerCase().includes("urban") ? "ULB" : "RLB"})
                  </span>
                </span>
              ) : (
                <span className="font-medium text-gray-800">-</span>
              )}
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-36 shrink-0">Local Body</span>
              <span className="font-medium text-gray-800">
                {row.location?.local_body_name ?? row.panchayat?.panchayat_name ?? "-"}
                {(row.location?.local_body_level ?? (row.panchayat?.panchayat_name ? "Panchayat" : null)) && (
                  <span className="ml-1.5 text-xs text-indigo-500 font-semibold">
                    ({row.location?.local_body_level ?? "Panchayat"})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <Divider className="!my-0" />

        {/* Staff */}
        <div>
          <SectionLabel>Staff</SectionLabel>
          {st?.base ? (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">
                Base Template:{" "}
                <span className="font-semibold text-gray-700">{st.base.display_code}</span>
              </p>
              <div className="flex flex-col gap-1 pl-3 border-l-2 border-gray-200">
                <InfoRow label="Driver" value={st.base.driver?.employee_name} />
                <InfoRow label="Operator" value={st.base.operator?.employee_name} />
              </div>
            </div>
          ) : (
            <div className="mb-3 flex flex-col gap-1">
              <InfoRow label="Driver" value={row.driver?.employee_name} />
              <InfoRow label="Operator" value={row.operator?.employee_name} />
            </div>
          )}
          {st?.alt && (
            <div>
              <p className="text-xs text-orange-500 mb-1.5">
                Alt Template <span className="text-orange-400">(Substitute)</span>:{" "}
                <span className="font-semibold text-orange-700">{st.alt.display_code}</span>
              </p>
              <div className="flex flex-col gap-1 pl-3 border-l-2 border-orange-200">
                <InfoRow label="Driver" value={st.alt.driver?.employee_name} />
                <InfoRow label="Operator" value={st.alt.operator?.employee_name} />
              </div>
            </div>
          )}
        </div>

        <Divider className="!my-0" />

        {/* Collection Points */}
        <div>
          <SectionLabel>
            Collection Points
            {cps.length > 0 && (
              <span className="ml-1 normal-case font-normal text-gray-400">
                — {collectedCount} / {cps.length} collected
              </span>
            )}
          </SectionLabel>
          {cps.length === 0 ? (
            <p className="text-sm text-gray-400">No collection points recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cps.map((cp) => (
                <li
                  key={cp.unique_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {cp.is_collected ? (
                      <i className="pi pi-check-circle text-green-500 text-base" />
                    ) : (
                      <i className="pi pi-times-circle text-red-400 text-base" />
                    )}
                    <span className={cp.is_collected ? "text-gray-800" : "text-gray-400"}>
                      {cp.sequence != null ? `${cp.sequence}. ` : ""}
                      {cp.cp_name ?? cp.unique_id}
                    </span>
                    {!cp.is_collected && (
                      <span className="text-xs text-red-400">(Not collected)</span>
                    )}
                  </div>
                  {cp.collected_weight_kg != null ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                      {Number(cp.collected_weight_kg).toFixed(2)} kg
                    </span>
                  ) : cp.is_collected ? (
                    <span className="text-xs text-gray-400 shrink-0">— kg</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Household Collection Points */}
        {hhCollections.length > 0 && (
          <>
            <Divider className="!my-0" />
            <div>
              <SectionLabel>
                Household Collections
                <span className="ml-1 normal-case font-normal text-gray-400">
                  — {hhCollectedCount} / {hhCollections.length} collected
                </span>
              </SectionLabel>
              <ul className="flex flex-col gap-2">
                {hhCollections.map((hh) => (
                  <li
                    key={hh.unique_id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {hh.is_collected ? (
                        <i className="pi pi-check-circle text-green-500 text-base" />
                      ) : (
                        <i className="pi pi-times-circle text-red-400 text-base" />
                      )}
                      <span className={hh.is_collected ? "text-gray-800" : "text-gray-400"}>
                        {hh.sequence != null ? `${hh.sequence}. ` : ""}
                        {hh.customer_name ?? hh.customer_unique_id ?? hh.unique_id}
                      </span>
                      {!hh.is_collected && (
                        <span className="text-xs text-red-400">(Not collected)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hh.collected_weight_kg != null ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          {Number(hh.collected_weight_kg).toFixed(2)} kg
                        </span>
                      ) : hh.is_collected ? (
                        <span className="text-xs text-gray-400">— kg</span>
                      ) : null}
                      {hh.collected_at && (
                        <span className="text-xs text-gray-400">
                          {formatCollectionTime(hh.collected_at)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Remarks */}
        {(mode === "verify" || row.remarks) && (
          <>
            <Divider className="!my-0" />
            <div>
              <SectionLabel>
                {mode === "verify" ? "Remarks (optional)" : "Remarks"}
              </SectionLabel>
              {mode === "verify" ? (
                <InputTextarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="w-full text-sm"
                  placeholder="Add verification remarks..."
                  autoResize
                />
              ) : (
                <p className="text-sm text-gray-700">{row.remarks}</p>
              )}
            </div>
          </>
        )}

        {/* Verified by */}
        {mode === "view" && row.log_status === "Verified" && row.verified_by_name && (
          <>
            <Divider className="!my-0" />
            <div>
              <SectionLabel>Verification</SectionLabel>
              <div className="flex flex-col gap-1.5">
                <InfoRow label="Verified by" value={row.verified_by_name} />
                <InfoRow label="Verified at" value={row.verified_at ?? undefined} />
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────
   Main list component
───────────────────────────────────────────────────── */
export default function DailyTripLogList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encScheduleMasters, encDailyTripLog } = getEncryptedRoute();
  const { reportPath } = createCrudRoutePaths(encScheduleMasters, encDailyTripLog);

  const [allLogs, setAllLogs] = useState<DailyTripLogRecord[]>([]);
  const [collectionType, setCollectionType] = useState<"all" | "bin" | "household">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    row: DailyTripLogRecord;
    mode: "view" | "verify";
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [imageRow, setImageRow] = useState<DailyTripLogRecord | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [dateFilter, setDateFilter] = useState("");
  const [wasteTypeIds, setWasteTypeIds] = useState<string[]>([]);
  const [wasteTypeOptions, setWasteTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  // Bumped to force-remount HierarchyFilterBar (it owns its own internal
  // state/pre-seeding) whenever "Clear All Filters" is used.
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _assignment: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _waste: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _base_template: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _alt_template: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _location: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    log_status: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    trip_date: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ── waste type dropdown options ── */
  useEffect(() => {
    (wasteTypeApi.readAll() as Promise<any[]>)
      .then((data) => {
        const options = (Array.isArray(data) ? data : []).map((wt) => ({
          label: wt.waste_type_name ?? wt.name ?? wt.unique_id,
          value: wt.unique_id,
        }));
        setWasteTypeOptions(options);
      })
      .catch(() => {
        /* non-critical — filter simply shows no options */
      });
  }, []);

  /* ── build server query params from the hierarchy/date/waste-type filters ──
     waste_type_id is sent as one comma-separated string, not an array — axios
     serializes array params as waste_type_id[]=a&waste_type_id[]=b, which the
     backend's getlist("waste_type_id") never matches. */
  const buildParams = useCallback((): Record<string, any> => {
    const params: Record<string, any> = { ...hierarchyParams };
    if (dateFilter) params.date = dateFilter;
    if (wasteTypeIds.length > 0) params.waste_type_id = wasteTypeIds.join(",");
    return params;
  }, [hierarchyParams, dateFilter, wasteTypeIds]);

  /* ── load logs (re-runs whenever hierarchy/date/waste-type filters change) ── */
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    (dailyTripLogApi.readAll({ params: buildParams() }) as Promise<DailyTripLogRecord[]>)
      .then((data) => {
        if (mounted) setAllLogs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (mounted)
          Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t, buildParams]);

  /* ── enrich rows ── */
  const rows = allLogs.map((rec) => ({
    ...rec,
    _assignment:
      rec.trip_assignment?.display_code ??
      rec.trip_assignment?.unique_id ??
      rec.trip_assignment_id ??
      "",
    _waste: Array.isArray(rec.waste_types_detail)
      ? rec.waste_types_detail.map((wt) => wt.waste_type_name).filter(Boolean).join(", ")
      : "",
    _base_template: rec.staff_template?.base?.display_code ?? "",
    _alt_template: rec.staff_template?.alt?.display_code ?? "",
    _location: rec.location?.local_body_name ?? rec.location_name ?? rec.panchayat?.panchayat_name ?? "",
    _driver: rec.driver?.employee_name ?? "",
    _operator: rec.operator?.employee_name ?? "",
    _vehicle: (rec.vehicle as any)?.vehicle_no ?? "",
    _computed_weight: computeCollectedWeight(rec.collection_points),
    _has_point_weights: (rec.collection_points ?? []).some(
      (cp) => cp?.collected_weight_kg !== null && cp?.collected_weight_kg !== undefined
    ),
  }));

  /* ── filter by collection type ── */
  const data = rows.filter((row) => {
    if (collectionType === "bin") {
      const hasBinWeight =
        (row._has_point_weights && (row._computed_weight ?? 0) > 0) ||
        (row.collected_weight_kg != null && Number(row.collected_weight_kg) > 0);
      return hasBinWeight;
    }
    if (collectionType === "household") {
      return (
        row.household_collected_weight_kg != null &&
        Number(row.household_collected_weight_kg) > 0
      );
    }
    return true;
  });

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  /* ── verify confirm (from modal) ── */
  const handleVerifyConfirm = async (remarks: string) => {
    if (!modalState) return;
    setIsVerifying(true);
    try {
      await api.patch(
        `/schedule-operations/daily-trip-logs/${modalState.row.unique_id}/verify/`,
        { remarks }
      );
      setAllLogs((current) =>
        current.map((item) =>
          item.unique_id === modalState.row.unique_id
            ? { ...item, log_status: "Verified" }
            : item
        )
      );
      setModalState(null);
      Swal.fire({
        icon: "success",
        title: "Verified",
        text: "Trip log has been verified.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err) ?? "Failed to verify trip log", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  /* ── inline status change (Draft ↔ Verify) ── */
  const handleStatusChange = async (row: DailyTripLogRecord, newStatus: string) => {
    const result = await Swal.fire({
      title: `Change status to ${newStatus}?`,
      text: `This will move the log from "${row.log_status}" to "${newStatus}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, change to ${newStatus}`,
    });
    if (!result.isConfirmed) return;
    try {
      const res = await api.patch(
        `/schedule-operations/daily-trip-logs/${row.unique_id}/change-status/`,
        { log_status: newStatus }
      );
      const updated = (res as any)?.data ?? res;
      setAllLogs((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id
            ? {
                ...item,
                log_status: updated.log_status ?? newStatus,
                verified_by_name: updated.verified_by_name ?? null,
                verified_at: updated.verified_at ?? null,
              }
            : item
        )
      );
      Swal.fire({
        icon: "success",
        title: "Done",
        text: `Status changed to ${newStatus}.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err) ?? "Failed to change status", "error");
    }
  };

  /* ── inline action buttons ── */
  const actionTemplate = (row: DailyTripLogRecord) => {
    const isVerified = row.log_status === "Verified";
    const isDraft = row.log_status === "Draft";

    return (
      <div className="flex items-center gap-1.5">
        {/* Captured images */}
        <button
          title="View captured images"
          onClick={() => setImageRow(row)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
        >
          <i className="pi pi-images text-xs" />
          Images
        </button>

        {/* View — navigates to the dedicated detail report page */}
        <button
          title="View details"
          onClick={() => row.unique_id && navigate(reportPath(row.unique_id))}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <i className="pi pi-eye text-xs" />
          View
        </button>

        {/* Verify — disabled when already Verified */}
        <button
          title={isVerified ? "Already verified" : "Verify this log"}
          disabled={isVerified}
          onClick={() => setModalState({ row, mode: "verify" })}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            isVerified
              ? "bg-green-50 text-green-400 cursor-not-allowed opacity-60"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          <i className="pi pi-check-circle text-xs" />
          Verify
        </button>

        {/* Draft — disabled when already Draft */}
        <button
          title={isDraft ? "Already in draft" : "Revert to draft"}
          disabled={isDraft}
          onClick={() => handleStatusChange(row, "Draft")}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            isDraft
              ? "bg-gray-50 text-gray-300 cursor-not-allowed opacity-60"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <i className="pi pi-undo text-xs" />
          Draft
        </button>
      </div>
    );
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: "Search trip logs...",
    });

  /* ── download the currently filtered set (hierarchy + waste type + date +
     global search) as a detailed, per-collection-point/customer itemized
     Excel report — same shape as the trip report page ── */
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const exportSource = (await dailyTripLogApi.readAllForExport({
        params: buildParams(),
      })) as DailyTripLogRecord[];

      const search = globalFilterValue.trim().toLowerCase();
      const filteredSource = search
        ? exportSource.filter((rec) => {
            const haystack = [
              rec.unique_id,
              rec.trip_assignment?.display_code ?? rec.trip_assignment_id,
              rec.location?.local_body_name ?? rec.location_name,
              rec.driver?.employee_name,
              rec.operator?.employee_name,
              (rec.vehicle as any)?.vehicle_no,
              rec.log_status,
              rec.collection_status,
              rec.trip_date,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(search);
          })
        : exportSource;

      const byCollectionType = filteredSource.filter((rec) => {
        if (collectionType === "bin") {
          const hasBinWeight =
            (rec.collection_points ?? []).some(
              (cp) => cp?.collected_weight_kg !== null && cp?.collected_weight_kg !== undefined
            ) || (rec.collected_weight_kg != null && Number(rec.collected_weight_kg) > 0);
          return hasBinWeight;
        }
        if (collectionType === "household") {
          return rec.household_collected_weight_kg != null && Number(rec.household_collected_weight_kg) > 0;
        }
        return true;
      });

      const exportRows: Record<string, unknown>[] = [];
      byCollectionType.forEach((rec) => {
        const baseRow = {
          "Trip ID": rec.unique_id,
          "Trip Assignment": rec.trip_assignment?.display_code ?? rec.trip_assignment_id ?? "-",
          "Trip Date": rec.trip_date ?? "-",
          State: rec.location?.state ?? "-",
          District: rec.location?.district ?? "-",
          "Local Body": rec.location?.local_body_name ?? "-",
          "Local Body Level": rec.location?.local_body_level ?? "-",
          Driver: rec.driver?.employee_name ?? "-",
          Operator: rec.operator?.employee_name ?? "-",
          Vehicle: (rec.vehicle as any)?.vehicle_no ?? "-",
          "Log Status": rec.log_status ?? "-",
        };

        const cps = rec.collection_points ?? [];
        const hhs = rec.household_collections ?? [];
        const isHousehold = hhs.length > 0;

        if (isHousehold) {
          hhs.forEach((hh) => {
            const breakdown = hh.waste_type_breakdown?.length
              ? hh.waste_type_breakdown
              : [{ waste_type_name: "-", collected_weight_kg: hh.collected_weight_kg }];
            breakdown.forEach((wt) => {
              exportRows.push({
                ...baseRow,
                "Point Type": "Household",
                "Collection Point / Customer": hh.customer_name ?? hh.customer_unique_id ?? "-",
                "Waste Type": wt.waste_type_name ?? "-",
                "Collected Weight (kg)": wt.collected_weight_kg ?? "-",
                "Collection Time": formatCollectionTime(hh.collected_at),
                "Is Collected": hh.is_collected ? "Yes" : "No",
              });
            });
          });
        } else if (cps.length > 0) {
          cps.forEach((cp) => {
            const breakdown = cp.waste_type_breakdown?.length
              ? cp.waste_type_breakdown
              : [{ waste_type_name: cp.waste_type_name, collected_weight_kg: cp.collected_weight_kg }];
            breakdown.forEach((wt) => {
              exportRows.push({
                ...baseRow,
                "Point Type": "Collection Point",
                "Collection Point / Customer": cp.cp_name ?? cp.unique_id ?? "-",
                "Waste Type": wt.waste_type_name ?? "-",
                "Collected Weight (kg)": wt.collected_weight_kg ?? "-",
                "Collection Time": formatCollectionTime(cp.collected_at),
                "Is Collected": cp.is_collected ? "Yes" : "No",
              });
            });
          });
        } else {
          exportRows.push({
            ...baseRow,
            "Point Type": "-",
            "Collection Point / Customer": "-",
            "Waste Type": "-",
            "Collected Weight (kg)": rec.collected_weight_kg ?? "-",
            "Collection Time": "-",
            "Is Collected": "-",
          });
        }
      });

      exportRecordsToExcel(exportRows, getAdminScreenExcelFilename("all"), "Daily Trip Logs");
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err) ?? "Failed to download trip log data.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters =
    Object.keys(hierarchyParams).length > 0 ||
    Boolean(dateFilter) ||
    wasteTypeIds.length > 0 ||
    collectionType !== "all";

  const handleClearFilters = () => {
    setHierarchyParams({});
    setDateFilter("");
    setWasteTypeIds([]);
    setCollectionType("all");
    setFilterResetKey((key) => key + 1);
  };

  return (
    <div className="p-3">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Daily Trip Logs</h1>
          <p className="text-sm text-gray-500">Capture and verify actual collection trip results</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={collectionType}
            onChange={(e) => setCollectionType(e.target.value as "all" | "bin" | "household")}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="all">All Collections</option>
            <option value="bin">Bin Collection</option>
            <option value="household">Household Collection</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <Button
            label={isExporting ? "Downloading…" : "Download"}
            icon="pi pi-download"
            className="p-button-outlined"
            disabled={isExporting || data.length === 0}
            onClick={handleDownload}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
        <HierarchyFilterBar key={filterResetKey} className="contents" showClear={false} onChange={setHierarchyParams} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Waste Type</label>
          <MultiSelect
            value={wasteTypeIds}
            onChange={(e) => {
              const raw = Array.isArray(e.value) ? e.value : [];
              // PrimeReact MultiSelect can emit full option objects instead of
              // the scalar optionValue — normalize so filter params stay clean strings.
              const values = raw.map((v: any) =>
                v && typeof v === "object" ? String(v.value ?? v.unique_id ?? v.id ?? "") : String(v),
              );
              setWasteTypeIds(values);
            }}
            options={wasteTypeOptions}
            optionLabel="label"
            optionValue="value"
            maxSelectedLabels={2}
            placeholder="All waste types"
            className="flex! h-10! w-full! items-center! justify-between! rounded-md! border! border-input! bg-background! px-3! py-2! text-sm! shadow-none! ring-offset-background! focus:outline-none! focus:ring-2! focus:ring-ring! focus:ring-offset-2! disabled:cursor-not-allowed! disabled:opacity-50!"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="pi pi-filter-slash text-xs" />
            Clear All Filters
          </button>
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
        emptyMessage="No trip logs found."
        globalFilterFields={[
          "unique_id",
          "_assignment",
          "_location",
          "_waste",
          "_base_template",
          "_alt_template",
          "_driver",
          "_operator",
          "_vehicle",
          "log_status",
          "collection_status",
          "trip_date",
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
        />
        <Column
          field="_location"
          header="Location"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
          body={(row: DailyTripLogRecord) => {
            const name = row.location?.local_body_name ?? row.location_name ?? row.panchayat?.panchayat_name;
            const level = row.location?.local_body_level ?? row.location_level ?? (row.panchayat?.panchayat_name ? "Panchayat" : null);
            const cls = row.location?.classification ?? "";
            if (!name) return <span className="text-sm text-gray-400">—</span>;
            return (
              <div className="text-sm text-gray-800">
                {name}
                {level && <span className="ml-1 text-xs text-indigo-500 font-medium">({level})</span>}
                {cls && (
                  <div className="text-[10px] font-semibold text-gray-500">
                    {cls.toLowerCase().includes("urban") ? "ULB" : "RLB"} · {row.location?.district ?? ""}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Column
          field="_base_template"
          header="Staff Template"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 160 }}
          body={(row: DailyTripLogRecord) => (
            <span className="text-sm text-gray-800">
              {row.staff_template?.base?.display_code ?? "-"}
            </span>
          )}
        />
        <Column
          field="_alt_template"
          header="Alt Staff Template"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 170 }}
          body={(row: DailyTripLogRecord) =>
            row.staff_template?.alt ? (
              <span className="text-sm font-medium text-orange-700">
                {row.staff_template.alt.display_code}
              </span>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )
          }
        />
        <Column
          field="_waste"
          header="Waste Type"
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="collected_weight_kg"
          header="Bin Weight (kg)"
          sortable
          style={{ minWidth: 130 }}
          body={(row: DailyTripLogRecord & { _computed_weight?: number; _has_point_weights?: boolean }) => {
            const weight = row._has_point_weights
              ? row._computed_weight
              : row.collected_weight_kg;
            return weight != null ? (
              <span className="font-semibold text-gray-800">
                {Number(weight).toFixed(2)}
              </span>
            ) : (
              "-"
            );
          }}
        />
        <Column
          field="household_collected_weight_kg"
          header="HH Weight (kg)"
          sortable
          style={{ minWidth: 130 }}
          body={(row: DailyTripLogRecord) =>
            row.household_collected_weight_kg != null ? (
              <span className="font-semibold text-gray-800">
                {Number(row.household_collected_weight_kg).toFixed(2)}
              </span>
            ) : (
              "-"
            )
          }
        />
        <Column
          field="log_status"
          header="Log Status"
          body={(row: DailyTripLogRecord) => <Badge value={row.log_status} />}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 110 }}
        />
        <Column
          field="collection_status"
          header="Collection Status"
          body={(row: DailyTripLogRecord) => <CollectionStatusBadge value={row.collection_status} />}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 145 }}
        />
        <Column field="_driver" header="Driver" style={{ minWidth: 130 }} />
        <Column field="_operator" header="Operator" style={{ minWidth: 130 }} />
        <Column field="_vehicle" header="Vehicle" style={{ minWidth: 110 }} />
        <Column
          field="trip_date"
          header="Trip Date"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 110 }}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ minWidth: 210 }}
        />
      </DataTable>

      {modalState && (
        <TripLogModal
          row={modalState.row}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
          onConfirm={handleVerifyConfirm}
          isLoading={isVerifying}
        />
      )}

      <Dialog
        header="Captured images"
        visible={imageRow != null}
        onHide={() => setImageRow(null)}
        style={{ width: "min(90vw, 720px)" }}
        modal
        dismissableMask
      >
        {(imageRow?.capture_images?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No captured images found for this trip.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3">
            {imageRow?.capture_images?.map((img, index) => (
              <a
                key={`${img.url}-${index}`}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="block"
                title="Open image"
              >
                <img
                  src={img.url}
                  alt={`Captured image ${index + 1}`}
                  className="h-40 w-full rounded-lg border object-cover"
                  loading="lazy"
                />
                {img.weight != null && img.weight !== "" && (
                  <div className="mt-1 text-center text-xs text-gray-500">
                    {img.weight} kg
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
