import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronDown, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import type { Geometry } from "geojson";
import * as polygonClippingNs from "polygon-clipping";
import type { MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import {
  loadStateGeo, makeDistrictMatcher, resolveStateSlug,
  type DistrictFeature, type LatLng, type StateGeo,
} from "@/data/indiaGeo";
import { LB_TYPES, TYPE_CATEGORY, TYPE_COLOR, TYPE_LABEL } from "./leaderMapTheme";
import { PIN_STATUS, pinState } from "./grievanceMapTheme";
import type {
  GrievanceAreaDetail, GrievanceCounts, GrievanceDistrictMap, GrievanceMapDistrict,
  GrievanceMapLocalBody, GrievanceStateMap,
} from "@/features/complaintTicketing/types";

/* ─────────────────────────────────────────────────────────────────────
   Public complaint map (Public Grievance portal), three drill-down levels:

   state       every district shaded by its open complaints (one blue ramp,
               light → dark), a bubble with the count; click → district
   district    only that district, its ULBs / RLBs drawn from their own
               geofences in their type's colour (as on the leader map),
               trimmed to the district outline; click → local body
   local body  only that body's geofence, with one pin per complaint
               coloured by state (open / escalated / resolved)

   At every level everything outside the current scope is masked out.
   ──────────────────────────────────────────────────────────────────── */

export type GrievanceLbFilter = "all" | "ulb" | "rlb" | GrievanceMapLocalBody["type"];

/** sequential blue (dataviz reference ramp, steps 100 → 550) for open complaints */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#1c5cab"];
const RAMP_EMPTY = "#e2e8f0";
const BUBBLE = "#0d366b";
const SCOPE_LINE = "#0A5C36";
/** a body without a geofence is framed with the pins within this distance */
const NEAR_METERS = 25_000;


const rampColor = (value: number, max: number) =>
  value <= 0 ? RAMP_EMPTY : RAMP[Math.min(RAMP.length - 1, Math.floor((value / Math.max(max, 1)) * RAMP.length))];

type LngLat = [number, number];
// the package's ESM build exposes its functions on a default export while
// its typings declare them as named exports — accept either shape
const polygonClipping =
  (polygonClippingNs as unknown as { default?: typeof polygonClippingNs }).default ?? polygonClippingNs;
const featureToClip = (f: DistrictFeature): ClipMultiPolygon =>
  f.geometry.type === "Polygon" ? [f.geometry.coordinates as LngLat[][]] : (f.geometry.coordinates as LngLat[][][]);

const MASK_COLOR = "#f1f5f9";
const WORLD_RING: LatLng[] = [[-85, -180], [85, -180], [85, 180], [-85, 180]];
const outerRings = (g: Geometry): LatLng[][] => {
  if (g.type === "Polygon") return [g.coordinates[0].map(([x, y]) => [y, x] as LatLng)];
  if (g.type === "MultiPolygon") return g.coordinates.map((poly) => poly[0].map(([x, y]) => [y, x] as LatLng));
  if (g.type === "GeometryCollection") return g.geometries.flatMap(outerRings);
  return [];
};

const centroid = (pts: LatLng[]): LatLng => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];

const fmt = (v: number) => v.toLocaleString("en-IN");
/** A complaint pin: enlarged with a dark outline when it is the one being
 *  viewed, faded while another one is. */
const pinStyle = (color: string, ticketNo: string, activeNo: string | null | undefined): L.CircleMarkerOptions =>
  ticketNo === activeNo
    ? { radius: 11, color: "#0f172a", weight: 3, fillColor: color, fillOpacity: 1, opacity: 1 }
    : { radius: 7, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: activeNo ? 0.35 : 1, opacity: activeNo ? 0.5 : 1 };

const reportedAt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const countLines = (c: GrievanceCounts) => `
  <span>Open: <i>${fmt(c.open)}</i>${c.escalated ? ` · escalated <i>${fmt(c.escalated)}</i>` : ""}</span>
  <span>Resolved: <i>${fmt(c.resolved)}</i> · Total: <i>${fmt(c.total)}</i></span>`;

