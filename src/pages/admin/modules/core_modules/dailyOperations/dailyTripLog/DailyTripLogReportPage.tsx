import type {
  DailyTripLogRecord,
  TripLogCaptureImage,
  WasteTypeBreakdownItem,
} from "./types";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";

import { api } from "@/api";
import { dailyTripLogApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { formatCollectionTime } from "./collectionTime";

// Same "still in play" definition as DailyTripAssignment.pending_bin_stops()/
// pending_household_stops() on the backend — everything except Collected and
// Missed/Not Available is eligible to carry over to a next trip.
const isStopPending = (status?: string): boolean =>
  !["Collected", "Missed", "Not Available"].includes(String(status ?? ""));

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

// actual_start_time/actual_end_time are plain "HH:MM:SS" TimeField strings
// (no date component), so formatCollectionTime (which parses a full
// datetime) doesn't apply here.
const formatTime12Hour = (value?: string | null): string => {
  if (!value) return "-";
  const [hourStr, minuteStr = "00"] = value.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${minuteStr.padStart(2, "0")} ${period}`;
};

const computeCollectedWeight = (collectionPoints?: DailyTripLogRecord["collection_points"]): number => {
  return (collectionPoints ?? []).reduce((sum, cp) => {
    if (cp?.collected_weight_kg === null || cp?.collected_weight_kg === undefined) return sum;
    const weight = Number(cp.collected_weight_kg);
    return sum + (Number.isFinite(weight) ? weight : 0);
  }, 0);
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{children}</p>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-gray-500 w-40 shrink-0">{label}</span>
    <span className="font-medium text-gray-800">{value ?? "-"}</span>
  </div>
);

const WasteChips = ({ items }: { items?: WasteTypeBreakdownItem[] }) => {
  if (!items || items.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <span
          key={`${item.waste_type_name}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
        >
          {item.waste_type_name ?? "—"}
          <span className="font-semibold">
            {item.collected_weight_kg != null ? `${Number(item.collected_weight_kg).toFixed(2)} kg` : "—"}
          </span>
        </span>
      ))}
    </div>
  );
};

const CollectionImageLinks = ({ images }: { images?: TripLogCaptureImage[] }) => {
  const availableImages = (images ?? []).filter((image) => Boolean(image.url));
  if (availableImages.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {availableImages.map((image, index) => (
        <a
          key={`${image.url}-${index}`}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          title="Open collection image"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <i className="pi pi-image text-xs" aria-hidden="true" />
          {availableImages.length === 1 ? "View image" : `Image ${index + 1}`}
        </a>
      ))}
    </div>
  );
};

type ImageCollectionRow = {
  unique_id?: string;
  waste_collection_id?: string | null;
  waste_type_breakdown?: WasteTypeBreakdownItem[];
  capture_images?: TripLogCaptureImage[];
};

const imageCollectionIds = (image: TripLogCaptureImage): string[] =>
  [
    image.collection_id,
    image.waste_collection_id,
    image.household_collection_id,
    image.trip_household_collection_id,
    image.collection_point_id,
    image.trip_collection_point_id,
    image.bin_collection_event_id,
  ]
    .filter((value): value is string => value !== null && value !== undefined)
    .map(String);

const sameWeight = (
  imageWeight: TripLogCaptureImage["weight"],
  breakdownWeight: WasteTypeBreakdownItem["collected_weight_kg"],
) => {
  const left = Number(imageWeight);
  const right = Number(breakdownWeight);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.001;
};

/**
 * Newer API responses can return capture_images on each collection row.
 * Older responses aggregate them at trip level, so allocate those images back
 * to their collection using IDs first and waste type/weight as a fallback.
 */
