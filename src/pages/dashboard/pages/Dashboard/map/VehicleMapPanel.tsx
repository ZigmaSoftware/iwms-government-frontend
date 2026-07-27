import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

import { DEFAULT_CENTER, initBaseMap } from "./mapUtils";
import { dailyTripCollectionPointApi, vehicleCreationApi } from "@/helpers/admin";

type ApiVehicle = {
  unique_id: string;
  vehicle_no: string;
  vehicle_type?: { vehicleType?: string; vehicle_type_name?: string };
  is_active?: boolean;
  capacity?: number | string;
  mileage_per_liter?: number | string;
  service_record?: string;
  vehicle_condition?: string;
};

type VehicleApiResponse = ApiVehicle[] | { results?: ApiVehicle[] };

type VehicleStatus = "active" | "inactive";

type VehicleItem = {
  id: string;
  vehicleNo: string;
  vehicleType: string;
  status: VehicleStatus;
  capacity?: number;
  mileage?: number;
  condition?: string;
  lat?: number;
  lng?: number;
  recordedAt?: string;
  assignmentId?: string;
  tripStatus?: string;
};

type TrackingOverviewTrip = {
  assignment_id: string;
  status: string;
  vehicle_no?: string | null;
  vehicle_start?: [number, number] | null;
  vehicle_tracking?: {
    current_location?: {
      latitude?: number | string | null;
      longitude?: number | string | null;
      recorded_at?: string | null;
      collection_point?: string | null;
    } | null;
  };
};

type TrackingOverviewResponse = {
  trips?: TrackingOverviewTrip[];
};

const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#15803d", bg: "rgba(34,197,94,0.18)" },
  inactive: { label: "Inactive", color: "#b91c1c", bg: "rgba(239,68,68,0.2)" },
};

