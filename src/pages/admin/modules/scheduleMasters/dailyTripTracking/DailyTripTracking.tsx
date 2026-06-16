import type { OptimizationResult, OverviewResponse, Row, Tab, TrackingResponse, VehicleLocation } from "./types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Swal from "@/lib/notify";
import {
  alternativeStaffTemplateApi,
  dailyTripAssignmentApi,
  dailyTripCollectionPointApi,
  projectApi,
  staffTemplateApi,
} from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useCollectionPointLocationOptions } from "@/hooks/useCollectionPointLocationOptions";
import { normalizeList } from "@/utils/forms";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  Pending: "#ef4444",
  "In Progress": "#f59e0b",
  Collected: "#22c55e",
  Completed: "#22c55e",
  Skipped: "#6b7280",
  Missed: "#9ca3af",
};

const STATUS_BG: Record<string, string> = {
  Pending: "bg-red-50 border-red-200",
  "In Progress": "bg-amber-50 border-amber-300",
  Collected: "bg-green-50 border-green-200",
  Completed: "bg-green-50 border-green-200",
  Skipped: "bg-gray-50 border-gray-200",
  Missed: "bg-gray-50 border-gray-200",
};

const TABS = ["All", "On Process", "Completed", "Pending", "Missed"] as const;

const TAB_FILTER: Record<Tab, string | undefined> = {
  All: undefined,
  "On Process": "In Progress",
  Completed: "Collected",
  Pending: "Pending",
  Missed: "Missed",
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
  return [cp?.panchayat_name, cp?.ward_name, cp?.zone_name].filter(Boolean).join(" · ") || null;
}

