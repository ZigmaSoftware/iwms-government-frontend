import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronDown, ChevronRight, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import {
  loadStateGeo, makeDistrictMatcher, resolveStateSlug,
  type DistrictFeature, type LatLng, type StateGeo,
} from "@/data/indiaGeo";
import { compactNumber } from "@/utils/compactNumber";
import type { Geometry } from "geojson";
import * as polygonClippingNs from "polygon-clipping";
import type { MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import {
  BRAND, BRAND_DEEP, LB_TYPES, MAP_DEEP, MAP_FILL, MAP_LINE, TYPE_CATEGORY as TYPE_CATEGORY_OF, TYPE_COLOR, TYPE_LABEL,
  type LocalBodyCategory, type LocalBodyType,
} from "./leaderMapTheme";

/* ─────────────────────────────────────────────────────────────────────
   Leader dashboard map (State + District portals).

   state mode    — the leader's whole state: every district as a polygon,
                   dashed state border, one bubble per district; clicking a
                   district reveals only that district's ULBs and RLBs.
   district mode — only the leader's own district, with all its ULBs/RLBs.

   Boundaries come from public/geo/states/<slug>.json (picked from the
   state name in the API payload); local bodies are drawn from their own
   master `coordinates` (3+ points → boundary, else a location pin).
   ──────────────────────────────────────────────────────────────────── */

export type MapMetric = "weight" | "trips" | "points";

type Stats = { weight: number; trips: number; points: number };

export type MapDistrict = Stats & {
  district_id: string;
  name: string;
  is_active: boolean;
  coordinates: LatLng[];
};

export type MapLocalBody = Stats & {
  id: string;
  type: LocalBodyType;
  category: LocalBodyCategory;
  name: string;
  district_id: string;
  is_active: boolean;
  coordinates: LatLng[];
  /** ward count (ULBs only) */
  wards?: number | null;
};

export type LeaderMapPayload = {
  scope: "state" | "district";
  state_id: string;
  state_name: string;
  district_id?: string;
  district_name?: string;
  month: string;
  source: string;
  districts: MapDistrict[];
  local_bodies: MapLocalBody[];
  totals: Stats;
};

// one colour for the state map — the same violet the dashboard charts use
// one light sky-blue for the whole map (districts and local bodies alike)
/* colours per portal: the state map is violet (the charts' accent) with each
   local-body type in its own colour; the district map is one light sky-blue
   for the district and all its local bodies */
type MapPalette = { fill: string; line: string; deep: string; typedLocalBodies: boolean };
const PALETTES: Record<"state" | "district", MapPalette> = {
  state: { fill: BRAND, line: BRAND, deep: BRAND_DEEP, typedLocalBodies: true },
  district: { fill: MAP_FILL, line: MAP_LINE, deep: MAP_DEEP, typedLocalBodies: false },
};
const FILL_INACTIVE = "#cbd5e1";
/* paint order: biggest areas underneath */
const DRAW_ORDER: MapLocalBody["type"][] = ["panchayat_union", "panchayat", "town_panchayat", "municipality", "corporation"];
/* local bodies are drawn like the district choropleth: a soft fill in the
   type's colour with thin white borders between neighbours, inside the open
   district's dashed red outline (same style as the state border).
   A panchayat union covers the same ground as its village panchayats, so it
   is only filled when it is the type being shown on its own — otherwise it
   contributes just its borders and the villages carry the fill. */
const districtOutline = (pal: MapPalette) => ({ color: pal.line, weight: 2.2, dashArray: "6 5", opacity: 0.95, fill: false, lineJoin: "round" as const });
const lbStyle = (type: MapLocalBody["type"], filter: string, hover = false) => {
  const filled = type !== "panchayat_union" || filter === "panchayat_union";
  return {
    color: "#ffffff",
    weight: type === "panchayat_union" && !filled ? 2 : 1,
    opacity: 1,
    fillOpacity: filled ? (hover ? 0.5 : 0.3) : 0,
  };
};

/* local-body boundaries (LGD/SBM survey data) and the district outlines
   (bundled public GeoJSON) come from different sources and disagree by up
   to a km or two at the edges, so each body is trimmed to the open
   district's outline before drawing; bodies wholly outside it are left out */
type LngLat = [number, number];
// the package's ESM build exposes its functions on a default export while
// its typings declare them as named exports — accept either shape
const polygonClipping =
  (polygonClippingNs as unknown as { default?: typeof polygonClippingNs }).default ?? polygonClippingNs;
const featureToClip = (f: DistrictFeature): ClipMultiPolygon =>
  f.geometry.type === "Polygon"
    ? [f.geometry.coordinates as LngLat[][]]
    : (f.geometry.coordinates as LngLat[][][]);

const pointInRing = ([x, y]: LngLat, ring: LngLat[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const pointInClip = (p: LngLat, clip: ClipMultiPolygon) =>
  clip.some(([outer, ...holes]) => pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h)));

/* ── "only my state" mask: a world-sized rectangle with the leader's
   state (or district) cut out of it, so neighbouring states, the sea and
   their place names are hidden while the scope keeps its basemap ── */
const MASK_COLOR = "#f1f5f9"; // = the map container background
const WORLD_RING: LatLng[] = [[-85, -180], [85, -180], [85, 180], [-85, 180]];
const outerRings = (g: Geometry): LatLng[][] => {
  if (g.type === "Polygon") return [g.coordinates[0].map(([x, y]) => [y, x] as LatLng)];
  if (g.type === "MultiPolygon") return g.coordinates.map((poly) => poly[0].map(([x, y]) => [y, x] as LatLng));
  if (g.type === "GeometryCollection") return g.geometries.flatMap(outerRings);
  return [];
};

/** a local body as drawn: its rings (lat/lng) already trimmed to the district */
type DrawnLocalBody = { lb: MapLocalBody; rings: LatLng[][][] | null; point: LatLng | null };

export type LbFilter = "all" | LocalBodyCategory | LocalBodyType;
const matchesFilter = (lb: MapLocalBody, f: LbFilter) => f === "all" || f === lb.category || f === lb.type;


const fmtFull = (v: number, dec = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: dec });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const statLines = (s: Stats) => `
  <span>Weight: <i>${fmtFull(s.weight, 2)} kg</i></span>
  <span>Trips: <i>${fmtFull(s.trips)}</i></span>
  <span>Points covered: <i>${fmtFull(s.points)}</i></span>`;

