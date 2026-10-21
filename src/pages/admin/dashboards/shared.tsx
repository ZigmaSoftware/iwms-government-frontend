import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  CalendarClock,
  Database,
  Download,
  Globe,
  House,
  LayoutGrid,
  MapPin,
  MessageSquareWarning,
  Recycle,
  ShieldCheck,
  Table2,
  Truck,
  UserCog,
  Users,
  RefreshCw,
  X,
} from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CountMap, MasterRow } from "./types";
import {
  PALETTE,
  humanize,
  inputClass,
  iso,
  monthRange,
  mutedClass,
  num,
  panelClass,
  rangeFor,
  triggerClass,
  type Column,
  type DateRange,
  type RangePreset,
  type Tone,
} from "./dashboardUtils";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const TONE_BAR: Record<Tone, string> = {
  ok: "bg-[#1f9d47]",
  info: "bg-[#2f72c9]",
  warn: "bg-[#d99a06]",
  bad: "bg-[#d63b3b]",
  neutral: "bg-[#9ca3af]",
};

const TONE_ICON: Record<Tone, string> = {
  ok: "bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300",
  info: "bg-[#e3eefc] text-[#2357a0] dark:bg-blue-900/40 dark:text-blue-300",
  warn: "bg-[#fff3d6] text-[#9a6c00] dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-[#fde4e4] text-[#b42626] dark:bg-red-900/40 dark:text-red-300",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const BADGE: Record<Tone, string> = {
  ok: "bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300",
  info: "bg-[#e3eefc] text-[#2357a0] dark:bg-blue-900/40 dark:text-blue-300",
  warn: "bg-[#fff3d6] text-[#9a6c00] dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-[#fde4e4] text-[#b42626] dark:bg-red-900/40 dark:text-red-300",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const presets: [RangePreset, string][] = [
    ["today", t("admin.dashboards.range.today", "Today")],
    ["yesterday", t("admin.dashboards.range.yesterday", "Yesterday")],
    ["7d", t("admin.dashboards.range.last7", "Last 7 days")],
    ["30d", t("admin.dashboards.range.last30", "Last 30 days")],
    ["month", t("admin.dashboards.range.month", "This month")],
    ["3m", t("admin.dashboards.range.last3m", "Last 3 months")],
    ["6m", t("admin.dashboards.range.last6m", "Last 6 months")],
    ["year", t("admin.dashboards.range.year", "This year")],
    ["day", t("admin.dashboards.range.day", "Pick a day")],
    ["custom", t("admin.dashboards.range.custom", "Date range")],
    ["months", t("admin.dashboards.range.months", "Month range")],
  ];

  const max = iso(new Date());
  const maxMonth = max.slice(0, 7);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SingleSelect
        label={t("admin.dashboards.range.label", "Period")}
        icon={<CalendarDays className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />}
        options={presets.map(([id, name]) => ({ id, name }))}
        value={value.preset}
        onChange={(id) => onChange(rangeFor(id as RangePreset, value))}
        className="w-[170px]"
        searchable={false}
      />
      {value.preset === "day" ? (
        <input
          type="date"
          aria-label={t("admin.dashboards.range.day", "Pick a day")}
          className={inputClass}
          max={max}
          value={value.to}
          onChange={(e) =>
            e.target.value && onChange({ preset: "day", from: e.target.value, to: e.target.value })
          }
        />
      ) : null}
      {value.preset === "custom" ? (
        <>
          <input
            type="date"
            aria-label={t("admin.dashboards.range.from", "From")}
            className={inputClass}
            max={value.to}
            value={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <span className={mutedClass}>–</span>
          <input
            type="date"
            aria-label={t("admin.dashboards.range.to", "To")}
            className={inputClass}
            min={value.from}
            max={max}
            value={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </>
      ) : null}
      {value.preset === "months" ? (
        <>
          <input
            type="month"
            aria-label={t("admin.dashboards.range.from_month", "From month")}
            className={inputClass}
            max={value.to.slice(0, 7)}
            value={value.from.slice(0, 7)}
            onChange={(e) => e.target.value && onChange(monthRange(e.target.value, value.to.slice(0, 7)))}
          />
          <span className={mutedClass}>–</span>
          <input
            type="month"
            aria-label={t("admin.dashboards.range.to_month", "To month")}
            className={inputClass}
            min={value.from.slice(0, 7)}
            max={maxMonth}
            value={value.to.slice(0, 7)}
            onChange={(e) => e.target.value && onChange(monthRange(value.from.slice(0, 7), e.target.value))}
          />
        </>
      ) : null}
    </div>
  );
}

/* ---------- Building blocks ---------- */

export type Variant = "admin" | "superadmin";

const HERO: Record<Variant, string> = {
  admin: "bg-gradient-to-br from-[#0d5c2d] via-[#1f9d47] to-[#0f9488]",
  superadmin: "bg-gradient-to-br from-[#1e1b4b] via-[#4338ca] to-[#7c3aed]",
};

/** Coloured banner with the page title, scope line and refresh, followed by
 * a card holding the page's filters (`children`). */
export function PageHeader({
  variant,
  icon,
  eyebrow,
  title,
  subtitle,
  loading,
  onRefresh,
  generatedAt,
  stats,
  children,
}: {
  variant: Variant;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: ReactNode;
  loading: boolean;
  onRefresh: () => void;
  generatedAt?: string;
  stats?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const updated = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <header className="mb-5">
      <div className={`relative overflow-hidden rounded-2xl px-5 pb-12 pt-5 text-white shadow-lg ${HERO[variant]}`}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                {eyebrow}
              </div>
              <h1 className="m-0 text-[24px] font-bold leading-tight">{title}</h1>
              <p className="m-0 mt-1 text-[13px] text-white/85">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {updated ? (
              <span className="hidden text-xs text-white/75 sm:inline">
                {t("admin.dashboards.updated", "Updated")} {updated}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1d2b22] shadow-sm hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              {t("admin.dashboards.refresh", "Refresh")}
            </button>
          </div>
        </div>
        {stats ? <div className="relative mt-5">{stats}</div> : null}
      </div>
      {children ? (
        <div className="relative z-20 mx-3 -mt-8 rounded-xl border border-[#dfe8e2] bg-white p-3 shadow-md dark:border-[#26352b] dark:bg-[#17221b]">
          {children}
        </div>
      ) : null}
    </header>
  );
}

/** Big white numbers inside the banner. */
export function HeroStats({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
          <dt className="text-[12px] text-white/75">{item.label}</dt>
          <dd className="m-0 text-[22px] font-bold leading-tight tabular-nums">{item.value}</dd>
          {item.hint ? <div className="text-[11px] text-white/70">{item.hint}</div> : null}
        </div>
      ))}
    </dl>
  );
}

