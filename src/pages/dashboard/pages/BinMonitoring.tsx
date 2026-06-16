import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { binApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";

const binMarkerAnimations = `
  @keyframes binPulse {
    0% { transform: translateX(-50%) scale(0.9); opacity: 0.6; }
    100% { transform: translateX(-50%) scale(1.35); opacity: 0; }
  }
  @keyframes binBounce {
    0% { transform: translateX(-50%) scale(0.9); }
    60% { transform: translateX(-50%) scale(1.08); }
    100% { transform: translateX(-50%) scale(1); }
  }
`;

type BinPriority = "high" | "medium" | "low";

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
  created_at?: string;
  updated_at?: string;
};

type BinRecord = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  priority: BinPriority;
  ward?: string;
  status?: string;
  colorCode?: string;
  updatedAt?: string;
};

const priorityConfig: Record<BinPriority, { color: string; bg: string }> = {
  high: { color: "#b91c1c", bg: "rgba(239,68,68,0.15)" },
  medium: { color: "#b45309", bg: "rgba(245,158,11,0.15)" },
  low: { color: "#15803d", bg: "rgba(34,197,94,0.12)" },
};

const parseCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
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

const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const createBinIcon = (priority: BinPriority, isFocused = false) => {
  const meta = priorityConfig[priority];
  const shadow = isFocused
    ? "0 0 0 4px rgba(255,255,255,0.9), 0 10px 22px rgba(0,0,0,.35)"
    : "0 8px 16px rgba(0,0,0,.28)";
  const size = isFocused ? 48 : 36;
  const pointer = isFocused ? 14 : 12;
  const iconSize: [number, number] = [size + 6, size + pointer + 4];
  const anchorX = Math.round(iconSize[0] / 2);
  const anchorY = iconSize[1] - 2;
  return L.divIcon({
    className: "",
    iconSize,
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -44],
    html: `
      <div style="position:relative; width:${iconSize[0]}px; height:${iconSize[1]}px;">
        ${
          isFocused
            ? `
        <span
          style="
            position:absolute;
            top:${Math.max(size * 0.12, 4)}px;
            left:50%;
            transform:translateX(-50%);
            width:${Math.round(size * 1.15)}px;
            height:${Math.round(size * 1.15)}px;
            border-radius:14px;
            background:${meta.bg};
            opacity:0.65;
            animation: binPulse 1.3s ease-out infinite;
          "
        ></span>`
            : ""
        }
        <div
          style="
            position:absolute;
            top:0;
            left:50%;
            transform:translateX(-50%);
            width:${size}px;
            height:${size}px;
            border-radius:12px;
            background:${meta.color};
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:${shadow};
            border:2px solid #fff;
            ${isFocused ? "animation: binBounce 0.6s ease-out;" : ""}
          "
        >
          <svg
            width="${Math.round(size * 0.5)}"
            height="${Math.round(size * 0.5)}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <rect x="6" y="6" width="12" height="14" rx="2" />
            <path d="M10 10v6" />
            <path d="M14 10v6" />
          </svg>
        </div>
        <div
          style="
            position:absolute;
            top:${size - 4}px;
            left:50%;
            transform:translateX(-50%);
            width:0;
            height:0;
            border-left:${Math.round(pointer * 0.6)}px solid transparent;
            border-right:${Math.round(pointer * 0.6)}px solid transparent;
            border-top:${pointer}px solid ${meta.color};
            filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));
          "
        ></div>
      </div>
    `,
  });
};

