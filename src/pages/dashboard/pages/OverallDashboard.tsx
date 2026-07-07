import { useState } from "react";
import TamilNaduDistrictMap from "./components/TamilNaduDistrictMap";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Activity,
  RefreshCw,
  Download,
  Droplets,
  Recycle,
  Shield,
  Leaf,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Gauge,
  Building2,
  Globe,
  Filter,
  MapPin,
} from "lucide-react";

// ─── MOCK DATA ────────────────────────────────────────────────────

const collectionTrends = [
  { day: "Mon", wet: 420, dry: 280, sanitary: 95, special: 45 },
  { day: "Tue", wet: 460, dry: 310, sanitary: 88, special: 52 },
  { day: "Wed", wet: 390, dry: 265, sanitary: 102, special: 38 },
  { day: "Thu", wet: 510, dry: 340, sanitary: 115, special: 60 },
  { day: "Fri", wet: 480, dry: 295, sanitary: 98, special: 55 },
  { day: "Sat", wet: 350, dry: 220, sanitary: 75, special: 30 },
  { day: "Sun", wet: 280, dry: 185, sanitary: 62, special: 25 },
];

const grievanceTrends = [
  { month: "Jan", received: 245, resolved: 228 },
  { month: "Feb", received: 312, resolved: 290 },
  { month: "Mar", received: 287, resolved: 265 },
  { month: "Apr", received: 354, resolved: 329 },
  { month: "May", received: 298, resolved: 278 },
  { month: "Jun", received: 267, resolved: 249 },
];

const segregationPie = [
  { name: "Wet Waste", value: 48, color: "#10b981", qty: "485 MT" },
  { name: "Dry Waste", value: 32, color: "#3b82f6", qty: "323 MT" },
  { name: "Sanitary", value: 12, color: "#f59e0b", qty: "121 MT" },
  { name: "Special Care", value: 8, color: "#8b5cf6", qty: "81 MT" },
];

const fleetByZone = [
  { zone: "North", active: 38, idle: 7, maintenance: 2 },
  { zone: "South", active: 44, idle: 8, maintenance: 3 },
  { zone: "East", active: 32, idle: 6, maintenance: 1 },
  { zone: "West", active: 35, idle: 6, maintenance: 2 },
  { zone: "Central", active: 24, idle: 5, maintenance: 1 },
];

const areaPerformance = [
  { area: "Chennai Corp.", collected: 1250, target: 1350, efficiency: 93, status: "On Track" },
  { area: "Coimbatore Corp.", collected: 845, target: 920, efficiency: 92, status: "On Track" },
  { area: "Madurai Corp.", collected: 720, target: 800, efficiency: 90, status: "On Track" },
  { area: "Trichy Corp.", collected: 680, target: 750, efficiency: 91, status: "On Track" },
  { area: "Salem Corp.", collected: 520, target: 600, efficiency: 87, status: "Delayed" },
  { area: "Tirunelveli Corp.", collected: 490, target: 540, efficiency: 91, status: "On Track" },
  { area: "Tiruppur Corp.", collected: 460, target: 500, efficiency: 92, status: "On Track" },
  { area: "Erode Mun.", collected: 310, target: 360, efficiency: 86, status: "Delayed" },
];

const grievanceCategories = [
  { category: "Non-Collection", received: 142, resolved: 128, pct: 90 },
  { category: "Overflow Bins", received: 89, resolved: 76, pct: 85 },
  { category: "Vehicle Nuisance", received: 56, resolved: 51, pct: 91 },
  { category: "Illegal Dumping", received: 43, resolved: 39, pct: 91 },
  { category: "Others", received: 38, resolved: 35, pct: 92 },
];

// ─── STATIC STYLE MAPS ────────────────────────────────────────────

