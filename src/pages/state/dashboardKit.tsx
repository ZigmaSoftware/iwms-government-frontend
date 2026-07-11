import React, { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { tnDistricts, TN_VIEWBOX } from "@/data/tamilnadu-map";

/* ─────────────────────────────────────────────────────────────────────
   Shared building blocks for the State (Tamil Nadu) dashboards
   (Overview / Fleet Track / Grievances) so every tab reads as one system.
   ──────────────────────────────────────────────────────────────────── */

export const fmt = (v: number) => v.toLocaleString("en-IN");

export const CARD =
  "bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)]";

/* a few districts in tamilnadu-map use different id spellings than tnDistricts */
const MAP_ID_TO_DATA_ID: Record<string, string> = {
  thoothukkudi: "thoothukudi",
  viluppuram: "villupuram",
  tirupathur: "tirupattur",
};

export type TipEntry = { name?: string; value?: number; color?: string; fill?: string };

export const TrendPill = ({ v, bad, suffix = "vs last month" }: { v: number; bad?: boolean; suffix?: string }) => {
  const up = v >= 0;
  const good = bad ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${good ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{v}% <span className="text-slate-400 font-normal">{suffix}</span>
    </span>
  );
};

export const Panel = ({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <div className={`${CARD} p-4 ${className ?? ""}`}>
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const KpiCard = ({ label, desc, value, unit, trend, badUp, Icon, color, soft }: {
  label: string; desc: string; value: string; unit?: string; trend: number; badUp?: boolean;
  Icon: React.ComponentType<{ className?: string }>; color: string; soft: string;
}) => (
  <div className={`${CARD} p-4`}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{label}</p>
      <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: soft, color }}><Icon className="h-4 w-4" /></span>
    </div>
    <p className="text-[11px] text-slate-400 mt-1 leading-snug min-h-[28px]">{desc}</p>
    <p className="mt-1 flex items-baseline gap-1">
      <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</span>
      {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
    </p>
    <div className="mt-1.5"><TrendPill v={trend} bad={badUp} /></div>
  </div>
);

export const PieTip = ({ active, payload, unit = "" }: { active?: boolean; payload?: TipEntry[]; unit?: string }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-xl">
      <p className="font-semibold">{p.name}</p>
      <p className="text-slate-300 tabular-nums">{fmt(p.value ?? 0)}{unit}</p>
    </div>
  );
};

export const BarTip = ({ active, payload, label, unit = "" }: { active?: boolean; payload?: TipEntry[]; label?: string; unit?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-[11px] shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-200">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          {p.name}: <span className="font-semibold text-white tabular-nums">{fmt(p.value ?? 0)}{unit}</span>
        </p>
      ))}
    </div>
  );
};

export const FilterSelect: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, value, onChange, active, children }) => (
  <div className={`flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs shadow-sm transition-colors focus-within:ring-2 focus-within:ring-blue-100 ${active ? "border border-blue-300 text-blue-700" : "border border-slate-200 text-slate-600"}`}>
    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-blue-500" : "text-slate-400"}`} />
    <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer bg-transparent pr-1 font-medium outline-none">
      {children}
    </select>
  </div>
);

/* ── reusable Tamil Nadu choropleth map ──
   tints each district by `colorOf(dataId)`; hover/click optional. */
export const TNChoropleth: React.FC<{
  colorOf: (dataId: string) => string;
  titleOf: (dataId: string) => string;
  selectedId?: string | null;
  onSelect?: (dataId: string) => void;
  onHover?: (dataId: string | null) => void;
}> = ({ colorOf, titleOf, selectedId, onSelect, onHover }) => (
  <svg viewBox={TN_VIEWBOX} className="h-full w-auto max-w-full max-h-[560px]" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => onHover?.(null)}>
    <defs>
      <filter id="tnk-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1e293b" floodOpacity="0.16" />
      </filter>
    </defs>
    <g filter="url(#tnk-shadow)">
      {tnDistricts.map((shape) => {
        const dataId = MAP_ID_TO_DATA_ID[shape.id] ?? shape.id;
        const on = selectedId === dataId;
        return (
          <path
            key={shape.id}
            d={shape.d}
            fill={colorOf(dataId)}
            stroke={on ? "#0f172a" : "#ffffff"}
            strokeWidth={on ? 2.6 : 1.4}
            strokeLinejoin="round"
            opacity={selectedId && !on ? 0.55 : 1}
            style={{ cursor: onSelect ? "pointer" : "default", transition: "fill .15s ease, opacity .15s ease" }}
            onMouseEnter={() => onHover?.(dataId)}
            onClick={() => onSelect?.(dataId)}
          >
            <title>{titleOf(dataId)}</title>
          </path>
        );
      })}
    </g>
  </svg>
);

/** step colour scale: pick the colour whose threshold the value clears */
export const stepScale = (stops: Array<{ min: number; color: string }>, fallback = "#eef2f7") =>
  (v: number | undefined) => {
    if (v === undefined) return fallback;
    let picked = fallback;
    for (const s of stops) if (v >= s.min) picked = s.color;
    return picked;
  };

/** small reusable map legend */
export const MapLegend = ({ items }: { items: Array<[string, string]> }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-[10px] text-slate-500">
    {items.map(([l, c]) => (
      <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
    ))}
  </div>
);

/** hook: district selection shared by the fleet/grievance dashboards */
export function useDistrictSelect() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return { selectedId, setSelectedId, hoveredId, setHoveredId, currentId: selectedId ?? hoveredId };
}
