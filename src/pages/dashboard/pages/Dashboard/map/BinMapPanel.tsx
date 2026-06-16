import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

import {
  BIN_PRIORITY_META,
  createBinIcon,
  initBaseMap,
  type BinPriority,
} from "./mapUtils";
import { binApi } from "@/helpers/admin";
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

type Bin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  priority: BinPriority;
  wardName?: string;
  installedDate?: string;
  binType?: string;
  wasteType?: string;
  capacityLiters?: number;
  status?: string;
  colorCode?: string;
  expectedLifeYears?: number;
  isActive?: boolean;
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

const parseHexColor = (value: string) => {
  let hex = value.trim().toLowerCase();
  if (!hex) return null;
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c))) return null;
  return { r, g, b };
};

const getPriorityFromColor = (
  colorCode?: string,
  status?: string
): BinPriority => {
  const normalized = String(colorCode ?? "").trim().toLowerCase();
  if (normalized) {
    if (normalized.includes("red")) return "high";
    if (
      normalized.includes("orange") ||
      normalized.includes("yellow") ||
      normalized.includes("amber")
    ) {
      return "medium";
    }
    if (normalized.includes("green")) return "low";
    const rgb = parseHexColor(normalized);
    if (rgb) {
      if (rgb.r >= 200 && rgb.g < 120) return "high";
      if (rgb.g >= 170 && rgb.r < 140) return "low";
      if (rgb.r >= 180 && rgb.g >= 120) return "medium";
    }
  }

  const statusValue = String(status ?? "").trim().toLowerCase();
  if (statusValue === "full") return "high";
  if (statusValue === "maintenance" || statusValue === "damaged") {
    return "medium";
  }

  return "low";
};

/* ================= COMPONENT ================= */
export function BinMapPanel() {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, L.Marker>>({});

  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [binRecords, setBinRecords] = useState<ApiBin[]>([]);

  /* ================= FILTER STATE ================= */
  const [priorityFilter, setPriorityFilter] = useState<
    Record<BinPriority, boolean>
  >({
    high: true,
    medium: true,
    low: true,
  });

  /* ================= DATA ================= */
  useEffect(() => {
    let isMounted = true;
    const fetchBins = async () => {
      try {
        const data = await binApi.readAll();
        if (!isMounted) return;
        setBinRecords(Array.isArray(data) ? data : []);
      } catch {
        if (!isMounted) return;
        setBinRecords([]);
      }
    };

    fetchBins();
    return () => {
      isMounted = false;
    };
  }, []);

  /* ================= DATA ================= */
  const bins = useMemo(
    () =>
      binRecords.reduce<Bin[]>((acc, bin) => {
        if (bin.is_active === false) return acc;

        const lat = parseCoordinate(bin.latitude);
        const lng = parseCoordinate(bin.longitude);
        if (lat === null || lng === null) return acc;

        acc.push({
          id: String(bin.unique_id ?? ""),
          name: bin.bin_name || bin.unique_id || "Unnamed Bin",
          lat,
          lng,
          priority: getPriorityFromColor(bin.color_code, bin.bin_status),
          wardName: bin.ward_name || bin.ward || undefined,
          installedDate: bin.installation_date || undefined,
          binType: formatLabel(bin.bin_type),
          wasteType: formatLabel(bin.waste_type),
          capacityLiters: toNumberOrUndefined(bin.capacity_liters),
          status: formatLabel(bin.bin_status),
          colorCode: bin.color_code || undefined,
          expectedLifeYears: toNumberOrUndefined(bin.expected_life_years),
          isActive: bin.is_active,
        });

        return acc;
      }, []),
    [binRecords]
  );

  const filteredBins = useMemo(
    () => bins.filter((b) => priorityFilter[b.priority]),
    [bins, priorityFilter]
  );

  const summary = useMemo(
    () =>
      bins.reduce(
        (acc, b) => {
          acc[b.priority] += 1;
          return acc;
        },
        { high: 0, medium: 0, low: 0 }
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
        icon: createBinIcon(bin.priority, bin.id === selectedBin?.id),
        title: bin.name,
      });

      const priorityLabel = t(BIN_PRIORITY_META[bin.priority].labelKey);
      marker.bindPopup(
        `<strong>${bin.name}</strong><br/>
         ${t("common.priority")}: ${priorityLabel}<br/>
         ${t("common.color")}: ${bin.colorCode ?? "—"}<br/>
         ${t("common.status")}: ${bin.status ?? "—"}`,
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

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
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
      <div className="absolute left-1/2 top-3 z-[600] -translate-x-1/2">
        <div className="flex gap-2 rounded-lg border border-white/40 bg-white/80 px-3 py-2 shadow text-xs">
          {(Object.keys(priorityFilter) as BinPriority[]).map((key) => {
            const meta = BIN_PRIORITY_META[key];
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-full px-3 py-1 font-semibold cursor-pointer"
                style={{
                  background: meta.bg,
                  color: meta.color,
                  opacity: priorityFilter[key] ? 1 : 0.5,
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
                  checked={priorityFilter[key]}
                  onChange={() =>
                    setPriorityFilter((p) => ({ ...p, [key]: !p[key] }))
                  }
                  className="hidden"
                />
              </label>
            );
          })}
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
  const meta = bin ? BIN_PRIORITY_META[bin.priority] : null;
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
                <InfoRow label={t("common.status")} value={bin.status} />
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
