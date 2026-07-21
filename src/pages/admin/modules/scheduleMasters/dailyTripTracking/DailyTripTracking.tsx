import type {
  HouseholdRecord,
  OptimizationResult,
  OverviewResponse,
  Row,
  Tab,
  TrackingResponse,
  VehicleLocation,
  VehicleStatus,
} from "./types";
import type { ReactNode } from "react";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Swal from "@/lib/notify";
import {
  alternativeStaffTemplateApi,
  dailyTripAssignmentApi,
  dailyTripCollectionPointApi,
  dailyTripHouseholdCollectionApi,
  staffTemplateApi,
  tripPlanApi,
  wasteTypeApi,
} from "@/helpers/admin";
import { normalizeList, staffTemplateLabel, altStaffTemplateLabel } from "@/utils/forms";
import { useGeoHierarchy, staffTemplateInHierarchy } from "@/hooks/useGeoHierarchy";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  Pending: "#ef4444",
  "In Progress": "#f59e0b",
  Collected: "#22c55e",
  Completed: "#22c55e",
  Skipped: "#6b7280",
  Missed: "#9ca3af",
  "Collect Later": "#f59e0b",
  "Not Available": "#9ca3af",
  "Not Collected": "#9ca3af",
};

const STATUS_BG: Record<string, string> = {
  Pending: "bg-red-50 border-red-200",
  "In Progress": "bg-amber-50 border-amber-300",
  Collected: "bg-green-50 border-green-200",
  Completed: "bg-green-50 border-green-200",
  Skipped: "bg-gray-50 border-gray-200",
  Missed: "bg-gray-50 border-gray-200",
  "Collect Later": "bg-amber-50 border-amber-300",
  "Not Available": "bg-gray-50 border-gray-200",
  "Not Collected": "bg-gray-50 border-gray-200",
};

const TABS = ["All", "On Process", "Completed", "Pending", "Missed"] as const;

const TAB_FILTER: Record<Tab, string | undefined> = {
  All: undefined,
  "On Process": "In Progress",
  Completed: "Collected",
  Pending: "Pending",
  Missed: "Missed",
};

// Household/bulk stops have no server-side status filter (their status set —
// Pending/Collected/Collect Later/Not Available — doesn't share bin-stop's "In
// Progress" state), so tab filtering for them happens client-side against this map.
const HOUSEHOLD_TAB_STATUSES: Record<Tab, string[] | null> = {
  All: null,
  "On Process": [],
  Completed: ["Collected"],
  Pending: ["Pending", "Collect Later"],
  Missed: ["Not Available", "Not Collected"],
};

const TRIP_ROUTE_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#db2777",
  "#16a34a",
  "#4f46e5",
  "#ca8a04",
];

const TRACKING_REFRESH_INTERVAL_MS = 15000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTravelTime(seconds?: number) {
  if (!seconds || seconds <= 0) return "Arriving";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function locationLabel(cp?: Row["collection_point"]) {
  return cp?.panchayat_name || null;
}

/** Unified stop name across bin-collection rows (`collection_point`) and
 * household/bulk rows (`household.customer`) so timeline/map code doesn't
 * need to branch on which kind of stop it's rendering. */
function stopName(row: Row) {
  if (row.household) {
    return row.household.customer?.customer_name || row.household.customer?.unique_id || row.unique_id;
  }
  return row.collection_point?.cp_name ?? row.unique_id;
}

function stopLocationLabel(row: Row) {
  if (row.household) {
    const c = row.household.customer;
    const address = [c?.building_no, c?.street].filter(Boolean).join(", ");
    return address || c?.location_name || null;
  }
  return locationLabel(row.collection_point);
}

function stopLatLng(row: Row | undefined | null): [number, number] | null {
  if (!row) return null;
  const source = row.household ? row.household.customer : row.collection_point;
  // Customer lat/lng come back from the API as strings (possibly blank for
  // records never geocoded) — `Number("")` is 0, not NaN, so an unset value
  // would otherwise silently resolve to a real (but wrong) point off the
  // coast of Africa instead of being treated as "no coordinates".
  if (source?.latitude === "" || source?.latitude == null) return null;
  if (source?.longitude === "" || source?.longitude == null) return null;
  const lat = Number(source.latitude);
  const lng = Number(source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return [lat, lng];
}

function statusLabel(status: string) {
  return status === "Collected" ? "Completed" : status;
}

const VEHICLE_STATUS_STALE_MS = 5 * 60 * 1000;

function vehicleStatusOf(vehicleNo?: string | null, recordedAt?: string | null): VehicleStatus {
  if (!vehicleNo) return "no_vehicle";
  if (!recordedAt) return "no_gps";
  const recorded = new Date(recordedAt).getTime();
  if (!Number.isFinite(recorded)) return "no_gps";
  return Date.now() - recorded <= VEHICLE_STATUS_STALE_MS ? "live" : "stale";
}

const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; dot: string; text: string; bg: string }> = {
  live: { label: "Live", dot: "#22c55e", text: "text-green-700", bg: "bg-green-50 border-green-200" },
  stale: { label: "Stale", dot: "#f59e0b", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  no_gps: { label: "No GPS data yet", dot: "#9ca3af", text: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
  no_vehicle: { label: "No vehicle assigned", dot: "#9ca3af", text: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
};

function fmtRelativeTime(iso?: string | null) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function VehicleStatusBadge({ status, recordedAt }: { status: VehicleStatus; recordedAt?: string | null }) {
  const meta = VEHICLE_STATUS_META[status];
  const relative = status === "live" || status === "stale" ? fmtRelativeTime(recordedAt) : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.text} ${meta.bg}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
      {relative ? ` · ${relative}` : ""}
    </span>
  );
}

function normalizeVehicleNumber(value: unknown) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function readLiveVehicleLocation(payload: unknown, vehicleNo?: string | null) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const targetVehicle = normalizeVehicleNumber(vehicleNo);

  const record = rows.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const rowVehicle = normalizeVehicleNumber(
      row.vehicleNo ?? row.vehicle_number ?? row.regNo ?? row.vehicle_no,
    );
    return targetVehicle ? rowVehicle === targetVehicle : false;
  }) as Record<string, unknown> | undefined;

  if (!record) return null;
  const latitude = Number(record.latitude ?? record.lat);
  const longitude = Number(record.longitude ?? record.lng ?? record.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    recorded_at: String(
      record.updatedTime ??
        record.lastComunicationTime ??
        record.recorded_at ??
        new Date().toISOString(),
    ),
  } satisfies VehicleLocation;
}

// ─── Timeline Row Component ────────────────────────────────────────────────────