/** One labelled control in the filter card. */
export const Filter = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#66756b] dark:text-[#9aaba0]">
      {label}
    </span>
    {children}
  </div>
);

export type Option = { id: string; name: string; group?: string };

/** shadcn multi-select combobox (Popover + Command). Empty selection = all. */
export function MultiSelect({
  label,
  icon,
  options,
  value,
  onChange,
  allLabel,
}: {
  label: string;
  icon?: ReactNode;
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  allLabel: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const groups = new Map<string, Option[]>();
  for (const o of options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find((o) => o.id === value[0])?.name ?? allLabel)
        : `${value.length} ${t("admin.dashboards.selected", "selected")}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={`${triggerClass} w-full sm:w-[250px]`}
        >
          {icon}
          <span className={`min-w-0 flex-1 truncate text-left ${value.length ? "font-medium" : "text-muted-foreground"}`}>
            {summary}
          </span>
          {value.length > 1 ? (
            <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">{value.length}</span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={`${t("admin.dashboards.search", "Search")}…`} />
          <CommandList>
            <CommandEmpty>{t("admin.dashboards.no_rows", "Nothing to show")}</CommandEmpty>
            {[...groups.entries()].map(([group, items]) => (
              <CommandGroup key={group || "_"} heading={group || undefined}>
                {items.map((o) => {
                  const on = selected.has(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.id}
                      keywords={[o.name, o.group ?? ""]}
                      onSelect={() => toggle(o.id)}
                    >
                      <span
                        className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary ${
                          on ? "bg-primary text-primary-foreground" : "opacity-50"
                        }`}
                      >
                        {on ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                      </span>
                      <span className="truncate">{o.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          <CommandSeparator />
          <div className="flex items-center justify-between p-1">
            <button
              type="button"
              className="rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              disabled={value.length === options.length}
              onClick={() => onChange(options.map((o) => o.id))}
            >
              {t("admin.dashboards.select_all", "Select all")}
            </button>
            <button
              type="button"
              className="rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              disabled={!value.length}
              onClick={() => onChange([])}
            >
              {t("admin.dashboards.clear", "Clear")}
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** shadcn single-select with search. */
export function SingleSelect({
  label,
  icon,
  options,
  value,
  onChange,
  className = "w-full sm:w-[250px]",
  searchable = true,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          className={`${triggerClass} ${className}`}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? "–"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0">
        <Command>
          {searchable ? <CommandInput placeholder={`${t("admin.dashboards.search", "Search")}…`} /> : null}
          <CommandList>
            <CommandEmpty>{t("admin.dashboards.no_rows", "Nothing to show")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id || "_"}
                  value={o.id || "_"}
                  keywords={[o.name]}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${o.id === value ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                  <span className="truncate">{o.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Removable chips for the current selection. */
export function SelectionChips({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; kind: string; onRemove: () => void }[];
  onClearAll: () => void;
}) {
  const { t } = useTranslation();
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#eef3ef] pt-3 dark:border-[#22302a]">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-[#e3f6e8] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#167a37] dark:bg-green-900/40 dark:text-green-300"
        >
          <span className="opacity-70">{chip.kind}:</span> {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`${t("admin.dashboards.remove", "Remove")} ${chip.label}`}
            className="rounded-full p-0.5 hover:bg-[#167a37]/15"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="ml-1 text-xs font-medium text-[#b42626] hover:underline">
        {t("admin.dashboards.clear_all", "Clear all")}
      </button>
    </div>
  );
}

/** Pill links that scroll to each section. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="shrink-0 rounded-full border border-[#dfe8e2] bg-white px-3 py-1 text-[12px] font-medium text-[#3c4b41] hover:border-[#1f9d47] hover:text-[#167a37] dark:border-[#26352b] dark:bg-[#17221b] dark:text-[#c5d3ca]"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function Section({
  id,
  title,
  icon,
  description,
  children,
}: {
  id?: string;
  title: string;
  icon?: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-7 scroll-mt-4">
      <div className="mb-3 flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="m-0 text-[16px] font-semibold">{title}</h2>
          {description ? <p className={`m-0 text-xs ${mutedClass}`}>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export const KpiGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">{children}</div>
);

export function Kpi({
  label,
  value,
  hint,
  tone = "ok",
  icon,
  progress,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** 0–100; draws a bar under the value. */
  progress?: number | null;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#dfe8e2] bg-white px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#26352b] dark:bg-[#17221b]">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${TONE_BAR[tone]}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <div className={`text-[13px] font-medium ${mutedClass}`}>{label}</div>
        {icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="-mt-1 text-[26px] font-bold leading-tight tabular-nums">
        {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-[#eef3ef] dark:bg-[#22302a]" /> : value}
      </div>
      {progress !== undefined && progress !== null && !loading ? (
        <div className="mt-2 h-1.5 rounded-full bg-[#eef3ef] dark:bg-[#22302a]">
          <div
            className={`h-1.5 rounded-full ${TONE_BAR[tone]}`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      ) : null}
      {hint ? <div className={`mt-1.5 text-xs ${mutedClass}`}>{hint}</div> : null}
    </div>
  );
}

export const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`inline-block rounded-full px-[9px] py-0.5 text-xs font-medium ${BADGE[tone]}`}>
    {children}
  </span>
);

export function Panel({
  title,
  icon,
  actions,
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${panelClass} ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 inline-flex items-center gap-2 text-[15px] font-semibold">
          {icon ? <span className={mutedClass}>{icon}</span> : null}
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

export const Empty = ({ children }: { children?: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div className={`flex h-full min-h-[120px] items-center justify-center text-center ${mutedClass}`}>
      {children ?? t("admin.dashboards.no_data", "No data for this period")}
    </div>
  );
};

/* ---------- Charts ---------- */

function useChartColors() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return { grid: dark ? "#26352b" : "#dfe8e2", tick: dark ? "#9aaba0" : "#66756b" };
}

export type Series = { label: string; values: number[]; color: string; type?: "bar" | "line" };

/** Bars per day, optionally stacked, with line overlays. */
export function TrendChart({
  labels,
  series,
  stacked = false,
  height = 260,
  format,
}: {
  labels: string[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  format?: (value: number) => string;
}) {
  const colors = useChartColors();
  const data = useMemo(
    () => ({
      labels,
      datasets: series.map((s) => ({
        type: s.type ?? ("bar" as const),
        label: s.label,
        data: s.values,
        backgroundColor: s.color,
        borderColor: s.color,
        borderRadius: s.type === "line" ? 0 : 4,
        borderWidth: s.type === "line" ? 2 : 0,
        pointRadius: s.type === "line" ? 2 : 0,
        tension: 0.3,
        stack: stacked && s.type !== "line" ? "stack" : undefined,
      })),
    }),
    [labels, series, stacked],
  );
  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          display: series.length > 1,
          position: "bottom" as const,
          labels: { color: colors.tick, boxWidth: 12 },
        },
        tooltip: format
          ? {
              callbacks: {
                label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
                  `${ctx.dataset.label ?? ""}: ${format(ctx.parsed.y ?? 0)}`,
              },
            }
          : undefined,
      },
      scales: {
        x: { stacked, grid: { display: false }, ticks: { color: colors.tick, maxTicksLimit: 12 } },
        y: {
          stacked,
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: { color: colors.tick, precision: 0 },
        },
      },
    }),
    [colors, format, series.length, stacked],
  );
  if (!labels.length) return <Empty />;
  return (
    <div className="relative" style={{ height }}>
      {/* Mixed bar/line datasets: chart.js picks each dataset's own `type`. */}
      <Bar data={data as never} options={options} />
    </div>
  );
}

/** Doughnut over a {label: count} map. */
export function SplitChart({
  counts,
  height = 240,
  labelFor = humanize,
}: {
  counts: CountMap;
  height?: number;
  labelFor?: (key: string) => string;
}) {
  const colors = useChartColors();
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const data = useMemo(
    () => ({
      labels: entries.map(([k]) => labelFor(k)),
      datasets: [
        { data: entries.map(([, v]) => v), backgroundColor: PALETTE, borderWidth: 0 },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(entries), labelFor],
  );
  if (!entries.length) return <Empty />;
  return (
    <div className="relative" style={{ height }}>
      <Doughnut
        data={data}
        options={{
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: colors.tick, boxWidth: 12 },
            },
          },
        }}
      />
    </div>
  );
}

/** Horizontal bars for a short ranked list. */
export function RankList<T extends { id: string; name: string }>({
  rows,
  value,
  format = num,
  sub,
}: {
  rows: T[];
  value: (row: T) => number;
  format?: (v: number) => string;
  sub?: (row: T) => ReactNode;
}) {
  const values = rows.map(value);
  const max = Math.max(...values, 1);
  if (!rows.length) return <Empty />;
  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {rows.map((row, i) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate font-medium">
              {i + 1}. {row.name}
            </span>
            <span className="shrink-0 tabular-nums">
              {format(values[i])}
              {sub ? <span className={`ml-1.5 text-xs ${mutedClass}`}>{sub(row)}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#eef3ef] dark:bg-[#22302a]">
            <div
              className="h-1.5 rounded-full bg-[#1f9d47]"
              style={{ width: `${Math.max((values[i] / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A {status: count} map as labelled pills. */
export function StatusPills({
  counts,
  tones = {},
}: {
  counts: CountMap;
  tones?: Record<string, Tone>;
}) {
  const entries = Object.entries(counts);
  if (!entries.length) return <span className={mutedClass}>–</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <Badge key={key} tone={tones[key] ?? "neutral"}>
          {humanize(key)} · {num(value)}
        </Badge>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** Searchable, sortable, paginated table with CSV export of every matching row. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  fileName,
  initialSort,
  pageSize = 10,
  filters,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  fileName: string;
  initialSort?: string;
  pageSize?: number;
  /** Extra controls shown beside the search box. */
  filters?: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(
    initialSort ? { key: initialSort, desc: true } : null,
  );
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let out = needle
      ? rows.filter((row) =>
          columns.some((c) => String(c.value(row) ?? "").toLowerCase().includes(needle)),
        )
      : rows;
    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column) {
        out = [...out].sort((a, b) => {
          const x = column.value(a) ?? "";
          const y = column.value(b) ?? "";
          const cmp =
            typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y), undefined, { numeric: true });
          return sort.desc ? -cmp : cmp;
        });
      }
    }
    return out;
  }, [rows, columns, query, sort]);

  const shown = columns.filter((c) => !c.exportOnly);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  // Rows can shrink under the current page (new data, search); clamp.
  const current = Math.min(page, pages);

  const exportCsv = () => {
    const lines = [
      columns.map((c) => csvCell(c.header)).join(","),
      ...filtered.map((row) => columns.map((c) => csvCell(c.value(row))).join(",")),
    ];
    saveAs(
      new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `${fileName}-${iso(new Date())}.csv`,
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={t("admin.dashboards.search", "Search")}
          placeholder={t("admin.dashboards.search", "Search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} w-full sm:w-[220px]`}
        />
        {filters}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className={`${inputClass} inline-flex items-center gap-1.5 hover:border-[#1f9d47] disabled:opacity-60`}
        >
          <Download size={14} aria-hidden="true" />
          {t("admin.dashboards.export_csv", "Export CSV")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {shown.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap border-b border-[#dfe8e2] px-2.5 py-2 font-medium text-[#66756b] dark:border-[#26352b] dark:text-[#9aaba0] ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[#1d2b22] dark:hover:text-[#e6efe8]"
                    onClick={() => {
                      setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : true }));
                      setPage(1);
                    }}
                  >
                    {c.header}
                    <ArrowDownUp
                      size={11}
                      aria-hidden="true"
                      className={sort?.key === c.key ? "opacity-100" : "opacity-30"}
                    />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * size, current * size).map((row) => (
              <tr key={rowKey(row)} className="hover:bg-[#f6faf7] dark:hover:bg-[#1c2a21]">
                {shown.map((c) => (
                  <td
                    key={c.key}
                    className={`border-b border-[#eef3ef] px-2.5 py-2 align-middle dark:border-[#22302a] ${
                      c.align === "right" ? "whitespace-nowrap text-right tabular-nums" : ""
                    }`}
                  >
                    {c.render ? c.render(row) : String(c.value(row) ?? "–")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <Empty>{t("admin.dashboards.no_rows", "Nothing to show")}</Empty> : null}
      </div>
      {filtered.length ? (
        <Pagination
          page={current}
          pages={pages}
          size={size}
          total={filtered.length}
          onPage={setPage}
          onSize={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}

/** A table cell with a muted second line. */
export const Two = ({ main, sub }: { main: ReactNode; sub?: ReactNode }) => (
  <div className="leading-tight">
    <div className="font-medium">{main}</div>
    {sub ? <div className={`mt-0.5 text-[11px] font-normal ${mutedClass}`}>{sub}</div> : null}
  </div>
);

/** "8 / 22" with a thin bar for the share; for rates inside table cells. */
export const Meter = ({ value, label }: { value: number; label: ReactNode }) => (
  <div className="ml-auto w-[96px] leading-tight">
    <div className="font-medium">{label}</div>
    <div className="mt-1 h-1 rounded-full bg-[#eef3ef] dark:bg-[#22302a]">
      <div
        className={`h-1 rounded-full ${value >= 80 ? "bg-[#1f9d47]" : value >= 50 ? "bg-[#d99a06]" : "bg-[#d63b3b]"}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  </div>
);

const PAGE_SIZES = [10, 25, 50, 100];

/** 1 … 4 5 [6] 7 8 … 20 */
const pageList = (page: number, pages: number): (number | "…")[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push("…");
  out.push(pages);
  return out;
};

function Pagination({
  page,
  pages,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number;
  pages: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const { t } = useTranslation();
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, total);
  const nav =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background px-2 text-[13px] hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef3ef] pt-3 dark:border-[#22302a]">
      <div className={`flex items-center gap-2 text-[13px] ${mutedClass}`}>
        <span>{t("admin.dashboards.rows_per_page", "Rows per page")}</span>
        <SingleSelect
          label={t("admin.dashboards.rows_per_page", "Rows per page")}
          options={PAGE_SIZES.map((n) => ({ id: String(n), name: String(n) }))}
          value={String(size)}
          onChange={(id) => onSize(Number(id))}
          className="!h-8 w-[80px]"
          searchable={false}
        />
        <span className="tabular-nums">
          {num(first)}–{num(last)} {t("admin.dashboards.of", "of")} {num(total)}
        </span>
      </div>
      <nav aria-label={t("admin.dashboards.pagination", "Pagination")} className="flex items-center gap-1">
        <button type="button" className={nav} disabled={page === 1} onClick={() => onPage(1)} aria-label={t("admin.dashboards.first_page", "First page")}>
          <ChevronsLeft size={14} aria-hidden="true" />
        </button>
        <button type="button" className={nav} disabled={page === 1} onClick={() => onPage(page - 1)} aria-label={t("admin.dashboards.prev_page", "Previous page")}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className={`px-1 ${mutedClass}`}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={
                p === page
                  ? "inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-2 text-[13px] font-semibold text-primary-foreground"
                  : nav
              }
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={nav} disabled={page === pages} onClick={() => onPage(page + 1)} aria-label={t("admin.dashboards.next_page", "Next page")}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className={nav} disabled={page === pages} onClick={() => onPage(pages)} aria-label={t("admin.dashboards.last_page", "Last page")}>
          <ChevronsRight size={14} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

/* ---------- Masters ---------- */

const GROUP_LOOK: { match: RegExp; icon: typeof Database; tint: string }[] = [
  { match: /location/i, icon: MapPin, tint: "bg-[#e3eefc] text-[#2357a0] dark:bg-blue-900/40 dark:text-blue-300" },
  { match: /leader/i, icon: UserCog, tint: "bg-[#eef0ff] text-[#4338ca] dark:bg-[#23224a] dark:text-[#c7c9ff]" },
  { match: /waste|bin/i, icon: Recycle, tint: "bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300" },
  { match: /transport|vehicle/i, icon: Truck, tint: "bg-[#fff3d6] text-[#9a6c00] dark:bg-amber-900/40 dark:text-amber-300" },
  { match: /customer/i, icon: House, tint: "bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-900/40 dark:text-teal-300" },
  { match: /schedule/i, icon: CalendarClock, tint: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-900/40 dark:text-orange-300" },
  { match: /staff/i, icon: Users, tint: "bg-[#fce7f3] text-[#be185d] dark:bg-pink-900/40 dark:text-pink-300" },
  { match: /role/i, icon: ShieldCheck, tint: "bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-900/40 dark:text-violet-300" },
  { match: /complaint/i, icon: MessageSquareWarning, tint: "bg-[#fde4e4] text-[#b42626] dark:bg-red-900/40 dark:text-red-300" },
];
const lookFor = (group: string) =>
  GROUP_LOOK.find((g) => g.match.test(group)) ?? {
    icon: Database,
    tint: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };

/** Every master's count, grouped like the sidebar, with a per-local-body
 * (or per-district) matrix. */
export function MasterCounts({
  rows,
  columns,
  by,
  loading,
}: {
  rows: MasterRow[];
  columns: { id: string; name: string }[];
  by: "local_body" | "district";
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<"cards" | "matrix">("cards");
  const groups = useMemo(() => {
    const map = new Map<string, MasterRow[]>();
    for (const row of rows) map.set(row.group, [...(map.get(row.group) ?? []), row]);
    return [...map.entries()];
  }, [rows]);
  const breakdown = (row: MasterRow) => row.breakdown ?? {};
  const matrixGroups = groups
    .map(([group, items]) => [
      group,
      items.filter((row) => row.level !== "global" && Object.keys(row.breakdown ?? {}).length > 0),
    ] as const)
    .filter(([, items]) => items.length);
  const totalRecords = rows.reduce((sum, r) => sum + r.total, 0);

  const tabs = (
    <div role="tablist" className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
      {(["cards", "matrix"] as const).map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          onClick={() => setView(key)}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-all ${
            view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {key === "cards" ? <LayoutGrid size={13} aria-hidden="true" /> : <Table2 size={13} aria-hidden="true" />}
          {key === "cards"
            ? t("admin.dashboards.masters.totals", "Totals")
            : by === "local_body"
              ? t("admin.dashboards.masters.by_local_body", "By local body")
              : t("admin.dashboards.masters.by_district", "By district")}
        </button>
      ))}
    </div>
  );

  return (
    <div className={panelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className={`text-[13px] ${mutedClass}`}>
          <span className="font-semibold text-foreground">{num(rows.length)}</span> {t("admin.dashboards.masters.masters", "masters")} ·{" "}
          <span className="font-semibold text-foreground">{num(totalRecords)}</span> {t("admin.dashboards.masters.records", "records")} ·{" "}
          <span className="font-semibold text-foreground">{num(groups.length)}</span> {t("admin.dashboards.masters.groups", "groups")}
        </div>
        {tabs}
      </div>
      {loading && !rows.length ? (
        <Empty>…</Empty>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map(([group, items]) => {
            const look = lookFor(group);
            const Icon = look.icon;
            const sum = items.reduce((n, r) => n + r.total, 0);
            return (
              <div key={group} className="rounded-xl border border-[#e8eee9] bg-white transition hover:shadow-md dark:border-[#26352b] dark:bg-[#17221b]">
                <div className="flex items-center gap-3 border-b border-[#eef3ef] px-4 py-3 dark:border-[#22302a]">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${look.tint}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{group}</div>
                    <div className={`text-xs ${mutedClass}`}>
                      {items.length} {t("admin.dashboards.masters.masters", "masters")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[20px] font-bold leading-none tabular-nums">{num(sum)}</div>
                    <div className={`text-[11px] ${mutedClass}`}>{t("admin.dashboards.masters.records", "records")}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {items.map((row) => (
                    <div
                      key={row.key}
                      className={`rounded-lg bg-[#f6f8f7] px-3 py-2 dark:bg-[#1c2a21] ${row.total ? "" : "opacity-60"}`}
                    >
                      <div className={`flex items-center gap-1 text-xs ${mutedClass}`}>
                        <span className="truncate">{row.label}</span>
                        {row.level === "global" ? (
                          <Globe
                            size={11}
                            className="shrink-0"
                            aria-label={t("admin.dashboards.masters.global", "platform-wide")}
                          />
                        ) : null}
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[18px] font-bold tabular-nums">{num(row.total)}</span>
                        {row.inactive ? (
                          <span className="text-[11px] font-medium text-[#b42626] dark:text-red-300">
                            {num(row.inactive)} {t("admin.dashboards.inactive", "inactive")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className={`col-span-full m-0 flex items-center gap-1 text-xs ${mutedClass}`}>
            <Globe size={11} aria-hidden="true" /> {t("admin.dashboards.masters.global_hint", "Platform-wide master, shared by every local body")}
          </p>
        </div>
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-lg border border-[#e8eee9] dark:border-[#26352b]">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#f6f8f7] dark:bg-[#1c2a21]">
                <th className="sticky left-0 z-10 border-b border-[#e8eee9] bg-[#f6f8f7] px-3 py-2.5 text-left text-xs font-medium text-muted-foreground dark:border-[#26352b] dark:bg-[#1c2a21]">
                  {t("admin.dashboards.masters.master", "Master")}
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className="whitespace-nowrap border-b border-[#e8eee9] px-3 py-2.5 text-right text-xs font-medium text-muted-foreground dark:border-[#26352b]"
                  >
                    {c.name}
                  </th>
                ))}
                <th className="border-b border-[#e8eee9] px-3 py-2.5 text-right text-xs font-semibold dark:border-[#26352b]">
                  {t("admin.dashboards.total", "Total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixGroups.map(([group, items]) => {
                const Icon = lookFor(group).icon;
                return (
                  <Fragment key={group}>
                    <tr>
                      <td
                        colSpan={columns.length + 2}
                        className="border-b border-[#e8eee9] bg-white px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-[#26352b] dark:bg-[#17221b]"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon size={12} aria-hidden="true" /> {group}
                        </span>
                      </td>
                    </tr>
                    {items.map((row) => (
                      <tr key={row.key} className="group hover:bg-[#f6faf7] dark:hover:bg-[#1c2a21]">
                        <td className="sticky left-0 border-b border-[#f0f4f1] bg-white px-3 py-2 group-hover:bg-[#f6faf7] dark:border-[#22302a] dark:bg-[#17221b] dark:group-hover:bg-[#1c2a21]">
                          {row.label}
                        </td>
                        {columns.map((c) => {
                          const v = breakdown(row)[c.id] ?? 0;
                          return (
                            <td
                              key={c.id}
                              className="border-b border-[#f0f4f1] px-3 py-2 text-right tabular-nums dark:border-[#22302a]"
                            >
                              {v ? (
                                <span className="inline-block min-w-7 rounded-md bg-[#e3f6e8] px-1.5 py-0.5 text-center font-medium text-[#167a37] dark:bg-green-900/40 dark:text-green-300">
                                  {num(v)}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">–</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-[#f0f4f1] px-3 py-2 text-right font-semibold tabular-nums dark:border-[#22302a]">
                          {num(row.total)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
