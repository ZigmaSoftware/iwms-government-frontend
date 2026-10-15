import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ChevronRight, Clock, Layers, Loader2, MapPin, Search, ShieldAlert, UserRound,
} from "lucide-react";

import GrievanceGeoMap, { type GrievanceLbFilter } from "@/components/maps/GrievanceGeoMap";
import ComplaintDetailCard from "./ComplaintDetailCard";
import { PIN_STATUS, pinState } from "@/components/maps/grievanceMapTheme";
import { LB_TYPES, TYPE_COLOR, TYPE_LABEL } from "@/components/maps/leaderMapTheme";
import { publicGrievanceApi } from "@/features/complaintTicketing/api";
import type {
  GrievanceAreaDetail, GrievanceCounts, GrievanceDistrictMap, GrievanceMapDistrict, GrievanceMapLocalBody,
  GrievancePin, GrievanceStateMap, GrievanceStatusCount,
} from "@/features/complaintTicketing/types";

/* ─────────────────────────────────────────────────────────────────────
   Public complaint map: Tamil Nadu → district → one ULB / RLB.
   The side panel follows the drill-down: districts ranked by open
   complaints, then the district's local bodies, then the picked body's
   escalation hierarchy (who handles its complaints at each level and how
   many are open there) and its complaint list.
   ──────────────────────────────────────────────────────────────────── */

const ROYAL = "#0A5C36";
const cardClass = "rounded-2xl border border-black/10 bg-white shadow-[0_12px_40px_-20px_rgba(10,92,54,0.25)]";