const localBodyTypes = [
  {
    type: "Corporation",
    count: 15,
    active: 15,
    Icon: Building2,
    accentCls: "bg-sky-500",
    iconCls: "text-sky-600",
    iconBg: "bg-sky-50 border-sky-100",
    desc: "Municipal Corporation",
  },
  {
    type: "Municipality",
    count: 152,
    active: 148,
    Icon: Building2,
    accentCls: "bg-blue-500",
    iconCls: "text-blue-600",
    iconBg: "bg-blue-50 border-blue-100",
    desc: "Municipal Council",
  },
  {
    type: "Town Panchayat",
    count: 528,
    active: 516,
    Icon: MapPin,
    accentCls: "bg-violet-500",
    iconCls: "text-violet-600",
    iconBg: "bg-violet-50 border-violet-100",
    desc: "Town & Nagara Panchayat",
  },
  {
    type: "Panchayat",
    count: 12524,
    active: 11980,
    Icon: Leaf,
    accentCls: "bg-emerald-500",
    iconCls: "text-emerald-600",
    iconBg: "bg-emerald-50 border-emerald-100",
    desc: "Village Panchayat",
  },
];

const wasteTypeCards = [
  {
    type: "Wet Waste",
    qty: "485 MT",
    pct: 48,
    accentColor: "#10b981",
    accentCls: "bg-emerald-500",
    iconBg: "bg-emerald-50 border-emerald-100",
    iconCls: "text-emerald-600",
    trendCls: "text-emerald-600 bg-emerald-50",
    effColor: "text-emerald-600",
    Icon: Droplets,
    trend: "+3.2%",
    up: true,
    desc: "Kitchen & organic",
    efficiency: 82,
  },
  {
    type: "Dry Waste",
    qty: "323 MT",
    pct: 32,
    accentColor: "#3b82f6",
    accentCls: "bg-blue-500",
    iconBg: "bg-blue-50 border-blue-100",
    iconCls: "text-blue-600",
    trendCls: "text-emerald-600 bg-emerald-50",
    effColor: "text-emerald-600",
    Icon: Recycle,
    trend: "+1.8%",
    up: true,
    desc: "Paper, plastic, metal",
    efficiency: 91,
  },
  {
    type: "Sanitary Waste",
    qty: "121 MT",
    pct: 12,
    accentColor: "#f59e0b",
    accentCls: "bg-amber-500",
    iconBg: "bg-amber-50 border-amber-100",
    iconCls: "text-amber-600",
    trendCls: "text-rose-600 bg-rose-50",
    effColor: "text-amber-600",
    Icon: Shield,
    trend: "-0.5%",
    up: false,
    desc: "Medical & hygiene",
    efficiency: 76,
  },
  {
    type: "Special Care",
    qty: "81 MT",
    pct: 8,
    accentColor: "#8b5cf6",
    accentCls: "bg-violet-500",
    iconBg: "bg-violet-50 border-violet-100",
    iconCls: "text-violet-600",
    trendCls: "text-emerald-600 bg-emerald-50",
    effColor: "text-rose-500",
    Icon: Leaf,
    trend: "+0.9%",
    up: true,
    desc: "E-waste, hazardous",
    efficiency: 68,
  },
];

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-card border border-border/60 rounded-xl shadow-xl p-3 text-xs backdrop-blur-sm">
      <p className="font-semibold mb-2 text-muted-foreground text-[11px] uppercase tracking-wide">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── STAT MINI CARD ───────────────────────────────────────────────

