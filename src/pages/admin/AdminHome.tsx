import { useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Briefcase,
  Building,
  Building2,
  ClipboardList,
  Database,
  Flag,
  GitBranch,
  Globe,
  Home,
  Key,
  Layers3,
  Map,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { api } from "@/api";
import { Button } from "@/components/ui/button";
import {
  areaTypeApi,
  binApi,
  collectionPointApi,
  columnPermissionApi,
  complaintCategoryApi,
  complaintSubcategoryApi,
  complaintTicketApi,
  continentApi,
  countryApi,
  customerCreationApi,
  departmentApi,
  designationApi,
  districtApi,
  feedbackApi,
  fuelApi,
  hierarchyApi,
  mainScreenApi,
  mainScreenTypeApi,
  panchayatApi,
  propertiesApi,
  staffCreationApi,
  staffUserTypeApi,
  stateApi,
  subPropertiesApi,
  userCreationApi,
  userScreenActionApi,
  userScreenApi,
  userScreenPermissionApi,
  userTypeApi,
  vehicleCreationApi,
  vehicleTypeApi,
  wasteCollectionApi,
  wasteTypeApi,
} from "@/helpers/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityKey =
  | "continents"
  | "countries"
  | "states"
  | "districts"
  | "panchayats"
  | "departments"
  | "designations"
  | "areaTypes"
  | "hierarchies"
  | "properties"
  | "subProperties"
  | "collectionPoints"
  | "wasteTypes"
  | "bins"
  | "users"
  | "userTypes"
  | "staffUserTypes"
  | "staff"
  | "customers"
  | "vehicleTypes"
  | "vehicles"
  | "fuels"
  | "wasteCollections"
  | "complaints"
  | "feedbacks"
  | "mainCategories"
  | "subCategories"
  | "mainScreenTypes"
  | "mainScreens"
  | "userScreens"
  | "screenActions"
  | "screenPermissions"
  | "columnPermissions";

type DashboardData = Record<EntityKey, Record<string, unknown>[]>;

type KpiConfig = {
  title: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bg: string;
};

type BreakdownItem = {
  label: string;
  value: number;
  sub?: string;
};

type WasteKpis = {
  total_agreed_weight: number;
  total_actual_weight: number;
  variance_kg: number;
  collection_efficiency_percent: number;
  average_weight_per_trip: number;
  coverage_efficiency_percent: number;
  total_trips: number;
  collection_points_covered: number;
  report_status: string;
};

type MainScreenRow = {
  id: string;
  name: string;
  type: string;
  userScreenNames: string[];
  userScreenCount: number;
  roles: string[];
  active: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MASTER_CATEGORIES: Array<{
  label: string;
  key: EntityKey;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  group: "Geography" | "Organisation" | "Waste";
}> = [
  {
    label: "Continents",
    key: "continents",
    color: "#6366f1",
    icon: Globe,
    group: "Geography",
  },
  {
    label: "Countries",
    key: "countries",
    color: "#3b82f6",
    icon: Flag,
    group: "Geography",
  },
  {
    label: "States",
    key: "states",
    color: "#0ea5e9",
    icon: Map,
    group: "Geography",
  },
  {
    label: "Districts",
    key: "districts",
    color: "#14b8a6",
    icon: MapPin,
    group: "Geography",
  },
  {
    label: "PLBs (Participating Local Bodies)",
    key: "panchayats",
    color: "#eab308",
    icon: Home,
    group: "Geography",
  },
  {
    label: "Departments",
    key: "departments",
    color: "#f97316",
    icon: Briefcase,
    group: "Organisation",
  },
  {
    label: "Designations",
    key: "designations",
    color: "#ef4444",
    icon: Tag,
    group: "Organisation",
  },
  {
    label: "Area Types",
    key: "areaTypes",
    color: "#ec4899",
    icon: Tag,
    group: "Organisation",
  },
  {
    label: "Hierarchies",
    key: "hierarchies",
    color: "#8b5cf6",
    icon: GitBranch,
    group: "Organisation",
  },
  {
    label: "Properties",
    key: "properties",
    color: "#a855f7",
    icon: Key,
    group: "Waste",
  },
  {
    label: "Sub Properties",
    key: "subProperties",
    color: "#7c3aed",
    icon: Workflow,
    group: "Waste",
  },
];

const ROLE_DISPLAY: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  company_admin: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    label: "Co. Admin",
  },
  company_operator: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Operator",
  },
  company_driver: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Driver",
  },
  company_supervisor: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Supervisor",
  },
  company_user: { bg: "bg-slate-100", text: "text-slate-600", label: "User" },
  company_project_admin: {
    bg: "bg-rose-100",
    text: "text-rose-700",
    label: "Proj. Admin",
  },
  contractor_admin: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    label: "Cont. Admin",
  },
  contractor_supervisor: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    label: "Cont. Supervisor",
  },
  contractor_operator: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    label: "Cont. Operator",
  },
  contractor_worker: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    label: "Cont. Worker",
  },
  contractor_driver: {
    bg: "bg-lime-100",
    text: "text-lime-700",
    label: "Cont. Driver",
  },
};