/** "govt_panchayat_union_admin" → "Panchayat Union Admin" */
const roleLabel = (code: string) =>
  code
    .replace(/^govt_/i, "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const fmt = (v: number) => v.toLocaleString("en-IN");

function StatTiles({ counts, overdue }: { counts: GrievanceCounts; overdue?: number }) {
  const tiles = [
    { label: "Total", value: counts.total },
    { label: "Open", value: counts.open },
    { label: "Escalated", value: counts.escalated },
    { label: "Resolved", value: counts.resolved },
    ...(overdue != null ? [{ label: "Overdue", value: overdue }] : []),
  ];
  return (
    <div className={`grid gap-1.5 ${tiles.length > 4 ? "grid-cols-5" : "grid-cols-4"}`}>
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 rounded-xl border border-black/5 bg-[#F5F7F5] px-2 py-2">
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-black/45" title={t.label}>{t.label}</p>
          <p className="text-lg font-extrabold tabular-nums text-[#0A0A0A]">{fmt(t.value)}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBreakdown({ rows }: { rows: GrievanceStatusCount[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (!total) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-black/45">By status</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate font-semibold text-black/70">{r.name}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
              <span className="block h-full rounded-full" style={{ width: `${(r.count / total) * 100}%`, background: ROYAL }} />
            </span>
            <span className="w-8 text-right font-bold tabular-nums">{fmt(r.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelBreakdown({ byLevel }: { byLevel: Record<string, number> }) {
  const rows = Object.entries(byLevel)
    .map(([lvl, n]) => ({ lvl: Number(lvl), n }))
    .sort((a, b) => a.lvl - b.lvl);
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-black/45">
        Open complaints by hierarchy level
      </p>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span key={r.lvl} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-semibold">
            {r.lvl ? `Level ${r.lvl}` : "Awaiting assignment"} · <b className="tabular-nums">{fmt(r.n)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function RankedRow({ name, sub, counts, color, onClick }: {
  name: string; sub?: string; counts: GrievanceCounts; color?: string; onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#0A5C36]/5"
      >
        {color && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#0A0A0A]">{name}</span>
          {sub && <span className="block truncate text-[11px] text-black/45">{sub}</span>}
        </span>
        <span className="text-right text-[11px] leading-tight text-black/50">
          <b className="block text-sm tabular-nums text-[#0A0A0A]">{fmt(counts.open)}</b>open
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
      </button>
    </li>
  );
}

function HierarchyLadder({ area }: { area: GrievanceAreaDetail }) {
  if (!area.hierarchy.length)
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        No escalation hierarchy is configured for this area yet.
      </p>
    );
  // first level on top, in the order a complaint moves up
  const levels = [...area.hierarchy].sort((a, b) => a.level - b.level);
  return (
    <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-0.5 before:bg-black/10">
      {area.unassigned_open > 0 && (
        <li className="relative flex items-center gap-3">
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-[11px] font-extrabold text-white">
            –
          </span>
          <p className="text-xs font-semibold text-black/55">
            Awaiting assignment · <b className="tabular-nums">{fmt(area.unassigned_open)}</b> open
          </p>
        </li>
      )}
      {levels.map((l, step) => (
        <li key={l.level} className="relative flex items-start gap-3">
          <span
            className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
            style={{ background: l.open ? "#d03b3b" : ROYAL }}
            title={l.open ? "Has open complaints" : undefined}
          >
            {step + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              {/* officer name first, their staff user type under it */}
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#0A0A0A]">
                <UserRound className="h-4 w-4 shrink-0 text-black/45" />
                {l.officer ? (
                  <span className="truncate">{l.officer.name}</span>
                ) : (
                  <span className="font-semibold italic text-black/40">No officer mapped</span>
                )}
              </p>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                  l.open ? "bg-red-50 text-red-700" : "bg-black/5 text-black/50"
                }`}
              >
                {fmt(l.open)} open
              </span>
            </div>
            <p className="mt-0.5 pl-[22px] text-xs font-semibold text-[#0A5C36]">
              {l.roles.map(roleLabel).join(" / ")}
              {l.officer?.designation && <span className="font-normal text-black/45"> · {l.officer.designation}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

type Loaded<T> = { key: string; data?: T; failed?: boolean };

/** fetch `key`, storing the result (or the failure) under it */
const load = <T,>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, store: (r: Loaded<T>) => void) => {
  const controller = new AbortController();
  fetcher(controller.signal)
    .then((data) => store({ key, data }))
    .catch((err) => { if (!axios.isCancel(err)) store({ key, failed: true }); });
  return () => controller.abort();
};

export default function GrievanceMapView({ onBack }: { onBack: () => void }) {
  /* the drill-down lives in the URL (?district=…&type=…&id=…) so every
     area has a shareable link and the browser back button steps up a level */
  const [params, setParams] = useSearchParams();
  const districtParam = params.get("district");
  const typeParam = params.get("type");
  const idParam = params.get("id");

  /* each result is kept with the request key that produced it; what is shown
     is derived from the URL, so a stale response never shows up and nothing
     has to be reset when the URL changes */
  const [stateRes, setStateRes] = useState<Loaded<GrievanceStateMap> | null>(null);
  const [districtRes, setDistrictRes] = useState<Loaded<GrievanceDistrictMap> | null>(null);
  const [areaRes, setAreaRes] = useState<Loaded<GrievanceAreaDetail> | null>(null);
  const [lbFilter, setLbFilter] = useState<GrievanceLbFilter>("all");
  const [search, setSearch] = useState("");
  const focusPin = params.get("ticket");
  const setFocusPin = (ticketNo: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ticketNo) next.set("ticket", ticketNo);
        else next.delete("ticket");
        return next;
      },
      { replace: true },
    );

  const areaKey = typeParam && idParam ? `${typeParam}:${idParam}` : null;

  useEffect(() => load("state", (signal) => publicGrievanceApi.stateMap(signal), setStateRes), []);
  useEffect(() => {
    if (districtParam) return load(districtParam, (signal) => publicGrievanceApi.districtMap(districtParam, signal), setDistrictRes);
  }, [districtParam]);
  useEffect(() => {
    if (typeParam && idParam && areaKey)
      return load(areaKey, (signal) => publicGrievanceApi.areaMap(typeParam, idParam, signal), setAreaRes);
  }, [typeParam, idParam, areaKey]);

  const current = <T,>(res: Loaded<T> | null, key: string | null) => (key && res?.key === key ? res : null);
  const stateNow = current(stateRes, "state");
  const districtNow = current(districtRes, districtParam);
  const areaNow = current(areaRes, areaKey);
  const stateMap = stateNow?.data ?? null;
  const districtMap = districtNow?.data ?? null;
  const area = areaNow?.data ?? null;
  const focusedPin = (focusPin && area?.tickets.find((t) => t.ticket_no === focusPin)) || null;
  /** apply a change made from the complaint card (seen count, cleanup photo) to the loaded pins */
  const patchPin = (ticketNo: string, patch: Partial<GrievancePin>) =>
    setAreaRes((res) =>
      res?.data
        ? { ...res, data: { ...res.data, tickets: res.data.tickets.map((t) => (t.ticket_no === ticketNo ? { ...t, ...patch } : t)) } }
        : res
    );
  const loading = !stateNow || (!!districtParam && !districtNow) || (!!areaKey && !areaNow);
  const error = [stateNow, districtNow, areaNow].some((r) => r?.failed)
    ? "Unable to load the complaint map right now. Please try again."
    : "";

  const resetLists = () => {
    setSearch("");
    setLbFilter("all");
  };
  const openDistrict = (d: Pick<GrievanceMapDistrict, "district_id">) => {
    resetLists();
    setParams({ district: d.district_id });
  };
  const openLocalBody = (lb: Pick<GrievanceMapLocalBody, "type" | "id">) => {
    setParams({ ...(districtParam ? { district: districtParam } : {}), type: lb.type, id: lb.id });
  };
  const goState = () => {
    resetLists();
    setParams({});
  };
  const goDistrict = () => {
    const id = districtParam || area?.district_id;
    setParams(id ? { district: id } : {});
  };

  const level = area ? "local_body" : districtMap ? "district" : "state";
  const q = search.trim().toLowerCase();

  const rankedDistricts = useMemo(
    () =>
      [...(stateMap?.districts ?? [])]
        .filter((d) => !q || d.name.toLowerCase().includes(q))
        .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name)),
    [stateMap, q]
  );
  const lbCounts = useMemo(() => {
    const out: Record<string, number> = { all: 0, ulb: 0, rlb: 0 };
    for (const lb of districtMap?.local_bodies ?? []) {
      out.all += 1;
      out[lb.category] += 1;
      out[lb.type] = (out[lb.type] ?? 0) + 1;
    }
    return out;
  }, [districtMap]);
  const rankedLbs = useMemo(
    () =>
      (districtMap?.local_bodies ?? [])
        .filter((lb) => (lbFilter === "all" || lb.category === lbFilter || lb.type === lbFilter) && (!q || lb.name.toLowerCase().includes(q)))
        .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name)),
    [districtMap, lbFilter, q]
  );

  const crumbs = [
    { label: stateMap?.state_name || "Tamil Nadu", onClick: level === "state" ? undefined : goState },
    ...(districtMap || area
      ? [{ label: districtMap?.district_name || area?.district_name || "", onClick: level === "local_body" ? goDistrict : undefined }]
      : []),
    ...(area ? [{ label: area.local_body.name, onClick: undefined }] : []),
  ];

  const chip = (on: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
      on ? "border-[#0A5C36] bg-[#0A5C36] text-white" : "border-black/10 bg-white text-black/70 hover:border-black/30"
    }`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-bold text-black/45 transition hover:text-[#0A5C36]"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-bold" aria-label="Map level">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-black/30" />}
              {c.onClick ? (
                <button onClick={c.onClick} className="text-[#0A5C36] underline-offset-2 hover:underline">{c.label}</button>
              ) : (
                <span className="text-[#0A0A0A]">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_400px] 2xl:grid-cols-[1fr_460px]">
        {/* map */}
        <div className={`${cardClass} relative h-[60vh] min-h-[420px] overflow-hidden lg:h-auto`}>
          <GrievanceGeoMap
            state={stateMap}
            district={districtMap}
            area={area}
            lbFilter={lbFilter}
            focusPin={focusPin}
            onPickPin={setFocusPin}
            loading={loading}
            onSelectDistrict={openDistrict}
            onSelectLocalBody={openLocalBody}
            onZoomOut={area ? goDistrict : goState}
          />
          {level === "district" && (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex flex-wrap gap-1.5">
              {(["all", "ulb", "rlb"] as const).map((f) => (
                <button key={f} onClick={() => setLbFilter(f)} className={`pointer-events-auto ${chip(lbFilter === f)}`}>
                  {f === "all" ? "All" : f.toUpperCase()}
                  <span className="tabular-nums opacity-70">{fmt(lbCounts[f] ?? 0)}</span>
                </button>
              ))}
              {LB_TYPES.filter((t) => lbCounts[t]).map((t) => (
                <button key={t} onClick={() => setLbFilter(t)} className={`pointer-events-auto ${chip(lbFilter === t)}`}>
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/70" style={{ background: TYPE_COLOR[t] }} />
                  {TYPE_LABEL[t]}
                  <span className="tabular-nums opacity-70">{fmt(lbCounts[t])}</span>
                </button>
              ))}
            </div>
          )}
          {level === "state" && stateMap && (
            <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-lg border border-black/10 bg-white/95 px-3 py-1 text-[11px] font-semibold text-black/60 shadow-sm">
              Click or zoom into a district to see its ULBs &amp; RLBs
            </div>
          )}
        </div>

        {/* side panel */}
        <aside
          className={`${cardClass} flex max-h-[80vh] flex-col gap-4 p-4 lg:max-h-[calc(100vh-200px)] ${
            focusedPin ? "lg:overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {level === "local_body" && area && focusedPin && (
            <ComplaintDetailCard
              pin={focusedPin}
              area={area}
              onClose={() => setFocusPin(null)}
              onPatch={(patch) => patchPin(focusedPin.ticket_no, patch)}
            />
          )}

          {level === "state" && stateMap && (
            <>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-black/45">State</p>
                <h2 className="text-xl font-extrabold">{stateMap.state_name} complaints</h2>
              </div>
              <StatTiles counts={stateMap.totals} />
              <StatusBreakdown rows={stateMap.by_status} />
              <LevelBreakdown byLevel={stateMap.by_level} />
              <SearchBox value={search} onChange={setSearch} placeholder="Find a district" />
              <ul className="-mx-1 divide-y divide-black/5">
                {rankedDistricts.map((d) => (
                  <RankedRow key={d.district_id} name={d.name} sub={`${fmt(d.total)} total · ${fmt(d.resolved)} resolved`} counts={d} onClick={() => openDistrict(d)} />
                ))}
              </ul>
            </>
          )}

          {level === "district" && districtMap && (
            <>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-black/45">District</p>
                <h2 className="text-xl font-extrabold">{districtMap.district_name}</h2>
                <p className="text-xs text-black/50">
                  {fmt(lbCounts.ulb)} ULBs · {fmt(lbCounts.rlb)} RLBs
                </p>
              </div>
              <StatTiles counts={districtMap.totals} />
              <StatusBreakdown rows={districtMap.by_status} />
              <LevelBreakdown byLevel={districtMap.by_level} />
              <SearchBox value={search} onChange={setSearch} placeholder="Find a corporation, municipality, panchayat…" />
              <ul className="-mx-1 divide-y divide-black/5">
                {rankedLbs.slice(0, 200).map((lb) => (
                  <RankedRow
                    key={lb.id}
                    name={lb.name}
                    sub={`${TYPE_LABEL[lb.type]} · ${lb.category.toUpperCase()} · ${fmt(lb.total)} total`}
                    counts={lb}
                    color={TYPE_COLOR[lb.type]}
                    onClick={() => openLocalBody(lb)}
                  />
                ))}
              </ul>
              {rankedLbs.length > 200 && (
                <p className="text-center text-[11px] text-black/45">
                  Showing 200 of {fmt(rankedLbs.length)} — search or filter to narrow down.
                </p>
              )}
            </>
          )}

          {level === "local_body" && area && (
            <div className={`flex flex-col gap-4 ${focusedPin ? "lg:hidden" : ""}`}>
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-black/45">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[area.local_body.type] }} />
                  {TYPE_LABEL[area.local_body.type]} · {area.local_body.category.toUpperCase()}
                </p>
                <h2 className="text-xl font-extrabold">{area.local_body.name}</h2>
                <p className="text-xs text-black/50">
                  {area.district_name} District · {area.state_name}
                </p>
                {area.local_body.coordinates.length < 3 && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">No geofence on record for this body.</p>
                )}
              </div>
              <StatTiles counts={area.totals} overdue={area.totals.overdue} />

              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-black/45">
                  <Layers className="h-3.5 w-3.5" /> Complaint hierarchy
                </p>
                <p className="mb-2 text-[11px] text-black/50">
                  A complaint starts at the lowest level and moves up automatically if it is not resolved in time. Pick a
                  complaint to see who is handling it.
                </p>
                <HierarchyLadder area={area} />
              </section>

              <StatusBreakdown rows={area.by_status} />

              <section>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-black/45">
                  <MapPin className="h-3.5 w-3.5" /> Complaints on the map
                </p>
                {area.tickets.length === 0 ? (
                  <p className="text-xs text-black/45">No open or recently closed complaints here.</p>
                ) : (
                  <ul className="-mx-1 divide-y divide-black/5">
                    {area.tickets.map((t) => {
                      const s = PIN_STATUS[pinState(t)];
                      return (
                        <li key={t.ticket_no}>
                          <button
                            onClick={() => setFocusPin(t.ticket_no)}
                            aria-current={focusPin === t.ticket_no ? "true" : undefined}
                            className={`flex w-full items-start gap-2.5 rounded-xl border-l-4 px-2.5 py-2 text-left transition ${
                              focusPin === t.ticket_no
                                ? "border-[#0A5C36] bg-[#0A5C36]/10 ring-1 ring-[#0A5C36]/30"
                                : "border-transparent hover:bg-[#0A5C36]/5"
                            }`}
                          >
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-bold">{t.category || "Complaint"}</span>
                                {focusPin === t.ticket_no && (
                                  <span className="shrink-0 rounded-full bg-[#0A5C36] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                    Viewing
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-[11px] text-black/45">
                                {t.ticket_no} · {t.status}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black/55">
                              {t.is_overdue ? <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> : <Clock className="h-3.5 w-3.5" />}
                              {t.days_open}d
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {area.tickets_truncated && (
                  <p className="mt-1 text-center text-[11px] text-black/45">Showing the most recent {fmt(area.tickets.length)}.</p>
                )}
              </section>
            </div>
          )}

          {loading && !stateMap && (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#0A5C36]" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border-[1.5px] border-black/15 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-[#0A5C36] focus:ring-4 focus:ring-[#0A5C36]/15"
      />
    </div>
  );
}