function MiniStatCard({
  label,
  value,
  sub,
  subCls = "text-muted-foreground",
}: {
  label: string;
  value: string;
  sub: string;
  subCls?: string;
}) {
  return (
    <Card className="border-border/40 shadow-sm bg-card">
      <CardContent className="p-4">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-1.5">{value}</p>
        <p className={`text-[11px] mt-1 font-medium ${subCls}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────

export default function OverallDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [district, setDistrict] = useState("all");
  const [bodyType, setBodyType] = useState("all");
  const [dateRange, setDateRange] = useState("quarter");

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="space-y-5 pb-12">

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-100/80 dark:border-emerald-900/30 bg-linear-to-r from-emerald-50/70 via-white to-white dark:from-emerald-950/20 dark:via-card dark:to-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-800/40">
                <Globe className="h-3 w-3 text-emerald-600" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Tamil Nadu State
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-200/60 bg-white dark:bg-card dark:border-emerald-800/40">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Live</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Overall Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Smart Waste Management — State-level monitoring across all local bodies
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg border-border/60 hover:bg-muted/60 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs rounded-lg border-border/60 hover:bg-muted/60 transition-colors"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── HIERARCHY FILTERS ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/40 border border-border/40">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filters</span>
        </div>
        <div className="h-4 w-px bg-border/60 mx-0.5" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">State:</span>
          <span className="text-xs font-semibold text-foreground">Tamil Nadu</span>
        </div>

        <Select value={district} onValueChange={setDistrict}>
          <SelectTrigger className="h-7 w-[148px] text-xs rounded-lg border-border/50 bg-background hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="District" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Districts</SelectItem>
            <SelectItem value="chennai">Chennai</SelectItem>
            <SelectItem value="coimbatore">Coimbatore</SelectItem>
            <SelectItem value="madurai">Madurai</SelectItem>
            <SelectItem value="trichy">Tiruchirappalli</SelectItem>
            <SelectItem value="salem">Salem</SelectItem>
            <SelectItem value="vellore">Vellore</SelectItem>
            <SelectItem value="thanjavur">Thanjavur</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bodyType} onValueChange={setBodyType}>
          <SelectTrigger className="h-7 w-[168px] text-xs rounded-lg border-border/50 bg-background hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="Local Body Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Local Bodies</SelectItem>
            <SelectItem value="corporation">Corporation</SelectItem>
            <SelectItem value="municipality">Municipality</SelectItem>
            <SelectItem value="town-panchayat">Town Panchayat</SelectItem>
            <SelectItem value="panchayat">Panchayat</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="h-7 w-[124px] text-xs rounded-lg border-border/50 bg-background hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated 2 min ago
        </div>
      </div>

      {/* ── STATE KPI CARDS ───────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

        {/* Total Collected */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Collected</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">4,827</p>
                <p className="text-[11px] text-muted-foreground mt-1">MT today</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 shrink-0 ml-2 group-hover:bg-emerald-100 transition-colors">
                <Trash2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-emerald-50 w-fit">
              <ArrowUpRight className="h-3 w-3 text-emerald-600" />
              <span className="text-[11px] text-emerald-700 font-semibold">+8.2% vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Rate */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-sky-500 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Coverage Rate</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">91.4%</p>
                <p className="text-[11px] text-muted-foreground mt-1">of target areas</p>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 shrink-0 ml-2 group-hover:bg-sky-100 transition-colors">
                <Gauge className="h-4 w-4 text-sky-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-sky-50 w-fit">
              <ArrowUpRight className="h-3 w-3 text-sky-600" />
              <span className="text-[11px] text-sky-700 font-semibold">+2.1% this week</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Vehicles */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Active Vehicles</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">173</p>
                <p className="text-[11px] text-muted-foreground mt-1">of 205 total fleet</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 shrink-0 ml-2 group-hover:bg-blue-100 transition-colors">
                <Truck className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-blue-50 w-fit">
              <Activity className="h-3 w-3 text-blue-600" />
              <span className="text-[11px] text-blue-700 font-semibold">84.4% utilization</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Grievances */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-500 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pending Grievances</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">18</p>
                <p className="text-[11px] text-muted-foreground mt-1">of 267 received</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 shrink-0 ml-2 group-hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-emerald-50 w-fit">
              <ArrowDownRight className="h-3 w-3 text-emerald-600" />
              <span className="text-[11px] text-emerald-700 font-semibold">-23% vs last week</span>
            </div>
          </CardContent>
        </Card>

        {/* Segregation Rate */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-500 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Segregation Rate</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">78.6%</p>
                <p className="text-[11px] text-muted-foreground mt-1">source segregated</p>
              </div>
              <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100 shrink-0 ml-2 group-hover:bg-violet-100 transition-colors">
                <Recycle className="h-4 w-4 text-violet-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-violet-50 w-fit">
              <ArrowUpRight className="h-3 w-3 text-violet-600" />
              <span className="text-[11px] text-violet-700 font-semibold">+5.3% this month</span>
            </div>
          </CardContent>
        </Card>

        {/* Local Bodies */}
        <Card className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-400 rounded-t-xl" />
          <CardContent className="p-4 pt-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Local Bodies</p>
                <p className="text-[2rem] font-bold tracking-tight leading-none mt-2">1,248</p>
                <p className="text-[11px] text-muted-foreground mt-1">across Tamil Nadu</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0 ml-2 group-hover:bg-slate-100 transition-colors">
                <Building2 className="h-4 w-4 text-slate-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-emerald-50 w-fit">
              <CheckCircle className="h-3 w-3 text-emerald-600" />
              <span className="text-[11px] text-emerald-700 font-semibold">1,196 active</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── LOCAL BODY TYPE BREAKDOWN ─────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {localBodyTypes.map((lb) => (
          <Card key={lb.type} className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
            <div className={`absolute left-0 inset-y-0 w-1 ${lb.accentCls} rounded-l-xl`} />
            <CardContent className="pl-5 pr-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">{lb.desc}</p>
                  <p className="text-2xl font-bold tracking-tight mt-0.5">
                    {lb.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{lb.type}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${lb.iconBg} border shrink-0 group-hover:scale-105 transition-transform`}>
                  <lb.Icon className={`h-4 w-4 ${lb.iconCls}`} />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Active</span>
                <span className="font-bold text-foreground">{lb.active.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${lb.accentCls} transition-all duration-500`}
                  style={{ width: `${(lb.active / lb.count) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── MAIN MODULE TABS ──────────────────────────────────── */}
      <Tabs defaultValue="collection" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="h-9 w-max bg-muted/50 border border-border/40 rounded-xl p-1 gap-0.5">
            <TabsTrigger value="collection" className="gap-1.5 text-xs px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Trash2 className="h-3.5 w-3.5" />
              Waste Collection
            </TabsTrigger>
            <TabsTrigger value="grievances" className="gap-1.5 text-xs px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <AlertTriangle className="h-3.5 w-3.5" />
              Grievances
            </TabsTrigger>
            <TabsTrigger value="fleet" className="gap-1.5 text-xs px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Truck className="h-3.5 w-3.5" />
              Fleet Management
            </TabsTrigger>
            <TabsTrigger value="segregation" className="gap-1.5 text-xs px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Recycle className="h-3.5 w-3.5" />
              Segregation
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── WASTE COLLECTION ──────────────────────────────── */}
        <TabsContent value="collection" className="space-y-4 mt-0">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <MiniStatCard
              label="Daily Average"
              value="4,827 MT"
              sub="↑ +8.2% vs yesterday"
              subCls="text-emerald-600"
            />
            <MiniStatCard
              label="Weekly Total"
              value="32,580 MT"
              sub="↑ +4.1% vs last week"
              subCls="text-sky-600"
            />
            <MiniStatCard
              label="Monthly Total"
              value="1,28,450 MT"
              sub="↑ +6.7% vs last month"
              subCls="text-blue-600"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30 mb-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-emerald-500 inline-block" />
                  7-Day Collection Trends
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">MT per day</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={collectionTrends} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradWet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDry" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="wet" name="Wet" stroke="#10b981" fill="url(#gradWet)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="dry" name="Dry" stroke="#3b82f6" fill="url(#gradDry)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="sanitary" name="Sanitary" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    <Area type="monotone" dataKey="special" name="Special" stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-sky-500 inline-block" />
                  Today's Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-3 pb-4">
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={segregationPie} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                      {segregationPie.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {segregationPie.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">{item.qty}</span>
                        <span className="font-bold w-8 text-right">{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                <span className="h-4 w-1 rounded-full bg-blue-500 inline-block" />
                Area-wise Collection Performance
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">8 areas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-4">
              <div className="space-y-3">
                {areaPerformance.map((row) => (
                  <div key={row.area} className="flex items-center gap-3 group/row">
                    <span className="text-xs font-medium w-32 shrink-0 truncate text-foreground/80">{row.area}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {row.collected.toLocaleString()} / {row.target.toLocaleString()} MT
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          row.status === "On Track"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {row.status}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${row.efficiency >= 90 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${row.efficiency}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs font-bold w-10 text-right shrink-0 ${
                      row.efficiency >= 90 ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {row.efficiency}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GRIEVANCES ────────────────────────────────────── */}
        <TabsContent value="grievances" className="space-y-4 mt-0">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <MiniStatCard label="Total Received" value="267" sub="This month" />
            <MiniStatCard label="Resolved" value="249" sub="93.3% resolution rate" subCls="text-emerald-600" />
            <MiniStatCard label="Pending" value="18" sub="↓ -23% vs last week" subCls="text-emerald-600" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-amber-500 inline-block" />
                  Monthly Received vs Resolved
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-4 pb-4">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={grievanceTrends} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="received" name="Received" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-rose-500 inline-block" />
                  Category Resolution Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-4 space-y-4">
                {grievanceCategories.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/80">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">
                          {cat.resolved}/{cat.received}
                        </span>
                        <span className={`font-bold text-[11px] ${cat.pct >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                          {cat.pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cat.pct >= 90 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── FLEET MANAGEMENT ──────────────────────────────── */}
        <TabsContent value="fleet" className="space-y-4 mt-0">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MiniStatCard label="Total Fleet" value="205" sub="All vehicle types" />
            <MiniStatCard label="On Route" value="173" sub="84.4% utilization" subCls="text-emerald-600" />
            <MiniStatCard label="Idle" value="23" sub="Awaiting dispatch" subCls="text-amber-600" />
            <MiniStatCard label="Maintenance" value="9" sub="Temporarily offline" subCls="text-rose-500" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-blue-500 inline-block" />
                  Zone-wise Fleet Utilization
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-4 pb-4">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={fleetByZone} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="zone" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="active" name="Active" fill="#3b82f6" stackId="s" />
                    <Bar dataKey="idle" name="Idle" fill="#fbbf24" stackId="s" />
                    <Bar dataKey="maintenance" name="Maintenance" fill="#f87171" stackId="s" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-emerald-500 inline-block" />
                  GPS Status by Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-4">
                <div className="space-y-3.5">
                  {fleetByZone.map((zone) => {
                    const total = zone.active + zone.idle + zone.maintenance;
                    const util = Math.round((zone.active / total) * 100);
                    return (
                      <div key={zone.zone} className="flex items-center gap-3">
                        <span className="text-xs font-semibold w-14 text-muted-foreground shrink-0">
                          {zone.zone}
                        </span>
                        <div className="flex-1 flex h-3.5 rounded-full overflow-hidden bg-muted">
                          <div className="bg-blue-500 transition-all" style={{ width: `${(zone.active / total) * 100}%` }} />
                          <div className="bg-amber-400 transition-all" style={{ width: `${(zone.idle / total) * 100}%` }} />
                          <div className="bg-rose-400 transition-all" style={{ width: `${(zone.maintenance / total) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold w-9 text-right text-blue-600 shrink-0">
                          {util}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-blue-500 inline-block" />Active
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-amber-400 inline-block" />Idle
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-rose-400 inline-block" />Maintenance
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── WASTE SEGREGATION ─────────────────────────────── */}
        <TabsContent value="segregation" className="space-y-4 mt-0">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {wasteTypeCards.map((item) => (
              <Card key={item.type} className="border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-0.5 ${item.accentCls} rounded-t-xl`} />
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">{item.desc}</p>
                      <p className="text-sm font-bold mt-0.5">{item.type}</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${item.iconBg} border shrink-0 group-hover:scale-105 transition-transform`}>
                      <item.Icon className={`h-4 w-4 ${item.iconCls}`} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tracking-tight">{item.qty}</span>
                    <span className="text-sm font-semibold text-muted-foreground">{item.pct}%</span>
                  </div>
                  <div className={`inline-flex items-center gap-0.5 mt-2 px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${item.trendCls}`}>
                    {item.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {item.trend} vs yesterday
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-muted-foreground">Seg. efficiency</span>
                      <span className={`font-bold ${item.effColor}`}>{item.efficiency}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.efficiency}%`, background: item.accentColor }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-violet-500 inline-block" />
                  Segregation Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-3">
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={segregationPie} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value">
                        {segregationPie.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3.5">
                    {segregationPie.map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="font-medium text-foreground/80">{item.name}</span>
                          </div>
                          <span className="font-bold">{item.value}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.value * 2}%`, background: item.color }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.qty}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 pb-3">
                  <span className="h-4 w-1 rounded-full bg-emerald-500 inline-block" />
                  Weekly Segregation Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={collectionTrends} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="wet" name="Wet" fill="#10b981" stackId="s" />
                    <Bar dataKey="dry" name="Dry" fill="#3b82f6" stackId="s" />
                    <Bar dataKey="sanitary" name="Sanitary" fill="#f59e0b" stackId="s" />
                    <Bar dataKey="special" name="Special" fill="#8b5cf6" stackId="s" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── TAMIL NADU DISTRICT MAP ──────────────────────────── */}
      <TamilNaduDistrictMap />

    </div>
  );
}