const bubbleIcon = (value: number, max: number, base: number, spread: number) => {
  const size = Math.round(base + spread * Math.sqrt(value / Math.max(max, 1)));
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="ggm-bubble" style="width:${size}px;height:${size}px;font-size:${size > 36 ? 12 : 10}px">${value}</div>`,
  });
};

/* even-odd point-in-polygon; works on [lat, lng] or [lng, lat] as long as
   the point and the rings use the same order */
const pointInRing = ([x, y]: [number, number], ring: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const pointInPolys = (p: [number, number], polys: [number, number][][][]) =>
  polys.some(([outer, ...holes]) => pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h)));

/* zoom drill-down: steps past the fitted view of each level that open the
   next level (or, zooming out, return to the one above) */
const ZOOM_INTO_DISTRICT = 2;
const ZOOM_INTO_LOCAL_BODY = 3;
const ZOOM_OUT_STEPS = 2;
/* when zooming into a district, a village panchayat / town is picked over
   the panchayat union drawn underneath it */
const HIT_ORDER: GrievanceMapLocalBody["type"][] = ["corporation", "municipality", "town_panchayat", "panchayat", "panchayat_union"];

const matchesFilter = (lb: GrievanceMapLocalBody, f: GrievanceLbFilter) => f === "all" || f === lb.category || f === lb.type;
const DRAW_ORDER: GrievanceMapLocalBody["type"][] = ["panchayat_union", "panchayat", "town_panchayat", "municipality", "corporation"];

export default function GrievanceGeoMap({
  state,
  district,
  area,
  lbFilter = "all",
  focusPin = null,
  onPickPin,
  loading = false,
  onSelectDistrict,
  onSelectLocalBody,
  onZoomOut,
}: {
  state: GrievanceStateMap | null;
  /** set → district level */
  district: GrievanceDistrictMap | null;
  /** set → local-body level */
  area: GrievanceAreaDetail | null;
  lbFilter?: GrievanceLbFilter;
  /** ticket_no of a pin to fly to and open */
  focusPin?: string | null;
  /** a complaint pin was clicked on the map */
  onPickPin?: (ticketNo: string) => void;
  loading?: boolean;
  onSelectDistrict?: (d: GrievanceMapDistrict) => void;
  onSelectLocalBody?: (lb: GrievanceMapLocalBody) => void;
  /** zoomed out past the current level's view: go up one level */
  onZoomOut?: () => void;
}) {
  const level: "state" | "district" | "local_body" = area ? "local_body" : district ? "district" : "state";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const maskRef = useRef<L.LayerGroup | null>(null);
  const pinLayers = useRef(new Map<string, L.CircleMarker>());
  // each pin's own colour, to restore it when another complaint is picked
  const pinColors = useRef(new Map<string, string>());
  // pulsing "Viewing" ring around the picked complaint's pin
  const activeRing = useRef<L.Marker | null>(null);
  // read by the pin drawing below, so a redraw keeps the picked pin highlighted
  const focusPinRef = useRef(focusPin);
  focusPinRef.current = focusPin;
  // latest pick handler, read from the pins' click events without redrawing them
  const onPickPinRef = useRef(onPickPin);
  onPickPinRef.current = onPickPin;
  const cbRef = useRef({ onSelectDistrict, onSelectLocalBody, onZoomOut });
  useEffect(() => {
    cbRef.current = { onSelectDistrict, onSelectLocalBody, onZoomOut };
  }, [onSelectDistrict, onSelectLocalBody, onZoomOut]);
  /* zoom drill-down: the zoom the current level was fitted at (null while
     the map is moving on its own, so its own animations never navigate),
     and the handler the map's zoomend listener calls */
  const baseZoomRef = useRef<number | null>(null);
  const autoMoveRef = useRef(0);
  /** the whole-state view's zoom — the map never zooms out past it */
  const stateZoomRef = useRef<number | null>(null);
  const onUserZoomRef = useRef<() => void>(() => {});

  const [geo, setGeo] = useState<StateGeo | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);

  /* ── the state's district boundaries (bundled GeoJSON) ── */
  const stateName = area?.state_name || district?.state_name || state?.state_name || null;
  const slug = resolveStateSlug(stateName);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    loadStateGeo(slug).then((g) => !cancelled && setGeo(g)).catch(() => !cancelled && setGeo(null));
    return () => { cancelled = true; };
  }, [slug]);

  const match = useMemo(() => (geo ? makeDistrictMatcher(geo) : null), [geo]);

  /* districts per shape (a shape can carry more than one DB district,
     e.g. Mayiladuthurai is drawn on Nagapattinam) */
  const districtsByFeature = useMemo(() => {
    const out = new Map<string, GrievanceMapDistrict[]>();
    if (!match || !state) return out;
    for (const d of state.districts) {
      const f = match(d.name);
      if (f) out.set(f.properties.name, [...(out.get(f.properties.name) ?? []), d]);
    }
    return out;
  }, [match, state]);

  const districtName = area?.district_name || district?.district_name || null;
  const districtFeature = useMemo(
    () => (match && districtName ? match(districtName) : null),
    [match, districtName]
  );

  /* ── map + basemap, once ── */
  useEffect(() => {
    if (!containerRef.current) return;
    // one wheel notch ≈ one zoom level, so zoom drill-down steps are predictable
    const map = L.map(containerRef.current, { zoomControl: false, minZoom: 5, maxZoom: 18, zoomSnap: 1, wheelPxPerZoomLevel: 100 });
    const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    const attribution = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
    L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution, maxZoom: 16, maxNativeZoom: 16 } as L.TileLayerOptions).addTo(map);
    const labels = map.createPane("ggm-labels");
    labels.style.zIndex = "320";
    labels.style.pointerEvents = "none";
    L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { pane: "ggm-labels", maxNativeZoom: 16, maxZoom: 18 }).addTo(map);
    const maskPane = map.createPane("ggm-mask");
    maskPane.style.zIndex = "350";
    maskPane.style.pointerEvents = "none";
    maskRef.current = L.layerGroup().addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);
    map.setView([11.1, 78.6], 7); // Tamil Nadu until the scope is known
    mapRef.current = map;
    map.on("zoomend", () => onUserZoomRef.current());

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

  /* ── local bodies of the open district, trimmed to its outline ── */
  const drawnLbs = useMemo(() => {
    if (!district) return [];
    const clip = districtFeature ? featureToClip(districtFeature) : null;
    const out: { lb: GrievanceMapLocalBody; rings: LatLng[][][] | null; point: LatLng | null }[] = [];
    for (const lb of district.local_bodies) {
      if (!lb.coordinates.length) continue;
      if (lb.coordinates.length < 3) {
        out.push({ lb, rings: null, point: centroid(lb.coordinates) });
        continue;
      }
      let parts: ClipMultiPolygon = [[lb.coordinates.map(([lat, lng]) => [lng, lat] as LngLat)]];
      if (clip) {
        try {
          parts = polygonClipping.intersection(parts, clip);
        } catch {
          // degenerate geometry: draw it untrimmed rather than lose it
        }
        if (!parts.length) continue;
      }
      out.push({ lb, rings: parts.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLng))), point: null });
    }
    return out;
  }, [district, districtFeature]);

  /* ── scope outline (mask hole) and bounds for the current level ── */
  const scope = useMemo((): { rings: LatLng[][]; bounds: L.LatLngBounds } | null => {
    if (level === "local_body" && area) {
      const pts = area.local_body.coordinates;
      if (pts.length >= 3) return { rings: [pts], bounds: L.latLngBounds(pts) };
      // no geofence: frame the body's recorded location and the pins near it
      // (a mis-located pin far away would otherwise zoom out to all of India)
      const pins = area.tickets.map((t) => L.latLng(t.latitude, t.longitude));
      if (pts.length) {
        const at = L.latLng(centroid(pts));
        const near = pins.filter((p) => p.distanceTo(at) < NEAR_METERS);
        return { rings: [], bounds: L.latLngBounds([at, ...near]).extend(at.toBounds(3000)) };
      }
      return pins.length ? { rings: [], bounds: L.latLngBounds(pins).pad(0.3) } : null;
    }
    if (level === "district") {
      if (districtFeature) return { rings: outerRings(districtFeature.geometry), bounds: L.geoJSON(districtFeature).getBounds() };
      const pts = district?.district_coordinates ?? [];
      if (pts.length >= 3) return { rings: [pts], bounds: L.latLngBounds(pts) };
      const lbPts = drawnLbs.flatMap((d) => (d.rings ? d.rings.flat(2) as unknown as LatLng[] : [d.point!]));
      return lbPts.length ? { rings: [], bounds: L.latLngBounds(lbPts) } : null;
    }
    return geo ? { rings: outerRings(geo.outline), bounds: L.geoJSON(geo.outline).getBounds() } : null;
  }, [level, area, district, districtFeature, drawnLbs, geo]);

  /** run a map move of our own: zoom navigation pauses until it settles
   *  (`rearm`: the zoom it ends at becomes the level's fitted zoom) */
  const autoMove = (move: (map: L.Map) => void, rearm: boolean, onSettled?: (map: L.Map) => void) => {
    const map = mapRef.current;
    if (!map) return;
    const ticket = ++autoMoveRef.current;
    if (rearm) baseZoomRef.current = null;
    const settle = () => {
      if (ticket !== autoMoveRef.current) return;
      autoMoveRef.current = 0;
      if (rearm) baseZoomRef.current = Math.round(map.getZoom());
      onSettled?.(map);
    };
    map.once("moveend", settle);
    window.setTimeout(settle, 1500); // in case the view did not change
    move(map);
  };

  const fitScope = (animate = true) => {
    if (!scope?.bounds.isValid()) return;
    const bounds = scope.bounds;
    const isState = level === "state";
    autoMove(
      (map) => {
        // a whole zoom level (flyToBounds alone stops at fractional ones),
        // so zoom drill-down steps line up with the wheel's
        const zoom = Math.min(16, map.getBoundsZoom(bounds, false, L.point(48, 48)));
        if (animate) map.flyTo(bounds.getCenter(), zoom, { duration: 0.6 });
        else map.setView(bounds.getCenter(), zoom);
      },
      true,
      (map) => {
        if (!isState) return;
        stateZoomRef.current = map.getZoom();
        map.setMinZoom(map.getZoom());
      }
    );
  };

  /* zooming navigates like clicking: in far enough → open the district /
     local body under the map centre; out past the fitted view → up a level */
  useEffect(() => {
    onUserZoomRef.current = () => {
      const map = mapRef.current;
      const base = baseZoomRef.current;
      if (!map || autoMoveRef.current || base == null) return;
      const z = map.getZoom();
      const c = map.getCenter();
      const go = (fn: () => void) => {
        baseZoomRef.current = null; // once per level — re-armed by the next fit
        // after this zoom's own moveend, so the next level's fit doesn't
        // mistake it for the end of its move
        window.setTimeout(fn, 0);
      };
      if (level === "state" && geo && z >= base + ZOOM_INTO_DISTRICT) {
        const f = geo.features.find((feat) => pointInPolys([c.lng, c.lat], featureToClip(feat)));
        const d = f && districtsByFeature.get(f.properties.name)?.[0];
        if (d) go(() => cbRef.current.onSelectDistrict?.(d));
      } else if (level === "district") {
        if (z < base && z <= Math.max(base - ZOOM_OUT_STEPS, stateZoomRef.current ?? -Infinity))
          go(() => cbRef.current.onZoomOut?.());
        else if (z >= base + ZOOM_INTO_LOCAL_BODY) {
          const hits = drawnLbs.filter((d) => d.rings && matchesFilter(d.lb, lbFilter) && pointInPolys([c.lat, c.lng], d.rings));
          hits.sort((a, b) => HIT_ORDER.indexOf(a.lb.type) - HIT_ORDER.indexOf(b.lb.type));
          if (hits[0]) go(() => cbRef.current.onSelectLocalBody?.(hits[0].lb));
        }
      } else if (level === "local_body" && z < base && z <= Math.max(base - ZOOM_OUT_STEPS, stateZoomRef.current ?? -Infinity)) {
        go(() => cbRef.current.onZoomOut?.());
      }
    };
  }, [level, geo, districtsByFeature, drawnLbs, lbFilter]);

  /* mask + fit whenever the scope changes */
  const scopeKey = `${level}|${area?.local_body.id}|${district?.district_id}|${scope?.bounds.toBBoxString()}`;
  useEffect(() => {
    const mask = maskRef.current;
    if (!mask) return;
    mask.clearLayers();
    if (scope?.rings.length)
      L.polygon([WORLD_RING, ...scope.rings], {
        pane: "ggm-mask", stroke: false, fillColor: MASK_COLOR, fillOpacity: 1, interactive: false,
      }).addTo(mask);
    fitScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  /* ── draw overlays ── */
  useEffect(() => {
    const layer = overlayRef.current;
    if (!layer) return;
    layer.clearLayers();
    pinLayers.current.clear();
    pinColors.current.clear();

    if (level === "state" && geo && state) {
      const max = Math.max(0, ...state.districts.map((d) => d.open));
      for (const f of geo.features) {
        const members = districtsByFeature.get(f.properties.name) ?? [];
        const c = members.reduce<GrievanceCounts>(
          (a, m) => ({ total: a.total + m.total, open: a.open + m.open, resolved: a.resolved + m.resolved, escalated: a.escalated + m.escalated }),
          { total: 0, open: 0, resolved: 0, escalated: 0 }
        );
        const merged = members.filter((m) => m.name.toLowerCase() !== f.properties.name.toLowerCase()).map((m) => m.name);
        const tip = `<div class="ggm-tip"><b>${esc(f.properties.name)}</b>${
          merged.length ? `<span class="ggm-sub">incl. ${esc(merged.join(", "))}</span>` : ""
        }${members.length ? countLines(c) : "<span>Not configured</span>"}<span class="ggm-sub">Click to see ULBs &amp; RLBs</span></div>`;
        const poly = L.geoJSON(f, {
          style: { color: "#ffffff", weight: 1.2, fillColor: rampColor(c.open, max), fillOpacity: 0.85 },
        })
          .bindTooltip(tip, { sticky: true, direction: "top", className: "ggm-tooltip" })
          .on("mouseover", () => poly.setStyle({ weight: 2.5, color: SCOPE_LINE }))
          .on("mouseout", () => poly.setStyle({ weight: 1.2, color: "#ffffff" }))
          .addTo(layer);
        if (members[0]) poly.on("click", () => cbRef.current.onSelectDistrict?.(members[0]));
        if (c.open > 0)
          L.marker(f.properties.center, { icon: bubbleIcon(c.open, max, 24, 20), riseOnHover: true })
            .bindTooltip(tip, { direction: "top", offset: [0, -12], className: "ggm-tooltip" })
            .on("click", () => members[0] && cbRef.current.onSelectDistrict?.(members[0]))
            .addTo(layer);
      }
      L.geoJSON(geo.outline, { style: { color: SCOPE_LINE, weight: 1.8, dashArray: "6 5", fill: false }, interactive: false }).addTo(layer);
    }

    if (level === "district" && district) {
      const lbs = drawnLbs
        .filter((d) => matchesFilter(d.lb, lbFilter))
        .sort((x, y) => DRAW_ORDER.indexOf(x.lb.type) - DRAW_ORDER.indexOf(y.lb.type));
      const max = Math.max(0, ...lbs.map((d) => d.lb.open));
      for (const { lb, rings, point } of lbs) {
        // a union covers the same ground as its village panchayats — only
        // fill it when unions are shown on their own
        const filled = lb.type !== "panchayat_union" || lbFilter === "panchayat_union";
        const tip = `<div class="ggm-tip"><b>${esc(lb.name)}</b><span class="ggm-sub">${TYPE_LABEL[lb.type]} · ${lb.category.toUpperCase()}</span>${countLines(lb)}<span class="ggm-sub">Click to open</span></div>`;
        const base = { color: "#ffffff", weight: filled ? 1 : 2, fillColor: TYPE_COLOR[lb.type], fillOpacity: filled ? 0.32 : 0 };
        const shape = rings
          ? L.polygon(rings, { ...base, lineJoin: "round" })
          : L.circleMarker(point!, { radius: 6, color: "#ffffff", weight: 2, fillColor: TYPE_COLOR[lb.type], fillOpacity: 1 });
        shape
          .bindTooltip(tip, { sticky: true, direction: "top", className: "ggm-tooltip" })
          .on("mouseover", () => rings && shape.setStyle({ fillOpacity: filled ? 0.55 : 0.12, color: SCOPE_LINE, weight: 2 }))
          .on("mouseout", () => rings && shape.setStyle(base))
          .on("click", () => cbRef.current.onSelectLocalBody?.(lb))
          .addTo(layer);
        if (lb.open > 0) {
          const at = point ?? centroid(rings!.flat(2) as unknown as LatLng[]);
          L.marker(at, { icon: bubbleIcon(lb.open, max, 20, 14), riseOnHover: true })
            .bindTooltip(tip, { direction: "top", offset: [0, -10], className: "ggm-tooltip" })
            .on("click", () => cbRef.current.onSelectLocalBody?.(lb))
            .addTo(layer);
        }
      }
      if (districtFeature)
        L.geoJSON(districtFeature, { style: { color: SCOPE_LINE, weight: 2.4, dashArray: "6 5", fill: false }, interactive: false }).addTo(layer);
      else if (district.district_coordinates.length >= 3)
        L.polygon(district.district_coordinates, { color: SCOPE_LINE, weight: 2.4, dashArray: "6 5", fill: false, interactive: false }).addTo(layer);
    }

    if (level === "local_body" && area) {
      const lb = area.local_body;
      if (lb.coordinates.length >= 3)
        L.polygon(lb.coordinates, {
          color: SCOPE_LINE, weight: 2.6, dashArray: "6 5", fillColor: TYPE_COLOR[lb.type], fillOpacity: 0.12, interactive: false,
        }).addTo(layer);
      else if (lb.coordinates.length)
        L.marker(centroid(lb.coordinates), { icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="ggm-loc"></div>` }) })
          .bindTooltip(`<div class="ggm-tip"><b>${esc(lb.name)}</b><span class="ggm-sub">Recorded location (no geofence)</span></div>`, { direction: "top", className: "ggm-tooltip" })
          .addTo(layer);
      const areaLine = [
        lb.name,
        area.district_name && `${area.district_name} District`,
        area.state_name,
      ].filter(Boolean).join(", ");
      // resolved underneath, escalated on top
      const order = { resolved: 0, open: 1, escalated: 2 } as const;
      for (const t of [...area.tickets].sort((a, b) => order[pinState(a)] - order[pinState(b)])) {
        const s = PIN_STATUS[pinState(t)];
        const marker = L.circleMarker([t.latitude, t.longitude], pinStyle(s.color, t.ticket_no, focusPinRef.current))
          .bindTooltip(
            `<div class="ggm-tip"><b>${esc(t.ticket_no)} · ${esc(t.category)}</b>${t.subcategory ? `<span class="ggm-sub">${esc(t.subcategory)}</span>` : ""}
              <span>Status: <i>${esc(t.status)}</i>${t.is_overdue ? " · <i>overdue</i>" : ""}</span>
              <span>${t.is_open ? "Open" : "Took"} <i>${t.days_open} day${t.days_open === 1 ? "" : "s"}</i></span>
              <span>Reported: <i>${esc(reportedAt(t.created))}</i></span>
              <span class="ggm-row"><span class="ggm-label">Address</span>${
                t.location_text ? esc(t.location_text) : '<span class="ggm-sub">Not given by the reporter</span>'
              }</span>
              <span class="ggm-row"><span class="ggm-label">Area</span>${esc(areaLine)}</span>
              <span class="ggm-row"><span class="ggm-label">Coordinates</span>${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}</span>
              ${t.photos?.length ? `<img class="ggm-photo" src="${esc(t.photos[0])}" alt="Complaint photo" />${t.photos.length > 1 ? `<span class="ggm-sub">+${t.photos.length - 1} more photo${t.photos.length > 2 ? "s" : ""}</span>` : ""}` : ""}</div>`,
            { direction: "top", offset: [0, -6], className: "ggm-tooltip" }
          )
          // only one complaint's details at a time: a picked or hovered pin
          // closes whichever tooltip was open before
          .on("tooltipopen", () => {
            pinLayers.current.forEach((other, ticketNo) => {
              if (ticketNo !== t.ticket_no) other.closeTooltip();
            });
          })
          .on("click", () => onPickPinRef.current?.(t.ticket_no))
          .addTo(layer);
        pinLayers.current.set(t.ticket_no, marker);
        pinColors.current.set(t.ticket_no, s.color);
      }
    }
  }, [level, geo, state, district, area, districtsByFeature, districtFeature, drawnLbs, lbFilter]);

  /* the complaint being viewed: its pin is enlarged with a pulsing ring and a
     "Viewing" label, the others fade back. Re-applied whenever the pins are
     redrawn. */
  useEffect(() => {
    const map = mapRef.current;
    activeRing.current?.remove();
    activeRing.current = null;
    const active = focusPin ? pinLayers.current.get(focusPin) : null;
    pinLayers.current.forEach((marker, ticketNo) => {
      marker.setStyle(pinStyle(pinColors.current.get(ticketNo) ?? "#64748b", ticketNo, active ? focusPin : null));
      if (marker === active) marker.bringToFront();
    });
    if (active && map) {
      activeRing.current = L.marker(active.getLatLng(), {
        interactive: false,
        keyboard: false,
        zIndexOffset: -1000,
        icon: L.divIcon({
          className: "",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          html: `<div class="ggm-active"><span class="ggm-active-ring"></span><span class="ggm-active-tag">Viewing</span></div>`,
        }),
      }).addTo(map);
    }
  }, [focusPin, area]);

  useEffect(() => () => { activeRing.current?.remove(); }, []);

  /* fly to a complaint picked in the side list — or opened from a shared
     link, once its area's pins are drawn */
  const areaId = area?.local_body.id ?? null;
  useEffect(() => {
    const m = focusPin ? pinLayers.current.get(focusPin) : null;
    const map = mapRef.current;
    if (!m || !map) return;
    autoMove((mp) => mp.flyTo(m.getLatLng(), Math.max(mp.getZoom(), 15), { duration: 0.5 }), false);
    m.openTooltip();
  }, [focusPin, areaId]);

  const stateMax = state ? Math.max(0, ...state.districts.map((d) => d.open)) : 0;
  const ctrl = "flex h-9 w-9 items-center justify-center bg-white text-slate-700 transition-colors hover:bg-slate-50";

  return (
    <div className="relative isolate h-full w-full">
      <style>{`
        .ggm-bubble{display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${BUBBLE};
          color:#fff;font-weight:700;border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(15,23,42,.3);
          cursor:pointer;transition:transform .15s ease;font-variant-numeric:tabular-nums}
        .ggm-bubble:hover{transform:scale(1.08)}
        .ggm-loc{width:18px;height:18px;border-radius:9999px;border:3px solid ${SCOPE_LINE};background:#fff;box-shadow:0 0 0 4px rgba(10,92,54,.18)}
        .ggm-tooltip{border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 10px 24px -8px rgba(15,23,42,.25);padding:8px 10px}
        .ggm-tip{display:flex;flex-direction:column;gap:1px;font-size:11px;color:#475569;width:max-content;max-width:260px;white-space:normal}
        .ggm-tip b{font-size:12px;color:#0f172a;margin-bottom:2px}
        .ggm-tip i{font-style:normal;font-weight:600;color:#0f172a}
        .ggm-tip .ggm-sub{color:#94a3b8;font-size:10px}
        .ggm-active{position:relative;width:44px;height:44px;pointer-events:none}
        .ggm-active-ring{position:absolute;inset:0;border-radius:9999px;border:3px solid #0A5C36;animation:ggm-pulse 1.6s ease-out infinite}
        .ggm-active-tag{position:absolute;left:50%;top:100%;margin-top:2px;transform:translateX(-50%);white-space:nowrap;border-radius:9999px;background:#0A5C36;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;box-shadow:0 2px 6px rgba(15,23,42,.3)}
        @keyframes ggm-pulse{0%{transform:scale(.55);opacity:1}100%{transform:scale(1.35);opacity:0}}
        .ggm-tip .ggm-row{display:flex;flex-direction:column;margin-top:3px;color:#0f172a;line-height:1.35}
        .ggm-tip .ggm-label{color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .ggm-tip .ggm-photo{display:block;width:240px;max-width:none;height:150px;margin-top:4px;border-radius:6px;object-fit:contain;background:#f1f5f9}
      `}</style>
      <div ref={containerRef} className="h-full w-full bg-slate-100" />

      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40">
          <Loader2 className="h-6 w-6 animate-spin text-[#0A5C36]" />
        </div>
      )}

      {/* legend */}
      <div className="absolute bottom-3 left-3 z-[1000] max-w-[260px] rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] text-gray-600 shadow-md">
        <button onClick={() => setLegendOpen((v) => !v)} className="flex items-center gap-0.5 font-semibold text-gray-800">
          Legend {legendOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {legendOpen && (
          <div className="mt-1.5 space-y-1 pb-0.5">
            {level === "state" && (
              <>
                <p>Open complaints per district</p>
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums">0</span>
                  <span className="flex h-2.5 flex-1 overflow-hidden rounded-sm">
                    <span className="flex-1" style={{ background: RAMP_EMPTY }} />
                    {RAMP.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                  </span>
                  <span className="tabular-nums">{fmt(stateMax)}</span>
                </div>
                <p className="flex items-center gap-1.5">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: BUBBLE }}>n</span>
                  Open complaints
                </p>
              </>
            )}
            {level === "district" && (
              <>
                {LB_TYPES.map((t) => (
                  <p key={t} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
                    {TYPE_LABEL[t]} <span className="text-gray-400">({TYPE_CATEGORY[t].toUpperCase()})</span>
                  </p>
                ))}
                <p className="flex items-center gap-1.5">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: BUBBLE }}>n</span>
                  Open complaints
                </p>
              </>
            )}
            {level === "local_body" &&
              (Object.keys(PIN_STATUS) as (keyof typeof PIN_STATUS)[]).map((k) => (
                <p key={k} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: PIN_STATUS[k].color }} />
                  {PIN_STATUS[k].label}
                </p>
              ))}
            <p className="flex items-center gap-1.5">
              <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: SCOPE_LINE }} />
              {level === "state" ? "State border" : level === "district" ? "District border" : "Geofence"}
            </p>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-2">
        <div className="overflow-hidden rounded-xl shadow-md ring-1 ring-slate-200">
          <button onClick={() => mapRef.current?.zoomIn()} className={`${ctrl} border-b border-slate-200`} title="Zoom in"><Plus size={16} /></button>
          <button onClick={() => mapRef.current?.zoomOut()} className={ctrl} title="Zoom out"><Minus size={16} /></button>
        </div>
      </div>
    </div>
  );
}
