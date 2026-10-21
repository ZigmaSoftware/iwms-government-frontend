import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  ClipboardCheck,
  Globe,
  Database,
  House,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Map as MapIcon,
  MapPinned,
  Search,
  MessageSquareWarning,
  Minus,
  Route,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";

import { adminEndpoints } from "@/helpers/admin/endpoints";
import { isStoredSuperAdmin } from "@/utils/permissions";
import type {
  DistrictRow,
  LocalBodyGrant,
  LocalBodyPlatformRow,
  SuperadminDashboardData,
} from "./types";
import {
  Badge,
  DataTable,
  DateRangeControl,
  Filter,
  HeroStats,
  Kpi,
  KpiGrid,
  MasterCounts,
  Meter,
  MultiSelect,
  PageHeader,
  Panel,
  Section,
  SectionNav,
  SingleSelect,
  SplitChart,
  StatusPills,
  TrendChart,
  Two,
} from "./shared";
import {
  dateTime,
  inputClass,
  mutedClass,
  num,
  panelClass,
  pct,
  rangeFor,
  rangeParams,
  shortDay,
  weight,
  type Column,
  type DateRange,
} from "./dashboardUtils";
import { useDashboardData } from "./useDashboardData";
import { NoAccess } from "./NoAccess";

const URL = `/${adminEndpoints.superadminDashboard}/`;

type T = (key: string, fallback: string) => string;
type RoleRow = SuperadminDashboardData["staff_by_role"][number];
type StaffGrantRow = SuperadminDashboardData["permissions"]["staff_grants"][number];
type LoginRow = SuperadminDashboardData["activity"]["by_local_body"][number];

/** Every district and local body on the platform. Super admins only. */
export default function SuperadminDashboard() {
  if (!isStoredSuperAdmin()) return <NoAccess kind="superadmin" />;
  return <SuperadminDashboardContent />;
}