const mapImagesToCollections = (
  rows: ImageCollectionRow[],
  tripImages?: TripLogCaptureImage[],
): Map<string, TripLogCaptureImage[]> => {
  const images = tripImages ?? [];
  const usedImageIndexes = new Set<number>();
  const result = new Map<string, TripLogCaptureImage[]>();

  rows.forEach((collection, rowIndex) => {
    const rowKey = collection.unique_id ?? `collection-${rowIndex}`;
    const nestedImages = (collection.capture_images ?? []).filter((image) => Boolean(image.url));
    if (nestedImages.length > 0) {
      result.set(rowKey, nestedImages);
      const nestedUrls = new Set(nestedImages.map((image) => image.url));
      images.forEach((image, imageIndex) => {
        if (nestedUrls.has(image.url)) usedImageIndexes.add(imageIndex);
      });
      return;
    }

    const collectionIds = new Set(
      [collection.unique_id, collection.waste_collection_id]
        .filter((value): value is string => Boolean(value))
        .map(String),
    );
    const explicitlyLinked = images
      .map((image, imageIndex) => ({ image, imageIndex }))
      .filter(
        ({ image, imageIndex }) =>
          !usedImageIndexes.has(imageIndex) &&
          imageCollectionIds(image).some((id) => collectionIds.has(id)),
      );

    if (explicitlyLinked.length > 0) {
      explicitlyLinked.forEach(({ imageIndex }) => usedImageIndexes.add(imageIndex));
      result.set(rowKey, explicitlyLinked.map(({ image }) => image));
      return;
    }

    const matchedImages: TripLogCaptureImage[] = [];
    (collection.waste_type_breakdown ?? []).forEach((waste) => {
      const matchingIndex = images.findIndex((image, imageIndex) => {
        if (usedImageIndexes.has(imageIndex)) return false;
        const sameWasteType =
          !waste.waste_type_id ||
          !image.waste_type_id ||
          String(image.waste_type_id) === String(waste.waste_type_id);
        return sameWasteType && sameWeight(image.weight, waste.collected_weight_kg);
      });
      if (matchingIndex >= 0) {
        usedImageIndexes.add(matchingIndex);
        matchedImages.push(images[matchingIndex]);
      }
    });

    result.set(rowKey, matchedImages);
  });

  return result;
};

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

// Per-stop status, same literal values + styling as dailyTripCollectionPointList.tsx
// (Pending/Collected/Skipped), extended with the other status choices that exist
// on DailyTripCollectionPoint (In Progress, Missed) and DailyTripHouseholdCollection
// (Not Available, Collect Later).
const STOP_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  Skipped: "bg-red-100 text-red-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Missed: "bg-red-100 text-red-800",
  "Not Available": "bg-red-100 text-red-800",
  "Collect Later": "bg-orange-100 text-orange-800",
};

