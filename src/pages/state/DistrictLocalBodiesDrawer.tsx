import React, { useEffect, useMemo, useState } from "react";
import { Building, Building2, Home, Landmark, Layers, MapPin, X } from "lucide-react";
import { localBodiesByDistrict, villagePanchayatTotal, type BlockInfo } from "@/data/localBodies";

interface Props {
  districtId: string | null;
  districtName: string | null;
  waste?: { collected: number; processed: number; disposed: number } | null;
  onClose: () => void;
}

type TabKey = "corporation" | "municipality" | "town" | "blocks" | "village";

const fmtT = (v: number) => v.toLocaleString("en-IN");

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { key: "corporation", label: "Corporation", icon: Landmark, color: "#2563eb" },
  { key: "municipality", label: "Municipality", icon: Building2, color: "#16a34a" },
  { key: "town", label: "Town Panchayat", icon: Building, color: "#ea580c" },
  { key: "blocks", label: "Panchayat Union (Blocks)", icon: Layers, color: "#7c3aed" },
  { key: "village", label: "Village Panchayats", icon: Home, color: "#0d9488" },
];

/* ── deterministic illustrative daily-waste generator ──
   stable per (name,type) so figures don't jump between renders; swap for
   live per-local-body collection data when the API/feed is available. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const pick = (s: string, min: number, max: number, decimals = 1) => {
  const factor = 10 ** decimals;
  const span = (max - min) * factor;
  return Number((min + (hash(s) % (span + 1)) / factor).toFixed(decimals));
};
const DAILY_RANGE: Record<string, [number, number]> = {
  corporation: [280, 420],
  municipality: [22, 58],
  town: [5, 18],
};
const dailyFor = (name: string, type: keyof typeof DAILY_RANGE) => {
  const [a, b] = DAILY_RANGE[type];
  return pick(name + type, a, b);
};
const blockDaily = (b: BlockInfo) => Number((b.villagePanchayatCount * pick(b.name + "vp", 0.4, 0.9, 2)).toFixed(1));
/* cumulative total collected ≈ daily × operating days (deterministic per body) */
const totalFor = (daily: number, name: string) => Math.round(daily * pick(name + "days", 300, 360, 0));

