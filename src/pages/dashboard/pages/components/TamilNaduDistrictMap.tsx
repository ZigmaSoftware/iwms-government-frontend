import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trash2,
  Truck,
  AlertTriangle,
  MapPin,
  X,
  TrendingUp,
  TrendingDown,
  Recycle,
  Building2,
  Droplets,
  Shield,
  Leaf,
} from "lucide-react";
import { DISTRICTS, TN_OUTLINE, type DistrictInfo } from "@/data/tnDistricts";

// ─── HELPERS ─────────────────────────────────────────────────────

function districtFill(perf: number, selected: boolean, hovered: boolean): string {
  if (selected) return "#2563eb";
  if (hovered) return "#0ea5e9";
  if (perf >= 90) return "#15803d";
  if (perf >= 80) return "#22c55e";
  if (perf >= 70) return "#84cc16";
  if (perf >= 60) return "#f59e0b";
  return "#ef4444";
}

function gradeLabel(perf: number): string {
  if (perf >= 90) return "A+";
  if (perf >= 80) return "A";
  if (perf >= 70) return "B";
  if (perf >= 60) return "C";
  return "D";
}

function gradeBadgeCls(perf: number): string {
  if (perf >= 90) return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (perf >= 80) return "bg-green-100 text-green-800 border border-green-300";
  if (perf >= 70) return "bg-lime-100 text-lime-800 border border-lime-300";
  if (perf >= 60) return "bg-amber-100 text-amber-800 border border-amber-300";
  return "bg-red-100 text-red-800 border border-red-300";
}

// ─── COMPONENT ───────────────────────────────────────────────────

