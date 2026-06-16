import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

import {
  createHouseIcon,
  DEFAULT_CENTER,
  HOUSEHOLD_STATUS_META,
  initBaseMap,
  type HouseholdStatus,
} from "./mapUtils";
import { customerCreationApi, wasteCollectionApi } from "@/helpers/admin";
import {
  filterActiveCustomers,
  normalizeCustomerArray,
  type CustomerRecord as CustomerRecordBase,
} from "@/utils/customerUtils";
import { useTranslation } from "react-i18next";

/* ================= TYPES ================= */
type CustomerRecord = CustomerRecordBase & {
  customer_name?: string;
  customerName?: string;
  zone_name?: string;
  ward_name?: string;
  city_name?: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: string | number;
  lng?: string | number;
  latitude_value?: string | number;
  longitude_value?: string | number;
  building_no?: string;
  street?: string;
  area?: string;
  owner_name?: string;
  mobile_number?: string;
  phone?: string;
  house_type?: string;
  occupancy?: string;
};

type Household = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: HouseholdStatus;
  ward?: string;
  zone?: string;
  city?: string;
  street?: string;
  address?: string;
  ownerName?: string;
  mobile?: string;
  houseType?: string;
  occupancy?: string;
  lastCollectedOn?: string;
  assignedVehicle?: string;
  beatWorker?: string;
};

type CollectionMeta = {
  lastCollectedOn?: string;
  lastCollectedAt?: number;
  assignedVehicle?: string;
  beatWorker?: string;
};

const parseCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickCoordinate = (record: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    const parsed = parseCoordinate(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const pickText = (source: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
};

const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

/* ================= COMPONENT ================= */
export function HouseholdMapPanel() {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, L.Marker>>({});

  const [households, setHouseholds] = useState<Household[]>([]);
  const [summaryCounts, setSummaryCounts] = useState({
    total: 0,
    collected: 0,
    not_collected: 0,
  });
  const [selectedHouse, setSelectedHouse] = useState<Household | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  /* ================= FILTER STATE ================= */
  const [statusFilter, setStatusFilter] = useState<
    Record<HouseholdStatus, boolean>
  >({
    collected: true,
    not_collected: true,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchHouseholds = async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const [customerResponse, collectionResponse] = await Promise.all([
          customerCreationApi.readAll(),
          wasteCollectionApi.readAll({ params: { collection_date: today } }),
        ]);

        const normalized = normalizeCustomerArray(customerResponse) as CustomerRecord[];
        const activeCustomers = filterActiveCustomers(normalized) as CustomerRecord[];

        const collections = Array.isArray(collectionResponse) ? collectionResponse : [];
        const collectedIds = new Set<string>();
        const collectionMeta = new Map<string, CollectionMeta>();

        collections.forEach((entry: Record<string, any>) => {
          const customerId = String(
            entry.customer ?? entry.customer_id ?? entry.customer_unique_id ?? ""
          ).trim();
          if (!customerId) return;
          collectedIds.add(customerId);

          const rawDate = pickText(entry, [
            "collection_date",
            "collectionDate",
            "created_at",
            "createdAt",
            "date",
            "timestamp",
            "collected_at",
          ]);
          const vehicle = pickText(entry, [
            "vehicle_no",
            "vehicleNo",
            "vehicle_number",
            "vehicleNumber",
            "regNo",
          ]);
          const worker = pickText(entry, [
            "staff",
            "collector",
            "driver",
            "worker",
            "staff_name",
            "staffName",
          ]);

          const nextTimestamp = rawDate ? new Date(rawDate).getTime() : null;
          const existing = collectionMeta.get(customerId);
          if (!existing || (nextTimestamp && (!existing.lastCollectedAt || nextTimestamp > existing.lastCollectedAt))) {
            collectionMeta.set(customerId, {
              lastCollectedOn: formatDateTime(rawDate),
              lastCollectedAt: nextTimestamp ?? undefined,
              assignedVehicle: vehicle || undefined,
              beatWorker: worker || undefined,
            });
          }
        });

        const mapped = activeCustomers.reduce<Household[]>((acc, customer) => {
          const id = String(customer.unique_id ?? customer.id ?? "").trim();
          if (!id) return acc;
          const lat = pickCoordinate(customer, [
            "latitude",
            "lat",
            "latitude_value",
            "latitudeValue",
          ]);
          const lng = pickCoordinate(customer, [
            "longitude",
            "lng",
            "lon",
            "longitude_value",
            "longitudeValue",
          ]);
          if (lat === null || lng === null) return acc;

          const status: HouseholdStatus = collectedIds.has(id)
            ? "collected"
            : "not_collected";

          const addressParts = [
            pickText(customer, ["building_no", "buildingNo"], ""),
            pickText(customer, ["street", "street_name"], ""),
            pickText(customer, ["area", "area_name"], ""),
          ].filter((part) => part);

          const meta = collectionMeta.get(id);
          const household: Household = {
            id,
            name: pickText(customer, ["customer_name", "customerName", "name"], "Unknown"),
            lat,
            lng,
            status,
            ward: pickText(customer, ["ward_name", "ward"], ""),
            zone: pickText(customer, ["zone_name", "zone"], ""),
            city: pickText(customer, ["city_name", "city"], ""),
            street: pickText(customer, ["street", "street_name"], ""),
            address: addressParts.length ? addressParts.join(", ") : undefined,
            ownerName: pickText(customer, ["owner_name", "ownerName", "property_owner"], ""),
            mobile: pickText(customer, ["mobile_number", "mobile", "phone", "contact_no"], ""),
            houseType: pickText(customer, ["house_type", "houseType", "property_type"], ""),
            occupancy: pickText(customer, ["occupancy", "occupancy_status"], ""),
            lastCollectedOn: meta?.lastCollectedOn,
            assignedVehicle: meta?.assignedVehicle,
            beatWorker: meta?.beatWorker,
          };

          acc.push(household);
          return acc;
        }, []);

        if (!isMounted) return;
        setHouseholds(mapped);
        const totalCount = activeCustomers.length;
        const collectedCount = collectedIds.size;
        setSummaryCounts({
          total: totalCount,
          collected: collectedCount,
          not_collected: Math.max(totalCount - collectedCount, 0),
        });
      } catch (error) {
        console.error("Failed to load household monitoring data:", error);
        if (!isMounted) return;
        setHouseholds([]);
        setSummaryCounts({ total: 0, collected: 0, not_collected: 0 });
      }
    };

    fetchHouseholds();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedHouse) return;
    if (!households.some((house) => house.id === selectedHouse.id)) {
      setSelectedHouse(null);
    }
  }, [households, selectedHouse]);

  const filteredHouseholds = useMemo(
    () => households.filter((h) => statusFilter[h.status]),
    [households, statusFilter]
  );

  const totalSelected = statusFilter.collected && statusFilter.not_collected;
  const totalMeta = {
    label: t("dashboard.home.total_households_label"),
    color: "#1d4ed8",
    bg: "rgba(59,130,246,0.16)",
  };

  const summary = summaryCounts;

  /* ================= MAP INIT ================= */
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = initBaseMap(mapDivRef.current);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    const raf = requestAnimationFrame(resize);
    const timer = setTimeout(resize, 300);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  /* ================= MARKERS ================= */
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerLookupRef.current = {};
    const bounds: LatLngTuple[] = [];

    filteredHouseholds.forEach((house) => {
      const pos: LatLngTuple = [house.lat, house.lng];
      bounds.push(pos);

      const marker = L.marker(pos, {
        icon: createHouseIcon(house.status, house.id === selectedHouse?.id),
        title: house.name,
      });

      const statusLabel = t(HOUSEHOLD_STATUS_META[house.status].labelKey);
      marker.bindPopup(
        `<strong>${house.name}</strong><br/>
         ${t("common.ward")}: ${house.ward}<br/>
         ${t("common.status")}: ${statusLabel}`,
        { closeButton: false, autoClose: false, closeOnClick: false }
      );

      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());

      marker.on("click", (e) => {
        e.originalEvent?.preventDefault();
        setSelectedHouse(house);
        setPanelOpen(true);
      });

      marker.addTo(layer);
      markerLookupRef.current[house.id] = marker;
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
    else map.setView(DEFAULT_CENTER, 13);
  }, [filteredHouseholds, selectedHouse, t]);

  useEffect(() => {
    if (!selectedHouse) return;
    const map = mapRef.current;
    const marker = markerLookupRef.current[selectedHouse.id];
    if (map && marker) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    }
  }, [selectedHouse]);

  /* ================= UI ================= */
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200">
      <div ref={mapDivRef} className="absolute inset-0" />

      {/* TOP FILTER BAR */}
      <div className="absolute left-1/2 top-2 z-[600] -translate-x-1/2">
        <div className="flex max-w-[calc(100vw-32px)] flex-wrap items-center justify-center gap-2 rounded-md border border-white/40 bg-white/80 px-4 py-1 text-[10px] text-slate-700 dark:text-slate-200">
          {(Object.keys(statusFilter) as HouseholdStatus[]).map((key) => {
            const meta = HOUSEHOLD_STATUS_META[key];
            return (
              <label
                key={key}
                className="flex flex-wrap items-center justify-center gap-1.5 rounded-full px-2 py-1 text-center font-semibold leading-tight cursor-pointer"
                style={{
                  background: meta.bg,
                  color: meta.color,
                  opacity: statusFilter[key] ? 1 : 0.5,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: meta.color }}
                />
                {t(meta.labelKey)}
                <span className="ml-1 text-[11px] font-bold">
                  {summary[key]}
                </span>
                <input
                  type="checkbox"
                  checked={statusFilter[key]}
                  onChange={() =>
                    setStatusFilter((p) => ({ ...p, [key]: !p[key] }))
                  }
                  className="hidden"
                />
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => setStatusFilter({ collected: true, not_collected: true })}
            className="flex flex-wrap items-center justify-center gap-1.5 rounded-full px-2 py-1 text-center font-semibold leading-tight"
            style={{
              background: totalMeta.bg,
              color: totalMeta.color,
              opacity: totalSelected ? 1 : 0.5,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: totalMeta.color }}
            />
            {totalMeta.label}
            <span className="ml-1 text-[11px] font-bold">{summary.total}</span>
          </button>
        </div>
      </div>

      {/* SIDE PANEL */}
      <HouseholdSideDetailsPanel
        house={selectedHouse}
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}

/* ================= SIDE DETAILS PANEL ================= */
function HouseholdSideDetailsPanel({
  house,
  open,
  onToggle,
  onClose,
}: {
  house: Household | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const statusMeta = house ? HOUSEHOLD_STATUS_META[house.status] : null;
  const WIDTH = 240;

  return (
    <div
      className="absolute left-0 top-0 z-[700] h-full bg-white shadow-xl transition-transform duration-300"
      style={{
        width: WIDTH,
        transform: open ? "translateX(0)" : `translateX(-${WIDTH}px)`,
      }}
    >
      {/* CENTER TOGGLE */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-xs font-bold shadow"
      >
        {open ? "❮" : "❯"}
      </button>

      {/* CLOSE */}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-full border bg-white px-2 py-1 text-xs font-bold shadow"
      >
        ✕
      </button>

      <div className="h-full overflow-y-auto border-r">
        {house ? (
          <>
            {/* HEADER WITH BIG ANIMATED ICON */}
            <div className="flex items-center gap-3 border-b p-3">
              <AnimatedHouseIcon color={statusMeta?.color} bg={statusMeta?.bg} />
              <div>
                <h3 className="text-sm font-bold">{house.name}</h3>
                <p className="text-[11px] text-gray-500">
                  {t("common.ward")} {house.ward} · {statusMeta ? t(statusMeta.labelKey) : ""}
                </p>
              </div>
            </div>

            {/* DETAILS */}
            <div className="space-y-4 p-3 text-xs">
              <Section title={t("dashboard.home.household_info_title")}>
                <InfoRow label={t("common.owner")} value={house.ownerName} />
                <InfoRow label={t("common.mobile")} value={house.mobile} />
                <InfoRow label={t("common.house_type")} value={house.houseType} />
                <InfoRow label={t("common.occupancy")} value={house.occupancy} />
              </Section>

              <Section title={t("dashboard.home.location_title")}>
                <InfoRow label={t("common.city")} value={house.city} />
                <InfoRow label={t("common.zone")} value={house.zone} />
                <InfoRow label={t("common.address")} value={house.address ?? house.street} />
                <InfoRow label={t("common.latitude")} value={house.lat} />
                <InfoRow label={t("common.longitude")} value={house.lng} />
              </Section>

              <Section title={t("dashboard.home.collection_title")}>
                <InfoRow label={t("common.last_collected")} value={house.lastCollectedOn} />
                <InfoRow label={t("common.vehicle")} value={house.assignedVehicle} />
                <InfoRow label={t("common.beat_worker")} value={house.beatWorker} />
              </Section>
            </div>
          </>
        ) : (
          <div className="p-3 text-xs text-gray-400">
            {t("dashboard.home.select_household")}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= BIG ANIMATED HOUSE ICON ================= */
function AnimatedHouseIcon({
  color = "#2563eb",
  bg = "#dbeafe",
}: {
  color?: string;
  bg?: string;
}) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      {/* Pulse ring */}
      <span
        className="absolute inline-flex h-full w-full rounded-full animate-ping"
        style={{ backgroundColor: bg, opacity: 0.6 }}
      />
      {/* Icon container */}
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-lg animate-[bounce_0.6s_ease-out]"
        style={{ backgroundColor: bg }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          className="h-6 w-6"
        >
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
        </svg>
      </span>
    </div>
  );
}

/* ================= HELPERS ================= */
function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value ?? "—"}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase text-gray-500">
        {title}
      </div>
      <div className="space-y-1 rounded-md border bg-gray-50 p-2">
        {children}
      </div>
    </div>
  );
}