export default function BinMonitoring() {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, L.Marker>>({});
  const [focusedBin, setFocusedBin] = useState<string | null>(null);
  const [allBinSearch, setAllBinSearch] = useState("");
  const [binRecords, setBinRecords] = useState<ApiBin[]>([]);
  const [selectedBin, setSelectedBin] = useState<BinRecord | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const placeholderNa = t("dashboard.bin_monitoring.placeholder_na");

  const getPriorityLabel = useCallback((priority: BinPriority) => {
    if (priority === "high") return t("common.priority_high");
    if (priority === "medium") return t("common.priority_medium");
    return t("common.priority_low");
  }, [t]);

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

  const prioritized = useMemo(() => {
    const records = binRecords.reduce<BinRecord[]>((acc, bin) => {
      if (bin.is_active === false) return acc;
      const lat = parseCoordinate(bin.latitude);
      const lng = parseCoordinate(bin.longitude);
      if (lat === null || lng === null) return acc;
      const record: BinRecord = {
        id: String(bin.unique_id ?? ""),
        name: bin.bin_name ?? bin.unique_id ?? t("dashboard.bin_monitoring.unnamed_bin"),
        lat,
        lng,
        priority: getPriorityFromColor(bin.color_code, bin.bin_status),
        ward: bin.ward_name || bin.ward || undefined,
        status: formatLabel(bin.bin_status),
        colorCode: bin.color_code || undefined,
        updatedAt: formatDateTime(bin.updated_at ?? bin.created_at),
      };
      acc.push(record);
      return acc;
    }, []);

      return records.sort((a, b) => {
        const order: Record<BinPriority, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };
        return order[b.priority] - order[a.priority];
      });
  }, [binRecords, t]);

  const handleSelectBin = (bin: BinRecord) => {
    setSelectedBin(bin);
    setPanelOpen(true);
    setFocusedBin(bin.id);
  };

  const highPriority = prioritized.filter((bin) => bin.priority === "high");
  const filteredAllBins = useMemo(() => {
    const term = allBinSearch.trim().toLowerCase();
    if (!term) return prioritized;
    return prioritized.filter(
      (bin) =>
        bin.name.toLowerCase().includes(term) ||
        bin.id.toLowerCase().includes(term) ||
        (bin.ward ?? "").toLowerCase().includes(term) ||
        (bin.status ?? "").toLowerCase().includes(term),
    );
  }, [allBinSearch, prioritized]);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    if (!document.getElementById("bin-marker-animations")) {
      const style = document.createElement("style");
      style.id = "bin-marker-animations";
      style.textContent = binMarkerAnimations;
      document.head.appendChild(style);
    }
    const map = L.map(mapDivRef.current, {
      center: [28.6129, 77.2295],
      zoom: 12,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resizeMap = () => map.invalidateSize();
    const raf = window.requestAnimationFrame(resizeMap);
    const timer = window.setTimeout(resizeMap, 400);
    window.addEventListener("resize", resizeMap);
    return () => {
      window.removeEventListener("resize", resizeMap);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    markerLookupRef.current = {};
    const bounds: LatLngTuple[] = [];
    const priorityLabel = t("dashboard.bin_monitoring.popup_priority");
    const colorLabel = t("dashboard.bin_monitoring.popup_color");
    const statusLabel = t("dashboard.bin_monitoring.popup_status");
    prioritized.forEach((bin) => {
      const position: LatLngTuple = [bin.lat, bin.lng];
      bounds.push(position);
      const marker = L.marker(position, {
        icon: createBinIcon(bin.priority, bin.id === focusedBin),
        title: bin.name,
      });
      marker.bindPopup(
        `<strong>${bin.name}</strong><br/>${priorityLabel}: ${getPriorityLabel(
          bin.priority,
        )}<br/>${colorLabel}: ${bin.colorCode ?? placeholderNa}<br/>${statusLabel}: ${
          bin.status ?? placeholderNa
        }`,
      );
      marker.on("click", () => handleSelectBin(bin));
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.addTo(layer);
      markerLookupRef.current[bin.id] = marker;
    });
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [prioritized, focusedBin, getPriorityLabel, placeholderNa, t]);

  useEffect(() => {
    if (!focusedBin) return;
    const map = mapRef.current;
    const marker = markerLookupRef.current[focusedBin];
    if (map && marker) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    }
  }, [focusedBin]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold text-sky-500">
          {t("dashboard.bin_monitoring.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("dashboard.bin_monitoring.subtitle")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[760px] overflow-hidden">
            <CardHeader>
              <CardTitle>{t("dashboard.bin_monitoring.map_title")}</CardTitle>
              <CardDescription>{t("dashboard.bin_monitoring.map_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[640px] w-full rounded-lg border-2 border-dashed border-border overflow-hidden bg-gradient-to-br from-secondary to-muted">
                <div ref={mapDivRef} className="absolute inset-0" />
                <BinSideDetailsPanel
                  bin={selectedBin}
                  open={panelOpen}
                  onToggle={() => setPanelOpen((v) => !v)}
                  onClose={() => setPanelOpen(false)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.bin_monitoring.all_bins_title")}</CardTitle>
              <CardDescription>{t("dashboard.bin_monitoring.all_bins_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] space-y-2 overflow-y-auto pr-1">
              <div>
                <input
                  type="text"
                  value={allBinSearch}
                  onChange={(event) => setAllBinSearch(event.target.value)}
                  placeholder={t("dashboard.bin_monitoring.search_placeholder")}
                  className="w-full rounded border border-border/70 px-2 py-1 text-xs outline-none focus:border-sky-500"
                />
              </div>
              {filteredAllBins.length ? (
                filteredAllBins.map((bin) => {
                  const meta = priorityConfig[bin.priority];
                  return (
                    <button
                      key={bin.id}
                      type="button"
                      onClick={() => handleSelectBin(bin)}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition hover:border-emerald-300"
                    >
                      <div>
                        <p className="text-sm font-semibold">{bin.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {bin.ward ?? t("dashboard.bin_monitoring.ward_na")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold" style={{ color: meta.color }}>
                          {getPriorityLabel(bin.priority)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {bin.colorCode ?? placeholderNa}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.bin_monitoring.no_matching_bins")}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.bin_monitoring.summary_title")}</CardTitle>
                <CardDescription>{t("dashboard.bin_monitoring.summary_subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {t("dashboard.bin_monitoring.high_priority")}
                  </p>
                  <p className="text-2xl font-bold">{highPriority.length}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {t("dashboard.bin_monitoring.medium_priority")}
                  </p>
                  <p className="text-2xl font-bold">
                    {prioritized.filter((bin) => bin.priority === "medium").length}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {t("dashboard.bin_monitoring.low_priority")}
                  </p>
                  <p className="text-2xl font-bold">
                    {prioritized.filter((bin) => bin.priority === "low").length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.bin_monitoring.high_bins_title")}</CardTitle>
                <CardDescription>{t("dashboard.bin_monitoring.high_bins_subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {highPriority.length ? (
                  highPriority.map((bin) => {
                    const meta = priorityConfig[bin.priority];
                    return (
                      <button
                        key={bin.id}
                        type="button"
                        onClick={() => handleSelectBin(bin)}
                        className="w-full rounded-lg border border-border px-3 py-3 text-left transition hover:border-emerald-300"
                        style={{ background: meta.bg }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{bin.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {bin.ward ?? t("dashboard.bin_monitoring.ward_na")}
                            </p>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: meta.color }}>
                            {getPriorityLabel(bin.priority)}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {t("dashboard.bin_monitoring.updated_at", {
                            time: bin.updatedAt ?? placeholderNa,
                          })}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.bin_monitoring.no_high_priority")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function BinSideDetailsPanel({
  bin,
  open,
  onToggle,
  onClose,
}: {
  bin: BinRecord | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const meta = bin ? priorityConfig[bin.priority] : null;
  const WIDTH = 260;
  const priorityLabel = bin
    ? bin.priority === "high"
      ? t("common.priority_high")
      : bin.priority === "medium"
      ? t("common.priority_medium")
      : t("common.priority_low")
    : t("dashboard.bin_monitoring.placeholder_na");

  return (
    <div
      className="absolute left-0 top-0 z-[700] h-full bg-white shadow-xl transition-transform duration-300"
      style={{
        width: WIDTH,
        transform: open ? "translateX(0)" : `translateX(-${WIDTH}px)`,
      }}
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-xs font-bold shadow"
      >
        {open ? "❮" : "❯"}
      </button>

      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-full border bg-white px-2 py-1 text-xs font-bold shadow"
      >
        ✕
      </button>

      <div className="h-full overflow-y-auto border-l">
        {bin ? (
          <>
            <div className="flex items-center gap-3 border-b p-3">
              <AnimatedBinIcon color={meta?.color} bg={meta?.bg} />
              <div>
                <h3 className="text-sm font-bold">{bin.name}</h3>
                <p className="text-[11px] text-gray-500">{priorityLabel}</p>
              </div>
            </div>

            <div className="space-y-4 p-3 text-xs">
              <Section title={t("dashboard.bin_monitoring.details.bin_info")}>
                <InfoRow label={t("dashboard.bin_monitoring.details.priority")} value={priorityLabel} />
                <InfoRow label={t("dashboard.bin_monitoring.details.status")} value={bin.status} />
                <InfoRow label={t("dashboard.bin_monitoring.details.color_code")} value={bin.colorCode} />
              </Section>

              <Section title={t("dashboard.bin_monitoring.details.location")}>
                <InfoRow label={t("dashboard.bin_monitoring.details.ward")} value={bin.ward} />
                <InfoRow label={t("dashboard.bin_monitoring.details.latitude")} value={bin.lat} />
                <InfoRow label={t("dashboard.bin_monitoring.details.longitude")} value={bin.lng} />
              </Section>

              <Section title={t("dashboard.bin_monitoring.details.updated")}>
                <InfoRow label={t("dashboard.bin_monitoring.details.last_update")} value={bin.updatedAt} />
              </Section>
            </div>
          </>
        ) : (
          <div className="p-3 text-xs text-gray-400">
            {t("dashboard.bin_monitoring.select_bin")}
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedBinIcon({
  color = "#16a34a",
  bg = "#dcfce7",
}: {
  color?: string;
  bg?: string;
}) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <span
        className="absolute inline-flex h-full w-full rounded-full animate-ping"
        style={{ backgroundColor: bg, opacity: 0.6 }}
      />
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

function InfoRow({ label, value }: { label: string; value: any }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">
        {value ?? t("dashboard.bin_monitoring.placeholder_na")}
      </span>
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
