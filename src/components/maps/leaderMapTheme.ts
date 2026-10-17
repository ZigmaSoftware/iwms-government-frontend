/* ─────────────────────────────────────────────────────────────────────
   Shared vocabulary + colours for the State / District leader dashboards
   (map, category cards, donuts, trend charts) so every view reads as one
   system.

   Categorical colours are the dataviz reference palette in its fixed slot
   order (validated: lightness band, chroma floor, CVD separation and
   normal-vision floor all pass; some slots are < 3:1 against white, so
   every chart using them carries visible labels / a legend and the
   district page has a details table). Never reorder ad hoc.
   ──────────────────────────────────────────────────────────────────── */

/** single-series accent shared by the charts (trend bars / area, ranking
 *  bars) and the state map (district fill, borders); BRAND_DEEP marks the
 *  district bubbles so they stand out on the BRAND fill with white text */
export const BRAND = "#7c3aed";
export const BRAND_DEEP = "#5b21b6";

/** the maps (state + district): one light sky-blue for districts and local
 *  bodies alike, a deeper sky for lines, and the darkest for bubbles / the
 *  picked shape so white text and outlines stay readable on the fill */
export const MAP_FILL = "#38bdf8";
export const MAP_LINE = "#0284c7";
export const MAP_DEEP = "#075985";
/** single-hue sky shades (dark → light) for the local-body type donuts,
 *  keeping the district page to one colour family; the donut legend labels
 *  every slice, so identity never rests on the shade alone */
export const TYPE_SHADE: Record<"corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat", string> = {
  corporation: "#075985",
  municipality: "#0369a1",
  town_panchayat: "#0ea5e9",
  panchayat_union: "#7dd3fc",
  panchayat: "#bae6fd",
};

/** district page accent (charts) and its sky shades, dark → light, for any
 *  category list there (waste types, statuses …) — one colour family, the
 *  legends name every slice */
export const DISTRICT_ACCENT = "#0284c7";
export const SKY_SHADES = ["#075985", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe"];
export const skyShades = (names: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  [...names].sort().forEach((n, i) => (out[n] = SKY_SHADES[i] ?? "#cbd5e1"));
  return out;
};

export type LocalBodyType = "corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat";
export type LocalBodyCategory = "ulb" | "rlb";

export const LB_TYPES: LocalBodyType[] = ["corporation", "municipality", "town_panchayat", "panchayat_union", "panchayat"];

export const TYPE_LABEL: Record<LocalBodyType, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Village Panchayat",
};

export const TYPE_CATEGORY: Record<LocalBodyType, LocalBodyCategory> = {
  corporation: "ulb",
  municipality: "ulb",
  town_panchayat: "ulb",
  panchayat_union: "rlb",
  panchayat: "rlb",
};

/** categorical slots, fixed order */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];

export const TYPE_COLOR: Record<LocalBodyType, string> = {
  corporation: SERIES[0],
  municipality: SERIES[1],
  town_panchayat: SERIES[2],
  panchayat_union: SERIES[3],
  panchayat: SERIES[4],
};

/** waste types → colour, assigned by the entity's position in the API's
 *  stable (alphabetical) waste-type list, so a type keeps its colour across
 *  charts and filters; anything past the last slot shares a neutral grey */
export const wasteTypeColors = (names: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  [...names].sort().forEach((n, i) => (out[n] = SERIES[i] ?? "#8f8d86"));
  return out;
};