/* ── numbered table styled like the official portal listing ── */
interface Col { label: string; right?: boolean; total?: boolean }
const NameTable: React.FC<{ head: string; cols: Col[]; rows: (string | number)[][] }> = ({ head, cols, rows }) => {
  const hasTotal = cols.some((c) => c.total);
  const colTotals = cols.map((c, i) =>
    c.total ? rows.reduce((s, r) => s + (typeof r[i] === "number" ? (r[i] as number) : 0), 0) : null,
  );
  const cell = (v: string | number, isNum: boolean) => (typeof v === "number" && isNum ? fmtT(Number(v.toFixed(1))) : v);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
      <div className="bg-slate-700 text-white text-sm font-bold px-4 py-2.5">{head}</div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[440px]">
        <thead>
          <tr className="bg-slate-200 text-slate-600">
            {cols.map((c, i) => (
              <th key={c.label} className={`px-4 py-2 font-semibold ${i === 0 ? "w-14" : ""} ${c.right ? "text-right w-36" : "text-left"}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-2 ${j === 0 ? "text-blue-600 tabular-nums" : cols[j]?.right ? "text-right tabular-nums font-semibold text-slate-800" : "text-slate-700"}`}
                >
                  {cell(c, Boolean(cols[j]?.right))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotal && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-700">
              {cols.map((c, i) => (
                <td key={i} className={`px-4 py-2 ${c.right ? "text-right tabular-nums" : ""}`}>
                  {i === 0 ? "Total" : colTotals[i] !== null ? fmtT(Number((colTotals[i] as number).toFixed(1))) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  );
};

const DistrictLocalBodiesDrawer: React.FC<Props> = ({ districtId, districtName, waste, onClose }) => {
  const open = districtId !== null;
  const data = districtId ? localBodiesByDistrict[districtId] : undefined;
  const [tab, setTab] = useState<TabKey>("corporation");

  useEffect(() => {
    if (open) setTab("corporation");
  }, [districtId, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      corporation: data.corporations.length,
      municipality: data.municipalities.length,
      town: data.townPanchayats.length,
      blocks: data.blocks.length,
      village: villagePanchayatTotal(data),
    };
  }, [data]);

  if (!open) return null;

  const vpNamed = data ? data.blocks.some((b) => b.villagePanchayats.length > 0) : false;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] animate-in fade-in duration-200" onClick={onClose} />

      <div className="relative h-full w-full max-w-3xl bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-none">{data?.districtName ?? districtName} District</h2>
                <p className="text-xs text-slate-400 mt-1">Local Bodies — administrative & daily-collection breakdown</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {counts && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {TABS.map((t) => (
                <div key={t.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
                  <p className="text-base font-bold tabular-nums leading-none" style={{ color: t.color }}>{counts[t.key]}</p>
                  <p className="text-[9px] text-slate-400 mt-1 leading-tight">{t.label.replace(" (Blocks)", "")}</p>
                </div>
              ))}
            </div>
          )}

          {waste && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Total Waste Collected</p>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{fmtT(waste.collected)}</span>
                    <span className="text-xs font-semibold text-slate-400">T</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="rounded-lg bg-white border border-slate-100 px-3 py-1.5 text-right">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Processed</p>
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">{fmtT(waste.processed)} T</p>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-100 px-3 py-1.5 text-right">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Disposed</p>
                    <p className="text-sm font-bold text-orange-500 tabular-nums">{fmtT(waste.disposed)} T</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* body */}
        {!data ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-slate-400">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium text-slate-500">Local body breakdown for {districtName} isn't available yet.</p>
            <p className="text-xs mt-1">Currently loaded for Erode. Other districts will follow once their data is provided.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto px-4 pt-3 bg-slate-50 border-b border-slate-200">
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                      on ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label.replace(" (Blocks)", "")}
                    <span className={`ml-0.5 rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}>{counts?.[t.key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {tab === "corporation" && (
                <NameTable
                  head={`Corporation (${data.corporations.length})`}
                  cols={[{ label: "S.No" }, { label: "Corporation Name" }, { label: "Daily Waste (T)", right: true, total: true }, { label: "Total Collected (T)", right: true, total: true }]}
                  rows={data.corporations.map((n, i) => { const d = dailyFor(n, "corporation"); return [i + 1, n, d, totalFor(d, n)]; })}
                />
              )}

              {tab === "municipality" && (
                <NameTable
                  head={`Municipality (${data.municipalities.length})`}
                  cols={[{ label: "S.No" }, { label: "Municipality Name" }, { label: "Daily Waste (T)", right: true, total: true }, { label: "Total Collected (T)", right: true, total: true }]}
                  rows={data.municipalities.map((n, i) => { const d = dailyFor(n, "municipality"); return [i + 1, n, d, totalFor(d, n)]; })}
                />
              )}

              {tab === "town" && (
                <NameTable
                  head={`Town Panchayat (${data.townPanchayats.length})`}
                  cols={[{ label: "S.No" }, { label: "Town Panchayat Name" }, { label: "Daily Waste (T)", right: true, total: true }, { label: "Total Collected (T)", right: true, total: true }]}
                  rows={data.townPanchayats.map((n, i) => { const d = dailyFor(n, "town"); return [i + 1, n, d, totalFor(d, n)]; })}
                />
              )}

              {tab === "blocks" && (
                <NameTable
                  head={`Panchayat Union / Blocks (${data.blocks.length})`}
                  cols={[
                    { label: "S.No" },
                    { label: "Block Name" },
                    { label: "Village Panchayats", right: true, total: true },
                    { label: "Daily Waste (T)", right: true, total: true },
                    { label: "Total Collected (T)", right: true, total: true },
                  ]}
                  rows={data.blocks.map((b, i) => { const d = blockDaily(b); return [i + 1, b.name, b.villagePanchayatCount, d, totalFor(d, b.name)]; })}
                />
              )}

              {tab === "village" && (
                <>
                  {vpNamed ? (
                    data.blocks.map((b) => (
                      <NameTable
                        key={b.name}
                        head={`${b.name} — Village Panchayats (${b.villagePanchayatCount})`}
                        cols={[{ label: "S.No" }, { label: "Village Panchayat Name" }, { label: "Daily Waste (T)", right: true, total: true }, { label: "Total Collected (T)", right: true, total: true }]}
                        rows={b.villagePanchayats.map((n, i) => { const d = pick(n + "vp", 0.3, 1.1, 2); return [i + 1, n, d, totalFor(d, n)]; })}
                      />
                    ))
                  ) : (
                    <>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                        Individual Village Panchayat names are pending the official per-block file. Block-wise counts
                        (<span className="font-bold">{villagePanchayatTotal(data)}</span> total) with daily &amp; total collection are shown below; names slot in per block once supplied.
                      </div>
                      <NameTable
                        head={`Village Panchayats — Block-wise (${villagePanchayatTotal(data)})`}
                        cols={[
                          { label: "S.No" },
                          { label: "Block Name" },
                          { label: "Village Panchayats", right: true, total: true },
                          { label: "Daily Waste (T)", right: true, total: true },
                          { label: "Total Collected (T)", right: true, total: true },
                        ]}
                        rows={data.blocks.map((b, i) => { const d = blockDaily(b); return [i + 1, b.name, b.villagePanchayatCount, d, totalFor(d, b.name)]; })}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <p className="border-t border-slate-200 bg-white px-5 py-2.5 text-[10px] text-slate-400 leading-relaxed">
          Daily-waste figures are illustrative sample values (deterministic per local body) for design preview — they will switch to live per-local-body collection data once the feed is available.{data?.note ? ` ${data.note}` : ""}
        </p>
      </div>
    </div>
  );
};

export default DistrictLocalBodiesDrawer;