function TimelineRow({
  row,
  isFirst,
  isLast,
  isCurrent,
  isNext,
  onSelect,
}: {
  row: Row;
  isFirst: boolean;
  isLast: boolean;
  isCurrent: boolean;
  isNext: boolean;
  onSelect: () => void;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const collected = row.status === "Collected" || row.status === "Completed";
  const inProgress = row.status === "In Progress" || isCurrent;
  const dotColor = STATUS_COLOR[row.status] ?? "#ef4444";
  const loc = stopLocationLabel(row);
  const name = stopName(row);
  const latLng = stopLatLng(row);
  const isHousehold = Boolean(row.household);

  return (
    <div className="relative flex gap-4">
      {/* vertical connector */}
      <div className="flex flex-col items-center">
        <div
          className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-white ring-2"
          style={{ background: dotColor, boxShadow: `0 0 0 2px ${dotColor}30` }}
        />
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{ background: collected ? "#22c55e" : "#e5e7eb", minHeight: "2.5rem" }}
          />
        )}
      </div>

      {/* content */}
      <div className={`mb-4 flex-1 relative ${isFirst ? "mt-0" : ""}`}>
        {/* info button + popup (non-invasive) */}
        <div className="absolute right-2 top-0 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPopup((s) => !s);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="View stop details"
            aria-label={`View details for ${name}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
          </button>
        </div>
        {showPopup && (
          <div
            role="dialog"
            aria-modal="false"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-8 z-20 w-72 rounded-lg border bg-white p-3 text-xs shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">
                  {row.sequence}. {name}
                </p>
                <p className="mt-1 text-xs text-gray-500">{loc}</p>
                {isHousehold && row.household?.customer?.contact_no && (
                  <p className="mt-0.5 text-xs text-gray-500">📞 {row.household.customer.contact_no}</p>
                )}
              </div>
              <div className="ml-2 text-right text-[11px] text-gray-500">
                {row.trip_assignment?.scheduled_time ? row.trip_assignment.scheduled_time.slice(0, 5) : ""}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-gray-600">
              <div>
                <div className="text-[10px] text-gray-400">Status</div>
                <div className="font-medium">{row.status}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Collected at</div>
                <div className="font-medium">{row.collected_at ? fmtTime(row.collected_at) : "-"}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Lat / Lon</div>
                <div className="font-medium truncate">
                  {latLng ? `${latLng[0]}, ${latLng[1]}` : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">
                  {isHousehold ? "Type" : "Sequence"}
                </div>
                <div className="font-medium">
                  {isHousehold
                    ? row.household?.collection_type === "bulk_waste_collection"
                      ? "Bulk Waste"
                      : "Household"
                    : row.sequence}
                </div>
              </div>
              {isHousehold && row.household?.status_reason && (
                <div className="col-span-2">
                  <div className="text-[10px] text-gray-400">Reason</div>
                  <div className="font-medium">{row.household.status_reason}</div>
                </div>
              )}
            </div>
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPopup(false);
                }}
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
        {collected && (
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-green-600">
            ✓ Crossed
          </div>
        )}
        {inProgress && !collected && (
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600">
            ◉ Your Current Point
          </div>
        )}
        {isNext && !inProgress && !collected && (
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
            ↓ Next
          </div>
        )}

        <button
          type="button"
          onClick={onSelect}
          className={`rounded-xl border p-3 transition-all ${
            inProgress && !collected
              ? "border-amber-300 bg-amber-50 shadow-sm"
              : collected
              ? "border-green-100 bg-green-50/50"
              : isNext
              ? "border-blue-200 bg-blue-50"
              : STATUS_BG[row.status] ?? "border-gray-100 bg-white"
          } w-full text-left hover:shadow-md`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`font-semibold text-sm leading-tight ${
                  collected ? "text-gray-500 line-through" : "text-gray-800"
                }`}
              >
                {row.sequence}. {name}
                {isHousehold && (
                  <span className="ml-1.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-600">
                    {row.household?.collection_type === "bulk_waste_collection" ? "Bulk" : "Household"}
                  </span>
                )}
              </p>
              {loc && <p className="mt-0.5 text-xs text-gray-500">{loc}</p>}
            </div>
            <div className="shrink-0 text-right">
              {collected && row.collected_at ? (
                <span className="text-xs font-medium text-green-600">{fmtTime(row.collected_at)}</span>
              ) : row.trip_assignment?.scheduled_time ? (
                <span className="text-xs text-gray-400">
                  {row.trip_assignment.scheduled_time.slice(0, 5)}
                </span>
              ) : null}
            </div>
          </div>

          {/* status badge */}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${dotColor}18`, color: dotColor }}
            >
              {statusLabel(row.status)}
            </span>
            {inProgress && !collected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                On Time
              </span>
            )}
          </div>

          {/* navigate button for current/next */}
          {(inProgress || isNext) && !collected && latLng && (
            <div className="mt-2 flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Navigate
              </a>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Error boundary ─────────────────────────────────────────────────────────
// This page had no visible failure mode before — a render-time exception
// (e.g. from an unexpected API response shape on a given backend) unmounted
// the tree silently, showing a blank page with nothing but a DevTools
// console error to go on. Wrapping it here surfaces the actual error message
// on-screen instead.
class DailyTripTrackingErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("DailyTripTracking crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm font-semibold text-gray-800">Daily Trip Tracking failed to load</p>
          <p className="max-w-xl text-xs text-gray-500">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DailyTripTrackingPage() {
  return (
    <DailyTripTrackingErrorBoundary>
      <DailyTripTracking />
    </DailyTripTrackingErrorBoundary>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function DailyTripTracking() {
  const geo = useGeoHierarchy();

  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("All");
  const [page, setPage] = useState(1);
  const [assignments, setAssignments] = useState<Array<{ value: string; label: string; tripDate?: string }>>([]);
  const [assignmentRecords, setAssignmentRecords] = useState<Record<string, Record<string, unknown>>>({});
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [altStaffTemplateId, setAltStaffTemplateId] = useState("");
  const [staffTemplatesRaw, setStaffTemplatesRaw] = useState<Record<string, unknown>[]>([]);
  const [altStaffTemplatesRaw, setAltStaffTemplatesRaw] = useState<Record<string, unknown>[]>([]);
  const [tripPlanId, setTripPlanId] = useState("");
  const [tripPlans, setTripPlans] = useState<Array<{ value: string; label: string }>>([]);
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [wasteTypes, setWasteTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  // Household/bulk-waste stops for the selected trip — a separate table
  // (DailyTripHouseholdCollection) from the bin-collection stops in `data`,
  // fetched alongside it and merged into the timeline/map as `Row`s.
  const [householdRecords, setHouseholdRecords] = useState<HouseholdRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [routePlan, setRoutePlan] = useState<OptimizationResult | null>(null);
  const [gpsApiUrl, setGpsApiUrl] = useState("");
  const [liveVehicleLocation, setLiveVehicleLocation] = useState<VehicleLocation | null>(null);
  const [liveGpsReady, setLiveGpsReady] = useState(false);
  const [optimizationCycle, setOptimizationCycle] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showOrsRoute, setShowOrsRoute] = useState(true);
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Routes, collection-point markers and the vehicle marker all live in this
  // single persistent layer group, so a data refresh only has to clear +
  // repopulate this group — the map instance and tile layer are created once
  // and never touched again, so pan/zoom survives every 15s poll.
  const dynamicLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  // Tracks which "view" (a specific trip, or the all-trips overview) bounds
  // were last auto-fit for, so we only reframe the map on a genuine context
  // switch — never on a same-context periodic data refresh.
  const lastFitKeyRef = useRef<string | null>(null);
  const optimizingRef = useRef(false);
  const lastOptimizedVehicleStartRef = useRef("");
  // True once the user has explicitly picked "Daily Trip Assignment" back to
  // blank (or a specific trip) — suppresses auto-focusing a single filtered
  // match so an intentional "show me all trips" choice sticks until filters
  // actually change again.
  const userPinnedSelectionRef = useRef(false);
  const lastAutoFilterSignatureRef = useRef("");

  // ── Load dropdowns ─────────────────────────────────────────────────────────
  useEffect(() => {
    void Promise.all([
      dailyTripAssignmentApi.readAll(),
      staffTemplateApi.readAll(),
      alternativeStaffTemplateApi.readAll(),
      tripPlanApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([assignmentResult, staffResult, altResult, tripPlanResult, wasteTypeResult]) => {
      const assignmentRows = normalizeList(assignmentResult) as Record<string, unknown>[];
      setAssignments(
        assignmentRows.map((item) => ({
          value: String(item.unique_id ?? ""),
          label: `${String(item.unique_id ?? "")}${item.trip_date ? ` | ${String(item.trip_date)}` : ""}`,
          tripDate: item.trip_date ? String(item.trip_date) : undefined,
        })),
      );
      setAssignmentRecords(
        Object.fromEntries(assignmentRows.map((item) => [String(item.unique_id ?? ""), item])),
      );
      setStaffTemplatesRaw(normalizeList(staffResult) as Record<string, unknown>[]);
      setAltStaffTemplatesRaw(normalizeList(altResult) as Record<string, unknown>[]);
      setTripPlans(
        (normalizeList(tripPlanResult) as Record<string, unknown>[]).map((item) => ({
          value: String(item.unique_id ?? ""),
          label: String(item.display_code ?? item.unique_id ?? ""),
        })),
      );
      setWasteTypes(
        (normalizeList(wasteTypeResult) as Record<string, unknown>[]).map((item) => ({
          value: String(item.unique_id ?? ""),
          label: String(item.waste_type_name ?? item.unique_id ?? ""),
        })),
      );
    });
  }, []);

  // Staff / alt templates scoped to the selected local body (whichever level
  // the geo hierarchy filter currently targets). Selected values are always
  // kept present even if they fall outside the current scope.
  const staffTemplates = useMemo(
    () =>
      staffTemplatesRaw
        .filter(
          (tpl) =>
            staffTemplateInHierarchy(tpl, geo.hierarchyLevel, geo.hierarchyId) ||
            String((tpl as any)?.unique_id ?? "") === staffTemplateId,
        )
        .map((tpl) => ({ value: String((tpl as any).unique_id ?? ""), label: staffTemplateLabel(tpl) }))
        .filter((o) => o.value),
    [staffTemplatesRaw, geo.hierarchyLevel, geo.hierarchyId, staffTemplateId],
  );
  const altStaffTemplates = useMemo(
    () =>
      altStaffTemplatesRaw
        .filter(
          (tpl) =>
            staffTemplateInHierarchy(tpl, geo.hierarchyLevel, geo.hierarchyId) ||
            String((tpl as any)?.unique_id ?? "") === altStaffTemplateId,
        )
        .map((tpl) => ({ value: String((tpl as any).unique_id ?? ""), label: altStaffTemplateLabel(tpl) }))
        .filter((o) => o.value),
    [altStaffTemplatesRaw, geo.hierarchyLevel, geo.hierarchyId, altStaffTemplateId],
  );

  // `geo` (and its methods) are recreated every render since useGeoHierarchy
  // doesn't memoize them — read it via a ref inside callbacks below so those
  // callbacks don't churn identity every render along with it.
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // Prefills the rest of the filter bar (Trip Plan, Waste Type, Staff
  // Template, Alt Staff Template, and the full geo hierarchy) from the
  // selected assignment's own data, so choosing one trip visibly narrows
  // every other filter to match it instead of leaving them unrelated.
  const applyAssignmentFilters = useCallback((record: Record<string, unknown> | undefined) => {
    if (!record) return;
    // Defensive: this reads nested fields off whatever the assignment list
    // API returns. A backend on a different version than expected (older
    // deploy, permission-trimmed serializer, etc.) could shape this
    // differently — never let a mismatch here crash the whole page.
    try {
      geoRef.current.hydrate(record);
      const tripPlan = record.trip_plan as Record<string, unknown> | undefined;
      setTripPlanId(String(tripPlan?.unique_id ?? ""));
      const wasteType = record.waste_type as Record<string, unknown> | undefined;
      setWasteTypeId(String(wasteType?.unique_id ?? ""));
      const staffTemplate = record.staff_template as Record<string, unknown> | undefined;
      setStaffTemplateId(String(staffTemplate?.unique_id ?? ""));
      const effectiveStaff = record.effective_staff as Record<string, unknown> | undefined;
      setAltStaffTemplateId(
        effectiveStaff?.source === "alternative" ? String(effectiveStaff?.unique_id ?? "") : "",
      );
    } catch {
      // Leave whatever filters were already selected untouched.
    }
  }, []);

  const selectTrip = useCallback((id: string, tripDate?: string, options?: { auto?: boolean }) => {
    userPinnedSelectionRef.current = !options?.auto;
    setAssignmentId(id);
    if (tripDate) setDate(tripDate);
    setTab("All");
    setPage(1);
    setData(null);
    setHouseholdRecords([]);
    setRouteGeoJson(null);
    setRoutePlan(null);
    setLiveVehicleLocation(null);
    setLiveGpsReady(false);
    lastOptimizedVehicleStartRef.current = "";
    applyAssignmentFilters(assignmentRecords[id]);
  }, [applyAssignmentFilters, assignmentRecords]);

  // `selectTrip` sets assignmentId plus every filter `load` itself reads
  // (trip plan, waste type, staff template, geo hierarchy) via
  // applyAssignmentFilters — putting it directly in `load`'s dependency array
  // would mean any change to those filters recreates `load`, which is fine,
  // but calling `selectTrip` *from inside* `load`'s auto-focus branch could
  // then recreate `load` again through those same setters, re-firing the
  // `useEffect(() => void load(), [load])` below more than once per
  // navigation. Read it via a ref so `load` only calls the latest
  // `selectTrip` without depending on (or being recreated by) it.
  const selectTripRef = useRef(selectTrip);
  selectTripRef.current = selectTrip;

  // ── Load tracking data ─────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Scoping filters only — excludes trip_assignment_id/page/status so that
    // explicitly clearing the selected trip (or paging/tab-switching) doesn't
    // look like "the filters changed" and re-trigger auto-focus below.
    const scopeParams: Record<string, string | number> = {};
    if (date) scopeParams.date = date;
    if (search) scopeParams.search = search;
    if (geo.stateId) scopeParams.state_id = geo.stateId;
    if (geo.districtId) scopeParams.district_id = geo.districtId;
    if (geo.areaTypeId) scopeParams.area_type_id = geo.areaTypeId;
    if (geo.hierarchyId) scopeParams[geo.hierarchyLevel] = geo.hierarchyId;
    if (tripPlanId) scopeParams.trip_plan_id = tripPlanId;
    if (wasteTypeId) scopeParams.waste_type_id = wasteTypeId;
    if (staffTemplateId) scopeParams.staff_template_id = staffTemplateId;
    if (altStaffTemplateId) scopeParams.alt_staff_template_id = altStaffTemplateId;

    const params: Record<string, string | number> = { ...scopeParams, page, page_size: 50 };
    if (assignmentId) params.trip_assignment_id = assignmentId;
    if (!date || assignmentId) delete params.date;
    const statusFilter = TAB_FILTER[tab];
    if (statusFilter) params.status = statusFilter;
    try {
      if (assignmentId) {
        // Fetched independently (not Promise.all) so a household-endpoint
        // failure — e.g. not yet deployed, or a permissions gap on an older
        // backend — can't take down the core bin-collection tracking view;
        // household stops just fall back to empty instead.
        const trackingResult = await dailyTripCollectionPointApi.action<TrackingResponse>(
          "tracking",
          undefined,
          { params },
        );
        setData(trackingResult);
        try {
          const householdResult = await dailyTripHouseholdCollectionApi.readAll({
            params: { trip_assignment_id: assignmentId },
          });
          setHouseholdRecords(normalizeList<HouseholdRecord>(householdResult));
        } catch {
          setHouseholdRecords([]);
        }
      } else {
        const overviewResult = await dailyTripCollectionPointApi.action<OverviewResponse>(
          "tracking-overview",
          undefined,
          { params },
        );
        setOverview(overviewResult);
        setData(null);
        setHouseholdRecords([]);

        // Filters (trip plan / geo hierarchy / waste type / staff template /
        // date) narrowed the result to exactly one trip: focus the map on it
        // automatically instead of leaving the user to click it, unless
        // they've explicitly asked to see the unfiltered overview.
        const filterSignature = JSON.stringify(scopeParams);
        if (filterSignature !== lastAutoFilterSignatureRef.current) {
          lastAutoFilterSignatureRef.current = filterSignature;
          userPinnedSelectionRef.current = false;
        }
        if (!userPinnedSelectionRef.current && overviewResult.trips.length === 1) {
          selectTripRef.current(overviewResult.trips[0].assignment_id, overviewResult.trips[0].trip_date, { auto: true });
        }
      }
    } catch {
      if (!silent) {
        void Swal.fire("Error", "Unable to load daily trip tracking.", "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    altStaffTemplateId,
    assignmentId,
    date,
    geo.areaTypeId,
    geo.districtId,
    geo.hierarchyId,
    geo.hierarchyLevel,
    geo.stateId,
    page,
    search,
    staffTemplateId,
    tab,
    tripPlanId,
    wasteTypeId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load(true);
    }, TRACKING_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [load]);

  const assignedVehicleNo = data?.vehicle_tracking?.vehicle_no ?? routePlan?.vehicle_no;

  // Household/bulk stops as unified `Row`s, sequenced after the bin-collection
  // stops so the timeline reads as "bins along the route, then door-to-door
  // pickups" — they're a separate table with their own sequence numbering, so
  // we keep them ordered by their own sequence rather than interleaving by number.
  const householdRows: Row[] = useMemo(() => {
    const binCount = (data?.route_results ?? data?.results ?? []).length;
    return [...householdRecords]
      .sort((a, b) => a.sequence - b.sequence)
      .map((record) => ({
        unique_id: record.unique_id,
        sequence: binCount + record.sequence,
        status: record.status,
        collected_at: record.collected_at,
        household: record,
      }));
  }, [householdRecords, data?.results, data?.route_results]);

  useEffect(() => {
    if (!gpsApiUrl || !assignmentId || !assignedVehicleNo) {
      setLiveVehicleLocation(null);
      setLiveGpsReady(false);
      return;
    }

    let active = true;
    const loadLiveVehicleLocation = async () => {
      try {
        const response = await fetch(gpsApiUrl);
        const payload: unknown = await response.json();
        const location = readLiveVehicleLocation(payload, assignedVehicleNo);
        if (active && location) {
          setLiveVehicleLocation((previous) =>
            previous &&
            Number(previous.latitude) === Number(location.latitude) &&
            Number(previous.longitude) === Number(location.longitude)
              ? previous
              : location,
          );
        }
      } catch {
        // Keep backend GPS/default route when the live provider is unavailable.
      } finally {
        if (active) setLiveGpsReady(true);
      }
    };

    void loadLiveVehicleLocation();
    const interval = window.setInterval(
      () => void loadLiveVehicleLocation(),
      TRACKING_REFRESH_INTERVAL_MS,
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [assignedVehicleNo, assignmentId, gpsApiUrl]);

  // ── Map: create once ────────────────────────────────────────────────────────
  // The map instance and tile layer are created exactly once and never
  // recreated on data refresh — that's what used to make the *entire* map
  // (tiles, zoom, pan) reset every 15s poll. All refresh-driven content lives
  // in `dynamicLayerRef`, a single layer group cleared and repopulated by the
  // effect below.
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current).setView([10.7867, 76.6548], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    dynamicLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      dynamicLayerRef.current = null;
    };
  }, []);

  // ── Map: refresh only the collection-point/route/vehicle layer ─────────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = dynamicLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerRefs.current = {};

    const binPoints = (data?.route_results ?? data?.results ?? []).filter(
      (r) => r.collection_point?.latitude && r.collection_point?.longitude,
    );
    const householdPoints = householdRows.filter((r) => stopLatLng(r));
    const points = [...binPoints, ...householdPoints].sort((a, b) => a.sequence - b.sequence);
    const latLngs: L.LatLng[] = [];

    if (!assignmentId && overview?.trips.length) {
      overview.trips.forEach((trip, tripIndex) => {
        const color = TRIP_ROUTE_COLORS[tripIndex % TRIP_ROUTE_COLORS.length];
        if (trip.route_geojson) {
          L.geoJSON(trip.route_geojson, {
            style: { color: "#ffffff", weight: 9, opacity: 0.9 },
          }).addTo(layer);
          const routeLayer = L.geoJSON(trip.route_geojson, {
            style: { color, weight: 5, opacity: 0.9 },
          })
            .bindTooltip(
              `${trip.assignment_id} · ${trip.vehicle_no ?? "No vehicle"} · ${(trip.distance_meters / 1000).toFixed(2)} km`,
            )
            .on("click", () => selectTrip(trip.assignment_id, trip.trip_date))
            .addTo(layer);
          const bounds = routeLayer.getBounds();
          if (bounds.isValid()) latLngs.push(bounds.getNorthEast(), bounds.getSouthWest());
        }
        trip.collection_points.forEach((row) => {
          if (!row.collection_point?.latitude || !row.collection_point.longitude) return;
          const point = L.latLng(
            Number(row.collection_point.latitude),
            Number(row.collection_point.longitude),
          );
          latLngs.push(point);
          L.circleMarker(point, {
            radius: 5,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          })
            .bindTooltip(`${trip.assignment_id} · ${row.collection_point.cp_name ?? row.unique_id}`)
            .on("click", () => selectTrip(trip.assignment_id, trip.trip_date))
            .addTo(layer);
        });
        (trip.household_collection_points ?? []).forEach((record) => {
          const coords = stopLatLng({ unique_id: record.unique_id, sequence: record.sequence, status: record.status, household: record });
          if (!coords) return;
          const point = L.latLng(coords[0], coords[1]);
          latLngs.push(point);
          L.marker(point, {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:18px;height:18px;border-radius:4px;background:${color};border:2px solid white;box-shadow:0 2px 6px #0005;color:white;font-size:10px;display:flex;align-items:center;justify-content:center">🏠</div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            }),
          })
            .bindTooltip(
              `${trip.assignment_id} · ${record.customer?.customer_name ?? record.unique_id} · ${record.status}`,
            )
            .on("click", () => selectTrip(trip.assignment_id, trip.trip_date))
            .addTo(layer);
        });
        // Vehicle marker for this trip: real GPS fix first, then the ORS
        // route's derived start point, then (for household-only trips with
        // no ORS route) the first plottable household stop as a last resort
        // — mirrors the single-trip view's fallback chain so every trip on
        // the overview map shows a vehicle wherever we have any signal at all.
        const vehiclePosition =
          trip.vehicle_start ??
          (() => {
            const firstHouseholdStop = (trip.household_collection_points ?? [])
              .map((record) =>
                stopLatLng({ unique_id: record.unique_id, sequence: record.sequence, status: record.status, household: record }),
              )
              .find((coords): coords is [number, number] => Boolean(coords));
            return firstHouseholdStop ? [firstHouseholdStop[1], firstHouseholdStop[0]] as [number, number] : null;
          })();
        if (vehiclePosition) {
          const vehicleLatLng = L.latLng(vehiclePosition[1], vehiclePosition[0]);
          L.marker(vehicleLatLng, {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 7px #0005;display:flex;align-items:center;justify-content:center;font-size:13px">🚛</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
          })
            .bindTooltip(`${trip.assignment_id} · ${trip.vehicle_no ?? "No vehicle"}`, { direction: "top" })
            .on("click", () => selectTrip(trip.assignment_id, trip.trip_date))
            .addTo(layer);
          latLngs.push(vehicleLatLng);
        }
      });
    } else {
      points.forEach((row) => {
        const coords = stopLatLng(row);
        if (!coords) return;
        const latLng = L.latLng(coords[0], coords[1]);
        latLngs.push(latLng);
        const color = STATUS_COLOR[row.status] ?? "#ef4444";
        const marker = L.marker(latLng, {
          icon: row.household
            ? L.divIcon({
                className: "",
                html: `<div style="width:24px;height:24px;border-radius:6px;background:${color};border:2px solid white;box-shadow:0 2px 7px #0005;color:white;font-size:12px;display:flex;align-items:center;justify-content:center">🏠</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })
            : L.divIcon({
                className: "",
                html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 7px #0005;color:white;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">${row.sequence}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
        })
          .bindTooltip(
            `${stopName(row)} · ${statusLabel(row.status)}`,
            { direction: "top", offset: [0, -12] },
          )
          .addTo(layer);
        markerRefs.current[row.unique_id] = marker;
      });
      if (routePlan?.route_legs?.length) {
        routePlan.route_legs.forEach((leg, index) => {
          const destination = points.find((point) => point.unique_id === leg.destination_id);
          const routeColor = destination?.status === "Collected" ? "#22c55e" : "#2563eb";
          L.geoJSON(leg.geometry, {
            style: { color: "#ffffff", weight: 10, opacity: 0.95 },
          }).addTo(layer);
          L.geoJSON(leg.geometry, {
            style: { color: routeColor, weight: 6, opacity: 0.95 },
          })
            .bindTooltip(
              `${index === 0 ? "Vehicle" : `Stop ${index}`} → ${destination ? stopName(destination) : "collection point"} · ${(leg.distance / 1000).toFixed(2)} km · ${Math.round(leg.duration / 60)} min`,
            )
            .addTo(layer);
        });
      } else if (routeGeoJson) {
        L.geoJSON(routeGeoJson, {
          style: { color: "#ffffff", weight: 10, opacity: 0.95 },
        }).addTo(layer);
        L.geoJSON(routeGeoJson, {
          style: { color: "#2563eb", weight: 6, opacity: 0.95 },
        }).addTo(layer);
      }
      const vehicle = liveVehicleLocation ?? data?.vehicle_tracking?.current_location;
      if (vehicle) {
        const vehicleLatLng = L.latLng(Number(vehicle.latitude), Number(vehicle.longitude));
        L.marker(vehicleLatLng, {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:34px;height:34px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px #0006;display:flex;align-items:center;justify-content:center;font-size:18px">🚛</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        })
          .bindTooltip(
            `Vehicle ${data?.vehicle_tracking?.vehicle_no ?? ""} · ${VEHICLE_STATUS_META[vehicleStatusOf(data?.vehicle_tracking?.vehicle_no, data?.vehicle_tracking?.current_location?.recorded_at)].label}`,
            { direction: "top" },
          )
          .addTo(layer);
        latLngs.push(vehicleLatLng);
      } else if (routePlan?.vehicle_start) {
        const vehicleStart = L.latLng(routePlan.vehicle_start[1], routePlan.vehicle_start[0]);
        L.marker(vehicleStart, {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:34px;height:34px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px #0006;display:flex;align-items:center;justify-content:center;font-size:18px">🚛</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        }).bindTooltip("ORS route start", { direction: "top" }).addTo(layer);
        latLngs.push(vehicleStart);
      } else {
        // Trips with only household/bulk stops have no bin GPS event and no
        // ORS route to derive a vehicle position from (ORS only routes bin
        // collection points) — anchor the vehicle marker to the first
        // not-yet-collected household stop instead of showing nothing.
        const nextHousehold = householdRows.find((row) => row.status === "Pending" || row.status === "Collect Later");
        const fallbackHouseholdRow = nextHousehold ?? householdRows[0];
        const householdStart = fallbackHouseholdRow ? stopLatLng(fallbackHouseholdRow) : null;
        if (householdStart) {
          const vehicleStart = L.latLng(householdStart[0], householdStart[1]);
          L.marker(vehicleStart, {
            icon: L.divIcon({
              className: "",
              html: '<div style="width:34px;height:34px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px #0006;display:flex;align-items:center;justify-content:center;font-size:18px">🚛</div>',
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          }).bindTooltip("Vehicle · next household stop (no GPS yet)", { direction: "top" }).addTo(layer);
          latLngs.push(vehicleStart);
        }
      }
    }

    // Only reframe the map when the *context* changes (a different trip
    // selected, or entering/leaving the all-trips overview) — never on a
    // same-context periodic data refresh, so the user's pan/zoom is left
    // alone while collection-point statuses update underneath them.
    const fitKey = assignmentId ?? "__overview__";
    if (latLngs.length && lastFitKeyRef.current !== fitKey) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: assignmentId ? [24, 24] : [35, 35] });
      lastFitKeyRef.current = fitKey;
    }
  }, [assignmentId, data, householdRows, liveVehicleLocation, overview, routeGeoJson, routePlan, selectTrip]);

  // ── Route Optimization ─────────────────────────────────────────────────────
  const optimize = useCallback(async (vehicleStartSignature: string) => {
    if (!assignmentId || optimizingRef.current) return;
    optimizingRef.current = true;
    try {
      const result = await dailyTripCollectionPointApi.action<OptimizationResult>(
        "optimize-route",
        {
          trip_assignment_id: assignmentId,
          ...(liveVehicleLocation
            ? {
                vehicle_start: [
                  Number(liveVehicleLocation.longitude),
                  Number(liveVehicleLocation.latitude),
                ],
              }
            : {}),
        },
      );
      setRouteGeoJson(result.route_geojson ?? null);
      setRoutePlan(result);
      if (result.optimized_order?.length) {
        const order = new Map(result.optimized_order.map((id, index) => [id, index]));
        setData((current) =>
          current
            ? {
                ...current,
                route_results: [...(current.route_results ?? current.results)].sort(
                  (left, right) =>
                    (order.get(left.unique_id) ?? Number.MAX_SAFE_INTEGER) -
                    (order.get(right.unique_id) ?? Number.MAX_SAFE_INTEGER),
                ),
              }
            : current,
        );
      }
      lastOptimizedVehicleStartRef.current = vehicleStartSignature;
    } catch (error: unknown) {
      lastOptimizedVehicleStartRef.current = vehicleStartSignature;
      const detail =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      void Swal.fire("Optimization failed", detail ?? "OpenRouteService request failed.", "error");
    } finally {
      optimizingRef.current = false;
      setOptimizationCycle((cycle) => cycle + 1);
    }
  }, [assignmentId, liveVehicleLocation]);

  const vehicleStartSignature = useMemo(() => {
    if (!assignmentId) return "";
    const current = liveVehicleLocation ?? data?.vehicle_tracking?.current_location;
    if (!current) return `${assignmentId}:default`;

    const latitude = Number(current.latitude);
    const longitude = Number(current.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return `${assignmentId}:default`;
    }

    return `${assignmentId}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
  }, [assignmentId, data?.vehicle_tracking?.current_location, liveVehicleLocation]);

  useEffect(() => {
    if (
      !assignmentId ||
      !data ||
      !vehicleStartSignature ||
      (gpsApiUrl && assignedVehicleNo && !liveGpsReady) ||
      lastOptimizedVehicleStartRef.current === vehicleStartSignature
    ) {
      return;
    }

    void optimize(vehicleStartSignature);
  }, [
    assignedVehicleNo,
    assignmentId,
    data,
    gpsApiUrl,
    liveGpsReady,
    optimizationCycle,
    optimize,
    vehicleStartSignature,
  ]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const binRows = data?.results ?? [];
  const binRouteRows = data?.route_results ?? binRows;

  const tabFilteredHouseholdRows = useMemo(() => {
    const allowed = HOUSEHOLD_TAB_STATUSES[tab];
    if (allowed === null) return householdRows;
    if (allowed.length === 0) return [];
    return householdRows.filter((row) => allowed.includes(row.status));
  }, [householdRows, tab]);

  const rows = [...binRows, ...tabFilteredHouseholdRows];
  const routeRows = useMemo(
    () => [...binRouteRows, ...householdRows],
    [binRouteRows, householdRows],
  );
  // Stops that exist but have no plottable coordinates (blank/unset lat-lng
  // on the customer or collection point) — surfaced as a banner instead of
  // silently leaving the map empty with no explanation.
  const unplottableStopCount = useMemo(
    () => routeRows.filter((row) => !stopLatLng(row)).length,
    [routeRows],
  );
  const summary = useMemo(() => {
    const base = assignmentId ? data?.summary : overview?.summary;
    if (!assignmentId || !householdRecords.length) return base;
    const extra = householdRecords.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "Collected") acc.completed += 1;
        else if (record.status === "Not Available" || record.status === "Not Collected") acc.missed += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, completed: 0, in_progress: 0, pending: 0, missed: 0 },
    );
    const total = (base?.total ?? 0) + extra.total;
    const completed = (base?.completed ?? 0) + extra.completed;
    return {
      total,
      completed,
      in_progress: (base?.in_progress ?? 0) + extra.in_progress,
      pending: (base?.pending ?? 0) + extra.pending,
      missed: (base?.missed ?? 0) + extra.missed,
      completion_percentage: total ? Math.round((completed / total) * 10000) / 100 : 0,
    };
  }, [assignmentId, data?.summary, overview?.summary, householdRecords]);
  const vehicle = data?.vehicle_tracking;

  const currentIndex = useMemo(
    () => routeRows.findIndex((r) => r.status === "In Progress"),
    [routeRows],
  );

  const nextIndex = useMemo(() => {
    const base =
      currentIndex >= 0
        ? currentIndex + 1
        : routeRows.findIndex((r) => r.status === "Pending");
    return base >= 0 && base < routeRows.length ? base : -1;
  }, [currentIndex, routeRows]);
  const currentRowId = currentIndex >= 0 ? routeRows[currentIndex]?.unique_id : undefined;
  const nextRowId = nextIndex >= 0 ? routeRows[nextIndex]?.unique_id : undefined;
  const nextRouteLeg = routePlan?.route_legs?.[0];
  const nextRouteDestination = routeRows.find(
    (row) => row.unique_id === nextRouteLeg?.destination_id,
  );
  const nextStopName =
    nextRouteDestination?.collection_point?.cp_name ??
    vehicle?.next_collection_point?.cp_name ??
    "Next collection point";
  const nextStopArrivalTime = useMemo(() => {
    if (!nextRouteLeg?.duration) return null;
    return new Date(Date.now() + nextRouteLeg.duration * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [nextRouteLeg?.duration]);

  const focusCollectionPoint = useCallback((row: Row) => {
    const coords = stopLatLng(row);
    if (!coords) return;
    mapRef.current?.flyTo(coords, 17, { duration: 0.7 });
    markerRefs.current[row.unique_id]?.openTooltip();
  }, []);

  const pct = summary?.completion_percentage ?? 0;
  const selectedAssignment = assignmentId
    ? assignments.find((a) => a.value === assignmentId)
    : null;
  const activeFilterCount = [
    date,
    tripPlanId,
    wasteTypeId,
    staffTemplateId,
    altStaffTemplateId,
    geo.stateId,
    geo.districtId,
    geo.areaTypeId,
    geo.hierarchyId,
    search,
  ].filter(Boolean).length;
  const wasAutoFocused = Boolean(assignmentId) && !userPinnedSelectionRef.current && activeFilterCount > 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-gray-50">
      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Daily Trip Tracking</h1>
          <p className="text-xs text-gray-500">
            Route progress &amp; collection point completion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen((x) => !x)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            {filtersOpen ? "Hide Filters" : "Filters"}
          </button>
          <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
            Auto Route · Live GPS
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Filter bar (collapsible) ── */}
      {filtersOpen && (
        <div className="shrink-0 border-b bg-white px-4 py-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <select
              value={assignmentId}
              onChange={(e) => {
                const nextAssignment = assignments.find((item) => item.value === e.target.value);
                if (e.target.value) {
                  selectTrip(e.target.value, nextAssignment?.tripDate);
                } else {
                  userPinnedSelectionRef.current = true;
                  setAssignmentId("");
                  setDate("");
                  setTab("All");
                  setHouseholdRecords([]);
                  setRouteGeoJson(null);
                  setRoutePlan(null);
                  setLiveVehicleLocation(null);
                  setLiveGpsReady(false);
                  lastOptimizedVehicleStartRef.current = "";
                }
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Daily Trip Assignment</option>
              {assignments.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            />
            <select
              value={tripPlanId}
              onChange={(e) => {
                setTripPlanId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Trip Plan</option>
              {tripPlans.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search CP…"
              className="rounded-lg border border-gray-200 p-2 text-sm"
            />

            {/* Geo hierarchy cascade: State → District → Area Type → Local Body Type → Local Body */}
            <select
              value={geo.stateId}
              onChange={(e) => {
                geo.setStateId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">State</option>
              {geo.stateOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={geo.districtId}
              onChange={(e) => {
                geo.setDistrictId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">District</option>
              {geo.districtOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={geo.areaTypeId}
              onChange={(e) => {
                geo.setAreaTypeId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Area Type (ULB / RLB)</option>
              {geo.areaTypeOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={geo.areaTypeCategory ? geo.hierarchyLevel : ""}
              disabled={!geo.areaTypeCategory}
              onChange={(e) => {
                geo.setHierarchyLevel(e.target.value as typeof geo.hierarchyLevel);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="" disabled={!!geo.areaTypeCategory}>
                {geo.areaTypeCategory ? "Local Body Type" : "Select Area Type first"}
              </option>
              {geo.areaTypeCategory &&
                geo.availableHierarchyLevels.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
            </select>
            <select
              value={geo.hierarchyId}
              disabled={!geo.areaTypeCategory}
              onChange={(e) => {
                geo.setHierarchyId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">{geo.areaTypeCategory ? geo.hierarchyLabel : "Local Body"}</option>
              {geo.hierarchyOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>

            <select
              value={wasteTypeId}
              onChange={(e) => {
                setWasteTypeId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Waste Type</option>
              {wasteTypes.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={staffTemplateId}
              onChange={(e) => {
                setStaffTemplateId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Staff Template</option>
              {staffTemplates.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={altStaffTemplateId}
              onChange={(e) => {
                setAltStaffTemplateId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Alt Staff Template</option>
              {altStaffTemplates.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                geo.setStateId("");
                setTripPlanId("");
                setWasteTypeId("");
                setStaffTemplateId("");
                setAltStaffTemplateId("");
                setSearch("");
                setDate("");
                setAssignmentId("");
                setTab("All");
                setPage(1);
                userPinnedSelectionRef.current = false;
              }}
              className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* ── Active filter summary ── */}
      {activeFilterCount > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-blue-50/60 px-4 py-1.5 text-xs text-blue-700">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span className="font-semibold">
            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
          </span>
          <span>·</span>
          <span>
            {assignmentId
              ? wasAutoFocused
                ? "showing the one trip that matches"
                : "showing selected trip"
              : `${overview?.trips.length ?? 0} matching trip${(overview?.trips.length ?? 0) === 1 ? "" : "s"} on map`}
          </span>
          <button
            type="button"
            onClick={() => {
              geo.setStateId("");
              setTripPlanId("");
              setWasteTypeId("");
              setStaffTemplateId("");
              setAltStaffTemplateId("");
              setSearch("");
              setDate("");
              setAssignmentId("");
              setTab("All");
              setPage(1);
              userPinnedSelectionRef.current = false;
            }}
            className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Status tabs ── */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-white px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-green-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t}
            {summary && (
              <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">
                {t === "All"
                  ? summary.total
                  : t === "On Process"
                  ? summary.in_progress
                  : t === "Completed"
                  ? summary.completed
                  : t === "Pending"
                  ? summary.pending
                  : summary.missed}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Main body: map + timeline ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 overflow-hidden">
          <div ref={mapElement} className="h-full w-full" />
          {assignmentId && unplottableStopCount > 0 && (
            <div className="absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-lg backdrop-blur-sm">
              ⚠ {unplottableStopCount} of {routeRows.length} stop{routeRows.length === 1 ? "" : "s"} {unplottableStopCount === 1 ? "has" : "have"} no map coordinates and can't be shown
            </div>
          )}
          <div className="absolute left-4 top-4 z-[400] rounded-xl border bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm">
            <p className="mb-2 font-bold text-gray-700">Route Breakdown</p>
            {[
              ["Completed", "#22c55e"],
              ["In Progress", "#f59e0b"],
              ["Pending", "#ef4444"],
              ["Missed / Skipped", "#6b7280"],
            ].map(([label, color]) => (
              <div key={label} className="mb-1 flex items-center gap-2 last:mb-0">
                <span className="h-2.5 w-6 rounded-full" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          {routePlan && showOrsRoute && (
            <div className="absolute right-4 top-4 z-[400] w-64 rounded-xl border bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-bold text-gray-800">ORS Vehicle Route</p>
                <button
                  type="button"
                  onClick={() => setShowOrsRoute(false)}
                  className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Close ORS Vehicle Route panel"
                  aria-label="Close panel"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-500">{routePlan.vehicle_no ?? vehicle?.vehicle_no ?? "Assigned vehicle"}</p>
              <p className="text-[10px] text-gray-400">
                Start: {routePlan.vehicle_start_source === "latest_gps" ? "latest collection GPS" : routePlan.vehicle_start_source === "request" ? "live vehicle GPS" : "first collection point fallback"}
              </p>
              {nextRouteLeg && (
                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                    Next Collection Point
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-blue-800" title={nextStopName}>
                    {nextStopName}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-blue-700">
                    <span>{(nextRouteLeg.distance / 1000).toFixed(2)} km away</span>
                    <span className="font-bold">{formatTravelTime(nextRouteLeg.duration)}</span>
                  </div>
                  {nextStopArrivalTime && (
                    <p className="mt-1 text-[10px] text-blue-500">
                      Estimated arrival: {nextStopArrivalTime}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-blue-50 p-2">
                  <p className="text-[10px] text-blue-500">Remaining CPs</p>
                  <p className="font-bold text-blue-700">{routePlan.optimized_stop_count ?? 0}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2">
                  <p className="text-[10px] text-green-500">Preserved Done</p>
                  <p className="font-bold text-green-700">{routePlan.completed_stop_count ?? 0}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">Distance</p>
                  <p className="font-bold text-gray-700">{(routePlan.distance_meters / 1000).toFixed(2)} km</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">ETA</p>
                  <p className="font-bold text-gray-700">{Math.round(routePlan.duration_seconds / 60)} min</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                Live GPS checked every 15 seconds. Route updates only when the vehicle moves.
              </p>
            </div>
          )}
          {/* mini stat overlay */}
          {summary && (
            <div className="absolute bottom-4 left-4 flex gap-3 rounded-xl border border-white/50 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-sm">
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Total</div>
                <div className="text-base font-bold text-gray-800">{summary.total}</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Done</div>
                <div className="text-base font-bold text-green-600">{summary.completed}</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Remaining</div>
                <div className="text-base font-bold text-red-500">
                  {summary.pending + summary.in_progress}
                </div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Progress</div>
                <div className="text-base font-bold text-blue-600">{pct}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: trip details + timeline */}
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l bg-white xl:w-96">
          {/* Trip info card */}
          <div className="shrink-0 border-b bg-gray-50 px-4 py-3">
            {selectedAssignment ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Assignment
                </p>
                <p className="mt-0.5 text-sm font-bold text-gray-800">{selectedAssignment.label}</p>
                {wasAutoFocused && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Auto-selected — only trip matching your filters
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  All Trip Routes
                </p>
                <p className="mt-0.5 text-sm font-bold text-gray-800">
                  {overview?.trips.length ?? 0} trips {activeFilterCount > 0 ? "match your filters" : "displayed"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {activeFilterCount > 0
                    ? "Refine filters further to auto-focus a single trip, or select one below."
                    : "Select a trip to open detailed collection-point tracking."}
                </p>
              </div>
            )}

            {assignmentId && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="text-2xl">🚛</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-500">Vehicle</p>
                  <p className="text-sm font-bold text-gray-800">{vehicle?.vehicle_no ?? "Not assigned"}</p>
                  <div className="mt-1">
                    <VehicleStatusBadge
                      status={vehicleStatusOf(vehicle?.vehicle_no, vehicle?.current_location?.recorded_at)}
                      recordedAt={vehicle?.current_location?.recorded_at}
                    />
                  </div>
                </div>
                {vehicle?.remaining_collection_points !== undefined && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                    {vehicle.remaining_collection_points} left
                  </span>
                )}
              </div>
            )}

            {/* Next CP info */}
            {vehicle?.next_collection_point?.cp_name && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-blue-500">Next Stop</p>
                <p className="text-sm font-semibold text-blue-800">
                  {vehicle.next_collection_point.cp_name}
                </p>
              </div>
            )}

            {/* Progress bar */}
            {summary && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-semibold text-green-600">
                    {summary.completed}/{summary.total} collected
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-green-400 to-green-600 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-0.5 text-right text-xs font-bold text-green-600">{pct}%</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!assignmentId && overview?.trips.map((trip, index) => {
              const color = TRIP_ROUTE_COLORS[index % TRIP_ROUTE_COLORS.length];
              return (
                <button
                  key={trip.assignment_id}
                  type="button"
                  onClick={() => selectTrip(trip.assignment_id, trip.trip_date)}
                  className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{trip.assignment_id}</p>
                          <p className="text-xs text-gray-500">
                            {trip.trip_date} · {trip.vehicle_no ?? "No vehicle assigned"}
                          </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          {trip.status}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <VehicleStatusBadge
                          status={vehicleStatusOf(trip.vehicle_no, trip.gps_recorded_at)}
                          recordedAt={trip.gps_recorded_at}
                        />
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${trip.summary.completion_percentage}%` }}
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-gray-500">
                        <span>{trip.summary.completed}/{trip.summary.total} done</span>
                        <span>{(trip.distance_meters / 1000).toFixed(2)} km</span>
                        <span>{Math.round(trip.duration_seconds / 60)} min</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {rows.length === 0 && !loading && (
              <div className={`${!assignmentId && overview?.trips.length ? "hidden" : "flex"} flex-col items-center py-12 text-center text-gray-400`}>
                <span className="text-4xl">🗺️</span>
                <p className="mt-2 text-sm">{assignmentId ? "No collection points found." : "No trip routes found."}</p>
                <p className="text-xs">Adjust filters or create trip assignments with collection points.</p>
              </div>
            )}
            {loading && rows.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <svg
                  className="h-6 w-6 animate-spin text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              </div>
            )}

            {assignmentId && rows.length > 0 && (
              <>
                {/* Start of trip */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">🚛</span>
                  <div className="h-0.5 flex-1 bg-linear-to-r from-gray-300 to-transparent" />
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    Start of Trip
                  </span>
                </div>

                {rows.map((row, idx) => (
                  <TimelineRow
                    key={String(row.unique_id ?? `${row.sequence}-${idx}`)}
                    row={row}
                    isFirst={idx === 0}
                    isLast={idx === rows.length - 1}
                    isCurrent={row.unique_id === currentRowId}
                    isNext={row.unique_id === nextRowId}
                    onSelect={() => focusCollectionPoint(row)}
                  />
                ))}

                {/* End of trip */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-0.5 flex-1 bg-linear-to-r from-transparent to-gray-300" />
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    End of Trip
                  </span>
                  <span className="text-lg">🏁</span>
                </div>
              </>
            )}
          </div>

          {/* Pagination — only shown when results span multiple pages */}
          {(data?.count ?? 0) > 50 && (
            <div className="shrink-0 flex items-center justify-between border-t px-4 py-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((x) => x - 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-500">Page {page}</span>
              <button
                disabled={page * 50 >= (data?.count ?? 0)}
                onClick={() => setPage((x) => x + 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