function statusLabel(status: string) {
  return status === "Collected" ? "Completed" : status;
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
  const collected = row.status === "Collected" || row.status === "Completed";
  const inProgress = row.status === "In Progress" || isCurrent;
  const dotColor = STATUS_COLOR[row.status] ?? "#ef4444";
  const loc = locationLabel(row.collection_point);

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
      <div className={`mb-4 flex-1 ${isFirst ? "mt-0" : ""}`}>
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
                {row.sequence}. {row.collection_point?.cp_name ?? row.unique_id}
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
          {(inProgress || isNext) && !collected && row.collection_point?.latitude && (
            <div className="mt-2 flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${row.collection_point.latitude},${row.collection_point.longitude}`}
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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DailyTripTracking() {
  const { companyUniqueId, projectId, companies, projects, setProjectId, onCompanyChange } =
    useCompanyProjectSelection({ isEdit: false });
  const locations = useCollectionPointLocationOptions(companyUniqueId, projectId);

  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("All");
  const [page, setPage] = useState(1);
  const [assignments, setAssignments] = useState<Array<{ value: string; label: string; tripDate?: string }>>([]);
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [altStaffTemplateId, setAltStaffTemplateId] = useState("");
  const [staffTemplates, setStaffTemplates] = useState<Array<{ value: string; label: string }>>([]);
  const [altStaffTemplates, setAltStaffTemplates] = useState<Array<{ value: string; label: string }>>([]);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [routePlan, setRoutePlan] = useState<OptimizationResult | null>(null);
  const [gpsApiUrl, setGpsApiUrl] = useState("");
  const [liveVehicleLocation, setLiveVehicleLocation] = useState<VehicleLocation | null>(null);
  const [liveGpsReady, setLiveGpsReady] = useState(false);
  const [optimizationCycle, setOptimizationCycle] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const optimizingRef = useRef(false);
  const lastOptimizedVehicleStartRef = useRef("");

  // ── Load dropdowns ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyUniqueId || !projectId) return;
    const params = { company_id: companyUniqueId, project_id: projectId };
    const toOptions = (result: unknown, label = "display_code") =>
      (normalizeList(result) as Record<string, unknown>[]).map((item) => ({
        value: String(item.unique_id ?? ""),
        label: String(item[label] ?? item.unique_id ?? ""),
      }));
    void Promise.all([
      dailyTripAssignmentApi.readAll({ params }),
      staffTemplateApi.readAll({ params }),
      alternativeStaffTemplateApi.readAll({ params }),
    ]).then(([assignmentResult, staffResult, altResult]) => {
      setAssignments(
        (normalizeList(assignmentResult) as Record<string, unknown>[]).map((item) => ({
          value: String(item.unique_id ?? ""),
          label: `${String(item.unique_id ?? "")}${item.trip_date ? ` | ${String(item.trip_date)}` : ""}`,
          tripDate: item.trip_date ? String(item.trip_date) : undefined,
        })),
      );
      setStaffTemplates(toOptions(staffResult));
      setAltStaffTemplates(toOptions(altResult));
    });
  }, [companyUniqueId, projectId]);

  useEffect(() => {
    if (!projectId) {
      setGpsApiUrl("");
      setLiveVehicleLocation(null);
      setLiveGpsReady(false);
      return;
    }

    let active = true;
    setLiveVehicleLocation(null);
    setLiveGpsReady(false);
    projectApi
      .read(projectId)
      .then((project) => {
        if (active) setGpsApiUrl(String(project?.gps_api_url ?? ""));
      })
      .catch(() => {
        if (active) setGpsApiUrl("");
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  // ── Load tracking data ─────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!companyUniqueId || !projectId) return;
    if (!silent) setLoading(true);
    const params: Record<string, string | number> = {
      company_id: companyUniqueId,
      project_id: projectId,
      page,
      page_size: 50,
    };
    if (assignmentId) params.trip_assignment_id = assignmentId;
    if (date && !assignmentId) params.date = date;
    if (search) params.search = search;
    if (locations.zoneId) params.zone_id = locations.zoneId;
    if (locations.wardId) params.ward_id = locations.wardId;
    if (locations.panchayatId) params.panchayat_id = locations.panchayatId;
    if (staffTemplateId) params.staff_template_id = staffTemplateId;
    if (altStaffTemplateId) params.alt_staff_template_id = altStaffTemplateId;
    const statusFilter = TAB_FILTER[tab];
    if (statusFilter) params.status = statusFilter;
    try {
      if (assignmentId) {
        setData(
          await dailyTripCollectionPointApi.action<TrackingResponse>("tracking", undefined, { params }),
        );
      } else {
        setOverview(
          await dailyTripCollectionPointApi.action<OverviewResponse>(
            "tracking-overview",
            undefined,
            { params },
          ),
        );
        setData(null);
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
    companyUniqueId,
    date,
    locations.panchayatId,
    locations.wardId,
    locations.zoneId,
    page,
    projectId,
    search,
    staffTemplateId,
    tab,
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

  const selectTrip = useCallback((id: string, tripDate?: string) => {
    setAssignmentId(id);
    if (tripDate) setDate(tripDate);
    setTab("All");
    setPage(1);
    setData(null);
    setRouteGeoJson(null);
    setRoutePlan(null);
    setLiveVehicleLocation(null);
    setLiveGpsReady(false);
    lastOptimizedVehicleStartRef.current = "";
  }, []);

  // ── Map ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapElement.current) return;
    mapRef.current?.remove();
    markerRefs.current = {};
    const points = (data?.route_results ?? data?.results ?? []).filter(
      (r) => r.collection_point?.latitude && r.collection_point?.longitude,
    ).sort((a, b) => a.sequence - b.sequence);
    const center: L.LatLngExpression =
      points.length
        ? [
            Number(points[0].collection_point!.latitude),
            Number(points[0].collection_point!.longitude),
          ]
        : [10.7867, 76.6548];
    const map = L.map(mapElement.current).setView(center, points.length ? 13 : 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    const latLngs: L.LatLng[] = [];
    if (!assignmentId && overview?.trips.length) {
      overview.trips.forEach((trip, tripIndex) => {
        const color = TRIP_ROUTE_COLORS[tripIndex % TRIP_ROUTE_COLORS.length];
        if (trip.route_geojson) {
          L.geoJSON(trip.route_geojson, {
            style: { color: "#ffffff", weight: 9, opacity: 0.9 },
          }).addTo(map);
          const routeLayer = L.geoJSON(trip.route_geojson, {
            style: { color, weight: 5, opacity: 0.9 },
          })
            .bindTooltip(
              `${trip.assignment_id} · ${trip.vehicle_no ?? "No vehicle"} · ${(trip.distance_meters / 1000).toFixed(2)} km`,
            )
            .on("click", () => selectTrip(trip.assignment_id, trip.trip_date))
            .addTo(map);
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
            .addTo(map);
        });
      });
      if (latLngs.length) map.fitBounds(L.latLngBounds(latLngs), { padding: [35, 35] });
      mapRef.current = map;
      return () => {
        map.remove();
        mapRef.current = null;
      };
    }
    points.forEach((row) => {
      const latLng = L.latLng(
        Number(row.collection_point!.latitude),
        Number(row.collection_point!.longitude),
      );
      latLngs.push(latLng);
      const color = STATUS_COLOR[row.status] ?? "#ef4444";
      const marker = L.marker(latLng, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 7px #0005;color:white;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">${row.sequence}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .bindTooltip(
          `${row.sequence}. ${row.collection_point?.cp_name ?? row.unique_id} · ${statusLabel(row.status)}`,
          { direction: "top", offset: [0, -12] },
        )
        .addTo(map);
      markerRefs.current[row.unique_id] = marker;
    });
    if (routePlan?.route_legs?.length) {
      routePlan.route_legs.forEach((leg, index) => {
        const destination = points.find((point) => point.unique_id === leg.destination_id);
        const routeColor = destination?.status === "Collected" ? "#22c55e" : "#2563eb";
        L.geoJSON(leg.geometry, {
          style: { color: "#ffffff", weight: 10, opacity: 0.95 },
        }).addTo(map);
        L.geoJSON(leg.geometry, {
          style: { color: routeColor, weight: 6, opacity: 0.95 },
        })
          .bindTooltip(
            `${index === 0 ? "Vehicle" : `Stop ${index}`} → ${destination?.collection_point?.cp_name ?? "collection point"} · ${(leg.distance / 1000).toFixed(2)} km · ${Math.round(leg.duration / 60)} min`,
          )
          .addTo(map);
      });
    } else if (routeGeoJson) {
      L.geoJSON(routeGeoJson, {
        style: { color: "#ffffff", weight: 10, opacity: 0.95 },
      }).addTo(map);
      L.geoJSON(routeGeoJson, {
        style: { color: "#2563eb", weight: 6, opacity: 0.95 },
      }).addTo(map);
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
        .bindTooltip(`Vehicle ${data?.vehicle_tracking?.vehicle_no ?? ""}`, { direction: "top" })
        .addTo(map);
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
      }).bindTooltip("ORS route start", { direction: "top" }).addTo(map);
      latLngs.push(vehicleStart);
    }
    if (latLngs.length) map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [assignmentId, data, liveVehicleLocation, overview, routeGeoJson, routePlan, selectTrip]);

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
  const rows = data?.results ?? [];
  const routeRows = data?.route_results ?? rows;
  const summary = assignmentId ? data?.summary : overview?.summary;
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
    const latitude = Number(row.collection_point?.latitude);
    const longitude = Number(row.collection_point?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    mapRef.current?.flyTo([latitude, longitude], 17, { duration: 0.7 });
    markerRefs.current[row.unique_id]?.openTooltip();
  }, []);

  const pct = summary?.completion_percentage ?? 0;
  const selectedAssignment = assignmentId
    ? assignments.find((a) => a.value === assignmentId)
    : null;

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
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <select
              value={companyUniqueId}
              onChange={(e) => onCompanyChange(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Company</option>
              {companies.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Project</option>
              {projects.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={assignmentId}
              onChange={(e) => {
                const nextAssignment = assignments.find((item) => item.value === e.target.value);
                if (e.target.value) selectTrip(e.target.value, nextAssignment?.tripDate);
                else {
                  setAssignmentId("");
                  setDate("");
                  setTab("All");
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
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search CP…"
              className="rounded-lg border border-gray-200 p-2 text-sm"
            />
            <select
              value={locations.zoneId}
              onChange={(e) => locations.setZoneId(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Zone</option>
              {locations.zones.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={locations.wardId}
              onChange={(e) => locations.setWardId(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Ward</option>
              {locations.wards.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              value={locations.panchayatId}
              onChange={(e) => locations.setPanchayatId(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
            >
              <option value="">Panchayat</option>
              {locations.panchayats.map((x) => (
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
          </div>
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
          {routePlan && (
            <div className="absolute right-4 top-4 z-[400] w-64 rounded-xl border bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm">
              <p className="font-bold text-gray-800">ORS Vehicle Route</p>
              <p className="mt-1 text-gray-500">{routePlan.vehicle_no ?? vehicle?.vehicle_no ?? "Assigned vehicle"}</p>
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
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  All Trip Routes
                </p>
                <p className="mt-0.5 text-sm font-bold text-gray-800">
                  {overview?.trips.length ?? 0} trips displayed
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Select a trip to open detailed collection-point tracking.
                </p>
              </div>
            )}

            {vehicle?.vehicle_no && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="text-2xl">🚛</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-500">Vehicle</p>
                  <p className="text-sm font-bold text-gray-800">{vehicle.vehicle_no}</p>
                </div>
                {vehicle.remaining_collection_points !== undefined && (
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
                    key={row.unique_id}
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
