import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

import {
  createBinIcon,
  DEFAULT_CENTER,
  HOUSEHOLD_STATUS_META,
  initBaseMap,
  spreadPositions,
  type HouseholdStatus,
} from "./mapUtils";
import { binApi, binCollectionEventApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";

/* ================= TYPES ================= */
type ApiBin = {
  unique_id: string;
  bin_name: string;
  ward_name?: string;
  ward?: string;
  bin_type?: string;
  waste_type?: string;
  color_code?: string;
  capacity_liters?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  installation_date?: string;
  expected_life_years?: number | string;
  bin_status?: string;
  is_active?: boolean;
};

type ApiBinCollectionEvent = {
  bin_id?: string;
  bin?: { unique_id?: string };
  status?: string;
  collection_date?: string;
  created_at?: string;
  collected_weight_kg?: number | string;
};

type CollectionMeta = {
  lastCollectedOn?: string;
  collectedWeightKg?: number;
};

type Bin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: HouseholdStatus;
  wardName?: string;
  installedDate?: string;
  binType?: string;
  wasteType?: string;
  capacityLiters?: number;
  binCondition?: string;
  colorCode?: string;
  expectedLifeYears?: number;
  isActive?: boolean;
  lastCollectedOn?: string;
  collectedWeightKg?: number;
};

const parseCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberOrUndefined = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatLabel = (value?: string) => {
  if (!value) return undefined;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const buildBin = (
  bin: ApiBin,
  lat: number,
  lng: number,
  collectedMeta: Map<string, CollectionMeta>
): Bin => {
  const id = String(bin.unique_id ?? "");
  const meta = collectedMeta.get(id);
  return {
    id,
    name: bin.bin_name || bin.unique_id || "Unnamed Bin",
    lat,
    lng,
    status: meta ? "collected" : "not_collected",
    wardName: bin.ward_name || bin.ward || undefined,
    installedDate: bin.installation_date || undefined,
    binType: formatLabel(bin.bin_type),
    wasteType: formatLabel(bin.waste_type),
    capacityLiters: toNumberOrUndefined(bin.capacity_liters),
    binCondition: formatLabel(bin.bin_status),
    colorCode: bin.color_code || undefined,
    expectedLifeYears: toNumberOrUndefined(bin.expected_life_years),
    isActive: bin.is_active,
    lastCollectedOn: meta?.lastCollectedOn,
    collectedWeightKg: meta?.collectedWeightKg,
  };
};

/* ================= COMPONENT ================= */
export function BinMapPanel({ params = {} }: { params?: Record<string, string> }) {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, L.Marker>>({});

  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [binRecords, setBinRecords] = useState<ApiBin[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<ApiBinCollectionEvent[]>([]);

  /* ================= FILTER STATE ================= */
  const [statusFilter, setStatusFilter] = useState<
    Record<HouseholdStatus, boolean>
  >({
    collected: true,
    not_collected: true,
  });

  /* ================= DATA ================= */
  useEffect(() => {
    let isMounted = true;
    const fetchBins = async () => {
      const today = new Date().toISOString().split("T")[0];
      const config = Object.keys(params).length ? { params } : undefined;
      try {
        const [binResponse, collectionResponse] = await Promise.all([
          binApi.readAll(config),
          binCollectionEventApi.readAll({ params: { collection_date: today, ...params } }),
        ]);
        if (!isMounted) return;
        setBinRecords(Array.isArray(binResponse) ? binResponse : []);
        setCollectionRecords(Array.isArray(collectionResponse) ? collectionResponse : []);
      } catch {
        if (!isMounted) return;
        setBinRecords([]);
        setCollectionRecords([]);
      }
    };

    fetchBins();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  /* ================= DATA ================= */
  const bins = useMemo(() => {
    const collectedMeta = new Map<string, CollectionMeta>();
    collectionRecords.forEach((event) => {
      if (event.status !== "Collected") return;
      const binId = String(event.bin_id ?? event.bin?.unique_id ?? "").trim();
      if (!binId) return;
      collectedMeta.set(binId, {
        lastCollectedOn: formatDateTime(event.collection_date || event.created_at),
        collectedWeightKg: toNumberOrUndefined(event.collected_weight_kg),
      });
    });

    const active = binRecords.filter((bin) => bin.is_active !== false);

    const withCoords: Bin[] = [];
    const missingCoords: ApiBin[] = [];

    active.forEach((bin) => {
      const lat = parseCoordinate(bin.latitude);
      const lng = parseCoordinate(bin.longitude);
      if (lat === null || lng === null) {
        missingCoords.push(bin);
        return;
      }
      withCoords.push(buildBin(bin, lat, lng, collectedMeta));
    });

    const center: LatLngTuple = withCoords.length
      ? [
          withCoords.reduce((sum, b) => sum + b.lat, 0) / withCoords.length,
          withCoords.reduce((sum, b) => sum + b.lng, 0) / withCoords.length,
        ]
      : DEFAULT_CENTER;
    const fallbackPositions = spreadPositions(missingCoords.length, center);

    const synthesized: Bin[] = missingCoords.map((bin, i) =>
      buildBin(bin, fallbackPositions[i][0], fallbackPositions[i][1], collectedMeta)
    );

    return [...withCoords, ...synthesized];
  }, [binRecords, collectionRecords]);

  const filteredBins = useMemo(
    () => bins.filter((b) => statusFilter[b.status]),
    [bins, statusFilter]
  );

  const totalSelected = statusFilter.collected && statusFilter.not_collected;
  const totalMeta = {
    label: t("dashboard.home.total_bins_label"),
    color: "#1d4ed8",
    bg: "rgba(59,130,246,0.16)",
  };

  const summary = useMemo(
    () =>
      bins.reduce(
        (acc, b) => {
          acc[b.status] += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, collected: 0, not_collected: 0 }
      ),
    [bins]
  );

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

    filteredBins.forEach((bin) => {
      const pos: LatLngTuple = [bin.lat, bin.lng];
      bounds.push(pos);

      const marker = L.marker(pos, {
        icon: createBinIcon(bin.status, bin.id === selectedBin?.id),
        title: bin.name,
      });

      const statusLabel = t(HOUSEHOLD_STATUS_META[bin.status].labelKey);
      marker.bindPopup(
        `<strong>${bin.name}</strong><br/>
         ${t("common.status")}: ${statusLabel}<br/>
         ${t("common.ward")}: ${bin.wardName ?? "—"}`,
        { closeButton: false, autoClose: false, closeOnClick: false }
      );

      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());

      marker.on("click", (e) => {
        e.originalEvent?.preventDefault();
        setSelectedBin(bin);
        setPanelOpen(true);
      });

      marker.addTo(layer);
      markerLookupRef.current[bin.id] = marker;
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    else if (bounds.length === 1) map.setView(bounds[0], 15);
    else map.setView(DEFAULT_CENTER, 13);
  }, [filteredBins, selectedBin, t]);

  useEffect(() => {
    if (!selectedBin) return;
    const map = mapRef.current;
    const marker = markerLookupRef.current[selectedBin.id];
    if (map && marker) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    }
  }, [selectedBin]);

  /* ================= UI ================= */
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200">
      <div ref={mapDivRef} className="absolute inset-0" />

      {/* TOP FILTER */}
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
      <BinSideDetailsPanel
        bin={selectedBin}
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}

/* ================= SIDE DETAILS PANEL ================= */
function BinSideDetailsPanel({
  bin,
  open,
  onToggle,
  onClose,
}: {
  bin: Bin | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const meta = bin ? HOUSEHOLD_STATUS_META[bin.status] : null;
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
        {bin ? (
          <>
            {/* HEADER WITH BIG ANIMATED BIN ICON */}
            <div className="flex items-center gap-3 border-b p-3">
              <AnimatedBinIcon
                color={meta?.color}
                bg={meta?.bg}
              />
              <div>
                <h3 className="text-sm font-bold">{bin.name}</h3>
                <p className="text-[11px] text-gray-500">
                  {meta ? t(meta.labelKey) : ""}
                </p>
              </div>
            </div>

            {/* DETAILS */}
            <div className="space-y-4 p-3 text-xs">
              <Section title={t("dashboard.home.bin_info_title")}>
                <InfoRow label={t("common.status")} value={bin.binCondition} />
                <InfoRow label={t("common.bin_type")} value={bin.binType} />
                <InfoRow label={t("common.waste_type")} value={bin.wasteType} />
                <InfoRow label={t("common.color_code")} value={bin.colorCode} />
                <InfoRow label={t("common.capacity_liters")} value={bin.capacityLiters} />
              </Section>

              <Section title={t("dashboard.home.location_title")}>
                <InfoRow label={t("common.ward")} value={bin.wardName} />
                <InfoRow label={t("common.latitude")} value={bin.lat} />
                <InfoRow label={t("common.longitude")} value={bin.lng} />
              </Section>

              <Section title={t("dashboard.home.collection_title")}>
                <InfoRow label={t("common.last_collected")} value={bin.lastCollectedOn} />
                <InfoRow label={t("common.collected_weight_kg")} value={bin.collectedWeightKg} />
              </Section>

              <Section title={t("dashboard.home.lifecycle_title")}>
                <InfoRow label={t("common.installed_on")} value={bin.installedDate} />
                <InfoRow label={t("common.expected_life_years")} value={bin.expectedLifeYears} />
              </Section>
            </div>
          </>
        ) : (
          <div className="p-3 text-xs text-gray-400">
            {t("dashboard.home.select_bin")}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= BIG ANIMATED BIN ICON ================= */
function AnimatedBinIcon({
  color = "#16a34a",
  bg = "#dcfce7",
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
      {/* Icon */}
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
          <path d="M3 6h18" />
          <path d="M8 6v14" />
          <path d="M16 6v14" />
          <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
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