const CHART_COLORS = [
  "#16a34a",
  "#f97316",
  "#059669",
  "#ea580c",
  "#15803d",
  "#fb923c",
  "#047857",
  "#d97706",
  "#0f766e",
  "#65a30d",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyData = (): DashboardData => ({
  continents: [],
  countries: [],
  states: [],
  districts: [],
  panchayats: [],
  departments: [],
  designations: [],
  areaTypes: [],
  hierarchies: [],
  properties: [],
  subProperties: [],
  collectionPoints: [],
  wasteTypes: [],
  bins: [],
  users: [],
  userTypes: [],
  staffUserTypes: [],
  staff: [],
  customers: [],
  vehicleTypes: [],
  vehicles: [],
  fuels: [],
  wasteCollections: [],
  complaints: [],
  feedbacks: [],
  mainCategories: [],
  subCategories: [],
  mainScreenTypes: [],
  mainScreens: [],
  userScreens: [],
  screenActions: [],
  screenPermissions: [],
  columnPermissions: [],
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.results))
    return value.results.filter(isRecord);
  return [];
};

const isActive = (row: Record<string, unknown>) =>
  row.is_active !== false && row.is_deleted !== true;

const getLabel = (row: Record<string, unknown>, fallback: string) =>
  String(
    row.mainscreen_name ??
      row.mainScreenName ??
      row.module_name ??
      row.name ??
      row.screen_name ??
      row.title ??
      row.unique_id ??
      fallback,
  );

const getNestedId = (row: Record<string, unknown>, field: string): string => {
  const val = row[field];
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (isRecord(val)) return String(val.id ?? val.unique_id ?? "");
  return "";
};

const extractUserTypeName = (permission: Record<string, unknown>): string => {
  if (typeof permission.user_type_name === "string")
    return permission.user_type_name;
  if (typeof permission.user_type__user_type_name === "string")
    return permission.user_type__user_type_name;
  if (isRecord(permission.user_type)) {
    const ut = permission.user_type as Record<string, unknown>;
    return String(ut.user_type_name ?? ut.name ?? ut.unique_id ?? "");
  }
  if (typeof permission.user_type === "string") return permission.user_type;
  return "";
};