const StopStatusBadge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      STOP_STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"
    }`}
  >
    {value ?? "-"}
  </span>
);

// A stop can carry a plain status (e.g. still "Pending") AND be moved to a
// continuation trip at the same time — the source stop is deliberately left
// untouched so trip completion math stays honest (see
// retrip_service.approve_retrip). This badge is what tells the viewer where
// it actually went.
const CarriedToNextTripBadge = ({
  assignmentId,
  remarks,
}: {
  assignmentId: string;
  remarks?: string | null;
}) => (
  <div className="flex flex-col gap-1">
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 w-fit">
      <i className="pi pi-arrow-right" style={{ fontSize: "0.6rem" }} />
      {assignmentId}
    </span>
    {remarks && <span className="text-[11px] italic text-gray-400">"{remarks}"</span>}
  </div>
);

function ProceedNextTripModal({
  isHousehold,
  carryCount,
  onClose,
  onConfirm,
  isLoading,
}: {
  isHousehold: boolean;
  carryCount: number;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  isLoading: boolean;
}) {
  const [remarks, setRemarks] = useState("");
  const canSubmit = remarks.trim().length > 0;

  const footer = (
    <div className="flex justify-end gap-2 pt-2">
      <Button label="Cancel" className="p-button-text p-button-secondary" onClick={onClose} disabled={isLoading} />
      <Button
        label="Done"
        icon="pi pi-check"
        className="p-button-success"
        loading={isLoading}
        disabled={!canSubmit}
        onClick={() => onConfirm(remarks.trim())}
      />
    </div>
  );

  return (
    <Dialog
      visible
      onHide={onClose}
      header="Proceed with Next Trip"
      footer={footer}
      style={{ width: "480px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
          {isHousehold
            ? `All ${carryCount} remaining household(s) will move to a new trip for the same staff, vehicle, and date. This trip will be marked ended.`
            : `${carryCount} selected collection point(s) will move to a new trip for the same staff, vehicle, and date. This trip will be marked ended.`}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">
            Remarks <span className="text-red-500">*</span>
          </p>
          <InputTextarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="w-full text-sm"
            placeholder="Why is this trip proceeding to a next trip? (required)"
            autoResize
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────
   Daily Trip Log — detailed report page (single trip)
───────────────────────────────────────────────────── */
export default function DailyTripLogReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { encDailyOperations, encDailyTripLog } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encDailyOperations, encDailyTripLog);

  const [row, setRow] = useState<DailyTripLogRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // "Proceed with Next Trip" — carry uncollected stops to a continuation trip,
  // same feature as the Daily Trip Plan form, surfaced here too so a
  // supervisor reviewing this report doesn't have to navigate away to act on it.
  const [selectedCpIds, setSelectedCpIds] = useState<Set<string>>(new Set());
  const [proceedMode, setProceedMode] = useState<"bin" | "household" | null>(null);
  const [isProceeding, setIsProceeding] = useState(false);

  const loadLog = (mountedRef?: { current: boolean }) => {
    if (!id) return;
    setLoading(true);
    (dailyTripLogApi.read(id) as Promise<DailyTripLogRecord>)
      .then((data) => {
        if (!mountedRef || mountedRef.current) setRow(data);
      })
      .catch((err) => {
        if (!mountedRef || mountedRef.current)
          Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
      })
      .finally(() => {
        if (!mountedRef || mountedRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    const mountedRef = { current: true };
    loadLog(mountedRef);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading trip report…</div>;
  }

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">Trip log not found.</p>
        <Button label="Back to list" icon="pi pi-arrow-left" onClick={() => navigate(listPath)} />
      </div>
    );
  }

  const cps = row.collection_points ?? [];
  const hhCollections = row.household_collections ?? [];
  // A trip is either a bin-collection trip or a household-collection trip —
  // show whichever list is populated, never both, never an empty table.
  const isHousehold = hhCollections.length > 0;
  const st = row.staff_template;
  const wasteTypeName =
    Array.isArray(row.waste_types_detail) && row.waste_types_detail.length > 0
      ? row.waste_types_detail.map((wt) => wt.waste_type_name).filter(Boolean).join(", ")
      : "-";
  const wasteTypeBreakdown = Array.isArray(row.waste_type_breakdown) ? row.waste_type_breakdown : [];
  const collectedWeightFromPoints = computeCollectedWeight(cps);
  const overallTotal = collectedWeightFromPoints + Number(row.household_collected_weight_kg ?? 0);
  const householdImages = mapImagesToCollections(hhCollections, row.capture_images);
  const collectionPointImages = mapImagesToCollections(cps, row.capture_images);

  // Stops moved to a Re-Trip continuation (truck went for weighment before
  // finishing the route) — surfaced so "Pending" here doesn't read as
  // "nothing happened". See retrip_service.approve_retrip on the backend.
  const carriedStops = [...cps, ...hhCollections].filter((stop) => stop.carried_to_assignment);
  const carriedToAssignmentId = carriedStops[0]?.carried_to_assignment ?? null;
  const carriedRemarks = carriedStops[0]?.carried_to_assignment_remarks ?? null;

  // Proceed with Next Trip — only meaningful while the trip is still open.
  const assignmentId = row.trip_assignment_id ?? row.trip_assignment?.unique_id;
  const assignmentStatus = (row.trip_assignment as any)?.status;
  const canProceedTrip = assignmentStatus === "In Progress" && Boolean(assignmentId);
  const pendingCps = cps.filter((cp) => isStopPending(cp.status));
  const remainingHouseholdCount = hhCollections.filter((hh) => isStopPending(hh.status)).length;

  const toggleCpSelected = (key?: string) => {
    if (!key) return;
    setSelectedCpIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleProceedConfirm = async (remarks: string) => {
    if (!assignmentId || !proceedMode) return;
    setIsProceeding(true);
    try {
      const isHouseholdMode = proceedMode === "household";
      const response = await api.post(
        `/schedule-operations/daily-trip-assignments/${assignmentId}/proceed-next-trip/`,
        {
          ...(isHouseholdMode ? {} : { collection_point_ids: Array.from(selectedCpIds) }),
          remarks,
        },
      );
      setProceedMode(null);
      setSelectedCpIds(new Set());
      loadLog();
      Swal.fire({
        icon: "success",
        title: "Trip Proceeded",
        text: `A new trip (${response.data?.new_assignment_id ?? ""}) has been created for the remaining stops.`,
        timer: 2800,
        showConfirmButton: false,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      const message = data?.detail ?? data?.remarks ?? data?.collection_point_ids ?? "Unable to proceed with next trip.";
      Swal.fire(t("common.error"), String(Array.isArray(message) ? message[0] : message), "error");
    } finally {
      setIsProceeding(false);
    }
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Trip Log Report</h1>
          <p className="text-sm text-gray-500">{row.unique_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={row.log_status} />
          <CollectionStatusBadge value={row.collection_status} />
        </div>
      </div>

      {/* Trip / Location / Staff summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 mb-6">
        <div className="rounded-xl border p-4">
          <SectionLabel>Trip Details</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <InfoRow label="Trip Assignment" value={row.trip_assignment?.display_code ?? row.trip_assignment_id} />
            <InfoRow label="Date" value={row.trip_date} />
            <InfoRow label="Collection Status" value={row.collection_status} />
            <InfoRow label="Waste Type" value={wasteTypeName} />
            <InfoRow label="Vehicle" value={(row.vehicle as any)?.vehicle_no} />
            <InfoRow label="Start Time" value={formatTime12Hour(row.actual_start_time)} />
            <InfoRow label="End Time" value={formatTime12Hour(row.actual_end_time)} />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <SectionLabel>Local Body Hierarchy</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <InfoRow label="State" value={row.location?.state} />
            <InfoRow label="District" value={row.location?.district} />
            <InfoRow label="Classification" value={row.location?.classification} />
            <InfoRow
              label="Local Body"
              value={
                row.location?.local_body_name
                  ? `${row.location.local_body_name}${row.location.local_body_level ? ` (${row.location.local_body_level})` : ""}`
                  : undefined
              }
            />
            <InfoRow label="Ward" value={row.wards_detail?.map((ward) => ward.ward_name).filter(Boolean).join(", ")} />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <SectionLabel>Staff</SectionLabel>
          {st?.base ? (
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Driver" value={st.base.driver?.employee_name} />
              <InfoRow label="Operator" value={st.base.operator?.employee_name} />
              {st.alt && (
                <>
                  <p className="text-xs text-orange-500 mt-1">Alt: {st.alt.display_code}</p>
                  <InfoRow label="Driver" value={st.alt.driver?.employee_name} />
                  <InfoRow label="Operator" value={st.alt.operator?.employee_name} />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Driver" value={row.driver?.employee_name} />
              <InfoRow label="Operator" value={row.operator?.employee_name} />
            </div>
          )}
        </div>
      </div>

      {carriedStops.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-6 text-sm text-blue-800">
          <div>
            <i className="pi pi-arrow-right mr-1.5" style={{ fontSize: "0.8rem" }} />
            {carriedStops.length} {isHousehold ? "household" : "collection point"}
            {carriedStops.length === 1 ? "" : "s"} on this trip {carriedStops.length === 1 ? "was" : "were"} moved to
            trip <span className="font-semibold">{carriedToAssignmentId}</span>.
          </div>
          {carriedRemarks && (
            <p className="mt-1 text-xs italic text-blue-700">Remarks: "{carriedRemarks}"</p>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="rounded-xl border p-4 mb-6 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Overall Total</p>
          <p className="text-xl font-bold text-gray-900">{overallTotal.toFixed(2)} kg</p>
        </div>
        {wasteTypeBreakdown.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total by Waste Type</p>
            <WasteChips items={wasteTypeBreakdown} />
          </div>
        )}
      </div>

      {/* Collection Points OR Household Collections — never both */}
      {isHousehold ? (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <SectionLabel>
              Household Collections
              <span className="ml-1 normal-case font-normal text-gray-400">
                — {hhCollections.filter((hh) => hh.is_collected).length} / {hhCollections.length} collected
              </span>
            </SectionLabel>
            {canProceedTrip && remainingHouseholdCount > 0 && (
              <Button
                type="button"
                label={`Proceed with Next Trip (${remainingHouseholdCount} remaining)`}
                icon="pi pi-arrow-right"
                className="p-button-sm p-button-warning"
                onClick={() => setProceedMode("household")}
              />
            )}
          </div>
          <DataTable
            value={hhCollections}
            dataKey="unique_id"
            className="p-datatable-sm"
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            exportable={false}
          >
            <Column field="sequence" header="#" style={{ width: 50 }} />
            <Column
              header="Customer"
              body={(hh: any) => hh.customer_name ?? hh.customer_unique_id ?? "-"}
            />
            <Column
              header="Waste Type Breakdown"
              body={(hh: any) => <WasteChips items={hh.waste_type_breakdown} />}
            />
            <Column
              header="Collection Time"
              style={{ width: 140 }}
              body={(hh: any) => formatCollectionTime(hh.collected_at)}
            />
            <Column
              header="Image"
              style={{ width: 140 }}
              body={(hh: any) => (
                <CollectionImageLinks
                  images={householdImages.get(hh.unique_id) ?? hh.capture_images}
                />
              )}
            />
            <Column
              header="Status"
              style={{ width: 160 }}
              body={(hh: any) => (
                <div className="flex flex-col gap-1 items-start">
                  <StopStatusBadge value={hh.status} />
                  {hh.carried_to_assignment && (
                    <CarriedToNextTripBadge
                      assignmentId={hh.carried_to_assignment}
                      remarks={hh.carried_to_assignment_remarks}
                    />
                  )}
                </div>
              )}
            />
          </DataTable>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <SectionLabel>
              Collection Points
              {cps.length > 0 && (
                <span className="ml-1 normal-case font-normal text-gray-400">
                  — {cps.filter((cp) => cp.is_collected).length} / {cps.length} collected
                </span>
              )}
            </SectionLabel>
            {canProceedTrip && pendingCps.length > 0 && (
              <Button
                type="button"
                label={`Proceed with Next Trip${selectedCpIds.size > 0 ? ` (${selectedCpIds.size})` : ""}`}
                icon="pi pi-arrow-right"
                className="p-button-sm p-button-warning"
                disabled={selectedCpIds.size === 0}
                onClick={() => setProceedMode("bin")}
              />
            )}
          </div>
          <DataTable
            value={cps}
            dataKey="unique_id"
            className="p-datatable-sm"
            emptyMessage="No collection points."
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            exportable={false}
          >
            <Column field="sequence" header="#" style={{ width: 50 }} />
            <Column field="cp_name" header="Collection Point" />
            <Column
              header="Waste Type Breakdown"
              body={(cp: any) => <WasteChips items={cp.waste_type_breakdown} />}
            />
            <Column
              header="Collection Time"
              style={{ width: 140 }}
              body={(cp: any) => formatCollectionTime(cp.collected_at)}
            />
            <Column
              header="Image"
              style={{ width: 140 }}
              body={(cp: any) => (
                <CollectionImageLinks
                  images={collectionPointImages.get(cp.unique_id) ?? cp.capture_images}
                />
              )}
            />
            <Column
              header="Status"
              style={{ width: 160 }}
              body={(cp: any) => (
                <div className="flex flex-col gap-1 items-start">
                  <StopStatusBadge value={cp.status} />
                  {cp.carried_to_assignment && (
                    <CarriedToNextTripBadge
                      assignmentId={cp.carried_to_assignment}
                      remarks={cp.carried_to_assignment_remarks}
                    />
                  )}
                </div>
              )}
            />
            {canProceedTrip && (
              <Column
                header="Carry Over"
                style={{ width: 100 }}
                align="center"
                body={(cp: any) =>
                  isStopPending(cp.status) ? (
                    <input
                      type="checkbox"
                      checked={selectedCpIds.has(String(cp.trip_collection_point_id ?? ""))}
                      onChange={() => toggleCpSelected(cp.trip_collection_point_id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )
                }
              />
            )}
          </DataTable>
        </div>
      )}

      <div className="mt-6">
        <Button
          label="Back to list"
          icon="pi pi-arrow-left"
          className="p-button-outlined p-button-sm"
          onClick={() => navigate(listPath)}
        />
      </div>

      {proceedMode && (
        <ProceedNextTripModal
          isHousehold={proceedMode === "household"}
          carryCount={proceedMode === "household" ? remainingHouseholdCount : selectedCpIds.size}
          onClose={() => setProceedMode(null)}
          onConfirm={handleProceedConfirm}
          isLoading={isProceeding}
        />
      )}
    </div>
  );
}