const centroid = (pts: LatLng[]): LatLng => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];

const bubbleIcon = (value: number, max: number, color: string, base: number, spread: number, selected = false) => {
  const empty = value <= 0;
  const size = empty ? base - 4 : Math.round(base + spread * Math.sqrt(value / Math.max(max, 1)));
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="lgm-bubble${empty ? " lgm-empty" : ""}${selected ? " lgm-sel" : ""}" style="--c:${color};width:${size}px;height:${size}px;font-size:${size > 44 ? 13 : size > 30 ? 11 : 10}px">${compactNumber(value)}</div>`,
  });
};

export default function LeaderGeoMap({
  mode,
  data,
  metric = "weight",
  selectedDistrictId = null,
  onSelectDistrict,
  lbFilter: lbFilterProp,
  onLbFilterChange,
  showSummary = true,
  topLeft,
  localBodies = true,
  selectedLocalBodyId = null,
  onSelectLocalBody,
}: {
  mode: "state" | "district";
  data: LeaderMapPayload | null;
  /** what the district bubbles (state mode) show */
  metric?: MapMetric;
  selectedDistrictId?: string | null;
  onSelectDistrict?: (districtId: string | null) => void;
  /** controlled ULB/RLB filter (falls back to internal state) */
  lbFilter?: LbFilter;
  onLbFilterChange?: (f: LbFilter) => void;
  /** "kg · trips · local bodies" pill in the top-right corner */
  showSummary?: boolean;
  /** extra control in the top-left corner (e.g. a Map / List toggle) */
  topLeft?: ReactNode;
  /** false: district-level map only — clicking a district just selects it
   *  (highlight + callback), no ULB/RLB layer, filter or hint */
  localBodies?: boolean;
  /** a local body picked on the map (click a ULB/RLB → callback); the pick
   *  is drawn with a dark outline and the others fade back */
  selectedLocalBodyId?: string | null;
  onSelectLocalBody?: (localBodyId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const maskRef = useRef<L.LayerGroup | null>(null);
  const pal = PALETTES[mode];
  const onSelectRef = useRef(onSelectDistrict);
  useEffect(() => {
    onSelectRef.current = onSelectDistrict;
  }, [onSelectDistrict]);
  const onSelectLbRef = useRef(onSelectLocalBody);
  useEffect(() => {
    onSelectLbRef.current = onSelectLocalBody;
  }, [onSelectLocalBody]);

  const [geo, setGeo] = useState<StateGeo | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  /* which local bodies to show: everything, one category, or one type */
  const [lbFilterState, setLbFilterState] = useState<LbFilter>("all");
  const lbFilter = lbFilterProp ?? lbFilterState;
  const setLbFilter = (f: LbFilter) => {
    setLbFilterState(f);
    onLbFilterChange?.(f);
  };
  const [legendOpen, setLegendOpen] = useState(false);

  /* ── load the state's boundary file ── */
  const slug = resolveStateSlug(data?.state_name);
  const hasData = !!data;
  useEffect(() => {
    if (!hasData) return;
    if (!slug) {
      setGeo(null);
      setGeoStatus("missing");
      return;
    }
    let cancelled = false;
    setGeoStatus("loading");
    loadStateGeo(slug)
      .then((g) => { if (!cancelled) { setGeo(g); setGeoStatus("ready"); } })
      .catch(() => { if (!cancelled) { setGeo(null); setGeoStatus("missing"); } });
    return () => { cancelled = true; };
  }, [slug, hasData]);

  /* ── join API districts to boundary features ── */
  const joined = useMemo(() => {
    const featureById = new Map<string, DistrictFeature>();
    const districtsByFeature = new Map<string, MapDistrict[]>();
    const unmatched: string[] = [];
    if (data && geo) {
      const match = makeDistrictMatcher(geo);
      for (const d of data.districts) {
        const f = match(d.name);
        if (!f) { unmatched.push(d.name); continue; }
        featureById.set(d.district_id, f);
        districtsByFeature.set(f.properties.name, [...(districtsByFeature.get(f.properties.name) ?? []), d]);
      }
    }
    return { featureById, districtsByFeature, unmatched };
  }, [data, geo]);

  /* ── map + basemap, once ── */
  useEffect(() => {
    if (!containerRef.current) return;
    // whole zoom levels only: at fractional scales Leaflet's plus-lighter tile
    // blending turns tile edges into white hairlines (and labels go blurry)
    const map = L.map(containerRef.current, { zoomControl: false, minZoom: 4, maxZoom: 16, zoomSnap: 1 });
    // Esri Light Gray: keyless, muted basemap. Pane order: tiles (200) <
    // place names (320) < outside-scope mask (350) < our overlays (400), so
    // the mask hides neighbouring places and their names; the light fills
    // drawn over names inside the scope keep them readable
    const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    const attribution = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
    L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution, maxZoom: 16 }).addTo(map);
    const labels = map.createPane("lgm-labels");
    labels.style.zIndex = "320";
    labels.style.pointerEvents = "none";
    L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { pane: "lgm-labels", maxZoom: 16 }).addTo(map);
    // no initial view: the first fit (below) opens straight on the leader's
    // scope, so no India-level tiles are left scaled behind it

    const maskPane = map.createPane("lgm-mask");
    maskPane.style.zIndex = "350";
    maskPane.style.pointerEvents = "none";
    maskRef.current = L.layerGroup().addTo(map);

    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // after a drag Leaflet can miss a shape's mouseout, leaving its sticky
    // hover tooltip open while the next shape opens another — so keep at
    // most one hover tooltip open, and close it on drag / zoom / leaving
    const closeTooltips = (except?: L.Tooltip) =>
      map.eachLayer((l) => {
        if (l.getTooltip() && l.getTooltip() !== except && !l.getTooltip()?.options.permanent) l.closeTooltip();
      });
    map.on("tooltipopen", (e) => closeTooltips((e as L.TooltipEvent).tooltip));
    map.on("dragstart zoomstart", () => closeTooltips());
    containerRef.current.addEventListener("mouseleave", () => closeTooltips());

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      maskRef.current = null;
    };
  }, []);

  /* bounds of the leader's scope (state outline / own district / its local bodies) */
  const scopeBounds = useMemo((): L.LatLngBounds | null => {
    if (!data) return null;
    if (mode === "state" && geo) return L.geoJSON(geo.outline).getBounds();
    if (mode === "district") {
      const own = data.districts[0];
      const f = own && joined.featureById.get(own.district_id);
      if (f) return L.geoJSON(f).getBounds();
      if (own && own.coordinates.length >= 3) return L.latLngBounds(own.coordinates);
    }
    const pts = data.local_bodies.flatMap((lb) => lb.coordinates);
    return pts.length ? L.latLngBounds(pts).pad(0.2) : null;
  }, [data, geo, mode, joined]);

  /* the scope's outline rings (state outline / own district) — the holes in the mask */
  const scopeRings = useMemo((): LatLng[][] | null => {
    if (!data) return null;
    if (mode === "state") return geo ? outerRings(geo.outline) : null;
    const own = data.districts[0];
    const f = own && joined.featureById.get(own.district_id);
    if (f) return outerRings(f.geometry);
    return own && own.coordinates.length >= 3 ? [own.coordinates] : null;
  }, [data, geo, mode, joined]);

  const fitScope = () => {
    const map = mapRef.current;
    if (map && scopeBounds?.isValid()) map.flyToBounds(scopeBounds, { padding: [16, 16], duration: 0.6 });
  };

  /* fit once whenever the scope itself changes (not on every redraw) */
  const scopeKey = `${mode}|${data?.state_id}|${data?.district_id}|${geoStatus}|${scopeBounds?.toBBoxString()}`;
  const viewSetRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    maskRef.current?.clearLayers();
    if (scopeBounds?.isValid()) {
      // lock the view to the scope: no panning off to the rest of India and
      // no zooming out past the fitted view (zoom in stays free)
      map.setMaxBounds(undefined as unknown as L.LatLngBounds);
      map.setMinZoom(1);
      map.fitBounds(scopeBounds, { padding: [16, 16], animate: false });
      map.setMinZoom(map.getZoom());
      map.setMaxBounds(scopeBounds.pad(0.3));
      map.options.maxBoundsViscosity = 1;
      if (scopeRings?.length)
        L.polygon([WORLD_RING, ...scopeRings], {
          pane: "lgm-mask", stroke: false, fillColor: MASK_COLOR, fillOpacity: 1, interactive: false,
        }).addTo(maskRef.current!);
    } else if (!viewSetRef.current && data && geoStatus !== "loading") map.setView([22.5, 79], 5); // nothing to frame: India
    else return;
    viewSetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  /* which districts' ULB/RLB are drawn: the leader's own district, or (state
     mode) only the clicked one — plus any DB districts folded onto the same
     shape (e.g. Mayiladuthurai on Nagapattinam) */
  const lbDistrictIds = useMemo((): Set<string> | null => {
    if (mode === "district") return null; // payload is already one district
    if (!selectedDistrictId || !localBodies) return new Set();
    const f = joined.featureById.get(selectedDistrictId);
    const members = f ? joined.districtsByFeature.get(f.properties.name) ?? [] : [];
    return new Set([selectedDistrictId, ...members.map((m) => m.district_id)]);
  }, [mode, selectedDistrictId, joined, localBodies]);

  const visibleLbs = useMemo(
    () => (data?.local_bodies ?? []).filter((lb) => !lbDistrictIds || lbDistrictIds.has(lb.district_id)),
    [data, lbDistrictIds]
  );

  /* the open district's outline, as the clip boundary for its local bodies */
  const clipFeature = useMemo((): DistrictFeature | null => {
    const id = mode === "district" ? data?.districts[0]?.district_id : selectedDistrictId;
    return id ? joined.featureById.get(id) ?? null : null;
  }, [mode, data, selectedDistrictId, joined]);

  const { drawnLbs, outsideCount } = useMemo(() => {
    const clip = clipFeature ? featureToClip(clipFeature) : null;
    const drawn: DrawnLocalBody[] = [];
    let outside = 0;
    for (const lb of visibleLbs) {
      if (!lb.coordinates.length) continue;
      const lngLat = lb.coordinates.map(([lat, lng]) => [lng, lat] as LngLat);
      if (lb.coordinates.length < 3) {
        const p = centroid(lb.coordinates);
        if (clip && !pointInClip([p[1], p[0]], clip)) { outside += 1; continue; }
        drawn.push({ lb, rings: null, point: p });
        continue;
      }
      let parts: ClipMultiPolygon = [[lngLat]];
      if (clip) {
        try {
          parts = polygonClipping.intersection([lngLat], clip);
        } catch {
          // degenerate geometry: draw it untrimmed rather than lose it
        }
        if (!parts.length) { outside += 1; continue; }
      }
      drawn.push({ lb, rings: parts.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLng))), point: null });
    }
    return { drawnLbs: drawn, outsideCount: outside };
  }, [visibleLbs, clipFeature]);

  /* ── draw overlays ── */
  useEffect(() => {
    const layer = overlayRef.current;
    if (!layer || !data) return;
    layer.clearLayers();

    // the open district's outline is drawn after its local bodies (whose
    // trimmed edges run along it) so it stays on top and reads as one bold line
    const openOutlines: DistrictFeature[] = [];

    /* district polygons */
    const features: DistrictFeature[] =
      mode === "state"
        ? geo?.features ?? []
        : (() => {
            const own = data.districts[0];
            const f = own && joined.featureById.get(own.district_id);
            return f ? [f] : [];
          })();

    for (const f of features) {
      const members = joined.districtsByFeature.get(f.properties.name) ?? [];
      const active = members.some((m) => m.is_active);
      const sel = members.some((m) => m.district_id === selectedDistrictId);
      const stats = members.reduce<Stats>(
        (a, m) => ({ weight: a.weight + m.weight, trips: a.trips + m.trips, points: a.points + m.points }),
        { weight: 0, trips: 0, points: 0 }
      );
      const merged = members.filter((m) => m.name.toLowerCase() !== f.properties.name.toLowerCase()).map((m) => m.name);
      const tip = `<div class="lgm-tip"><b>${esc(f.properties.name)}</b>${
        merged.length ? `<span class="lgm-sub">incl. ${esc(merged.join(", "))}</span>` : ""
      }${members.length ? (active ? "" : `<span class="lgm-sub">Inactive</span>`) + statLines(stats) : "<span>Not configured</span>"}</div>`;

      // the open district is left unfilled (its local bodies are outlined inside
      // it); with one open, the other districts fade back
      // with the ULB/RLB layer off a selected district keeps its fill and
      // bubble and just gains the dashed outline
      const open = mode === "district" || (sel && localBodies);
      const baseOpacity = open ? 0 : selectedDistrictId ? 0.12 : 0.28;
      const poly = L.geoJSON(f, {
        style: {
          color: "#ffffff",
          weight: open ? 0 : 1,
          fillColor: members.length && active ? pal.fill : FILL_INACTIVE,
          fillOpacity: baseOpacity,
        },
      })
        .bindTooltip(tip, { sticky: true, direction: "top", className: "lgm-tooltip" })
        .on("mouseover", () => { if (!open) poly.setStyle({ fillOpacity: baseOpacity + 0.12 }); })
        .on("mouseout", () => { if (!open) poly.setStyle({ fillOpacity: baseOpacity }); })
        .addTo(layer);
      if (open || sel) openOutlines.push(f);
      if (mode === "state" && members[0]) poly.on("click", () => onSelectRef.current?.(members[0].district_id));
      if (sel) poly.bringToFront();

      /* district bubble (state mode) — the open district shows its local bodies instead */
      if (mode === "state" && members.length && !(sel && localBodies) && stats[metric] > 0) {
        const max = Math.max(0, ...data.districts.map((d) => d[metric]));
        L.marker(f.properties.center, { icon: bubbleIcon(stats[metric], max, pal.deep, 30, 32, sel), riseOnHover: true })
          .bindTooltip(tip, { direction: "top", offset: [0, -14], className: "lgm-tooltip" })
          .on("click", () => onSelectRef.current?.(members[0].district_id))
          .addTo(layer);
      }
    }

    /* district without a boundary file match: fall back to its DB polygon */
    if (mode === "district" && !features.length) {
      const own = data.districts[0];
      if (own && own.coordinates.length >= 3)
        L.polygon(own.coordinates, { ...districtOutline(pal), interactive: false }).addTo(layer);
    }

    /* state border */
    if (mode === "state" && geo)
      L.geoJSON(geo.outline, { style: { color: pal.line, weight: 1.6, dashArray: "6 5", opacity: 0.85, fill: false }, interactive: false }).addTo(layer);

    /* ULB / RLB of the open district only — geofences (trimmed to the
       district) outlined in their type's colour; bodies with just a location
       get a dot. Larger areas first so smaller bodies' borders sit on top. */
    {
      const lbs = drawnLbs
        .filter((d) => matchesFilter(d.lb, lbFilter))
        .sort((x, y) => DRAW_ORDER.indexOf(x.lb.type) - DRAW_ORDER.indexOf(y.lb.type));
      const districtName = new Map(data.districts.map((d) => [d.district_id, d.name]));
      for (const { lb, rings, point } of lbs) {
        const color = pal.typedLocalBodies ? TYPE_COLOR[lb.type] : pal.fill;
        const tip = `<div class="lgm-tip"><b>${esc(lb.name)}</b><span class="lgm-sub">${TYPE_LABEL[lb.type]} · ${
          lb.category.toUpperCase()
        }${districtName.get(lb.district_id) ? ` · ${esc(districtName.get(lb.district_id)!)}` : ""}${lb.is_active ? "" : " · Inactive"}</span>${statLines(lb)}</div>`;
        // with a local body picked, it gets a dark outline + fuller fill and
        // the rest fade back
        const picked = selectedLocalBodyId === lb.id;
        const style = (hover = false) => {
          const base = lbStyle(lb.type, lbFilter, hover);
          if (!selectedLocalBodyId) return base;
          return picked
            ? { ...base, color: pal.deep, weight: 3, fillOpacity: 0.6 }
            : { ...base, fillOpacity: base.fillOpacity * 0.35 };
        };
        const shape = rings
          ? L.polygon(rings, { fillColor: color, lineJoin: "round", ...style() })
          : L.circleMarker(point!, {
              radius: picked ? 8 : 6, color: picked ? pal.deep : "#ffffff", weight: picked ? 3 : 2, fillColor: color,
              fillOpacity: selectedLocalBodyId && !picked ? 0.35 : 1,
            });
        shape
          .bindTooltip(tip, { sticky: true, direction: "top", className: "lgm-tooltip" })
          .on("mouseover", () => { if (!(shape instanceof L.CircleMarker)) shape.setStyle(style(true)); })
          .on("mouseout", () => { if (!(shape instanceof L.CircleMarker)) shape.setStyle(style()); })
          .addTo(layer);
        if (onSelectLbRef.current) shape.on("click", () => onSelectLbRef.current?.(picked ? null : lb.id));
        if (picked) shape.bringToFront();
      }
    }

    for (const f of openOutlines) L.geoJSON(f, { style: districtOutline(pal), interactive: false }).addTo(layer);
  }, [data, geo, joined, mode, pal, metric, selectedDistrictId, drawnLbs, lbFilter, localBodies, selectedLocalBodyId]);

  /* zoom to a picked local body (it can be a few pixels wide at district zoom) */
  useEffect(() => {
    const map = mapRef.current;
    const d = selectedLocalBodyId ? drawnLbs.find((x) => x.lb.id === selectedLocalBodyId) : null;
    if (!map || !d) return;
    const bounds = d.rings ? L.latLngBounds(d.rings.flat(2) as LatLng[]) : L.latLngBounds([d.point!, d.point!]);
    map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.6 });
    // only when the pick itself changes, not on every redraw of the layers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocalBodyId]);

  /* zoom to the selected district (state mode) */
  useEffect(() => {
    const map = mapRef.current;
    // district-only maps keep the whole state in view; the pick is just a highlight
    const f = selectedDistrictId && localBodies ? joined.featureById.get(selectedDistrictId) : null;
    if (map && f) map.flyToBounds(L.geoJSON(f).getBounds(), { padding: [40, 40], maxZoom: 11, duration: 0.6 });
  }, [selectedDistrictId, joined, localBodies]);

  /* legend counts follow what is drawn (the open district), else the whole scope */
  const lbCounts = useMemo(() => {
    const open = mode === "district" || !!selectedDistrictId;
    const lbs = open ? drawnLbs.map((d) => d.lb) : data?.local_bodies ?? [];
    const byType = {} as Record<LocalBodyType, number>;
    for (const t of LB_TYPES) byType[t] = 0;
    for (const l of lbs) byType[l.type] += 1;
    return {
      total: lbs.length,
      ulb: lbs.filter((l) => l.category === "ulb").length,
      rlb: lbs.filter((l) => l.category === "rlb").length,
      byType,
      unplaced: (open ? visibleLbs : lbs).filter((l) => !l.coordinates.length).length,
    };
  }, [data, mode, selectedDistrictId, drawnLbs, visibleLbs]);
  const lbsOnMap = mode === "district" || (!!selectedDistrictId && localBodies);

  const ctrl = "flex h-9 w-9 items-center justify-center bg-white text-slate-700 transition-colors hover:bg-slate-50";
  const chip = (on: boolean) =>
    `pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition-colors ${
      on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-gray-700 hover:bg-slate-50"
    }`;
  const filterButton = (f: LbFilter, label: string, count: number, color?: string) => (
    <button key={f} onClick={() => setLbFilter(f)} className={chip(lbFilter === f)} title={`Show ${label}`}>
      {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/70" style={{ background: color }} />}
      {label}
      <span className={`tabular-nums ${lbFilter === f ? "text-white/70" : "text-gray-500"}`}>{fmtFull(count)}</span>
    </button>
  );

  return (
    <div className="relative isolate h-full w-full">
      <style>{`
        .lgm-bubble{display:flex;align-items:center;justify-content:center;border-radius:9999px;
          background:var(--c);color:#fff;font-weight:700;border:2px solid rgba(255,255,255,.85);
          box-shadow:0 2px 8px rgba(15,23,42,.3);cursor:pointer;transition:transform .15s ease;font-variant-numeric:tabular-nums}
        .lgm-bubble:hover{transform:scale(1.08)}
        .lgm-bubble.lgm-empty{background:#94a3b8;box-shadow:0 1px 4px rgba(15,23,42,.2)}
        .lgm-bubble.lgm-sel{outline:3px solid var(--c);outline-offset:2px}
        .lgm-tooltip{border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 10px 24px -8px rgba(15,23,42,.25);padding:8px 10px}
        .lgm-tip{display:flex;flex-direction:column;gap:1px;font-size:11px;color:#475569}
        .lgm-tip b{font-size:12px;color:#0f172a;margin-bottom:2px}
        .lgm-tip i{font-style:normal;font-weight:600;color:#0f172a}
        .lgm-tip .lgm-sub{color:#94a3b8;font-size:10px}
      `}</style>
      <div ref={containerRef} className="h-full w-full bg-slate-100" />

      {/* status */}
      {(!data || geoStatus === "loading") && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      )}

      {/* top bar: [slot][ULB/RLB filter] ……… [summary | hint] */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {topLeft && <div className="pointer-events-auto">{topLeft}</div>}
          {data && lbsOnMap && (
            <>
              {filterButton("all", "All", lbCounts.total)}
              {(["ulb", "rlb"] as const).map((c) => (
                <span key={c} className="contents">
                  {LB_TYPES.filter((t) => TYPE_CATEGORY_OF[t] === c).map((t) =>
                    filterButton(t, TYPE_LABEL[t], lbCounts.byType[t], pal.typedLocalBodies ? TYPE_COLOR[t] : undefined)
                  )}
                </span>
              ))}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {data && showSummary && (
            <div className="flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] text-gray-500 shadow-sm">
              <b className="tabular-nums" style={{ color: pal.deep }}>{compactNumber(data.totals.weight)}</b> kg ·
              <b className="tabular-nums text-gray-900">{fmtFull(data.totals.trips)}</b> trips
              {localBodies && (
                <>
                  {" "}·<b className="tabular-nums text-gray-900">{fmtFull(lbCounts.total)}</b> local bodies
                </>
              )}
            </div>
          )}
          {mode === "state" && localBodies && geoStatus === "ready" && !selectedDistrictId && (
            <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-gray-600 shadow-sm">
              Click a district to see its ULBs &amp; RLBs
            </div>
          )}
          {data && geoStatus === "missing" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700 shadow-sm">
              No boundary map for “{data.state_name || "this state"}” — local bodies only
            </div>
          )}
        </div>
      </div>

      {/* legend (collapsible; data-quality notes stay visible in the header) */}
      <div className="absolute bottom-3 left-3 z-[1000] max-w-[320px] rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] text-gray-600 shadow-md">
        <button onClick={() => setLegendOpen((v) => !v)} className="flex w-full items-center gap-1.5 text-left">
          <span className="flex items-center gap-0.5 font-semibold text-gray-800">
            Legend {legendOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {(() => {
            const notes = [
    lbsOnMap && outsideCount > 0 ? `${outsideCount} outside boundary` : null,
    lbCounts.unplaced > 0 ? `${lbCounts.unplaced} no coordinates` : null,
    joined.unmatched.length ? `${joined.unmatched.length} district${joined.unmatched.length > 1 ? "s" : ""} not on map` : null,
  ].filter(Boolean);
            return notes.length ? <span className="text-[10px] text-amber-600">{notes.join(" · ")}</span> : null;
          })()}
        </button>
        {legendOpen && (
          <div className="mt-1.5 space-y-0.5 pb-0.5">
            {mode === "state" && (
              <>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.deep }} /> District with data</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Inactive / not configured</p>
              </>
            )}
            {lbsOnMap && pal.typedLocalBodies && LB_TYPES.map((t) => (
              <p key={t} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
                {TYPE_LABEL[t]} <span className="text-gray-400">({TYPE_CATEGORY_OF[t].toUpperCase()})</span>
              </p>
            ))}
            {lbsOnMap && !pal.typedLocalBodies && (
              <>
                <p className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: pal.fill, opacity: 0.6 }} /> Local body (ULB / RLB)
                </p>
                {onSelectLocalBody && (
                  <p className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm border-2" style={{ borderColor: pal.deep, background: pal.fill }} /> Selected local body
                  </p>
                )}
                <p className="pl-4 text-[10px] text-gray-400">Use the buttons above to show one type</p>
              </>
            )}
            <p className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: pal.line }} /> {mode === "state" ? "State / open district border" : "District border"}</p>
            {joined.unmatched.length > 0 && (
              <p className="text-[10px] text-amber-600">Not on map: {joined.unmatched.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => { onSelectDistrict?.(null); fitScope(); }}
          className={`${ctrl} rounded-full shadow-md ring-1 ring-slate-200`}
          title={mode === "state" ? "Show whole state" : "Show whole district"}
        >
          <Maximize2 size={15} />
        </button>
        <div className="overflow-hidden rounded-xl shadow-md ring-1 ring-slate-200">
          <button onClick={() => mapRef.current?.zoomIn()} className={`${ctrl} border-b border-slate-200`} title="Zoom in"><Plus size={16} /></button>
          <button onClick={() => mapRef.current?.zoomOut()} className={ctrl} title="Zoom out"><Minus size={16} /></button>
        </div>
      </div>
    </div>
  );
}