const entityRequests: Array<[EntityKey, () => Promise<unknown>]> = [
  ["continents", () => continentApi.readAll()],
  ["countries", () => countryApi.readAll()],
  ["states", () => stateApi.readAll()],
  ["districts", () => districtApi.readAll()],
  ["panchayats", () => panchayatApi.readAll()],
  ["departments", () => departmentApi.readAll()],
  ["designations", () => designationApi.readAll()],
  ["areaTypes", () => areaTypeApi.readAll()],
  ["hierarchies", () => hierarchyApi.readAll()],
  ["properties", () => propertiesApi.readAll()],
  ["subProperties", () => subPropertiesApi.readAll()],
  ["collectionPoints", () => collectionPointApi.readAll()],
  ["wasteTypes", () => wasteTypeApi.readAll()],
  ["bins", () => binApi.readAll()],
  ["users", () => userCreationApi.readAll()],
  ["userTypes", () => userTypeApi.readAll()],
  ["staffUserTypes", () => staffUserTypeApi.readAll()],
  ["staff", () => staffCreationApi.readAll()],
  ["customers", () => customerCreationApi.readAll()],
  ["vehicleTypes", () => vehicleTypeApi.readAll()],
  ["vehicles", () => vehicleCreationApi.readAll()],
  ["fuels", () => fuelApi.readAll()],
  ["wasteCollections", () => wasteCollectionApi.readAll()],
  ["complaints", () => complaintTicketApi.readAll()],
  ["feedbacks", () => feedbackApi.readAll()],
  ["mainCategories", () => complaintCategoryApi.readAll()],
  ["subCategories", () => complaintSubcategoryApi.readAll()],
  ["mainScreenTypes", () => mainScreenTypeApi.readAll()],
  ["mainScreens", () => mainScreenApi.readAll()],
  ["userScreens", () => userScreenApi.readAll()],
  ["screenActions", () => userScreenActionApi.readAll()],
  ["screenPermissions", () => userScreenPermissionApi.readAll()],
  ["columnPermissions", () => columnPermissionApi.readAll()],
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminHome() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [wasteKpis, setWasteKpis] = useState<WasteKpis | null>(null);
  const [wasteKpisLoading, setWasteKpisLoading] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    const next = emptyData();
    try {
      const results = await Promise.allSettled(
        entityRequests.map(([, req]) => req()),
      );
      results.forEach((result, i) => {
        const key = entityRequests[i][0];
        next[key] = result.status === "fulfilled" ? toRows(result.value) : [];
      });
      setData(next);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchWasteKpis = async () => {
      setWasteKpisLoading(true);
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      try {
        const { data } = await api.get<{ kpis: WasteKpis }>(
          "/reports/monthly-waste-comparison/",
          {
            params: { month: currentMonth },
          },
        );
        if (data?.kpis) {
          const k = data.kpis;
          setWasteKpis({
            total_agreed_weight: k.total_agreed_weight ?? 0,
            total_actual_weight: k.total_actual_weight ?? 0,
            variance_kg: k.variance_kg ?? 0,
            collection_efficiency_percent: k.collection_efficiency_percent ?? 0,
            average_weight_per_trip: k.average_weight_per_trip ?? 0,
            coverage_efficiency_percent: k.coverage_efficiency_percent ?? 0,
            total_trips: k.total_trips ?? 0,
            collection_points_covered: k.collection_points_covered ?? 0,
            report_status: k.report_status ?? "",
          });
        }
      } catch {
        // silently ignore — dashboard should not break if report API fails
      } finally {
        setWasteKpisLoading(false);
      }
    };
    void fetchWasteKpis();
  }, []);

  const dashboard = useMemo(() => {
    const geographyTotal =
      data.continents.length +
      data.countries.length +
      data.states.length +
      data.districts.length +
      data.panchayats.length;
    const orgTotal =
      data.departments.length +
      data.designations.length +
      data.areaTypes.length +
      data.hierarchies.length;
    const wasteTotal = data.properties.length + data.subProperties.length;
    const masterTotal = geographyTotal + orgTotal + wasteTotal;
    const assetTotal =
      data.collectionPoints.length + data.wasteTypes.length + data.bins.length;
    const workforceTotal =
      data.users.length + data.staff.length + data.customers.length;
    const transportTotal =
      data.vehicleTypes.length + data.vehicles.length + data.fuels.length;
    const grievanceTotal =
      data.complaints.length +
      data.feedbacks.length +
      data.mainCategories.length +
      data.subCategories.length;
    const screenTotal =
      data.mainScreenTypes.length +
      data.mainScreens.length +
      data.userScreens.length +
      data.screenActions.length;
    const permissionTotal =
      data.screenPermissions.length + data.columnPermissions.length;

    const activeUsers = data.users.filter(isActive).length;
    const activeStaff = data.staff.filter(isActive).length;
    const activeBins = data.bins.filter(isActive).length;
    const activeVehicles = data.vehicles.filter(isActive).length;
    const activeComplaints = data.complaints.filter((c) => {
      const status = String(c.status ?? c.complaint_status ?? "").toLowerCase();
      return !["closed", "resolved", "completed"].includes(status);
    }).length;

    // Module bar chart data
    const moduleNames = [
      "Masters",
      "Assets",
      "Users",
      "Transport",
      "Grievance",
      "Screens",
      "Permissions",
    ];
    const moduleValues = [
      masterTotal,
      assetTotal,
      workforceTotal,
      transportTotal,
      grievanceTotal,
      screenTotal,
      permissionTotal,
    ];
    const moduleLoadData = moduleNames.map((name, i) => ({
      name,
      value: moduleValues[i],
      color: CHART_COLORS[i],
    }));

    // Users donut data
    const userDonutLabels = [
      "Users",
      "Active Users",
      "Staff",
      "Customers",
      "User Types",
    ];
    const userDonutSeries = [
      data.users.length,
      activeUsers,
      data.staff.length,
      data.customers.length,
      data.userTypes.length,
    ];

    // Grievance area data
    const grievanceCategories = [
      "Complaints",
      "Open/Active",
      "Feedback",
      "Categories",
    ];
    const grievanceSeries = [
      data.complaints.length,
      activeComplaints,
      data.feedbacks.length,
      data.mainCategories.length + data.subCategories.length,
    ];

    // Asset radial data
    const maxAsset = Math.max(
      data.collectionPoints.length,
      data.wasteTypes.length,
      data.bins.length,
      activeBins,
      1,
    );
    const assetRadialSeries = [
      Math.round((data.collectionPoints.length / maxAsset) * 100),
      Math.round((data.wasteTypes.length / maxAsset) * 100),
      Math.round((data.bins.length / maxAsset) * 100),
      Math.round((activeBins / maxAsset) * 100),
    ];

    // Screen donut data
    const screenDonutLabels = [
      "Screen Types",
      "Main Screens",
      "User Screens",
      "Actions",
    ];
    const screenDonutSeries = [
      data.mainScreenTypes.length,
      data.mainScreens.length,
      data.userScreens.length,
      data.screenActions.length,
    ];

    // User screens by module (enhanced table)
    const mainScreenDetails: MainScreenRow[] = data.mainScreens.map(
      (screen, index) => {
        const screenId = String(screen.id ?? screen.unique_id ?? "");
        const screenName = getLabel(screen, `Main Screen ${index + 1}`);

        const typeId = String(
          screen.mainscreen_type_id ?? screen.mainscreen_type ?? "",
        );
        const typeObj = data.mainScreenTypes.find(
          (t) => String(t.id ?? t.unique_id ?? "") === typeId,
        );
        const typeName = typeObj
          ? getLabel(typeObj, "General")
          : typeId || "General";

        const linkedUserScreens = data.userScreens.filter((us) => {
          const usMainId =
            getNestedId(us, "mainscreen_id") || String(us.main_screen_id ?? "");
          return usMainId && screenId && usMainId === screenId;
        });

        const userScreenNames = linkedUserScreens.map((us, i) =>
          getLabel(us, `Screen ${i + 1}`),
        );

        const linkedPermissions = data.screenPermissions.filter((p) => {
          const pMainId =
            getNestedId(p, "mainscreen_id") || String(p.main_screen_id ?? "");
          return pMainId && screenId && pMainId === screenId;
        });

        const roles = [
          ...new Set(
            linkedPermissions.map(extractUserTypeName).filter(Boolean),
          ),
        ];

        return {
          id: screenId,
          name: screenName,
          type: typeName,
          userScreenNames,
          userScreenCount: linkedUserScreens.length,
          roles,
          active: screen.is_active !== false,
        };
      },
    );

    const kpiBreakdowns: Record<string, BreakdownItem[]> = {
      "Total Masters": [
        { label: "Continents", value: data.continents.length, sub: "Geography" },
        { label: "Countries", value: data.countries.length, sub: "Geography" },
        { label: "States", value: data.states.length, sub: "Geography" },
        { label: "Districts", value: data.districts.length, sub: "Geography" },
        { label: "Panchayats", value: data.panchayats.length, sub: "Geography" },
        { label: "Departments", value: data.departments.length, sub: "Organisation" },
        { label: "Designations", value: data.designations.length, sub: "Organisation" },
        { label: "Area Types", value: data.areaTypes.length, sub: "Organisation" },
        { label: "Hierarchies", value: data.hierarchies.length, sub: "Organisation" },
        { label: "Properties", value: data.properties.length, sub: "Waste" },
        { label: "Sub Properties", value: data.subProperties.length, sub: "Waste" },
      ],
      "Active Users": [
        { label: "Total Users", value: data.users.length, sub: "User accounts" },
        { label: "Active Users", value: activeUsers, sub: "Currently active" },
        { label: "Total Staff", value: data.staff.length, sub: "Staff members" },
        { label: "Active Staff", value: activeStaff, sub: "Currently active" },
        { label: "Customers", value: data.customers.length, sub: "Registered" },
        { label: "User Types", value: data.userTypes.length, sub: "Role types" },
        { label: "Staff Types", value: data.staffUserTypes.length, sub: "Staff roles" },
      ],
      "Fleet & Transport": [
        { label: "Vehicle Types", value: data.vehicleTypes.length, sub: "Categories" },
        { label: "Total Vehicles", value: data.vehicles.length, sub: "Fleet size" },
        { label: "Active Vehicles", value: activeVehicles, sub: "Operational" },
        { label: "Fuel Records", value: data.fuels.length, sub: "Fuel entries" },
      ],
      "Assets": [
        { label: "Collection Points", value: data.collectionPoints.length, sub: "Pickup locations" },
        { label: "Waste Types", value: data.wasteTypes.length, sub: "Classified types" },
        { label: "Total Bins", value: data.bins.length, sub: "All bins" },
        { label: "Active Bins", value: activeBins, sub: "Operational" },
      ],
      "Open Grievances": [
        { label: "Total Complaints", value: data.complaints.length, sub: "All time" },
        { label: "Open / Active", value: activeComplaints, sub: "Pending resolution" },
        { label: "Total Feedbacks", value: data.feedbacks.length, sub: "Submitted" },
        { label: "Main Categories", value: data.mainCategories.length, sub: "Complaint types" },
        { label: "Sub Categories", value: data.subCategories.length, sub: "Detailed types" },
      ],
      "Screen Coverage": [
        { label: "Screen Types", value: data.mainScreenTypes.length, sub: "Module types" },
        { label: "Main Screens", value: data.mainScreens.length, sub: "Modules" },
        { label: "User Screens", value: data.userScreens.length, sub: "Sub-screens" },
        { label: "Screen Actions", value: data.screenActions.length, sub: "Actions" },
        { label: "Screen Perms", value: data.screenPermissions.length, sub: "Access rules" },
        { label: "Column Perms", value: data.columnPermissions.length, sub: "Field access" },
      ],
      "Customers": [
        { label: "Total Customers", value: data.customers.length, sub: "Registered" },
        { label: "User Types", value: data.userTypes.length, sub: "User roles" },
        { label: "Staff User Types", value: data.staffUserTypes.length, sub: "Staff roles" },
      ],
      "Waste Collections": [
        { label: "Total Collections", value: data.wasteCollections.length, sub: "All records" },
        { label: "Waste Types", value: data.wasteTypes.length, sub: "Classified" },
        { label: "Properties", value: data.properties.length, sub: "Waste properties" },
        { label: "Sub Properties", value: data.subProperties.length, sub: "Sub-properties" },
        { label: "Collection Points", value: data.collectionPoints.length, sub: "Pickup locations" },
      ],
    };

    return {
      totals: {
        masterTotal,
        assetTotal,
        workforceTotal,
        transportTotal,
        grievanceTotal,
        screenTotal,
        permissionTotal,
        geographyTotal,
        activeUsers,
        activeStaff,
        activeBins,
        activeVehicles,
        activeComplaints,
      },
      charts: {
        moduleNames,
        moduleValues,
        moduleLoadData,
        userDonutLabels,
        userDonutSeries,
        grievanceCategories,
        grievanceSeries,
        assetRadialSeries,
        maxAsset,
        screenDonutLabels,
        screenDonutSeries,
      },
      mainScreenDetails,
      kpiBreakdowns,
    };
  }, [data]);

  const kpis: KpiConfig[] = [
    {
      title: "Total Masters",
      value: dashboard.totals.masterTotal,
      detail: `${dashboard.totals.geographyTotal} geography · ${dashboard.totals.masterTotal - dashboard.totals.geographyTotal} org`,
      icon: Database,
      gradient: "from-green-600 to-emerald-500",
      bg: "bg-green-50",
    },
    {
      title: "Active Users",
      value: dashboard.totals.activeUsers,
      detail: `${dashboard.totals.activeStaff} active staff · ${data.customers.length} customers`,
      icon: Users,
      gradient: "from-emerald-600 to-teal-500",
      bg: "bg-emerald-50",
    },
    {
      title: "Fleet & Transport",
      value: dashboard.totals.transportTotal,
      detail: `${data.vehicles.length} vehicles · ${dashboard.totals.activeVehicles} active`,
      icon: Truck,
      gradient: "from-orange-500 to-amber-500",
      bg: "bg-orange-50",
    },
    {
      title: "Assets",
      value: dashboard.totals.assetTotal,
      detail: `${dashboard.totals.activeBins} active bins · ${data.collectionPoints.length} collection points`,
      icon: Boxes,
      gradient: "from-green-500 to-emerald-400",
      bg: "bg-green-50",
    },
    {
      title: "Open Grievances",
      value: dashboard.totals.activeComplaints,
      detail: `${data.complaints.length} total complaints · ${data.feedbacks.length} feedbacks`,
      icon: AlertTriangle,
      gradient: "from-rose-600 to-red-500",
      bg: "bg-rose-50",
    },
    {
      title: "Screen Coverage",
      value: dashboard.totals.screenTotal,
      detail: `${data.mainScreens.length} main screens · ${data.userScreens.length} user screens`,
      icon: Layers3,
      gradient: "from-orange-600 to-amber-500",
      bg: "bg-orange-50",
    },
    {
      title: "Customers",
      value: data.customers.length,
      detail: `${data.userTypes.length} user types · ${data.staffUserTypes.length} staff types`,
      icon: Building2,
      gradient: "from-green-700 to-green-500",
      bg: "bg-green-50",
    },
    {
      title: "Waste Collections",
      value: data.wasteCollections.length,
      detail: `${data.wasteTypes.length} waste types · ${data.properties.length} properties`,
      icon: Activity,
      gradient: "from-orange-500 to-yellow-500",
      bg: "bg-orange-50",
    },
  ];

  // ─── ApexChart Options ──────────────────────────────────────────────────────

  const userDonutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels: dashboard.charts.userDonutLabels,
    colors: ["#16a34a", "#f97316", "#059669", "#ea580c", "#15803d"],
    legend: { position: "bottom", fontSize: "12px" },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "14px",
              fontWeight: "600" as unknown as number,
              color: "#0f172a",
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    tooltip: { y: { formatter: (v) => v.toLocaleString() } },
  };

  const grievanceAreaOptions: ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, fontFamily: "inherit" },
    stroke: { curve: "smooth", width: 3 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.5,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    colors: ["#f97316"],
    xaxis: {
      categories: dashboard.charts.grievanceCategories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { show: false },
    grid: { borderColor: "#fff7ed", strokeDashArray: 4 },
    dataLabels: {
      enabled: true,
      style: { colors: ["#ea580c"], fontSize: "13px", fontWeight: "700" },
    },
    markers: {
      size: 5,
      colors: ["#f97316"],
      strokeWidth: 2,
      strokeColors: "#fff",
    },
    tooltip: { y: { formatter: (v) => v.toLocaleString() } },
  };
  const grievanceAreaSeries = [
    { name: "Count", data: dashboard.charts.grievanceSeries },
  ];

  const assetRadialOptions: ApexOptions = {
    chart: { type: "radialBar", fontFamily: "inherit" },
    plotOptions: {
      radialBar: {
        hollow: { size: "20%", margin: 5 },
        track: { background: "#f0fdf4", strokeWidth: "80%", margin: 4 },
        dataLabels: { show: false },
      },
    },
    labels: ["Collection Pts", "Waste Types", "Bins", "Active Bins"],
    colors: ["#16a34a", "#f97316", "#059669", "#ea580c"],
    stroke: { lineCap: "round" },
  };

  const screenDonutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels: dashboard.charts.screenDonutLabels,
    colors: ["#16a34a", "#f97316", "#059669", "#ea580c"],
    legend: { position: "bottom", fontSize: "12px" },
    plotOptions: { pie: { donut: { size: "60%" } } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    tooltip: { y: { formatter: (v) => v.toLocaleString() } },
  };

  const hasUserData = dashboard.charts.userDonutSeries.some((v) => v > 0);
  const hasGrievanceData = dashboard.charts.grievanceSeries.some((v) => v > 0);
  const hasAssetData = dashboard.charts.assetRadialSeries.some((v) => v > 0);
  const hasScreenData = dashboard.charts.screenDonutSeries.some((v) => v > 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-base font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-0.5 text-xs text-gray-400">System-wide operational overview</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Live
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
            </div>
            <Button
              onClick={fetchDashboardData}
              disabled={loading}
              size="sm"
              className="bg-orange-500 hover:bg-orange-400 border-0 text-white shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-9xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ── KPI Cards (8) — click any card for a detailed breakdown ──── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.title}
              {...kpi}
              loading={loading}
              isSelected={selectedKpi === kpi.title}
              onClick={() => setSelectedKpi(selectedKpi === kpi.title ? null : kpi.title)}
            />
          ))}
        </div>

        {/* ── KPI Breakdown Panel ────────────────────────────────────────── */}
        {selectedKpi && !loading && dashboard.kpiBreakdowns[selectedKpi] && (
          <KpiBreakdownPanel
            title={selectedKpi}
            items={dashboard.kpiBreakdowns[selectedKpi]}
            onClose={() => setSelectedKpi(null)}
          />
        )}

        {/* ── Monthly Waste Collection KPIs ─────────────────────────────── */}
        <Panel
          title="Monthly Waste Collection"
          subtitle={`KPIs for ${new Date().toLocaleString("default", { month: "long", year: "numeric" })} — efficiency, variance, trips and coverage`}
          icon={Activity}
        >
          {wasteKpisLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : wasteKpis ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <WasteKpiTile
                  label="Collection Efficiency"
                  value={`${wasteKpis.collection_efficiency_percent.toFixed(1)}%`}
                  sub="actual vs agreed weight"
                  color="text-emerald-600"
                  border="border-emerald-400"
                  bg="bg-emerald-50"
                />
                <WasteKpiTile
                  label="Coverage Efficiency"
                  value={`${wasteKpis.coverage_efficiency_percent.toFixed(1)}%`}
                  sub="points covered vs trips"
                  color="text-orange-600"
                  border="border-orange-400"
                  bg="bg-orange-50"
                />
                <WasteKpiTile
                  label="Avg Weight / Trip"
                  value={`${wasteKpis.average_weight_per_trip.toFixed(2)} kg`}
                  sub="actual weight per trip"
                  color="text-green-700"
                  border="border-green-500"
                  bg="bg-green-50"
                />
                <WasteKpiTile
                  label="Total Variance"
                  value={`${wasteKpis.variance_kg >= 0 ? "+" : ""}${wasteKpis.variance_kg.toFixed(2)} kg`}
                  sub="actual minus agreed"
                  color={
                    wasteKpis.variance_kg >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }
                  border={
                    wasteKpis.variance_kg >= 0
                      ? "border-emerald-400"
                      : "border-rose-400"
                  }
                  bg={
                    wasteKpis.variance_kg >= 0 ? "bg-emerald-50" : "bg-rose-50"
                  }
                />
                <WasteKpiTile
                  label="Report Status"
                  value={wasteKpis.report_status || "—"}
                  sub="overall performance"
                  color={
                    wasteKpis.report_status === "Surplus"
                      ? "text-emerald-600"
                      : wasteKpis.report_status === "Deficit"
                        ? "text-rose-600"
                        : "text-blue-600"
                  }
                  border={
                    wasteKpis.report_status === "Surplus"
                      ? "border-emerald-400"
                      : wasteKpis.report_status === "Deficit"
                        ? "border-rose-400"
                        : "border-blue-400"
                  }
                  bg={
                    wasteKpis.report_status === "Surplus"
                      ? "bg-emerald-50"
                      : wasteKpis.report_status === "Deficit"
                        ? "bg-rose-50"
                        : "bg-blue-50"
                  }
                />
              </div>
              {/* Weight comparison + operations in one row */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Weight & Operations
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 lg:col-span-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-600">
                        <span className="font-medium">Actual Weight</span>
                        <span className="font-bold">{wasteKpis.total_actual_weight.toLocaleString()} kg</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${wasteKpis.total_actual_weight >= wasteKpis.total_agreed_weight ? "bg-orange-500" : "bg-rose-500"}`}
                          style={{
                            width: `${Math.min(
                              wasteKpis.total_agreed_weight > 0
                                ? (wasteKpis.total_actual_weight / wasteKpis.total_agreed_weight) * 100
                                : 0,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Trips</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-orange-600">{wasteKpis.total_trips.toLocaleString()}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">collection trips made</p>
                  </div>
                  <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Points Covered</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-green-600">{wasteKpis.collection_points_covered.toLocaleString()}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">collection points</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              No monthly waste report data available.
            </div>
          )}
        </Panel>

        {/* ── Module Load + Users Donut ──────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Module Load"
            subtitle="Record volume across all administrative domains"
            icon={Activity}
          >
            <ModuleLoadBars
              data={dashboard.charts.moduleLoadData}
              loading={loading}
            />
          </Panel>

          <Panel
            title="Users & Workforce"
            subtitle="Operational availability snapshot"
            icon={Users}
          >
            {loading ? (
              <SkeletonChart height={320} />
            ) : hasUserData ? (
              <ReactApexChart
                options={userDonutOptions}
                series={dashboard.charts.userDonutSeries}
                type="donut"
                height={320}
              />
            ) : (
              <EmptyChart height={320} />
            )}
          </Panel>
        </div>

  

        {/* ── Grievance + Assets + Screen Composition ───────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            title="Grievance Pulse"
            subtitle="Complaints, open cases, feedback & categories"
            icon={ClipboardList}
          >
            {loading ? (
              <SkeletonChart height={260} />
            ) : hasGrievanceData ? (
              <ReactApexChart
                options={grievanceAreaOptions}
                series={grievanceAreaSeries}
                type="area"
                height={260}
              />
            ) : (
              <EmptyChart height={260} />
            )}
          </Panel>

          <Panel
            title="Asset Breakdown"
            subtitle="Collection points, waste types & bins"
            icon={Boxes}
          >
            {loading ? (
              <SkeletonChart height={260} />
            ) : hasAssetData ? (
              <div className="flex items-center gap-2">
                <div className="w-[55%]">
                  <ReactApexChart
                    options={assetRadialOptions}
                    series={dashboard.charts.assetRadialSeries}
                    type="radialBar"
                    height={240}
                  />
                </div>
                <div className="flex-1 space-y-5 py-2 pr-2">
                  {[
                    {
                      label: "Collection Points",
                      value: data.collectionPoints.length,
                      color: "#16a34a",
                    },
                    {
                      label: "Waste Types",
                      value: data.wasteTypes.length,
                      color: "#f97316",
                    },
                    {
                      label: "Total Bins",
                      value: data.bins.length,
                      color: "#059669",
                    },
                    {
                      label: "Active Bins",
                      value: dashboard.totals.activeBins,
                      color: "#ea580c",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <p
                          className="text-2xl font-bold tabular-nums leading-none"
                          style={{ color }}
                        >
                          {value.toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart height={260} />
            )}
          </Panel>

          <Panel
            title="Screen Composition"
            subtitle="Screen types, screens, user screens & actions"
            icon={ShieldCheck}
          >
            {loading ? (
              <SkeletonChart height={260} />
            ) : hasScreenData ? (
              <ReactApexChart
                options={screenDonutOptions}
                series={dashboard.charts.screenDonutSeries}
                type="donut"
                height={260}
              />
            ) : (
              <EmptyChart height={260} />
            )}
          </Panel>
        </div>


        {/* ── Bottom Summary Stats ────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <BottomStat
            label="Screen Permissions"
            value={data.screenPermissions.length}
            icon={ShieldCheck}
            color="bg-green-700"
            loading={loading}
          />
          <BottomStat
            label="Column Permissions"
            value={data.columnPermissions.length}
            icon={Key}
            color="bg-orange-600"
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  gradient,
  loading,
  isSelected,
  onClick,
}: KpiConfig & { loading: boolean; isSelected?: boolean; onClick?: () => void }) {
  const isOrange =
    gradient.includes("orange") ||
    gradient.includes("amber") ||
    gradient.includes("yellow");
  return (
    <div
      onClick={onClick}
      className={`group flex flex-col rounded-xl border bg-white shadow-sm transition-all duration-200 cursor-pointer select-none
        hover:-translate-y-0.5 hover:shadow-md
        ${isSelected
          ? "border-orange-400 ring-2 ring-orange-200 shadow-md -translate-y-0.5"
          : "border-gray-200 hover:border-gray-300"
        }`}
    >
      <div className={`h-1 w-full rounded-t-xl bg-linear-to-r ${gradient}`} />
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
              {loading ? (
                <span className="inline-block h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
              ) : (
                value.toLocaleString()
              )}
            </p>
          </div>
          <div
            className={`shrink-0 rounded-xl p-2.5 ${isOrange ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-700"}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400 leading-snug">{detail}</p>
          {isSelected && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-orange-500">
              expanded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiBreakdownPanel({
  title,
  items,
  onClose,
}: {
  title: string;
  items: BreakdownItem[];
  onClose: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50/60 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title} — Breakdown</h3>
          <p className="text-xs text-gray-400">Click the card again to collapse</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-orange-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {items.map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3 shadow-sm">
              <p className="text-xl font-bold tabular-nums text-gray-900">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-700">{label}</p>
              {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MasterCard({
  label,
  count,
  color,
  icon: Icon,
  loading,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  loading?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border-2 bg-white px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: `${color}22` }}
    >
      <div
        className="rounded-lg p-1.5"
        style={{ backgroundColor: `${color}14` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      {loading ? (
        <span className="inline-block h-7 w-10 animate-pulse rounded bg-gray-100" />
      ) : (
        <span className="text-xl font-bold text-gray-900 tabular-nums">
          {count.toLocaleString()}
        </span>
      )}
      <span className="text-[10px] font-medium leading-tight text-gray-500">
        {label}
      </span>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className={`text-xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-gray-500">{label}</p>
    </div>
  );
}

function BottomStat({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className={`rounded-xl ${color} p-3 text-white shadow-sm`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">
          {loading ? (
            <span className="inline-block h-7 w-12 animate-pulse rounded bg-gray-100" />
          ) : (
            value.toLocaleString()
          )}
        </p>
      </div>
    </div>
  );
}

function ModuleLoadBars({
  data,
  loading,
}: {
  data: { name: string; value: number; color: string }[];
  loading: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3 py-1">
      {data.map(({ name, value, color }) => {
        const pct = Math.max((value / max) * 100, 2);
        return (
          <div key={name} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-right text-xs font-semibold text-gray-600">
              {name}
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
              {loading ? (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-gray-200" />
              ) : (
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              )}
            </div>
            <div className="w-14 shrink-0 text-right">
              {loading ? (
                <span className="inline-block h-5 w-10 animate-pulse rounded bg-gray-200" />
              ) : (
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-xs font-bold tabular-nums text-white"
                  style={{ backgroundColor: color }}
                >
                  {value.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonChart({ height }: { height: number }) {
  return (
    <div className="animate-pulse rounded-xl bg-gray-100" style={{ height }} />
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-gray-50 text-sm font-medium text-gray-400"
      style={{ height }}
    >
      No data available
    </div>
  );
}

function WasteKpiTile({
  label,
  value,
  sub,
  color,
  border,
  bg,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  border: string;
  bg: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-100 border-l-4 ${border} ${bg} p-4 shadow-sm`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-bold tabular-nums leading-tight ${color}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}
