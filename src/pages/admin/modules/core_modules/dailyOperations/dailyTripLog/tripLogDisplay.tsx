import type { ReactNode } from "react";
import type { WasteTypeBreakdownItem } from "./types";
import { wasteTypeColor } from "./tripLogSummary";

/* ─────────────────────────────────────────────────────
   Shared display pieces for the Daily Trip Log list:
   waste-type colours/chips, the composition panel and KPI cards.
───────────────────────────────────────────────────── */

/* ── waste type chips for one trip row ── */
export function WasteTypeChips({
  breakdown,
  names,
}: {
  breakdown?: WasteTypeBreakdownItem[];
  names?: string[];
}) {
  const items =
    breakdown && breakdown.length > 0
      ? breakdown.map((b) => ({
          name: b.waste_type_name ?? "—",
          kg: b.collected_weight_kg != null ? Number(b.collected_weight_kg) : null,
        }))
      : (names ?? []).map((name) => ({ name, kg: null as number | null }));

  if (items.length === 0) return <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => {
        const color = wasteTypeColor(item.name);
        return (
          <span
            key={`${item.name}-${index}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: `${color}40`, background: `${color}12`, color }}
            title={item.kg != null ? `${item.name}: ${item.kg.toFixed(2)} kg` : item.name}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate">{item.name}</span>
            {item.kg != null && Number.isFinite(item.kg) ? (
              <span className="shrink-0 font-semibold tabular-nums">{item.kg.toFixed(1)}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/* ── KPI card ── */
export function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: string;
  tone: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <i className={`${icon} text-base`} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="truncate text-xl font-semibold tabular-nums text-gray-900">{value}</p>
        {hint ? <p className="truncate text-[11px] text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}
