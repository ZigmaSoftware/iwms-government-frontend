import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple, Map } from "leaflet";

import { createVehicleIcon, VEHICLE_STATUS_META } from "./mapUtils";
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

const normalizeVehicleNo = (value?: string | null) =>
  String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const toNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const todayIso = () => new Date().toISOString().split("T")[0];

const formatLiveTime = (value?: string) => {
  if (!value) return "Live";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

type VehicleMapContentProps = {
  map: Map | null;
  params: Record<string, string>;
  focusedId: string;
  setFocusedId: (id: string) => void;
  selectedVehicle: VehicleItem | null;
  setSelectedVehicle: (v: VehicleItem | null) => void;
};

export function VehicleMapContent({
  map,
  params,
  focusedId,
  setFocusedId,
  selectedVehicle,
  setSelectedVehicle,
}: VehicleMapContentProps) {
  const markersRef = useRef<L.Marker[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");

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
          vehicleType: v.vehicle_type?.vehicleType ?? v.vehicle_type?.vehicle_type_name ?? "",
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
    return () => { cancelled = true; };
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
  }, [JSON.stringify(params)]);

  const filtered = useMemo(
    () => {
      const visible = statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);
      return visible.filter((v) => v.lat !== undefined && v.lng !== undefined);
    },
    [vehicles, statusFilter],
  );

  useEffect(() => {
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

    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((v) => [v.lat!, v.lng!] as LatLngTuple));
      map.fitBounds(bounds.pad(0.2));
    }
  }, [map, filtered, focusedId, setFocusedId, setSelectedVehicle]);

  return null;
}