const createVehicleIcon = (status: VehicleStatus, isFocused = false) => {
  const meta = VEHICLE_STATUS_META[status];
  const size = isFocused ? 40 : 32;
  const shadow = isFocused
    ? "0 0 0 4px rgba(255,255,255,0.9), 0 8px 18px rgba(0,0,0,.3)"
    : "0 6px 14px rgba(0,0,0,.25)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div
        style="
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:${meta.color};
          display:flex;align-items:center;justify-content:center;
          box-shadow:${shadow};
          border:2px solid #fff;
          font-size:${isFocused ? "18px" : "14px"};
        "
      >🚛</div>
    `,
  });
};

const toNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeVehicleNo = (value?: string | null) =>
  String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const todayIso = () => new Date().toISOString().split("T")[0];

const formatLiveTime = (value?: string) => {
  if (!value) return "Live";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function VehicleMapPanel({ params = {} }: { params?: Record<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [focusedId, setFocusedId] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleItem | null>(null);

  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      mapRef.current = initBaseMap(containerRef.current);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const config = Object.keys(params).length ? { params } : undefined;
    const loadVehicles = async () => {
      const liveParams = { date: params.date ?? todayIso(), ...params };
      const [vehicleData, trackingData] = await Promise.all([
        vehicleCreationApi.readAll(config) as Promise<VehicleApiResponse>,
        dailyTripCollectionPointApi.action<TrackingOverviewResponse>(
          "tracking-overview",
          undefined,
          { params: liveParams },
        ),
      ]);
      if (cancelled) return;
      const liveByVehicle = new Map<string, TrackingOverviewTrip>();
      (trackingData.trips ?? []).forEach((trip) => {
        if (!trip.vehicle_no || !trip.vehicle_start) return;
        liveByVehicle.set(normalizeVehicleNo(trip.vehicle_no), trip);
      });
      const raw = Array.isArray(vehicleData) ? vehicleData : vehicleData?.results ?? [];
      const items: VehicleItem[] = raw.map((v: ApiVehicle) => {
        const live = liveByVehicle.get(normalizeVehicleNo(v.vehicle_no));
        const location = live?.vehicle_tracking?.current_location;
        const lng = Number(location?.longitude ?? live?.vehicle_start?.[0]);
        const lat = Number(location?.latitude ?? live?.vehicle_start?.[1]);
        return {
          id: v.unique_id,
          vehicleNo: v.vehicle_no,
          vehicleType:
            v.vehicle_type?.vehicleType ?? v.vehicle_type?.vehicle_type_name ?? "",
          status: v.is_active !== false ? "active" : "inactive",
          capacity: toNumber(v.capacity),
          mileage: toNumber(v.mileage_per_liter),
          condition: v.vehicle_condition,
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
          recordedAt: location?.recorded_at ?? undefined,
          assignmentId: live?.assignment_id,
          tripStatus: live?.status,
        };
      });
      setVehicles(items);
    };

    loadVehicles()
      .catch(() => {
        if (cancelled) return;
        setVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const liveParams = { date: params.date ?? todayIso(), ...params };
      dailyTripCollectionPointApi
        .action<TrackingOverviewResponse>("tracking-overview", undefined, { params: liveParams })
        .then((trackingData) => {
          const liveByVehicle = new Map<string, TrackingOverviewTrip>();
          (trackingData.trips ?? []).forEach((trip) => {
            if (!trip.vehicle_no || !trip.vehicle_start) return;
            liveByVehicle.set(normalizeVehicleNo(trip.vehicle_no), trip);
          });
          setVehicles((current) =>
            current.map((vehicle) => {
              const live = liveByVehicle.get(normalizeVehicleNo(vehicle.vehicleNo));
              const location = live?.vehicle_tracking?.current_location;
              const lng = Number(location?.longitude ?? live?.vehicle_start?.[0]);
              const lat = Number(location?.latitude ?? live?.vehicle_start?.[1]);
              return {
                ...vehicle,
                lat: Number.isFinite(lat) ? lat : vehicle.lat,
                lng: Number.isFinite(lng) ? lng : vehicle.lng,
                recordedAt: location?.recorded_at ?? vehicle.recordedAt,
                assignmentId: live?.assignment_id ?? vehicle.assignmentId,
                tripStatus: live?.status ?? vehicle.tripStatus,
              };
            }),
          );
        })
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  const filtered = useMemo(
    () => {
      const visible = statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);
      return visible.filter((v) => v.lat !== undefined && v.lng !== undefined);
    },
    [vehicles, statusFilter],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

    filtered.forEach((v) => {
      if (v.lat === undefined || v.lng === undefined) return;
      const isFocused = v.id === focusedId;
      const marker = L.marker([v.lat, v.lng] as LatLngTuple, {
        icon: createVehicleIcon(v.status, isFocused),
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;font-weight:600;padding:2px 0">${v.vehicleNo}</div>
           <div style="font-size:11px;color:#64748b">${v.vehicleType || "—"}</div>
           <div style="font-size:11px;color:${VEHICLE_STATUS_META[v.status].color};font-weight:500">${v.status}</div>
           <div style="font-size:11px;color:#64748b">Lat: ${v.lat.toFixed(6)}, Lng: ${v.lng.toFixed(6)}</div>`,
        )
        .on("click", () => {
          setFocusedId(v.id);
          setSelectedVehicle(v);
        });
      markersRef.current.push(marker);
    });

    const bounds = L.latLngBounds(filtered.map((v) => [v.lat!, v.lng!] as LatLngTuple));
    map.fitBounds(bounds.pad(0.2));
  }, [filtered, focusedId]);

  const counts = useMemo(() => {
    const active = vehicles.filter((v) => v.status === "active").length;
    const inactive = vehicles.filter((v) => v.status === "inactive").length;
    const live = vehicles.filter((v) => v.lat !== undefined && v.lng !== undefined).length;
    return { total: vehicles.length, active, inactive, live };
  }, [vehicles]);

  const statusOptions: { value: VehicleStatus | "all"; label: string; count: number; color: string }[] = [
    { value: "all", label: "All", count: counts.total, color: "#3b82f6" },
    { value: "active", label: "Active", count: counts.active, color: "#15803d" },
    { value: "inactive", label: "Inactive", count: counts.inactive, color: "#b91c1c" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatusFilter(opt.value);
                setFocusedId("");
                setSelectedVehicle(null);
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                statusFilter === opt.value
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: opt.color }} />
              {opt.label}
              <span className="ml-0.5 opacity-70">({opt.count})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Live GPS {counts.live}/{counts.total}
          </span>
          {loading && <span className="text-xs text-slate-400">Loading...</span>}
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-[#28425f]">
          <div ref={containerRef} className="h-full w-full" style={{ minHeight: 280 }} />
          {filtered.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-slate-400 dark:bg-slate-900/60">
              No live vehicle GPS found
            </div>
          )}
        </div>

        {selectedVehicle && (
          <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 dark:border-[#28425f] dark:bg-[#0c1828]">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {selectedVehicle.vehicleNo}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSelectedVehicle(null);
                  setFocusedId("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400">Type</span>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {selectedVehicle.vehicleType || "—"}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Status</span>
                <p
                  className="font-medium"
                  style={{ color: VEHICLE_STATUS_META[selectedVehicle.status].color }}
                >
                  {selectedVehicle.status}
                </p>
              </div>
              {selectedVehicle.capacity !== undefined && (
                <div>
                  <span className="text-slate-400">Capacity</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {selectedVehicle.capacity} kg
                  </p>
                </div>
              )}
              {selectedVehicle.mileage !== undefined && (
                <div>
                  <span className="text-slate-400">Mileage</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {selectedVehicle.mileage} km/L
                  </p>
                </div>
              )}
              {selectedVehicle.condition && (
                <div>
                  <span className="text-slate-400">Condition</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {selectedVehicle.condition}
                  </p>
                </div>
              )}
              {selectedVehicle.lat !== undefined && selectedVehicle.lng !== undefined && (
                <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2 dark:bg-[#132235]">
                  <div>
                    <span className="text-slate-400">Latitude</span>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{selectedVehicle.lat.toFixed(6)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Longitude</span>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{selectedVehicle.lng.toFixed(6)}</p>
                  </div>
                </div>
              )}
              {selectedVehicle.tripStatus && (
                <div>
                  <span className="text-slate-400">Trip Status</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{selectedVehicle.tripStatus}</p>
                </div>
              )}
              {selectedVehicle.recordedAt && (
                <div>
                  <span className="text-slate-400">Last GPS Update</span>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {formatLiveTime(selectedVehicle.recordedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