export default function TamilNaduDistrictMap() {
  const [selected, setSelected] = useState<DistrictInfo | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    district: DistrictInfo;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, d: DistrictInfo) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        district: d,
      });
      setHovered(d.id);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHovered(null);
  }, []);

  const handleClick = useCallback((d: DistrictInfo) => {
    setSelected((prev) => (prev?.id === d.id ? null : d));
  }, []);

  const sortedByPerf = [...DISTRICTS].sort((a, b) => b.perf - a.perf);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Tamil Nadu — District Performance Map
          </CardTitle>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-700 inline-block" />≥90% A+
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-green-500 inline-block" />80–89% A
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-lime-400 inline-block" />70–79% B
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-amber-400 inline-block" />60–69% C
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-red-500 inline-block" />&lt;60% D
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="grid gap-4 lg:grid-cols-5">

          {/* ── SVG MAP ─────────────────────────────────────── */}
          <div className="lg:col-span-3 relative">
            <svg
              ref={svgRef}
              viewBox="76 0 5 6.5"
              className="w-full h-auto"
              style={{ maxHeight: 520 }}
              onMouseLeave={handleMouseLeave}
            >
              {/* Sea background */}
              <rect x="76" y="0" width="5" height="6.5" fill="#bfdbfe" />

              {/* TN land background (sea clipped away) */}
              <polygon
                points={TN_OUTLINE}
                fill="#f0fdf4"
                stroke="none"
              />

              {/* District fill polygons */}
              {DISTRICTS.map((d) => (
                <polygon
                  key={d.id}
                  points={d.points}
                  fill={districtFill(d.perf, selected?.id === d.id, hovered === d.id)}
                  stroke="white"
                  strokeWidth="0.012"
                  strokeLinejoin="round"
                  opacity={selected && selected.id !== d.id ? 0.55 : 1}
                  style={{ cursor: "pointer", transition: "fill 0.15s" }}
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onClick={() => handleClick(d)}
                />
              ))}

              {/* District name labels */}
              {DISTRICTS.map((d) => {
                const pts = d.points.trim().split(/\s+/).map((p) => {
                  const [x, y] = p.split(",").map(Number);
                  return { x, y };
                });
                const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                const label =
                  d.name === "The Nilgiris" ? "Nilgiris"
                  : d.name === "Tiruchirappalli" ? "Trichy"
                  : d.name === "Ramanathapuram" ? "Ramanath."
                  : d.name.length > 9 ? d.name.split(" ")[0]
                  : d.name;
                return (
                  <text
                    key={`label-${d.id}`}
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="0.082"
                    fill="white"
                    fontWeight="700"
                    style={{
                      pointerEvents: "none",
                      fontFamily: "system-ui, sans-serif",
                      filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.7))",
                    }}
                  >
                    {label}
                  </text>
                );
              })}

              {/* State outline border on top */}
              <polygon
                points={TN_OUTLINE}
                fill="none"
                stroke="#059669"
                strokeWidth="0.022"
                strokeLinejoin="round"
              />
            </svg>

            {/* ── Floating Tooltip ─────────────────────────── */}
            {tooltip && (
              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: Math.min(tooltip.x + 12, 260),
                  top: Math.max(tooltip.y - 10, 0),
                }}
              >
                <div className="bg-background border border-border rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-foreground">
                      {tooltip.district.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${gradeBadgeCls(tooltip.district.perf)}`}>
                      {gradeLabel(tooltip.district.perf)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Performance</span>
                      <span className="font-semibold">{tooltip.district.perf}%</span>
                    </div>
                    <Progress value={tooltip.district.perf} className="h-1" />
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Collected</span>
                      <span className="font-semibold">{tooltip.district.collected} MT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grievances</span>
                      <span className="font-semibold text-amber-600">
                        {tooltip.district.grievances - tooltip.district.resolved} pending
                      </span>
                    </div>
                    <div className="pt-1 text-[10px] text-muted-foreground italic">
                      Click for detailed breakdown
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ─────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-3">

            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold">{selected.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gradeBadgeCls(selected.perf)}`}>
                      {gradeLabel(selected.perf)} — {selected.perf}%
                    </span>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 p-2.5 bg-emerald-50/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Trash2 className="h-3 w-3 text-emerald-600" />
                      <span className="text-[11px] text-muted-foreground">Waste Collected</span>
                    </div>
                    <p className="text-base font-bold">{selected.collected} MT</p>
                    <p className="text-[11px] text-muted-foreground">of {selected.target} MT target</p>
                    <Progress
                      value={(selected.collected / selected.target) * 100}
                      className="h-1 mt-1.5"
                    />
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5 bg-blue-50/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Truck className="h-3 w-3 text-blue-600" />
                      <span className="text-[11px] text-muted-foreground">Fleet Status</span>
                    </div>
                    <p className="text-base font-bold">{selected.activeVehicles}/{selected.vehicles}</p>
                    <p className="text-[11px] text-muted-foreground">vehicles active</p>
                    <Progress
                      value={(selected.activeVehicles / selected.vehicles) * 100}
                      className="h-1 mt-1.5"
                    />
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5 bg-amber-50/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <span className="text-[11px] text-muted-foreground">Grievances</span>
                    </div>
                    <p className="text-base font-bold text-amber-700">
                      {selected.grievances - selected.resolved}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.resolved}/{selected.grievances} resolved
                    </p>
                    <Progress
                      value={(selected.resolved / selected.grievances) * 100}
                      className="h-1 mt-1.5"
                    />
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5 bg-violet-50/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Recycle className="h-3 w-3 text-violet-600" />
                      <span className="text-[11px] text-muted-foreground">Segregation</span>
                    </div>
                    <p className="text-base font-bold text-violet-700">{selected.segregationRate}%</p>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.localBodies} local bodies
                    </p>
                    <Progress value={selected.segregationRate} className="h-1 mt-1.5" />
                  </div>
                </div>

                {/* Waste breakdown */}
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold mb-2.5 text-foreground">Waste Type Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: "Wet Waste", value: selected.wet, Icon: Droplets, cls: "text-emerald-600", barCls: "bg-emerald-500" },
                      { label: "Dry Waste", value: selected.dry, Icon: Recycle, cls: "text-blue-600", barCls: "bg-blue-500" },
                      { label: "Sanitary", value: selected.sanitary, Icon: Shield, cls: "text-amber-600", barCls: "bg-amber-400" },
                      { label: "Special Care", value: selected.special, Icon: Leaf, cls: "text-violet-600", barCls: "bg-violet-500" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <item.Icon className={`h-3 w-3 ${item.cls} flex-shrink-0`} />
                        <span className="text-[11px] w-20 text-muted-foreground flex-shrink-0">
                          {item.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.barCls}`}
                            style={{ width: `${(item.value / selected.collected) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold w-14 text-right flex-shrink-0">
                          {item.value} MT
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend */}
                <div className="rounded-lg border border-border/60 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {selected.perf >= 80
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                    }
                    <span className="text-xs text-muted-foreground">
                      {selected.perf >= 80 ? "Performing well" : "Needs improvement"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[11px] h-5">
                    <Building2 className="h-3 w-3 mr-1" />
                    {selected.localBodies} local bodies
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  District Rankings — Click map to drill down
                </p>
                <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
                  {sortedByPerf.map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => handleClick(d)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
                    >
                      <span className="text-[11px] text-muted-foreground w-5 flex-shrink-0 text-right">
                        {i + 1}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                        style={{ background: districtFill(d.perf, false, false) }}
                      />
                      <span className="text-xs font-medium flex-1 truncate">{d.name}</span>
                      <span className={`text-[10px] px-1.5 rounded-full font-bold flex-shrink-0 ${gradeBadgeCls(d.perf)}`}>
                        {d.perf}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary footer ───────────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Top Performer",
              value: sortedByPerf[0].name,
              sub: `${sortedByPerf[0].perf}%`,
              cls: "text-emerald-700",
              dotCls: "bg-emerald-500",
            },
            {
              label: "Needs Attention",
              value: sortedByPerf[sortedByPerf.length - 1].name,
              sub: `${sortedByPerf[sortedByPerf.length - 1].perf}%`,
              cls: "text-red-700",
              dotCls: "bg-red-500",
            },
            {
              label: "State Average",
              value: `${Math.round(DISTRICTS.reduce((s, d) => s + d.perf, 0) / DISTRICTS.length)}%`,
              sub: `${DISTRICTS.length} districts`,
              cls: "text-sky-700",
              dotCls: "bg-sky-500",
            },
            {
              label: "A/A+ Grade",
              value: `${DISTRICTS.filter((d) => d.perf >= 80).length} districts`,
              sub: "≥80% performance",
              cls: "text-green-700",
              dotCls: "bg-green-500",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/60"
            >
              <span className={`h-2 w-2 rounded-full mt-1 flex-shrink-0 ${item.dotCls}`} />
              <div>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className={`text-xs font-bold ${item.cls}`}>{item.value}</p>
                <p className="text-[11px] text-muted-foreground">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