function SuperadminDashboardContent() {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>(() => rangeFor("30d"));
  const [stateIds, setStateIds] = useState<string[]>([]);
  const params = useMemo(
    () => ({
      ...rangeParams(range),
      ...(stateIds.length ? { state_id: stateIds.join(",") } : {}),
    }),
    [range, stateIds],
  );
  const { data, loading, error, refresh } = useDashboardData<SuperadminDashboardData>(URL, params);

  const daily = useMemo(() => data?.daily ?? [], [data]);
  const labels = useMemo(() => daily.map((d) => shortDay(d.date)), [daily]);
  const districtColumns = useMemo(
    () => (data?.districts ?? []).map((d) => ({ id: d.district_id, name: d.district_name })),
    [data],
  );
  const bodiesByType = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data?.platform.local_bodies_by_type ?? {}).map(([k, v]) => [k, v.total]),
      ),
    [data],
  );

  if (error === 403) return <NoAccess kind="superadmin" />;

  const busy = loading && !data;
  const p = data?.platform;
  const ops = data?.operations;
  const scope = data?.scope;

  const sections = [
    { id: "sa-platform", label: t("admin.dashboards.sections.platform", "Platform") },
    { id: "sa-operations", label: t("admin.dashboards.sections.operations", "Operations in this period") },
    { id: "sa-local-bodies", label: t("admin.dashboards.sections.local_bodies_all", "Local bodies") },
    { id: "sa-districts", label: t("admin.dashboards.sections.districts", "Districts") },
    { id: "sa-permissions", label: t("admin.dashboards.sections.permissions", "Permissions") },
    { id: "sa-people", label: t("admin.dashboards.sections.people", "Staff and sign-ins") },
    { id: "sa-masters", label: t("admin.dashboards.sections.masters", "Master data") },
  ];

  return (
    <div className="p-3 text-sm text-[#1d2b22] dark:text-[#e6efe8]">
      <PageHeader
        variant="superadmin"
        icon={<ShieldCheck size={24} aria-hidden="true" />}
        eyebrow={t("admin.dashboards.superadmin.eyebrow", "Government control centre")}
        title={t("admin.dashboards.superadmin.title", "Superadmin Dashboard")}
        subtitle={
          scope
            ? `${stateIds.length ? scope.state_name : t("admin.dashboards.superadmin.subtitle", "All districts and local bodies")} · ${shortDay(scope.from_date)}${scope.days > 1 ? ` – ${shortDay(scope.to_date)}` : ""}`
            : "…"
        }
        loading={loading}
        onRefresh={refresh}
        generatedAt={data?.generated_at}
        stats={
          <HeroStats
            items={[
              { label: t("admin.dashboards.kpi.districts", "Districts"), value: busy ? "…" : num(p?.districts), hint: `${num(p?.districts_active)} ${t("admin.dashboards.active", "active")} · ${num(p?.states)} ${t("admin.dashboards.states_lc", "states")}` },
              { label: t("admin.dashboards.kpi.local_bodies", "Local bodies"), value: busy ? "…" : num(p?.local_bodies), hint: `${num(p?.local_bodies_active)} ${t("admin.dashboards.active", "active")} · ${num(p?.wards)} ${t("admin.dashboards.wards_lc", "wards")}` },
              { label: t("admin.dashboards.kpi.staff_total", "Staff"), value: busy ? "…" : num(data?.staff.total), hint: `${num(data?.staff.active)} ${t("admin.dashboards.active", "active")} · ${num(data?.staff.login_enabled)} ${t("admin.dashboards.login_enabled", "can sign in")}` },
              { label: t("admin.dashboards.kpi.waste", "Waste collected"), value: busy ? "…" : weight(ops?.waste.total_kg), hint: `${weight(ops?.waste.avg_kg_per_day)}/${t("admin.dashboards.day", "day")}` },
            ]}
          />
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Filter label={t("admin.dashboards.state", "State")}>
              <MultiSelect
                label={t("admin.dashboards.state", "State")}
                icon={<Globe size={15} aria-hidden="true" className="shrink-0 text-[#4338ca] dark:text-[#c7c9ff]" />}
                options={data?.filters.states ?? []}
                value={stateIds}
                onChange={setStateIds}
                allLabel={t("admin.dashboards.all_states", "All states")}
              />
            </Filter>
            <Filter label={t("admin.dashboards.range.label", "Period")}>
              <DateRangeControl value={range} onChange={setRange} />
            </Filter>
          </div>
          <Link
            to={stateIds.length ? `/admin?state=${encodeURIComponent(stateIds.join(","))}` : "/admin"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c7c4f5] bg-[#eef0ff] px-3 py-[7px] text-sm font-medium text-[#3730a3] hover:bg-[#e0e3ff] dark:border-[#3b3a7a] dark:bg-[#23224a] dark:text-[#c7c9ff]"
          >
            <LayoutDashboard size={14} aria-hidden="true" />
            {t("admin.dashboards.superadmin.open_admin", "District / local body view")}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </PageHeader>

      <SectionNav items={sections} />

      <Section id="sa-platform" icon={<Layers size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.platform", "Platform")} description={t("admin.dashboards.sections.platform_hint", "Set-up across every district and local body")}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <KpiGrid>
              <Kpi loading={busy} tone="info" icon={<MapPinned size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.data_scopes", "Staff data scopes")} value={num(p?.staff_data_scopes)} hint={`${num(p?.staff_access_configs)} ${t("admin.dashboards.access_configs_lc", "access configurations")}`} />
              <Kpi loading={busy} icon={<House size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.customers", "Customers")} value={num(p?.customers)} />
              <Kpi loading={busy} icon={<Truck size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.vehicles_total", "Vehicles")} value={num(p?.vehicles)} hint={`${num(data?.fleet.active)} ${t("admin.dashboards.active", "active")}`} />
              <Kpi loading={busy} tone="neutral" icon={<ListChecks size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.catalog", "Permission screens")} value={`${num(p?.screens_seeded)} / ${num(p?.screens)}`} hint={`${num(p?.modules)} ${t("admin.dashboards.modules", "modules")} · ${num(p?.app_modules)} ${t("admin.dashboards.app_modules", "app modules")}`} />
              <Kpi loading={busy} tone="neutral" icon={<MapIcon size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.area_types", "Area types")} value={num(p?.area_types)} />
              <Kpi loading={busy} tone="neutral" icon={<ShieldCheck size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.platform_admins", "Super admins")} value={num(p?.platform_admins)} />
            </KpiGrid>
          </div>
          <Panel title={t("admin.dashboards.local_bodies_by_type", "Local bodies by type")}>
            <SplitChart counts={bodiesByType} labelFor={(k) => k} height={220} />
          </Panel>
        </div>
      </Section>

      <Section id="sa-operations" icon={<Activity size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.operations", "Operations in this period")}>
        <KpiGrid>
          <Kpi loading={busy} tone="info" icon={<Route size={18} aria-hidden="true" />} progress={ops?.trips.completion_rate} label={t("admin.dashboards.kpi.trips", "Trips completed")} value={`${num(ops?.trips.completed)} / ${num(ops?.trips.total)}`} hint={`${pct(ops?.trips.completion_rate)} ${t("admin.dashboards.completion", "completion")}`} />
          <Kpi loading={busy} tone="info" icon={<ClipboardCheck size={18} aria-hidden="true" />} progress={ops?.trip_logs.verification_rate} label={t("admin.dashboards.kpi.trip_logs", "Daily trip logs")} value={num(ops?.trip_logs.total)} hint={`${pct(ops?.trip_logs.verification_rate)} ${t("admin.dashboards.verified", "verified")}`} />
          <Kpi loading={busy} icon={<House size={18} aria-hidden="true" />} progress={ops?.households.coverage_rate} label={t("admin.dashboards.kpi.households", "Households collected")} value={num(ops?.households.collected)} hint={`${pct(ops?.households.coverage_rate)} ${t("admin.dashboards.coverage", "coverage")}`} />
          <Kpi loading={busy} icon={<Trash2 size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.bins", "Bins collected")} value={num(ops?.bins.distinct_bins_collected)} />
          <Kpi loading={busy} tone={ops?.complaints.overdue_open ? "bad" : "warn"} icon={<MessageSquareWarning size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.open_complaints", "Open complaints")} value={num(ops?.complaints.open)} hint={`${num(ops?.complaints.raised)} ${t("admin.dashboards.raised", "raised")}`} />
          <Kpi loading={busy} tone={ops?.exceptions.breakdowns ? "bad" : "neutral"} icon={<TriangleAlert size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.exceptions", "Breakdowns / re-trips")} value={`${num(ops?.exceptions.breakdowns)} / ${num(ops?.exceptions.retrips)}`} />
          <Kpi loading={busy} tone="info" icon={<LogIn size={18} aria-hidden="true" />} label={t("admin.dashboards.kpi.logins", "Sign-ins")} value={num(data?.activity.logins)} hint={`${num(data?.activity.active_users)} ${t("admin.dashboards.users", "users")} · ${num(data?.activity.failed_logins)} ${t("admin.dashboards.failed", "failed")}`} />
        </KpiGrid>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Panel title={t("admin.dashboards.charts.waste_per_day", "Waste collected per day")}>
            <TrendChart
              labels={labels}
              stacked
              format={weight}
              series={[
                { label: t("admin.dashboards.household", "Household"), values: daily.map((d) => d.household_kg), color: "#1f9d47" },
                { label: t("admin.dashboards.bins", "Bins"), values: daily.map((d) => d.bin_kg), color: "#2f72c9" },
              ]}
            />
          </Panel>
          <Panel title={t("admin.dashboards.charts.trips_per_day", "Trips per day")}>
            <TrendChart
              labels={labels}
              series={[
                { label: t("admin.dashboards.scheduled", "Scheduled"), values: daily.map((d) => d.trips), color: "#c9dccf" },
                { label: t("admin.dashboards.completed", "Completed"), values: daily.map((d) => d.trips_completed), color: "#1f9d47" },
                { label: t("admin.dashboards.trip_logs", "Trip logs"), values: daily.map((d) => d.trip_logs), color: "#ef5a1c", type: "line" },
              ]}
            />
          </Panel>
          <Panel title={t("admin.dashboards.charts.logins_per_day", "Sign-ins per day")}>
            <TrendChart
              labels={labels}
              stacked
              series={[
                { label: t("admin.dashboards.success", "Successful"), values: (data?.activity.per_day ?? []).map((d) => d.success), color: "#1f9d47" },
                { label: t("admin.dashboards.failed", "Failed"), values: (data?.activity.per_day ?? []).map((d) => d.failed), color: "#d63b3b" },
              ]}
            />
          </Panel>
          <Panel title={t("admin.dashboards.charts.permission_changes", "Permission changes per day")}>
            <TrendChart
              labels={labels}
              series={[
                { label: t("admin.dashboards.changes", "Changes"), values: (data?.permissions.changes.per_day ?? []).map((d) => d.changes), color: "#7a5bd1" },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section id="sa-local-bodies" icon={<Building2 size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.local_bodies_all", "Local bodies")} description={t("admin.dashboards.sections.local_bodies_all_hint", "Every corporation, municipality, town panchayat, panchayat union and panchayat with staff, records or activity. Click one to open it in the Admin Dashboard.")}>
        <div className={panelClass}>
          <DataTable<LocalBodyPlatformRow>
            rows={data?.local_bodies ?? []}
            rowKey={(r) => r.local_body_id}
            fileName="superadmin-local-bodies"
            initialSort="total_kg"
            columns={localBodyColumnsFor(t)}
          />
        </div>
      </Section>

      <Section id="sa-districts" icon={<MapIcon size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.districts", "Districts")}>
        <div className={panelClass}>
          <DataTable<DistrictRow>
            rows={data?.districts ?? []}
            rowKey={(r) => r.district_id}
            fileName="superadmin-districts"
            initialSort="total_kg"
            columns={districtColumnsFor(t)}
          />
        </div>
      </Section>

      <Section id="sa-permissions" icon={<KeyRound size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.permissions", "Permissions")}>
        <PermissionExplorer grants={data?.permissions.local_body_grants ?? []} loading={busy} />
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title={t("admin.dashboards.staff_grants", "Staff holding each screen (view)")}>
            <DataTable<StaffGrantRow>
              rows={data?.permissions.staff_grants ?? []}
              rowKey={(r) => `${r.local_body_id}|${r.module}|${r.screen}`}
              fileName="superadmin-staff-grants"
              initialSort="staff"
              columns={[
                { key: "local_body", header: t("admin.dashboards.local_body", "Local body"), value: (r) => r.local_body_name },
                { key: "module", header: t("admin.dashboards.module", "Module"), value: (r) => r.module_label },
                { key: "screen", header: t("admin.dashboards.screen", "Screen"), value: (r) => r.screen_label },
                { key: "staff", header: t("admin.dashboards.staff_col", "Staff"), value: (r) => r.staff_with_view, align: "right" },
              ]}
            />
          </Panel>
          <Panel title={t("admin.dashboards.permission_changes", "Permission changes in this period")}>
            <div className="mb-2 text-[24px] font-semibold">{num(data?.permissions.changes.total)}</div>
            <div className="mb-1 text-xs text-[#66756b] dark:text-[#9aaba0]">{t("admin.dashboards.by_source", "By source")}</div>
            <StatusPills counts={data?.permissions.changes.by_source ?? {}} />
            <div className="mb-1 mt-2.5 text-xs text-[#66756b] dark:text-[#9aaba0]">{t("admin.dashboards.by_action", "By action")}</div>
            <StatusPills counts={data?.permissions.changes.by_action ?? {}} tones={{ CREATED: "ok", UPDATED: "info", DELETED: "bad" }} />
            <div className="mb-1 mt-2.5 text-xs text-[#66756b] dark:text-[#9aaba0]">{t("admin.dashboards.by_local_body", "By local body")}</div>
            <StatusPills counts={data?.permissions.changes.by_local_body ?? {}} />
          </Panel>
        </div>
      </Section>

      <Section id="sa-people" icon={<Users size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.people", "Staff and sign-ins")}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title={t("admin.dashboards.staff_by_role", "Staff by role")}>
            <SplitChart counts={data?.staff.by_role ?? {}} labelFor={(k) => k} />
          </Panel>
          <Panel className="xl:col-span-2" title={t("admin.dashboards.staff_by_area_role", "Staff by district, local body and role")}>
            <DataTable<RoleRow>
              rows={data?.staff_by_role ?? []}
              rowKey={(r) => `${r.district_id}|${r.local_body_id}|${r.role}`}
              fileName="superadmin-staff-by-role"
              columns={[
                { key: "district", header: t("admin.dashboards.district", "District"), value: (r) => r.district_name },
                { key: "local_body", header: t("admin.dashboards.local_body", "Local body"), value: (r) => r.local_body_name },
                { key: "role", header: t("admin.dashboards.role", "Role"), value: (r) => r.role },
                { key: "staff", header: t("admin.dashboards.staff_col", "Staff"), value: (r) => r.staff, align: "right" },
              ]}
            />
          </Panel>
        </div>
        <div className="mt-3">
          <Panel title={t("admin.dashboards.logins_by_local_body", "Sign-ins by local body")}>
            <DataTable<LoginRow>
              rows={data?.activity.by_local_body ?? []}
              rowKey={(r) => r.local_body_id || r.local_body_name}
              fileName="superadmin-sign-ins"
              initialSort="success"
              columns={[
                { key: "local_body", header: t("admin.dashboards.local_body", "Local body"), value: (r) => r.local_body_name },
                { key: "success", header: t("admin.dashboards.success", "Successful"), value: (r) => r.success, align: "right" },
                { key: "failed", header: t("admin.dashboards.failed", "Failed"), value: (r) => r.failed, align: "right" },
                { key: "users", header: t("admin.dashboards.users", "Users"), value: (r) => r.users, align: "right" },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section id="sa-masters" icon={<Database size={17} aria-hidden="true" />} title={t("admin.dashboards.sections.masters", "Master data")}>
        <MasterCounts rows={data?.masters ?? []} columns={districtColumns} by="district" loading={loading} />
      </Section>
    </div>
  );
}

const ACTIONS = ["view", "add", "edit", "delete", "use", "import", "export"] as const;

/** Which screens, with which actions, each local body is enabled for: pick a
 * local body, then a module on the left; the right side is a screen × action
 * matrix. */
function PermissionExplorer({ grants, loading }: { grants: LocalBodyGrant[]; loading: boolean }) {
  const { t } = useTranslation();
  const [grantKey, setGrantKey] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [query, setQuery] = useState("");

  // A grant without a local body applies to a whole district (or the
  // platform); it is keyed by its name.
  const keyOf = (g: LocalBodyGrant) => g.local_body_id || g.local_body_name;
  const options = useMemo(() => grants.map((g) => ({ id: keyOf(g), name: g.local_body_name })), [grants]);
  const current = grants.find((g) => keyOf(g) === grantKey) ?? grants[0];
  const modules = current?.modules ?? [];
  const needle = query.trim().toLowerCase();

  const isFull = (actions: string[]) => ACTIONS.every((a) => actions.includes(a));
  const screens = modules.flatMap((m) => m.screens);
  const full = screens.filter((s) => isFull(s.actions)).length;
  const viewOnly = screens.filter((s) => s.actions.length === 1 && s.actions[0] === "view").length;
  const coverage = Math.min(current?.coverage ?? 0, 100);

  const shown = modules
    .filter((m) => !moduleKey || m.module === moduleKey)
    .map((m) => ({
      ...m,
      screens: m.screens.filter((s) => !needle || `${m.label} ${s.label}`.toLowerCase().includes(needle)),
    }))
    .filter((m) => m.screens.length);

  return (
    <div className={panelClass}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-semibold">
            {t("admin.dashboards.local_body_permissions", "Local body permissions")}
          </h3>
          <p className={`m-0 text-xs ${mutedClass}`}>
            {t("admin.dashboards.local_body_permissions_hint", "Screens and actions the super admin has enabled for each local body in User Screen Permission")}
          </p>
        </div>
        <Filter label={t("admin.dashboards.local_body", "Local body")}>
          <SingleSelect
            label={t("admin.dashboards.local_body", "Local body")}
            icon={<Building2 className="h-4 w-4 shrink-0 text-[#4338ca]" aria-hidden="true" />}
            options={options}
            value={current ? keyOf(current) : ""}
            onChange={(id) => {
              setGrantKey(id);
              setModuleKey("");
            }}
          />
        </Filter>
      </div>

      {loading ? (
        <div className={mutedClass}>…</div>
      ) : !current ? (
        <div className={mutedClass}>{t("admin.dashboards.no_grants", "No local body has been given any screen yet.")}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[#e4e6f5] p-3 dark:border-[#2b2a52]">
              <div className={`text-xs ${mutedClass}`}>{t("admin.dashboards.coverage_title", "Catalog coverage")}</div>
              <div className="text-[20px] font-bold tabular-nums">{pct(coverage)}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0ff] dark:bg-[#23224a]">
                <div className="h-1.5 rounded-full bg-[#4338ca]" style={{ width: `${coverage}%` }} />
              </div>
            </div>
            <PermStat label={t("admin.dashboards.screens_enabled", "Screens enabled")} value={num(current.screens_enabled)} />
            <PermStat label={t("admin.dashboards.full_access", "Full access")} value={num(full)} />
            <PermStat label={t("admin.dashboards.view_only", "View only")} value={num(viewOnly)} />
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#e4e6f5] md:grid-cols-[240px_1fr] dark:border-[#2b2a52]">
            <nav className="max-h-[520px] overflow-y-auto border-b border-[#e4e6f5] bg-[#fafafe] p-2 md:border-b-0 md:border-r dark:border-[#2b2a52] dark:bg-[#18172f]">
              <ModuleButton
                active={!moduleKey}
                label={t("admin.dashboards.all_modules", "All modules")}
                count={screens.length}
                onClick={() => setModuleKey("")}
              />
              {modules.map((m) => (
                <ModuleButton
                  key={m.module}
                  active={moduleKey === m.module}
                  label={m.label}
                  count={m.screens.length}
                  complete={m.screens.every((s) => isFull(s.actions))}
                  onClick={() => setModuleKey(m.module)}
                />
              ))}
            </nav>
            <div className="min-w-0">
              <div className="flex items-center gap-2 border-b border-[#e4e6f5] p-2 dark:border-[#2b2a52]">
                <div className="relative flex-1">
                  <Search size={14} aria-hidden="true" className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`} />
                  <input
                    type="search"
                    aria-label={t("admin.dashboards.search_screens", "Search screens")}
                    placeholder={t("admin.dashboards.search_screens", "Search screens")}
                    className={`${inputClass} w-full pl-9`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-[464px] overflow-auto">
                {!shown.length ? (
                  <div className={`py-10 text-center ${mutedClass}`}>{t("admin.dashboards.no_rows", "Nothing to show")}</div>
                ) : (
                  <table className="w-full min-w-[520px] border-collapse text-[13px]">
                    <thead className="sticky top-0 z-10 bg-white dark:bg-[#17221b]">
                      <tr>
                        <th className={`border-b border-[#e4e6f5] px-3 py-2 text-left text-xs font-medium dark:border-[#2b2a52] ${mutedClass}`}>
                          {t("admin.dashboards.screen", "Screen")}
                        </th>
                        {ACTIONS.map((a) => (
                          <th key={a} className={`w-16 border-b border-[#e4e6f5] px-2 py-2 text-center text-xs font-medium capitalize dark:border-[#2b2a52] ${mutedClass}`}>
                            {a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((m) => (
                        <ModuleRows key={m.module} label={m.label} showLabel={!moduleKey} screens={m.screens} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModuleButton({
  active,
  label,
  count,
  complete,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  complete?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active
          ? "bg-[#4338ca] font-medium text-white"
          : "text-[#3c4b41] hover:bg-[#eef0ff] dark:text-[#c5d3ca] dark:hover:bg-[#23224a]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {complete && !active ? <CircleCheck size={13} aria-hidden="true" className="shrink-0 text-[#1f9d47]" /> : null}
      <span className={`shrink-0 text-[11px] tabular-nums ${active ? "text-white/80" : mutedClass}`}>{count}</span>
    </button>
  );
}

function ModuleRows({
  label,
  showLabel,
  screens,
}: {
  label: string;
  showLabel: boolean;
  screens: { name: string; label: string; actions: string[] }[];
}) {
  return (
    <>
      {showLabel ? (
        <tr>
          <td colSpan={ACTIONS.length + 1} className="bg-[#f7f7fd] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#4338ca] dark:bg-[#1c1b38] dark:text-[#c7c9ff]">
            {label}
          </td>
        </tr>
      ) : null}
      {screens.map((s) => (
        <tr key={s.name} className="hover:bg-[#fafafe] dark:hover:bg-[#1c1b38]">
          <td className="border-b border-[#f0f1f8] px-3 py-2 dark:border-[#22213f]">{s.label}</td>
          {ACTIONS.map((a) => (
            <td key={a} className="border-b border-[#f0f1f8] px-2 py-2 text-center dark:border-[#22213f]">
              {s.actions.includes(a) ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300">
                  <Check size={12} strokeWidth={3} aria-label={a} />
                </span>
              ) : (
                <Minus size={14} aria-label={`no ${a}`} className="inline text-gray-300 dark:text-gray-600" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const PermStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-[#e4e6f5] p-3 dark:border-[#2b2a52]">
    <div className={`text-xs ${mutedClass}`}>{label}</div>
    <div className="text-[20px] font-bold tabular-nums">{value}</div>
  </div>
);

const areaLink = "font-medium text-[#4338ca] hover:underline dark:text-[#c7c9ff]";

const localBodyColumnsFor = (t: T): Column<LocalBodyPlatformRow>[] => [
  {
    key: "local_body",
    header: t("admin.dashboards.local_body", "Local body"),
    value: (r) => r.local_body_name,
    render: (r) => (
      <Two
        main={
          <span className="inline-flex items-center gap-1.5">
            <Link to={`/admin?local_body=${encodeURIComponent(r.local_body_id)}`} className={areaLink}>
              {r.local_body_name}
            </Link>
            {!r.is_active ? <Badge tone="bad">{t("admin.dashboards.inactive", "inactive")}</Badge> : null}
          </span>
        }
        sub={`${r.type_label} · ${r.district_name || "–"} · ${num(r.wards)} ${t("admin.dashboards.wards_lc", "wards")}`}
      />
    ),
  },
  {
    key: "staff",
    header: t("admin.dashboards.staff_col", "Staff"),
    value: (r) => r.staff,
    render: (r) => (
      <Two
        main={`${num(r.staff_active)} / ${num(r.staff)} ${t("admin.dashboards.active", "active")}`}
        sub={`${num(r.staff_login_enabled)} ${t("admin.dashboards.login_enabled", "can sign in")}`}
      />
    ),
    align: "right",
  },
  {
    key: "configured",
    header: t("admin.dashboards.access", "Access"),
    value: (r) => r.staff_configured,
    render: (r) => (
      <Two
        main={`${num(r.staff_configured)} ${t("admin.dashboards.configured_lc", "configured")}`}
        sub={r.staff_without_grants ? `${num(r.staff_without_grants)} ${t("admin.dashboards.no_grants_lc", "without grants")}` : undefined}
      />
    ),
    align: "right",
  },
  {
    key: "screens",
    header: t("admin.dashboards.screens_enabled", "Screens enabled"),
    value: (r) => r.screen_coverage,
    render: (r) => <Meter value={r.screen_coverage} label={`${num(r.screens_enabled)} · ${pct(r.screen_coverage)}`} />,
    align: "right",
  },
  {
    key: "completion",
    header: t("admin.dashboards.trips", "Trips"),
    value: (r) => r.completion_rate,
    render: (r) => <Meter value={r.completion_rate} label={`${num(r.trips_completed)} / ${num(r.trips)}`} />,
    align: "right",
  },
  {
    key: "total_kg",
    header: t("admin.dashboards.waste", "Waste"),
    value: (r) => r.total_kg,
    render: (r) => <Two main={weight(r.total_kg)} sub={`${num(r.open_complaints)} ${t("admin.dashboards.open_complaints_lc", "open complaints")}`} />,
    align: "right",
  },
  {
    key: "logins",
    header: t("admin.dashboards.logins", "Sign-ins"),
    value: (r) => r.logins,
    render: (r) => (
      <Two
        main={`${num(r.logins)}${r.failed_logins ? ` · ${num(r.failed_logins)} ${t("admin.dashboards.failed", "failed")}` : ""}`}
        sub={dateTime(r.last_login)}
      />
    ),
    align: "right",
  },
  // CSV only:
  ...(
    [
      ["type", "Type", (r: LocalBodyPlatformRow) => r.type_label],
      ["district", "District", (r: LocalBodyPlatformRow) => r.district_name],
      ["wards", "Wards", (r: LocalBodyPlatformRow) => r.wards],
      ["staff_total", "Staff", (r: LocalBodyPlatformRow) => r.staff],
      ["staff_active", "Active staff", (r: LocalBodyPlatformRow) => r.staff_active],
      ["staff_login", "Can sign in", (r: LocalBodyPlatformRow) => r.staff_login_enabled],
      ["no_grants", "No grants", (r: LocalBodyPlatformRow) => r.staff_without_grants],
      ["screens_n", "Screens enabled", (r: LocalBodyPlatformRow) => r.screens_enabled],
      ["modules", "Modules", (r: LocalBodyPlatformRow) => r.modules_enabled],
      ["customers", "Customers", (r: LocalBodyPlatformRow) => r.customers],
      ["vehicles", "Vehicles", (r: LocalBodyPlatformRow) => r.vehicles],
      ["bins", "Bins (master)", (r: LocalBodyPlatformRow) => r.bins],
      ["trips_n", "Trips", (r: LocalBodyPlatformRow) => r.trips],
      ["trips_done", "Completed", (r: LocalBodyPlatformRow) => r.trips_completed],
      ["kg", "Waste (kg)", (r: LocalBodyPlatformRow) => r.total_kg],
      ["breakdowns", "Breakdowns", (r: LocalBodyPlatformRow) => r.breakdowns],
      ["complaints", "Open complaints", (r: LocalBodyPlatformRow) => r.open_complaints],
      ["failed", "Failed sign-ins", (r: LocalBodyPlatformRow) => r.failed_logins],
      ["last_login", "Last sign-in", (r: LocalBodyPlatformRow) => r.last_login ?? ""],
    ] as const
  ).map(([key, header, value]) => ({ key, header, value, exportOnly: true })),
];

const districtColumnsFor = (t: T): Column<DistrictRow>[] => [
  {
    key: "district",
    header: t("admin.dashboards.district", "District"),
    value: (r) => r.district_name,
    render: (r) => (
      <Two
        main={
          <span className="inline-flex items-center gap-1.5">
            <Link to={`/admin?district=${encodeURIComponent(r.district_id)}`} className={areaLink}>
              {r.district_name}
            </Link>
            {!r.is_active ? <Badge tone="bad">{t("admin.dashboards.inactive", "inactive")}</Badge> : null}
          </span>
        }
        sub={`${r.state_name ? `${r.state_name} · ` : ""}${num(r.local_bodies)} ${t("admin.dashboards.local_bodies_lc", "local bodies")} · ${num(r.wards)} ${t("admin.dashboards.wards_lc", "wards")}`}
      />
    ),
  },
  {
    key: "staff",
    header: t("admin.dashboards.resources", "Resources"),
    value: (r) => r.staff,
    render: (r) => (
      <Two
        main={`${num(r.staff)} ${t("admin.dashboards.staff", "staff")} · ${num(r.vehicles)} ${t("admin.dashboards.vehicles_lc", "vehicles")}`}
        sub={`${num(r.customers)} ${t("admin.dashboards.customers_lc", "customers")} · ${num(r.bins)} ${t("admin.dashboards.bins_lc", "bins")}`}
      />
    ),
    align: "right",
  },
  {
    key: "completion",
    header: t("admin.dashboards.trips", "Trips"),
    value: (r) => r.completion_rate,
    render: (r) => <Meter value={r.completion_rate} label={`${num(r.trips_completed)} / ${num(r.trips)}`} />,
    align: "right",
  },
  { key: "logs", header: t("admin.dashboards.trip_logs", "Trip logs"), value: (r) => r.trip_logs, align: "right" },
  {
    key: "total_kg",
    header: t("admin.dashboards.waste", "Waste"),
    value: (r) => r.total_kg,
    render: (r) => <Two main={weight(r.total_kg)} sub={`${num(r.open_complaints)} ${t("admin.dashboards.open_complaints_lc", "open complaints")}`} />,
    align: "right",
  },
  { key: "breakdowns", header: t("admin.dashboards.breakdowns", "Breakdowns"), value: (r) => r.breakdowns, align: "right" },
  ...(
    [
      ["state", "State", (r: DistrictRow) => r.state_name],
      ["local_bodies", "Local bodies", (r: DistrictRow) => r.local_bodies],
      ["wards", "Wards", (r: DistrictRow) => r.wards],
      ["staff_n", "Staff", (r: DistrictRow) => r.staff],
      ["vehicles", "Vehicles", (r: DistrictRow) => r.vehicles],
      ["customers", "Customers", (r: DistrictRow) => r.customers],
      ["bins", "Bins (master)", (r: DistrictRow) => r.bins],
      ["trips", "Trips", (r: DistrictRow) => r.trips],
      ["trips_done", "Completed", (r: DistrictRow) => r.trips_completed],
      ["household_kg", "Household (kg)", (r: DistrictRow) => r.household_kg],
      ["bin_kg", "Bins (kg)", (r: DistrictRow) => r.bin_kg],
      ["kg", "Waste (kg)", (r: DistrictRow) => r.total_kg],
      ["complaints", "Open complaints", (r: DistrictRow) => r.open_complaints],
    ] as const
  ).map(([key, header, value]) => ({ key, header, value, exportOnly: true })),
];
