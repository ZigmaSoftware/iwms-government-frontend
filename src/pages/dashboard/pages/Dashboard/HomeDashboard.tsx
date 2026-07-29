import { DataCard } from "@/components/ui/DataCard";
import Label from "@/components/form/Label";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, WheelEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  Home,
  Maximize2,
  Route,
  Scale,
  ShieldAlert,
  Square,
  Trash2,
  Truck,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { BinMapPanel } from "./map/BinMapPanel";
import { HouseholdMapPanel } from "./map/HouseholdMapPanel";
import VehicleMapPanel from "./map/VehicleMapPanel";
import { MapTabs } from "./map/MapTabs";
import { MAP_TABS, type MapTabKey } from "./map/mapUtils";
import { dashboardSummaryApi, wasteTypeApi } from "@/helpers/admin";
import { complaintTicketApi } from "@/features/complaintTicketing/api";
import type { ComplaintTicket } from "@/features/complaintTicketing/types";
import { useTranslation } from "react-i18next";
import { useGeoHierarchy } from "@/hooks/useGeoHierarchy";
import Select from "@/components/form/Select";
import { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { scopeFieldState } from "@/pages/admin/modules/masters/shared/dataScopeOptions";
import { getEncryptedRoute } from "@/utils/routeCache";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

type WardTrip = {
  trip_id: string;
  collection_type: string;
  driver_name: string;
  operator_name: string;
  vehicle_no: string;
  trip_date: string | null;
  trip_time: string | null;
};

type WardPerformance = {
  ward_id: string;
  ward_name: string;
  district_name: string;
  trips: WardTrip[];
  household_current_kg: number;
  household_target_kg: number;
  bin_current_kg: number;
  bin_target_kg: number;
  current_weight_kg: number;
  overall_weight_kg: number;
  waste_tons: number;
  status: "normal" | "delayed" | "no_vehicle" | "pending";
  households_collected: number;
  households_total: number;
  bins_collected: number;
  bins_total: number;
  completion_pct: number;
};

type FilterItem = { id: string; name: string };

type WasteTypeMasterRecord = {
  unique_id: string;
  waste_type_name?: string;
  is_active?: boolean;
};

type CriticalAlert = {
  id: string;
  kind: "grievance" | "vehicle_breakdown";
  title: string;
  description?: string;
  status: string;
  severity: "critical" | "warning";
  created?: string | null;
  updated?: string | null;
  priority?: string;
  category?: string;
  subcategory?: string;
  source?: string;
  incident_type?: string;
  collection_type?: string;
  reporter_type?: "Customer" | "Public Grievance";
  reporter_name?: string;
  raised_by_name?: string;
  customer_name?: string;
  contact_no?: string;
  email?: string;
  gender?: string;
  module?: string;
  waste_types?: string[];
  assigned_to?: string;
  location?: string;
  trip?: string;
  trip_date?: string;
  scheduled_time?: string;
  vehicle?: string;
  replacement_vehicle?: string;
  driver?: string;
  operator?: string;
  replacement_driver?: string;
  replacement_operator?: string;
  breakdown_time?: string;
  approval_status?: string;
  collected_weight_kg?: string;
  remarks?: string;
};

type DashboardSummary = {
  filters: {
    states: FilterItem[];
    districts: FilterItem[];
    area_types: FilterItem[];
    local_bodies: FilterItem[];
    wards: FilterItem[];
  };
  summary: {
    households: {
      total_customers: number;
      collected: number;
      not_available: number;
      not_collected: number;
    };
    attendance: { total: number; present: number; absent: number; leave: number };
    waste: {
      total_tons: number;
      household_kg: number;
      bin_kg: number;
      wet_tons: number;
      dry_tons: number;
      other_tons: number;
      waste_type_breakdown: Array<{
        waste_type_id: string;
        waste_type_name: string;
        weight_kg: number;
        tons: number;
        percentage: number;
      }>;
      collections: number;
      household_collections: number;
      bin_collections: number;
    };
    bins: { total: number; collected: number; not_collected: number };
    operations: {
      available: boolean;
      household: {
        trips_completed: number;
        trips_total: number;
        collections: number;
        weight_kg: number;
        wards_completed: number;
      };
      bin: {
        trips_completed: number;
        trips_total: number;
        collections: number;
        weight_kg: number;
        wards_completed: number;
      };
      bulk: { trips_completed: number; trips_total: number };
      trips_completed: number;
      trips_total: number;
      wards_completed: number;
    };
    vehicles: { total: number; active: number; inactive: number };
    grievances: { total: number; open: number; in_progress: number; resolved: number };
    masters: {
      states: number;
      districts: number;
      area_types: number;
      local_bodies: number;
      wards: number;
    };
  };
  recent_grievances: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    created?: string | null;
  }>;
  critical_alerts: CriticalAlert[];
  vehicle_performance: Array<{
    registration_no: string;
    vehicle_type: string;
    ward_name: string;
    trips: number;
    waste_tons: number;
    capacity_pct: number;
    status: string;
  }>;
  trip_performance: Array<{
    trip_id: string;
    vehicle_no: string;
    ward_name: string;
    start_time: string;
    stops: number;
    weight_tons: number;
    status: string;
  }>;
  team_performance: Array<{
    team_name: string;
    ward_name: string;
    attendance_present: number;
    attendance_total: number;
    trips: number;
    waste_tons: number;
    score: number;
  }>;
  ward_performance: WardPerformance[];
  collection_progress: Array<{
    label: string;
    value: number;
    pct: number;
    total_kg: number;
    household_count?: number;
    household_kg?: number;
    bin_count?: number;
    bin_kg?: number;
  }>;
  vehicle_status_detail: {
    idle: number;
    breakdown: number;
    offline_gps: number;
  };
  as_of: string;
};

const emptyDashboard: DashboardSummary = {
  filters: { states: [], districts: [], area_types: [], local_bodies: [], wards: [] },
  summary: {
    households: { total_customers: 0, collected: 0, not_available: 0, not_collected: 0 },
    attendance: { total: 0, present: 0, absent: 0, leave: 0 },
    waste: {
      total_tons: 0,
      household_kg: 0,
      bin_kg: 0,
      wet_tons: 0,
      dry_tons: 0,
      other_tons: 0,
      waste_type_breakdown: [],
      collections: 0,
      household_collections: 0,
      bin_collections: 0,
    },
    bins: { total: 0, collected: 0, not_collected: 0 },
    operations: {
      available: false,
      household: { trips_completed: 0, trips_total: 0, collections: 0, weight_kg: 0, wards_completed: 0 },
      bin: { trips_completed: 0, trips_total: 0, collections: 0, weight_kg: 0, wards_completed: 0 },
      bulk: { trips_completed: 0, trips_total: 0 },
      trips_completed: 0,
      trips_total: 0,
      wards_completed: 0,
    },
    vehicles: { total: 0, active: 0, inactive: 0 },
    grievances: { total: 0, open: 0, in_progress: 0, resolved: 0 },
    masters: { states: 0, districts: 0, area_types: 0, local_bodies: 0, wards: 0 },
  },
  recent_grievances: [],
  critical_alerts: [],
  vehicle_performance: [],
  trip_performance: [],
  team_performance: [],
  ward_performance: [],
  collection_progress: [],
  vehicle_status_detail: { idle: 0, breakdown: 0, offline_gps: 0 },
  as_of: "",
};

