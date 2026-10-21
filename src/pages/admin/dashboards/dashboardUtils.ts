// Formatting, date ranges and styling shared by the Admin and Superadmin
// dashboards. Components live in shared.tsx (react-refresh needs component
// files to export only components).

import type { ReactNode } from "react";

/* ---------- Look ---------- */

export const PALETTE = [
  "#1f9d47",
  "#2f72c9",
  "#d99a06",
  "#ef5a1c",
  "#d63b3b",
  "#7a5bd1",
  "#0f9488",
  "#9ca3af",
];

export const panelClass =
  "rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-sm dark:border-[#26352b] dark:bg-[#17221b]";
// shadcn input / select-trigger look.
export const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
export const triggerClass = `${inputClass} inline-flex items-center gap-2 hover:bg-accent/50`;
export const mutedClass = "text-[#66756b] dark:text-[#9aaba0]";

export type Tone = "ok" | "info" | "warn" | "bad" | "neutral";

/* ---------- Formatting ---------- */

const NUMBER = new Intl.NumberFormat("en-IN");
const DECIMAL = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export const num = (value?: number | null) =>
  value === null || value === undefined ? "–" : NUMBER.format(value);

export const pct = (value?: number | null) =>
  value === null || value === undefined ? "–" : `${DECIMAL.format(value)}%`;

/** Kilograms, switching to tonnes from 1,000 kg. */
export const weight = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return Math.abs(value) >= 1000
    ? `${DECIMAL.format(value / 1000)} t`
    : `${DECIMAL.format(value)} kg`;
};

export const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

export const fullDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const dateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

/** "household_collection" / "IN_PROGRESS" -> "Household Collection". */
export const humanize = (key: string) =>
  key
    ? key
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unspecified";

/* ---------- Date range ---------- */

export const iso = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const addDays = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

export type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "3m"
  | "6m"
  | "year"
  | "day"
  | "custom"
  | "months";

export type DateRange = { preset: RangePreset; from: string; to: string };

export const rangeFor = (preset: RangePreset, current?: DateRange): DateRange => {
  const today = new Date();
  switch (preset) {
    case "today":
      return { preset, from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = iso(addDays(today, -1));
      return { preset, from: y, to: y };
    }
    case "7d":
      return { preset, from: iso(addDays(today, -6)), to: iso(today) };
    case "30d":
      return { preset, from: iso(addDays(today, -29)), to: iso(today) };
    case "month":
      return {
        preset,
        from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: iso(today),
      };
    case "3m":
    case "6m":
      return {
        preset,
        from: iso(new Date(today.getFullYear(), today.getMonth() - (preset === "3m" ? 2 : 5), 1)),
        to: iso(today),
      };
    case "year":
      return { preset, from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
    case "months":
      return monthRange(
        (current?.from ?? iso(today)).slice(0, 7),
        (current?.to ?? iso(today)).slice(0, 7),
      );
    case "day":
      return { preset, from: current?.to ?? iso(today), to: current?.to ?? iso(today) };
    default:
      return { preset, from: current?.from ?? iso(addDays(today, -6)), to: current?.to ?? iso(today) };
  }
};

/** "2026-03".."2026-05" -> 1 Mar to 31 May, capped at today. */
export const monthRange = (fromMonth: string, toMonth: string): DateRange => {
  const [a, b] = fromMonth <= toMonth ? [fromMonth, toMonth] : [toMonth, fromMonth];
  const [y, m] = b.split("-").map(Number);
  const end = iso(new Date(y, m, 0));
  const today = iso(new Date());
  return { preset: "months", from: `${a}-01`, to: end > today ? today : end };
};

export const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

/** Day rows summed per calendar month. `present` becomes the average per
 * day, since summing head-counts over days means nothing. */
export const byMonth = <R extends { date: string; present: number }>(rows: R[]) => {
  const months = new Map<string, R & { month: string; days: number }>();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const acc = months.get(key);
    if (!acc) {
      months.set(key, { ...row, month: key, days: 1 });
      continue;
    }
    acc.days += 1;
    const sums = acc as unknown as Record<string, number>;
    for (const [k, v] of Object.entries(row)) if (typeof v === "number") sums[k] = (sums[k] ?? 0) + v;
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return [...months.values()].map((m) => {
    const out = { ...m } as Record<string, unknown>;
    for (const [k, v] of Object.entries(m)) if (typeof v === "number") out[k] = round(v);
    out.present = round(m.present / m.days);
    out.days = m.days;
    return out as R & { month: string; days: number };
  });
};

/** One day goes as `date`, a range as `from_date`/`to_date`. */
export const rangeParams = (range: DateRange): Record<string, string> =>
  range.from === range.to
    ? { date: range.from }
    : { from_date: range.from, to_date: range.to };

export type Column<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  /** In the CSV export only; the detail is already folded into another
   * column on screen (keeps tables narrow enough not to scroll). */
  exportOnly?: boolean;
};

