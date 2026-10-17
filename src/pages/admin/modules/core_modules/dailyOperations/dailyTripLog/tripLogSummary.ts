/* Daily Trip Log list: GET daily-trip-logs/summary/ shape and the
   waste-type colour / weight formatting shared by its display pieces. */

export type TripLogSummary = {
  total_logs: number;
  trips: number;
  bin_weight_kg: number;
  household_weight_kg: number;
  total_weight_kg: number;
  today_weight_kg: number;
  status_counts: Record<string, number>;
};

export const EMPTY_SUMMARY: TripLogSummary = {
  total_logs: 0,
  trips: 0,
  bin_weight_kg: 0,
  household_weight_kg: 0,
  total_weight_kg: 0,
  today_weight_kg: 0,
  status_counts: {},
};

/* The waste type master has no colour, so pick one by name (familiar
   colours for the common streams) and fall back to a stable hash. */
const NAMED_COLORS: Array<[RegExp, string]> = [
  [/organic|wet|food|bio/i, "#16a34a"],
  [/dry|paper/i, "#0284c7"],
  [/metal|scrap/i, "#d97706"],
  [/plastic/i, "#7c3aed"],
  [/glass/i, "#0d9488"],
  [/hazard|medical|sanitary/i, "#dc2626"],
  [/e-?waste|electronic/i, "#4f46e5"],
  [/construct|debris|c\s*&\s*d/i, "#78716c"],
];
const FALLBACK_COLORS = ["#db2777", "#0891b2", "#65a30d", "#ea580c", "#9333ea", "#475569"];

export const wasteTypeColor = (name?: string | null): string => {
  const label = name ?? "";
  const named = NAMED_COLORS.find(([pattern]) => pattern.test(label));
  if (named) return named[1];
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
};

export const formatKg = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 0 : 2 })} kg`;