const meaningfulName = (...values: Array<string | null | undefined>) =>
  values.find((value) => {
    const normalized = value?.trim().toLowerCase();
    return normalized && !["anonymous", "system", "-", "—"].includes(normalized);
  })?.trim() || "";

const complaintRows = (value: unknown): ComplaintTicket[] =>
  Array.isArray(value)
    ? value as ComplaintTicket[]
    : Array.isArray((value as { results?: unknown })?.results)
      ? (value as { results: ComplaintTicket[] }).results
      : [];

const wasteTypeRows = (value: unknown): WasteTypeMasterRecord[] =>
  (Array.isArray(value)
    ? value
    : Array.isArray((value as { results?: unknown })?.results)
      ? (value as { results: unknown[] }).results
      : []
  ).filter((row): row is WasteTypeMasterRecord => (
    Boolean(row)
    && typeof row === "object"
    && typeof (row as WasteTypeMasterRecord).unique_id === "string"
    && typeof (row as WasteTypeMasterRecord).waste_type_name === "string"
  ));

const mergeWasteTypeMasters = (
  waste: DashboardSummary["summary"]["waste"],
  masters: WasteTypeMasterRecord[],
) => {
  const activeMasters = masters.filter((item) => item.is_active !== false);
  if (activeMasters.length === 0) return waste.waste_type_breakdown;

  const supplied = waste.waste_type_breakdown ?? [];
  const suppliedById = new Map(
    supplied.map((item) => [String(item.waste_type_id), item]),
  );
  const suppliedByName = new Map(
    supplied.map((item) => [item.waste_type_name.trim().toLocaleLowerCase(), item]),
  );
  const matchedIds = new Set<string>();
  const matchedNames = new Set<string>();

  const breakdown = activeMasters.map((master) => {
    const masterId = String(master.unique_id);
    const masterName = master.waste_type_name?.trim() || "Unnamed Waste Type";
    const normalizedName = masterName.toLocaleLowerCase();
    const matched = suppliedById.get(masterId) || suppliedByName.get(normalizedName);
    if (matched) {
      matchedIds.add(String(matched.waste_type_id));
      matchedNames.add(matched.waste_type_name.trim().toLocaleLowerCase());
    }

    let tons = Number(matched?.tons || 0);
    if (!matched && supplied.length === 0) {
      if (normalizedName === "wet waste") tons = Number(waste.wet_tons || 0);
      if (normalizedName === "dry waste") tons = Number(waste.dry_tons || 0);
    }

    return {
      waste_type_id: masterId,
      waste_type_name: masterName,
      weight_kg: matched ? Number(matched.weight_kg || 0) : tons * 1000,
      tons,
      percentage: 0,
    };
  });

  const unmatchedSuppliedTons = supplied.reduce((total, item) => {
    const matched =
      matchedIds.has(String(item.waste_type_id))
      || matchedNames.has(item.waste_type_name.trim().toLocaleLowerCase());
    return total + (matched ? 0 : Number(item.tons || 0));
  }, 0);
  const othersTons = supplied.length > 0
    ? unmatchedSuppliedTons
    : Number(waste.other_tons || 0);

  if (othersTons > 0) {
    breakdown.push({
      waste_type_id: "others",
      waste_type_name: "Others",
      weight_kg: othersTons * 1000,
      tons: othersTons,
      percentage: 0,
    });
  }

  return breakdown;
};

const enrichCriticalAlerts = (
  alerts: CriticalAlert[] | undefined,
  tickets: ComplaintTicket[],
): CriticalAlert[] => {
  const ticketById = new Map<string, ComplaintTicket>();
  tickets.forEach((ticket) => {
    ticketById.set(ticket.unique_id, ticket);
    if (ticket.ticket_no) ticketById.set(ticket.ticket_no, ticket);
  });

  return (alerts || []).map((alert) => {
    if (alert.kind !== "grievance") return alert;
    const ticket = ticketById.get(alert.id);
    if (!ticket) return alert;

    const customerName = meaningfulName(ticket.customer_name);
    const submittedName = meaningfulName(ticket.profile_name, ticket.reporter_name);
    const raisedPersonName = meaningfulName(
      customerName,
      submittedName,
      ticket.raised_by_name,
      alert.customer_name,
      alert.reporter_name,
      alert.raised_by_name,
    ) || "Anonymous";
    const reporterName = meaningfulName(
      customerName,
      submittedName,
      alert.reporter_name,
    ) || "Anonymous";

    return {
      ...alert,
      reporter_type: customerName || ticket.customer ? "Customer" : "Public Grievance",
      reporter_name: reporterName,
      raised_by_name: raisedPersonName,
      customer_name: customerName,
      contact_no: ticket.wa_phone || alert.contact_no,
      email: ticket.email || alert.email,
      gender: ticket.gender || alert.gender,
      module: ticket.module_name || alert.module,
      waste_types: ticket.waste_type_names || alert.waste_types,
    };
  });
};

const alertDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function CriticalAlertDrillDown({ alert }: { alert: CriticalAlert }) {
  const fields = alert.kind === "vehicle_breakdown"
    ? [
        ["Collection type", alert.collection_type],
        ["Trip", alert.trip],
        ["Trip date", alert.trip_date],
        ["Scheduled", alert.scheduled_time],
        ["Breakdown time", alert.breakdown_time],
        ["Broken vehicle", alert.vehicle],
        ["Replacement vehicle", alert.replacement_vehicle],
        ["Original driver", alert.driver],
        ["Original operator", alert.operator],
        ["Replacement driver", alert.replacement_driver],
        ["Replacement operator", alert.replacement_operator],
        ["Approval", alert.approval_status],
        ["Collected before breakdown", alert.collected_weight_kg ? `${alert.collected_weight_kg} kg` : ""],
        ["Raised person name", alert.raised_by_name],
      ]
    : [
        ["Reported as", alert.reporter_type],
        ["Reporter name", alert.reporter_name || "Anonymous"],
        ["Raised person name", alert.raised_by_name || "Anonymous"],
        ["Contact", alert.contact_no],
        ["Email", alert.email],
        ["Gender", alert.gender],
        ["Complaint module", alert.module],
        ["Waste types", alert.waste_types?.join(", ")],
        ["Collection type", alert.collection_type],
        ["Complaint type", alert.incident_type],
        ["Category", alert.category],
        ["Subcategory", alert.subcategory],
        ["Source", alert.source],
        ["Priority", alert.priority],
        ["Assigned to", alert.assigned_to],
        ["Trip", alert.trip],
        ["Vehicle", alert.vehicle],
        ["Driver", alert.driver],
        ["Operator", alert.operator],
      ];

  return (
    <div className="text-xs">
      <div className={`border-b px-4 py-3 ${
        alert.severity === "critical"
          ? "border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10"
          : "border-amber-100 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-slate-950 dark:text-white">{alert.id}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{alert.title}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
            alert.severity === "critical"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
          }`}>
            {alert.kind === "vehicle_breakdown" ? "Breakdown" : "Grievance"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{alert.status || "Open"}</span>
          {alert.priority && <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{alert.priority}</span>}
          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{alertDateTime(alert.created)}</span>
        </div>
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4">
        {alert.description && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-[#243954] dark:bg-[#14243a]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Description</p>
            <p className="mt-1 leading-5 text-slate-700 dark:text-slate-200">{alert.description}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {fields.filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 px-2.5 py-2 dark:border-[#243954]">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-100">{value}</p>
            </div>
          ))}
        </div>
        {alert.location && (
          <div className="rounded-lg border border-slate-100 px-2.5 py-2 dark:border-[#243954]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Location</p>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{alert.location}</p>
          </div>
        )}
        {alert.remarks && alert.remarks !== alert.description && (
          <div className="rounded-lg border border-slate-100 px-2.5 py-2 dark:border-[#243954]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Remarks</p>
            <p className="mt-1 text-slate-700 dark:text-slate-200">{alert.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Every geo filter (State/District/Area Type/Local Body) is backed by a
// plain "" = unselected value in useGeoHierarchy. The shared Select
// component only shows its placeholder text as a *disabled* row while
// empty, so once a real option is picked there's no way to click back to
// "All ..." from the list itself. Injecting an always-present, always
// selectable "All ..." option (mapped back to "") fixes that for every
// dropdown that uses it.
const ALL_FILTER_VALUE = "__all__";
const withAllOption = (label: string, options: { value: string | number; label: React.ReactNode }[]) => [
  { value: ALL_FILTER_VALUE, label },
  ...options,
];
const toSelectValue = (id: string) => id || ALL_FILTER_VALUE;
const fromSelectValue = (value: string) => (value === ALL_FILTER_VALUE ? "" : value);

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const formatTons = (value: number) =>
  `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} Ton`;

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "red" | "amber" | "gray";
}) {
  const toneClass = {
    blue: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300",
    green:
      "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300",
    red: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300",
    amber:
      "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300",
    gray: "bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-800/60 dark:border-gray-700 dark:text-white",
  }[tone];

  return (
    <div className={`rounded-lg border p-2.5 text-center text-xs font-medium ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold leading-none">{value}</div>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  tone,
  icon,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "purple" | "amber";
  icon: ReactNode;
  progress: number;
}) {
  const toneClass = {
    blue: {
      icon: "text-sky-600 bg-sky-50 border-sky-100 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/20",
      bar: "bg-sky-500",
    },
    green: {
      icon: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20",
      bar: "bg-emerald-500",
    },
    purple: {
      icon: "text-violet-600 bg-violet-50 border-violet-100 dark:text-violet-300 dark:bg-violet-500/10 dark:border-violet-500/20",
      bar: "bg-violet-500",
    },
    amber: {
      icon: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20",
      bar: "bg-amber-500",
    },
  }[tone];

  const safeProgress = Math.max(0, Math.min(progress, 100));

  return (
    <DataCard
      compact
      accent={tone === "amber" ? "orange" : tone}
      className="bg-white/95 dark:bg-[#101d2c] dark:border-[#213653]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            {detail}
          </p>
        </div>
        <div className={`rounded-lg border p-2 ${toneClass.icon}`}>{icon}</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70">
        <div className={`h-full rounded-full ${toneClass.bar}`} style={{ width: `${safeProgress}%` }} />
      </div>
    </DataCard>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label className="mb-1 block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DashboardPanel({
  title,
  action,
  children,
  className = "",
  accent = "blue",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: "blue" | "green" | "orange" | "red" | "teal";
}) {
  const accentClass = {
    blue: "relative overflow-hidden before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-blue-600",
    green: "relative overflow-hidden before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-emerald-500",
    orange: "relative overflow-hidden before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-orange-500",
    red: "relative overflow-hidden before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-rose-500",
    teal: "relative overflow-hidden before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-teal-500",
  }[accent];

  return (
    <section
      className={`min-w-0 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-[#213653] dark:bg-[#101d2c] ${accentClass} ${className}`}
    >
      {(title || action) && (
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          {title && (
            <h3 className="truncate text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function ColorStatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "red" | "amber" | "slate" | "violet";
  icon?: ReactNode;
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    red: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  }[tone];

  return (
    <div className={`rounded-lg border px-2.5 py-2 text-center ${toneClass}`}>
      <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold leading-none">{value}</div>
    </div>
  );
}

function MiniProgress({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        <span className="truncate">{label}</span>
        <span>{safeValue.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

// Stable per-district color palette — cycles if there are more districts
// than colors, but in practice a handful of districts are shown at once.
const WARD_DISTRICT_PALETTE = [
  { border: "border-sky-300 dark:border-sky-500/40", bg: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  { border: "border-emerald-300 dark:border-emerald-500/40", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  { border: "border-violet-300 dark:border-violet-500/40", bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-300" },
  { border: "border-amber-300 dark:border-amber-500/40", bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  { border: "border-rose-300 dark:border-rose-500/40", bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-300" },
  { border: "border-teal-300 dark:border-teal-500/40", bg: "bg-teal-50 dark:bg-teal-500/10", text: "text-teal-700 dark:text-teal-300" },
];
const WARD_FALLBACK_COLOR = {
  border: "border-slate-200 dark:border-slate-600",
  bg: "bg-slate-50 dark:bg-slate-800/40",
  text: "text-slate-600 dark:text-slate-300",
};

function WardTicker({
  wards,
}: {
  wards: WardPerformance[];
}) {
  const displayWards = useMemo(() => {
    const uniqueWards = Array.from(
      new Map(wards.map((ward) => [ward.ward_id, ward])).values(),
    );

    return uniqueWards.length > 0
      ? uniqueWards
      : Array.from({ length: 8 }, (_, index) => ({
          ward_id: `ward-${index + 1}`,
          ward_name: `Ward ${String(index + 1).padStart(2, "0")}`,
          district_name: "",
          trips: [],
          household_current_kg: 0,
          household_target_kg: 0,
          bin_current_kg: 0,
          bin_target_kg: 0,
          current_weight_kg: 0,
          overall_weight_kg: 0,
          waste_tons: 0,
          status: "pending" as const,
          households_collected: 0,
          households_total: 0,
          bins_collected: 0,
          bins_total: 0,
          completion_pct: 0,
        }));
  }, [wards]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const renderedWards = hasOverflow
    ? [...displayWards, ...displayWards, ...displayWards]
    : displayWards;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const measure = () => {
      const firstCard = track.children[0] as HTMLElement | undefined;
      const repeatedFirstCard = track.children[displayWards.length] as HTMLElement | undefined;
      const loopWidth = firstCard && repeatedFirstCard
        ? repeatedFirstCard.offsetLeft - firstCard.offsetLeft
        : track.scrollWidth;
      const overflow = loopWidth > container.clientWidth + 1;
      setHasOverflow(overflow);
      if (overflow && (container.scrollLeft < 1 || container.scrollLeft >= loopWidth * 2)) {
        container.scrollLeft = loopWidth;
      }
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(track);
    return () => {
      resizeObserver.disconnect();
    };
  }, [displayWards, hasOverflow]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track || !hasOverflow) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const firstCard = track.children[0] as HTMLElement | undefined;
      const repeatedFirstCard = track.children[displayWards.length] as HTMLElement | undefined;
      const loopWidth = firstCard && repeatedFirstCard
        ? repeatedFirstCard.offsetLeft - firstCard.offsetLeft
        : track.scrollWidth / 3;
      if (!hoveredKey && !isInteracting) {
        const elapsed = Math.min(time - previousTime, 50);
        container.scrollLeft += elapsed * 0.09;
      }
      if (container.scrollLeft >= loopWidth * 2) container.scrollLeft -= loopWidth;
      if (container.scrollLeft < 1) container.scrollLeft += loopWidth;
      previousTime = time;
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [displayWards.length, hasOverflow, hoveredKey, isInteracting]);

  const districtNames = useMemo(
    () => Array.from(new Set(displayWards.map((w) => w.district_name).filter(Boolean))),
    [displayWards],
  );
  const colorForDistrict = (name: string) => {
    if (!name) return WARD_FALLBACK_COLOR;
    const idx = districtNames.indexOf(name);
    return WARD_DISTRICT_PALETTE[idx % WARD_DISTRICT_PALETTE.length];
  };

  const scrollOneCard = (direction: -1 | 1) => {
    containerRef.current?.scrollBy({
      left: direction * 222,
      behavior: "smooth",
    });
  };

  const handleTickerWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !hasOverflow) return;
    event.preventDefault();
    event.stopPropagation();
    container.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
  };

  return (
    <DashboardPanel
      title="Ward Collection Live Ticker"
      action={
        <div className="flex items-center gap-2">

          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
      }
      className="py-2"
    >
      <style>{`
        .ward-ticker-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
          overscroll-behavior: contain;
          touch-action: pan-x;
        }
        .ward-ticker-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        ref={containerRef}
        onWheelCapture={handleTickerWheel}
        onPointerDown={() => setIsInteracting(true)}
        onPointerUp={() => setIsInteracting(false)}
        onPointerCancel={() => setIsInteracting(false)}
        onPointerLeave={() => setIsInteracting(false)}
        className="ward-ticker-scroll overflow-x-auto overflow-y-hidden scroll-smooth"
      >
        <div
          ref={trackRef}
          className="flex w-max gap-3 pr-1"
        >
          {renderedWards.map((ward, index) => {
            const isDelayed = ward.status === "delayed";
            const isNoVehicle = ward.status === "no_vehicle";
            const color = colorForDistrict(ward.district_name);
            const cardKey = `${ward.ward_id}-${index}`;
            const isHovered = hoveredKey === cardKey;
            const card = (
              <div
                className={`w-[210px] shrink-0 rounded-md border px-3 py-2 shadow-sm transition-colors ${
                  isHovered
                    ? "border-yellow-400 bg-yellow-100 text-yellow-950 shadow-yellow-200/70 dark:border-yellow-300 dark:bg-yellow-400/20 dark:text-yellow-100"
                    : `${color.border} ${color.bg} ${color.text}`
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="truncate text-[13px] font-bold">{ward.ward_name}</span>
                  {isDelayed && <span className="shrink-0 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-300">Delayed</span>}
                  {isNoVehicle && <span className="shrink-0 text-[9px] font-bold uppercase text-rose-600 dark:text-rose-300">No Vehicle</span>}
                </div>
                {ward.district_name && (
                  <div className="mt-0.5 truncate text-[9px] font-semibold uppercase opacity-70">{ward.district_name}</div>
                )}
                <div className="mt-1.5 space-y-1 text-[10px] font-semibold">
                  <div className="flex items-center justify-between gap-2">
                    <span className="opacity-80">House ({ward.households_collected}/{ward.households_total})</span>
                    <span>{ward.household_current_kg.toFixed(1)} kg</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="opacity-80">Bin ({ward.bins_collected}/{ward.bins_total})</span>
                    <span>{ward.bin_current_kg.toFixed(1)} kg</span>
                  </div>
                </div>
              </div>
            );

            return (
              <HoverCard
                key={cardKey}
                openDelay={80}
                closeDelay={120}
                onOpenChange={(open) => setHoveredKey((current) => (open ? cardKey : current === cardKey ? null : current))}
              >
                <HoverCardTrigger asChild>
                  <div>{card}</div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="center"
                  sideOffset={14}
                  className="w-[360px] overflow-visible rounded-lg border border-slate-200 bg-white p-0 text-xs text-slate-700 shadow-xl dark:border-[#28425f] dark:bg-[#101d2c] dark:text-slate-200"
                >
                  <HoverCardArrow className="fill-yellow-50 stroke-slate-200 dark:fill-[#1a2738] dark:stroke-[#28425f]" width={18} height={9} />
                  <div className="border-b border-slate-100 bg-yellow-50 px-3 py-2.5 dark:border-[#243954] dark:bg-yellow-400/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{ward.ward_name}</p>
                        <p className="truncate text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                          {ward.district_name || "District not assigned"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-950 dark:bg-yellow-300">
                        {ward.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Completion", `${ward.completion_pct.toFixed(0)}%`],
                        ["Waste", `${ward.waste_tons.toFixed(2)} MT`],
                        ["Trips", ward.trips.length],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-[#243954] dark:bg-[#14243a]">
                          <p className="text-[9px] font-semibold uppercase text-slate-400 dark:text-slate-500">{label}</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-slate-100 px-2.5 py-2 dark:border-[#243954]">
                        <p className="text-[10px] font-bold text-slate-900 dark:text-white">Household</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {ward.households_collected}/{ward.households_total} covered
                        </p>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {ward.household_current_kg.toFixed(1)} kg / {ward.household_target_kg.toFixed(1)} kg
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 px-2.5 py-2 dark:border-[#243954]">
                        <p className="text-[10px] font-bold text-slate-900 dark:text-white">Bin</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {ward.bins_collected}/{ward.bins_total} collected
                        </p>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {ward.bin_current_kg.toFixed(1)} kg / {ward.bin_target_kg.toFixed(1)} kg
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Trip drill down</p>
                      {ward.trips.length > 0 ? (
                        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                          {ward.trips.map((trip) => (
                            <div key={trip.trip_id} className="rounded-md border border-slate-100 bg-white px-2.5 py-2 dark:border-[#243954] dark:bg-[#132235]">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {trip.collection_type === "household_collection" ? "Household Collection" : "Bin Collection"}
                                </p>
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{trip.trip_id}</span>
                              </div>
                              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                <p>Driver: {trip.driver_name || "-"}</p>
                                <p>Operator: {trip.operator_name || "-"}</p>
                                <p>Vehicle: {trip.vehicle_no || "-"}</p>
                                <p>
                                  {trip.trip_date ?? "-"}
                                  {trip.trip_time ? ` at ${trip.trip_time}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-500 dark:border-[#28425f] dark:text-slate-400">
                          No trip assignment for this ward yet.
                        </p>
                      )}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      </div>
    </DashboardPanel>
  );
}

function VehicleStatusRing({
  total,
  active,
  idle,
  breakdown,
  offlineGps,
  wasteSegments,
  totalWasteTons,
  totalWasteForBreakdown,
}: {
  total: number;
  active: number;
  idle: number;
  breakdown: number;
  offlineGps: number;
  wasteSegments: Array<{
    label: string;
    value: number;
    color: string;
    hex: string;
    rowClass: string;
  }>;
  totalWasteTons: number;
  totalWasteForBreakdown: number;
}) {
  const activePct = total > 0 ? (active / total) * 100 : 0;
  const idlePct = total > 0 ? (idle / total) * 100 : 0;
  const breakdownPct = total > 0 ? (breakdown / total) * 100 : 0;
  let wasteOffset = 0;
  const wasteGradientStops = wasteSegments.map((segment) => {
    const start = wasteOffset;
    wasteOffset += totalWasteTons > 0 ? (segment.value / totalWasteTons) * 100 : 0;
    return `${segment.hex} ${start}% ${wasteOffset}%`;
  });
  const wasteGradient =
    totalWasteTons > 0 && wasteGradientStops.length > 0
      ? `conic-gradient(${wasteGradientStops.join(", ")})`
      : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="flex h-full min-h-[430px] flex-col gap-3">
    <DashboardPanel title="Vehicle Status" accent="blue">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="space-y-2 text-[11px]">
          {[
            ["Total Fleet", total, "bg-slate-400", "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50"],
            ["Active", active, "bg-emerald-500", "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"],
            ["Idle", idle, "bg-amber-500", "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"],
            ["Breakdown", breakdown, "bg-rose-500", "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"],
            ["Offline GPS", offlineGps, "bg-slate-500", "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50"],
          ].map(([label, value, color, rowClass]) => (
            <div key={String(label)} className={`flex items-center justify-between gap-3 rounded-md border px-2 py-1.5 text-slate-600 dark:text-slate-300 ${rowClass}`}>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-sm ${color}`} />
                {label}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{formatNumber(Number(value))}</span>
            </div>
          ))}
        </div>
        <div
          className="grid h-24 w-24 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#22c55e ${activePct * 3.6}deg, #f59e0b ${activePct * 3.6}deg ${
              (activePct + idlePct) * 3.6
            }deg, #ef4444 ${(activePct + idlePct) * 3.6}deg ${
              (activePct + idlePct + breakdownPct) * 3.6
            }deg, #64748b ${(activePct + idlePct + breakdownPct) * 3.6}deg 360deg)`,
          }}
        >
          <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-center dark:bg-[#101d2c]">
            <div>
              <div className="text-2xl font-bold leading-none text-slate-950 dark:text-white">{formatNumber(total)}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Total</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="Waste Type Breakdown (Ton)"
      className="min-h-[220px] flex-1"
      accent="green"
    >
      <div>
        <div className="grid grid-cols-[96px_1fr] items-center gap-3">
          <div
            className="grid h-24 w-24 place-items-center rounded-full"
            style={{ background: wasteGradient }}
          >
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center dark:bg-[#101d2c]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{formatTons(totalWasteTons)}</span>
            </div>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-2 gap-2">
              {wasteSegments.map((item) => {
                const percentage = (item.value / totalWasteForBreakdown) * 100;

                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        className={`flex min-w-0 cursor-help items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${item.rowClass}`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-sm ${item.color}`} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[9px]">
                          {item.value.toFixed(2)} Ton ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64 px-3 py-2 text-xs">
                      <p className="font-bold">{item.label}</p>
                      <p className="mt-0.5">
                        {item.value.toFixed(2)} Ton ({percentage.toFixed(0)}%)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </DashboardPanel>
    </div>
  );
}

function CollectionProgressTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      value: number;
      total_kg: number;
      household_count?: number;
      household_kg?: number;
      bin_count?: number;
      bin_kg?: number;
    };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] shadow-lg dark:border-[#28425f] dark:bg-[#101d2c]">
      <p className="mb-1 font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-bold text-emerald-600">
        Household: {(point.household_kg || 0).toFixed(1)} kg · {point.household_count || 0} records
      </p>
      <p className="font-bold text-sky-600">
        Bin: {(point.bin_kg || 0).toFixed(1)} kg · {point.bin_count || 0} events
      </p>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Total: {point.total_kg.toFixed(1)} kg · {point.value} collections
      </p>
    </div>
  );
}

function AttendanceDetails({
  total,
  present,
  absent,
  leave,
}: {
  total: number;
  present: number;
  absent: number;
  leave: number;
}) {
  const presentPct = total > 0 ? (present / total) * 100 : 0;
  const absentPct = total > 0 ? (absent / total) * 100 : 0;
  const leavePct = total > 0 ? (leave / total) * 100 : 0;
  return (
    <DashboardPanel title="Attendance Details" className="xl:col-span-3" accent="blue">
      <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="bg-emerald-500" style={{ width: `${presentPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${absentPct}%` }} />
        <div className="bg-blue-500" style={{ width: `${leavePct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorStatTile label="Total Staffs" value={formatNumber(total)} tone="slate" icon={<Users className="h-3 w-3" />} />
        <ColorStatTile label="Present" value={formatNumber(present)} tone="green" icon={<UserCheck className="h-3 w-3" />} />
        <ColorStatTile label="Absent" value={formatNumber(absent)} tone="red" icon={<UserRoundX className="h-3 w-3" />} />
        <ColorStatTile label="Leave" value={formatNumber(leave)} tone="blue" icon={<Activity className="h-3 w-3" />} />
      </div>
      <div className="mt-3">
        <MiniProgress label="Present Percentage" value={presentPct} color="bg-emerald-500" />
      </div>
    </DashboardPanel>
  );
}

function CompactTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | ReactNode>>;
}) {
  return (
    <DashboardPanel
      title={title}
      action={<button className="text-[10px] font-semibold text-sky-600 dark:text-sky-300">View All</button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-[10px]">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              {headers.map((header) => (
                <th key={header} className="pb-2 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#243954]">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-slate-700 dark:text-slate-300">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-1.5 pr-2 font-medium">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  );
}

export function HomeDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const geo = useGeoHierarchy();
  const wardScope = scopeFieldState("ward");
  const [wardId, setWardId] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [activeMapTab, setActiveMapTab] = useState<MapTabKey>("vehicle");
  const [mapSize, setMapSize] = useState<"mid" | "max">("mid");
  const [asOf, setAsOf] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<CriticalAlert | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  const params = useMemo(() => {
    const next: Record<string, string> = {};
    const payload = geo.buildPayload();
    Object.entries(payload).forEach(([key, value]) => {
      if (value) next[key] = String(value);
    });
    if (geo.hierarchyId && wardId !== "all") next.ward_id = wardId;
    if (filterDate) next.date = filterDate;
    return next;
  }, [geo.stateId, geo.districtId, geo.areaTypeId, geo.hierarchyLevel, geo.hierarchyId, wardId, filterDate]);

  useEffect(() => {
    if (wardScope.mode === "locked") {
      if (wardId !== wardScope.options[0]?.value) {
        setWardId(wardScope.options[0]?.value ?? "all");
      }
      return;
    }
    if (!geo.hierarchyId && wardId !== "all") {
      setWardId("all");
    }
  }, [geo.hierarchyId, wardId, wardScope.mode, wardScope.options]);

  useEffect(() => {
    let isMounted = true;
    let requestInFlight = false;

    const loadDashboard = (showLoading: boolean) => {
      if (requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;
      if (showLoading) setLoading(true);
      Promise.all([
        dashboardSummaryApi.readAllwithPaginated(1, 1, { params }),
        complaintTicketApi.readAllForExport().catch(() => []),
        wasteTypeApi.readAllForExport().catch(() => []),
      ])
        .then(([response, ticketResult, wasteTypeResult]: [any, unknown, unknown]) => {
          if (!isMounted) return;
          const criticalAlerts = enrichCriticalAlerts(
            response.critical_alerts,
            complaintRows(ticketResult),
          );
          const responseSummary = response.summary || {};
          const responseOperations = responseSummary.operations || {};
          const responseWaste = {
            ...emptyDashboard.summary.waste,
            ...responseSummary.waste,
          };
          responseWaste.waste_type_breakdown = mergeWasteTypeMasters(
            responseWaste,
            wasteTypeRows(wasteTypeResult),
          );
          setDashboard({
            ...emptyDashboard,
            ...response,
            critical_alerts: criticalAlerts,
            summary: {
              ...emptyDashboard.summary,
              ...responseSummary,
              waste: responseWaste,
              operations: {
                ...emptyDashboard.summary.operations,
                ...responseOperations,
                household: {
                  ...emptyDashboard.summary.operations.household,
                  ...responseOperations.household,
                },
                bin: {
                  ...emptyDashboard.summary.operations.bin,
                  ...responseOperations.bin,
                },
                bulk: {
                  ...emptyDashboard.summary.operations.bulk,
                  ...responseOperations.bulk,
                },
              },
            },
            filters: { ...emptyDashboard.filters, ...response.filters },
          });
          if (response.as_of) setAsOf(response.as_of);
        })
        .catch((error) => {
          console.error("Failed to fetch dashboard summary:", error);
          if (isMounted && showLoading) setDashboard(emptyDashboard);
        })
        .finally(() => {
          requestInFlight = false;
          if (isMounted && showLoading) setLoading(false);
        });
    };

    loadDashboard(true);
    const refreshTimer = window.setInterval(() => loadDashboard(false), 10_000);
    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 80);
    return () => window.clearTimeout(timer);
  }, [mapSize]);

  const isMapMaximized = mapSize === "max";
  const selectClass =
    "h-8 w-full border-slate-200 bg-white text-xs text-slate-800 shadow-none dark:border-[#263b58] dark:bg-[#132235] dark:text-slate-100";
  const dateClass =
    "h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-800 shadow-none outline-none transition focus:ring-2 focus:ring-sky-500/30 dark:border-[#263b58] dark:bg-[#132235] dark:text-slate-100";
  const wardSelectDisabled = !geo.hierarchyId || wardScope.mode === "locked";
  const wardOptions =
    wardScope.mode === "unrestricted"
      ? dashboard.filters.wards.map((ward) => ({ value: ward.id, label: ward.name }))
      : wardScope.options;
  const mapCard = (
    <DataCard
      accent="blue"
      className={`h-full overflow-hidden flex flex-col ${
        isMapMaximized ? "bg-white dark:bg-white" : "dark:bg-[#101d2c] dark:border-[#213653]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
            {t("dashboard.home.operations_map_title")}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {(() => {
              const summaryKey = MAP_TABS.find((tab) => tab.key === activeMapTab)?.summaryKey;
              return summaryKey ? t(summaryKey) : "";
            })()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MapTabs activeKey={activeMapTab} onChange={setActiveMapTab} />
          <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setMapSize("mid")}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
                mapSize === "mid" ? "bg-gray-100 dark:bg-gray-800" : ""
              }`}
              aria-label={t("dashboard.home.map_size_default_aria")}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMapSize("max")}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
                mapSize === "max" ? "bg-gray-100 dark:bg-gray-800" : ""
              }`}
              aria-label={t("dashboard.home.map_size_max_aria")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeMapTab === "vehicle" && <VehicleMapPanel params={params} />}
        {activeMapTab === "bins" && <BinMapPanel params={params} />}
        {activeMapTab === "households" && <HouseholdMapPanel params={params} />}
      </div>
    </DataCard>
  );

  const summary = dashboard.summary;
  const householdCoveragePct =
    summary.households.total_customers > 0
      ? (summary.households.collected / summary.households.total_customers) * 100
      : 0;
  const vehicleActivePct =
    summary.vehicles.total > 0 ? (summary.vehicles.active / summary.vehicles.total) * 100 : 0;
  const binsCollectedPct =
    summary.bins.total > 0 ? (summary.bins.collected / summary.bins.total) * 100 : 0;
  const hasCollectionTypeMetrics = summary.operations.available;
  const legacyTripsCompleted =
    summary.waste.collections || summary.households.collected || summary.bins.collected;
  const tripsCompleted = hasCollectionTypeMetrics
    ? summary.operations.trips_completed
    : legacyTripsCompleted;
  const tripsTarget = hasCollectionTypeMetrics
    ? Math.max(summary.operations.trips_total, tripsCompleted, 1)
    : Math.max(tripsCompleted + summary.bins.not_collected, tripsCompleted, 1);
  const tripsPct = (tripsCompleted / tripsTarget) * 100;
  const completedWards = hasCollectionTypeMetrics
    ? summary.operations.wards_completed
    : Math.max(summary.masters.wards - summary.bins.not_collected, 0);
  const wardCompletionPct =
    summary.masters.wards > 0
      ? (completedWards / summary.masters.wards) * 100
      : 0;
  const collectionProgressSource: DashboardSummary["collection_progress"] =
    dashboard.collection_progress.length > 0
      ? dashboard.collection_progress
      : Array.from({ length: 31 }, (_, i) => ({
          label: String(i + 1),
          value: 0,
          pct: 0,
          total_kg: 0,
        }));
  const collectionProgressData = collectionProgressSource.map((point) => ({
    ...point,
    household_kg: point.household_kg ?? point.total_kg,
    bin_kg: point.bin_kg ?? 0,
    household_count: point.household_count ?? point.value,
    bin_count: point.bin_count ?? 0,
  }));
  const alerts = dashboard.critical_alerts.slice(0, 6);
  const grievancesPath = `/dashboard/${getEncryptedRoute().encDashboardGrievances}`;
  const vehicleRows = dashboard.vehicle_performance.slice(0, 5).map((v) => [
    v.registration_no,
    v.vehicle_type,
    v.ward_name || "-",
    v.trips,
    v.waste_tons.toFixed(2),
    <MiniProgress key={`cap-${v.registration_no}`} label="" value={v.capacity_pct} color="bg-emerald-500" />,
    <span key={`status-${v.registration_no}`} className={v.status === "Active" ? "text-emerald-500" : "text-amber-500"}>
      {v.status}
    </span>,
  ]);
  const tripRows = dashboard.trip_performance.slice(0, 5).map((t) => [
    t.trip_id,
    t.vehicle_no,
    t.ward_name || "-",
    t.start_time,
    t.stops,
    t.weight_tons.toFixed(2),
    <span key={`trip-${t.trip_id}`} className={t.status === "Completed" ? "text-emerald-500" : "text-amber-500"}>
      {t.status}
    </span>,
  ]);
  const teamRows = dashboard.team_performance.slice(0, 5).map((team) => [
    team.team_name,
    team.ward_name || "-",
    `${team.attendance_present} / ${team.attendance_total}`,
    team.trips,
    team.waste_tons.toFixed(2),
    <span key={`score-${team.team_name}`} className={team.score < 60 ? "text-amber-500" : "text-emerald-500"}>
      {team.score}
    </span>,
  ]);
  const wastePalette = [
    {
      color: "bg-emerald-500",
      hex: "#10b981",
      rowClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      color: "bg-sky-500",
      hex: "#0ea5e9",
      rowClass: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
    },
    {
      color: "bg-amber-500",
      hex: "#f59e0b",
      rowClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      color: "bg-violet-500",
      hex: "#8b5cf6",
      rowClass: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
    },
    {
      color: "bg-rose-500",
      hex: "#f43f5e",
      rowClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    },
    {
      color: "bg-cyan-500",
      hex: "#06b6d4",
      rowClass: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300",
    },
  ];
  const dynamicWasteTypes = summary.waste.waste_type_breakdown ?? [];
  const wasteSource = dynamicWasteTypes.length > 0
    ? dynamicWasteTypes.map((item) => ({
        label: item.waste_type_name,
        value: item.tons,
      }))
    : [
        { label: "Wet Waste", value: summary.waste.wet_tons },
        { label: "Dry Waste", value: summary.waste.dry_tons },
        { label: "Others", value: summary.waste.other_tons },
      ];
  const wasteSegments = wasteSource.map((item, index) => ({
    ...item,
    ...wastePalette[index % wastePalette.length],
  }));
  const totalWasteForBreakdown = summary.waste.total_tons > 0 ? summary.waste.total_tons : 1;

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#020912] dark:text-slate-100 lg:min-h-[calc(100vh-7.5rem)]">
      <div className="min-h-[calc(100vh-8.5rem)] w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-[#172a44] dark:bg-[#081421]">
        <main className="min-w-0 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-[#172a44] dark:bg-[#0c1828]">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                <FilterField label="Date">
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={dateClass} />
                </FilterField>
                <FilterField label="State">
                  <Select
                    value={toSelectValue(geo.stateId)}
                    onChange={(v) => geo.setStateId(fromSelectValue(v))}
                    options={withAllOption("All States", geo.stateOptions)}
                    className={selectClass}
                    placeholder="All states"
                    disabled={geo.stateScope.mode === "locked"}
                  />
                </FilterField>
                <FilterField label="District">
                  <Select
                    value={toSelectValue(geo.districtId)}
                    onChange={(v) => geo.setDistrictId(fromSelectValue(v))}
                    options={withAllOption("All Districts", geo.districtOptions)}
                    className={selectClass}
                    placeholder={geo.stateId ? "All districts" : "Select a state first"}
                    disabled={!geo.stateId || geo.districtScope.mode === "locked"}
                  />
                </FilterField>
                <FilterField label="Area Type">
                  <Select
                    value={toSelectValue(geo.areaTypeId)}
                    onChange={(v) => geo.setAreaTypeId(fromSelectValue(v))}
                    options={withAllOption("All Area Types", geo.areaTypeOptions)}
                    className={selectClass}
                    placeholder={geo.districtId ? "All area types" : "Select a district first"}
                    disabled={!geo.districtId || geo.areaTypeScope.mode === "locked"}
                  />
                </FilterField>
                <FilterField label="Local Body Type">
                  <Select value={geo.hierarchyLevel} onChange={(v) => geo.setHierarchyLevel(v as ReturnType<typeof useGeoHierarchy>["hierarchyLevel"])} options={geo.availableHierarchyLevels} className={selectClass} placeholder={geo.areaTypeCategory ? "Select type" : "Select an area type first"} disabled={!geo.areaTypeCategory || geo.hierarchyScope.mode === "locked"} />
                </FilterField>
                <FilterField label="Local Body">
                  <Select
                    value={toSelectValue(geo.hierarchyId)}
                    onChange={(v) => {
                      geo.setHierarchyId(fromSelectValue(v));
                      setWardId("all");
                    }}
                    options={withAllOption("All", geo.hierarchyOptions)}
                    className={selectClass}
                    placeholder={geo.areaTypeCategory ? "All" : "Select an area type first"}
                    disabled={!geo.areaTypeCategory || geo.hierarchyScope.mode === "locked"}
                  />
                </FilterField>
                <FilterField label="Wards">
                  <select
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    className={`${dateClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70 dark:disabled:bg-[#101d2c] dark:disabled:text-slate-500`}
                    disabled={wardSelectDisabled}
                  >
                    <option value="all">
                      {wardScope.mode === "locked"
                        ? "Ward locked by data scope"
                        : wardSelectDisabled
                          ? "Select local body first"
                          : "All Wards"}
                    </option>
                    {wardOptions.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </FilterField>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => {
                  geo.setStateId("");
                  setWardId("all");
                  setFilterDate("");
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-sky-600 transition hover:bg-slate-50 dark:border-[#2a405f] dark:text-sky-300 dark:hover:bg-[#132235]"
              >
                Clear
              </button>
              <span>Last Updated: {asOf ? new Date(asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Activity className="h-3 w-3" />
                Live
              </span>
              {loading && <span className="text-sky-600 dark:text-sky-300">Refreshing...</span>}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-12">
            <div className="xl:col-span-2">
              <OverviewMetric
                label="Today's Waste Collected"
                value={formatTons(summary.waste.total_tons)}
                detail={
                  hasCollectionTypeMetrics
                    ? `Household ${(summary.waste.household_kg / 1000).toFixed(2)} Ton · Bin ${(summary.waste.bin_kg / 1000).toFixed(2)} Ton`
                    : `${formatNumber(summary.waste.collections)} collections`
                }
                tone="green"
                progress={Math.min(summary.waste.total_tons, 100)}
                icon={<Scale className="h-4 w-4" />}
              />
            </div>
            <div className="xl:col-span-2">
              <OverviewMetric
                label="Trips Completed"
                value={`${formatNumber(tripsCompleted)} / ${formatNumber(tripsTarget)}`}
                detail={
                  hasCollectionTypeMetrics
                    ? `Household ${summary.operations.household.trips_completed} · Bin ${summary.operations.bin.trips_completed}`
                    : `${tripsPct.toFixed(1)}% complete`
                }
                tone="blue"
                progress={tripsPct}
                icon={<Route className="h-4 w-4" />}
              />
            </div>
            <div className="xl:col-span-2">
              <OverviewMetric label="Vehicles Active" value={`${formatNumber(summary.vehicles.active)} / ${formatNumber(summary.vehicles.total)}`} detail={`${vehicleActivePct.toFixed(1)}% active`} tone="green" progress={vehicleActivePct} icon={<Truck className="h-4 w-4" />} />
            </div>
            <div className="xl:col-span-2">
              <OverviewMetric label="Wards Completed" value={`${formatNumber(completedWards)} / ${formatNumber(summary.masters.wards)}`} detail={`${Math.max(wardCompletionPct, 0).toFixed(1)}% clear`} tone="purple" progress={wardCompletionPct} icon={<Building2 className="h-4 w-4" />} />
            </div>
            <div className="xl:col-span-2">
              <OverviewMetric
                label="Households Covered"
                value={`${formatNumber(summary.households.collected)} / ${formatNumber(summary.households.total_customers)}`}
                detail={
                  hasCollectionTypeMetrics
                    ? `${householdCoveragePct.toFixed(1)}% · Household records only`
                    : `${householdCoveragePct.toFixed(1)}% collected`
                }
                tone="amber"
                progress={householdCoveragePct}
                icon={<Home className="h-4 w-4" />}
              />
            </div>
            <div className="xl:col-span-2">
              <OverviewMetric
                label="Bins Collected"
                value={`${formatNumber(summary.bins.collected)} / ${formatNumber(summary.bins.total)}`}
                detail={
                  hasCollectionTypeMetrics
                    ? `${binsCollectedPct.toFixed(1)}% · Bin events only`
                    : `${binsCollectedPct.toFixed(1)}% collected`
                }
                tone="blue"
                progress={binsCollectedPct}
                icon={<Trash2 className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="mt-3">
            <WardTicker wards={dashboard.ward_performance} />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-12">
            <div className="xl:col-span-3">
              <VehicleStatusRing
                total={summary.vehicles.total}
                active={summary.vehicles.active}
                idle={dashboard.vehicle_status_detail.idle}
                breakdown={dashboard.vehicle_status_detail.breakdown}
                offlineGps={dashboard.vehicle_status_detail.offline_gps}
                wasteSegments={wasteSegments}
                totalWasteTons={summary.waste.total_tons}
                totalWasteForBreakdown={totalWasteForBreakdown}
              />
            </div>
            <div className="xl:col-span-6">
              <div ref={mapSectionRef} className="h-full min-h-[320px]">
                {isMapMaximized ? <div className="fixed inset-0 z-50 bg-white">{mapCard}</div> : mapCard}
              </div>
            </div>
            <div className="xl:col-span-3">
              <DashboardPanel title="Critical Alerts" action={<button type="button" onClick={() => navigate(grievancesPath)} className="text-[10px] font-semibold text-sky-600 dark:text-sky-300">View All</button>} className="h-full" accent="orange">
                <div className="space-y-2">
                  {alerts.map((item, index) => (
                    <HoverCard key={`${item.id}-${index}`} openDelay={100} closeDelay={160}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedAlert(item)}
                          className={`w-full rounded-md border px-2 py-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                            item.severity === "critical"
                              ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                              : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                          }`}
                          aria-label={`Open details for ${item.id}`}
                        >
                          <div className="flex items-start gap-2">
                            {item.kind === "vehicle_breakdown" ? (
                              <Truck className={`mt-0.5 h-3.5 w-3.5 ${item.severity === "critical" ? "text-rose-500" : "text-amber-500"}`} />
                            ) : (
                              <ShieldAlert className={`mt-0.5 h-3.5 w-3.5 ${item.severity === "critical" ? "text-rose-500" : "text-amber-500"}`} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                                {item.id}
                                {item.kind === "vehicle_breakdown" && <span className="ml-1 text-[9px] text-rose-500">BREAKDOWN</span>}
                              </p>
                              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{item.title || item.status}</p>
                            </div>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.severity === "critical" ? "bg-white text-rose-600 dark:bg-rose-500/20" : "bg-white text-amber-600 dark:bg-amber-500/20"}`}>
                              {item.created ? new Date(item.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 pl-5 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                            {item.kind === "grievance" && item.reporter_type && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 dark:bg-slate-900/60">
                                {item.reporter_type}: {item.reporter_name || "Anonymous"}
                              </span>
                            )}
                            {item.raised_by_name && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 dark:bg-slate-900/60">
                                Raised by: {item.raised_by_name}
                              </span>
                            )}
                            {item.collection_type && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 dark:bg-slate-900/60">
                                {item.collection_type}
                              </span>
                            )}
                            {item.driver && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 dark:bg-slate-900/60">
                                Driver: {item.driver}
                              </span>
                            )}
                            {item.vehicle && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 dark:bg-slate-900/60">
                                Vehicle: {item.vehicle}
                              </span>
                            )}
                          </div>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="left"
                        align="start"
                        sideOffset={12}
                        className="z-[1500] w-[390px] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-[#28425f] dark:bg-[#101d2c]"
                      >
                        <HoverCardArrow className="fill-white stroke-slate-200 dark:fill-[#101d2c] dark:stroke-[#28425f]" width={18} height={9} />
                        <CriticalAlertDrillDown alert={item} />
                        <p className="border-t px-4 py-2 text-[10px] font-semibold text-sky-600 dark:border-[#243954] dark:text-sky-300">
                          Click alert to keep these details open
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  ))}
                  {alerts.length === 0 && (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-6 text-center text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      No critical alerts available.
                    </p>
                  )}
                  <div className="pt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Total Alerts: {formatNumber(summary.grievances.open + dashboard.vehicle_status_detail.breakdown)}
                  </div>
                </div>
              </DashboardPanel>
            </div>
          </div>

          <Dialog open={Boolean(selectedAlert)} onOpenChange={(open) => !open && setSelectedAlert(null)}>
            <DialogContent className="max-w-2xl overflow-hidden p-0">
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedAlert?.id || "Critical alert"} details</DialogTitle>
                <DialogDescription>Operational details for the selected critical alert.</DialogDescription>
              </DialogHeader>
              {selectedAlert && <CriticalAlertDrillDown alert={selectedAlert} />}
            </DialogContent>
          </Dialog>

          {/* <div className="mt-3 grid gap-3 xl:grid-cols-12">
            <div className="xl:col-span-4" >
              <CompactTable title="Vehicle Performance" headers={["Vehicle", "Type", "Ward", "Trips", "Waste", "Capacity", "Status"]} rows={vehicleRows} />
            </div>
            <div className="xl:col-span-4">
              <CompactTable title="Trip Performance" headers={["Trip ID", "Vehicle", "Ward", "Start", "Stops", "Weight", "Status"]} rows={tripRows} />
            </div>
            <div className="xl:col-span-4" >
              <CompactTable title="Team Performance" headers={["Team", "Ward", "Attendance", "Trips", "Waste", "Score"]} rows={teamRows} />
            </div>
          </div> */}

          <div className="mt-3 grid gap-3 xl:grid-cols-12">
            <AttendanceDetails
              total={summary.attendance.total}
              present={summary.attendance.present}
              absent={summary.attendance.absent}
              leave={summary.attendance.leave}
            />
            <DashboardPanel title="Collection Progress (31 days)" className="xl:col-span-3">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={collectionProgressData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradHouseholdProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBinProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#28425f]" strokeOpacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <RechartsTooltip content={<CollectionProgressTooltip />} />
                  <Area type="monotone" dataKey="household_kg" name="Household (kg)" stroke="#10b981" fill="url(#gradHouseholdProgress)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="bin_kg" name="Bin (kg)" stroke="#0ea5e9" fill="url(#gradBinProgress)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </DashboardPanel>
            <DashboardPanel title="Household Coverage" className="xl:col-span-3" accent="blue">
              <div className="mb-3 grid grid-cols-3 gap-2">
                <ColorStatTile label="Total" value={formatNumber(summary.households.total_customers)} tone="blue" />
                <ColorStatTile label="Collected" value={formatNumber(summary.households.collected)} tone="green" />
                <ColorStatTile label="Pending" value={formatNumber(summary.households.not_collected)} tone="red" />
              </div>
              <div className="space-y-3">
                <MiniProgress label={`Collected ${formatNumber(summary.households.collected)}`} value={householdCoveragePct} color="bg-emerald-500" />
                <MiniProgress label={`Not Collected ${formatNumber(summary.households.not_collected)}`} value={summary.households.total_customers ? (summary.households.not_collected / summary.households.total_customers) * 100 : 0} color="bg-rose-500" />
                <MiniProgress label={`Not Available ${formatNumber(summary.households.not_available)}`} value={summary.households.total_customers ? (summary.households.not_available / summary.households.total_customers) * 100 : 0} color="bg-amber-500" />
              </div>
            </DashboardPanel>
            <DashboardPanel title="Grievance Summary" className="xl:col-span-3" accent="orange">
              <div className="grid grid-cols-5 gap-2">
                {[
                  ["New", summary.grievances.total, "blue"],
                  ["Open", summary.grievances.open, "amber"],
                  ["Progress", summary.grievances.in_progress, "violet"],
                  ["Resolved", summary.grievances.resolved, "green"],
                  ["Overdue", Math.max(summary.grievances.open - summary.grievances.in_progress, 0), "red"],
                ].map(([label, value, tone]) => (
                  <ColorStatTile
                    key={String(label)}
                    label={String(label)}
                    value={formatNumber(Number(value))}
                    tone={tone as "blue" | "green" | "red" | "amber" | "slate" | "violet"}
                  />
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <MiniProgress label="Missed Collection" value={summary.grievances.total ? (summary.grievances.open / summary.grievances.total) * 100 : 0} color="bg-rose-500" />
                <MiniProgress label="Irregular Collection" value={summary.grievances.total ? (summary.grievances.in_progress / summary.grievances.total) * 100 : 0} color="bg-amber-500" />
                <MiniProgress label="Resolved" value={summary.grievances.total ? (summary.grievances.resolved / summary.grievances.total) * 100 : 0} color="bg-emerald-500" />
              </div>
            </DashboardPanel>
          </div>
        </main>
      </div>
    </div>
  );
}
