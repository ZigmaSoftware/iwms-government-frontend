import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { ChartData } from "chart.js";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchWasteReport } from "@/utils/wasteApi";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

ChartJS.register(ArcElement, Tooltip, Legend);

// shadcn components
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

// lucide icons
import {
  Trash2,
  Calendar,
  Download,
  Home,
  Droplets,
  Recycle,
  BarChart3,
  MapPin,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type {
  ApiWasteRow,
  DailyRow,
  MonthlyDailyDialogRange,
  MonthlyFilterMode,
  MonthlyStat,
  MonthlyVehicleDialogRange,
  VehicleCollectionSummary,
  VehicleDialogRange,
} from "./WasteCollection/types";

// ---------------------- Fallback Samples ----------------------
const getLocalDateKey = (date = new Date()) =>
  date.toLocaleDateString("en-CA");

const todayKey = getLocalDateKey();

const FALLBACK_DAILY_DATA: DailyRow[] = [
  {
    date: todayKey,
    zone: "Zone A",
    wet: 8.5,
    dry: 5.2,
    mix: 2.1,
    total: 13.7,
    target: 15.0,
    households: 1200,
  },
];
const ZONE_WASTE_SUMMARY: Record<
  string,
  { household: number; ewaste: number; medical: number }
> = {
  "Zone A": { household: 120, ewaste: 15, medical: 8 },
  "Zone B": { household: 80, ewaste: 10, medical: 5 },
  "Zone C": { household: 150, ewaste: 12, medical: 7 },
  "Zone X": { household: 60, ewaste: 5, medical: 3 },
  "Zone Y": { household: 90, ewaste: 7, medical: 4 },
};

const ALL_MONTHS_START = "2000-01-01";

// ---------------------- Utility ----------------------
const toTons = (v: number | undefined | null) =>
  Number(((v ?? 0) / 1000).toFixed(2));

const formatTons = (v: number, unitLabel = "Tons") =>
  `${v.toFixed(1)} ${unitLabel}`;

const formatMonthLabel = (
  isoDate: string,
  locale = "en-US",
  fallbackLabel = "Current Month",
) => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return fallbackLabel;
  return d.toLocaleString(locale, { month: "long", year: "numeric" });
};

const toDateKey = (value?: string) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split("/");
    return `${y}-${m}-${d}`.slice(0, 10);
  }
  const dmyMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getRowWeightsKg = (row: Record<string, any>) => {
  const wetKg = toNumber(row.wet_weight);
  const dryKg = toNumber(row.dry_weight);
  const mixKg = toNumber(row.mix_weight);
  let totalKg = toNumber(row.total_net_weight);
  if (!totalKg) totalKg = wetKg + dryKg + mixKg;
  return { wetKg, dryKg, mixKg, totalKg };
};

const getActiveWasteRows = (
  rows: ApiWasteRow[],
  fromDate: string,
  toDate: string
) =>
  rows
    .map((row) => ({
      row,
      dateKey: getCollectionDateKey(row as Record<string, any>),
    }))
    .filter(({ dateKey }) => {
      if (!dateKey) return false;
      if (dateKey < fromDate || dateKey > toDate) return false;
      return true;
    });

const getCollectionDateKey = (row: Record<string, any>) =>
  toDateKey(
    row.collection_date ||
      row.collectionDate ||
      row.date ||
      row.Date ||
      row.created_at ||
      row.createdAt ||
      ""
  );

const getVehicleLabel = (row: Record<string, any>) =>
  String(
    row.vehicle_no ||
      row["Vehicle No"] ||
      row.Vehicle_No ||
      row.VehicleNo ||
      row.vehicleno ||
      row.vehicleNo ||
      row.vehicle_number ||
      row.vehicleNumber ||
      row.vehicle ||
      row.vehicle_id ||
      row.vehicleId ||
      row.reg_no ||
      row.regNo ||
      row.registration ||
      row.registration_no ||
      row.registrationNo ||
      "Unknown"
  );

// ---------------------- Drilldown Dummy Data ----------------------
const CITY_DATA: Record<string, { zones: Record<string, string[]> }> = {
  Delhi: {
    zones: {
      "Zone A": ["Ward 1", "Ward 2", "Ward 3"],
      "Zone B": ["Ward 4", "Ward 5"],
      "Zone C": ["Ward 6", "Ward 7", "Ward 8"],
    },
  },
  Chennai: {
    zones: {
      "Zone X": ["Ward 10", "Ward 11"],
      "Zone Y": ["Ward 12"],
    },
  },
};

const PROPERTY_OPTIONS = {
  All: ["All"],
  Household: ["Apartments", "Residences / Villas"],
  Commercial: ["Theatre Waste", "Medical Waste"],
};

type WasteCategoryKey = "household" | "ewaste" | "medical";

type WardWasteCategory = {
  total: number;
  breakdown: Record<string, number>;
};

type WardWasteMap = Record<WasteCategoryKey, WardWasteCategory>;

const WARD_WASTE_SUMMARY: Record<string, Record<string, WardWasteMap>> = {
  "Zone A": {
    "Ward 1": {
      household: {
        total: 42,
        breakdown: { "Dry Waste": 14, "Wet Waste": 20, "Mixed Waste": 8 },
      },
      ewaste: {
        total: 6.5,
        breakdown: {
          "Consumer Electronics": 2.5,
          Batteries: 1.5,
          "Large Appliances": 2.5,
        },
      },
      medical: {
        total: 3.2,
        breakdown: { Infectious: 1.9, "General Medical": 1.3 },
      },
    },
    "Ward 2": {
      household: {
        total: 37,
        breakdown: { "Dry Waste": 11, "Wet Waste": 18, "Mixed Waste": 8 },
      },
      ewaste: {
        total: 5,
        breakdown: {
          "Consumer Electronics": 2,
          Batteries: 1.2,
          "Large Appliances": 1.8,
        },
      },
      medical: {
        total: 2.6,
        breakdown: { Infectious: 1.4, "General Medical": 1.2 },
      },
    },
    "Ward 3": {
      household: {
        total: 48,
        breakdown: { "Dry Waste": 15, "Wet Waste": 22, "Mixed Waste": 11 },
      },
      ewaste: {
        total: 6.8,
        breakdown: {
          "Consumer Electronics": 2.8,
          Batteries: 1.6,
          "Large Appliances": 2.4,
        },
      },
      medical: {
        total: 3.4,
        breakdown: { Infectious: 1.7, "General Medical": 1.7 },
      },
    },
  },
  "Zone B": {
    "Ward 4": {
      household: {
        total: 31,
        breakdown: { "Dry Waste": 10, "Wet Waste": 15, "Mixed Waste": 6 },
      },
      ewaste: {
        total: 4.4,
        breakdown: {
          "Consumer Electronics": 1.6,
          Batteries: 1.1,
          "Large Appliances": 1.7,
        },
      },
      medical: {
        total: 2.1,
        breakdown: { Infectious: 1, "General Medical": 1.1 },
      },
    },
    "Ward 5": {
      household: {
        total: 35,
        breakdown: { "Dry Waste": 12, "Wet Waste": 16, "Mixed Waste": 7 },
      },
      ewaste: {
        total: 4.9,
        breakdown: {
          "Consumer Electronics": 1.9,
          Batteries: 1.3,
          "Large Appliances": 1.7,
        },
      },
      medical: {
        total: 2.3,
        breakdown: { Infectious: 1.1, "General Medical": 1.2 },
      },
    },
  },
  "Zone C": {
    "Ward 6": {
      household: {
        total: 44,
        breakdown: { "Dry Waste": 13, "Wet Waste": 21, "Mixed Waste": 10 },
      },
      ewaste: {
        total: 6.2,
        breakdown: {
          "Consumer Electronics": 2.2,
          Batteries: 1.6,
          "Large Appliances": 2.4,
        },
      },
      medical: {
        total: 3,
        breakdown: { Infectious: 1.5, "General Medical": 1.5 },
      },
    },
    "Ward 7": {
      household: {
        total: 36,
        breakdown: { "Dry Waste": 11, "Wet Waste": 17, "Mixed Waste": 8 },
      },
      ewaste: {
        total: 5.1,
        breakdown: {
          "Consumer Electronics": 1.9,
          Batteries: 1.3,
          "Large Appliances": 1.9,
        },
      },
      medical: {
        total: 2.4,
        breakdown: { Infectious: 1.2, "General Medical": 1.2 },
      },
    },
    "Ward 8": {
      household: {
        total: 39,
        breakdown: { "Dry Waste": 13, "Wet Waste": 18, "Mixed Waste": 8 },
      },
      ewaste: {
        total: 5.6,
        breakdown: {
          "Consumer Electronics": 2,
          Batteries: 1.4,
          "Large Appliances": 2.2,
        },
      },
      medical: {
        total: 2.7,
        breakdown: { Infectious: 1.3, "General Medical": 1.4 },
      },
    },
  },
  "Zone X": {
    "Ward 10": {
      household: {
        total: 28,
        breakdown: { "Dry Waste": 9, "Wet Waste": 13, "Mixed Waste": 6 },
      },
      ewaste: {
        total: 3.8,
        breakdown: {
          "Consumer Electronics": 1.4,
          Batteries: 0.9,
          "Large Appliances": 1.5,
        },
      },
      medical: {
        total: 1.8,
        breakdown: { Infectious: 0.9, "General Medical": 0.9 },
      },
    },
    "Ward 11": {
      household: {
        total: 30,
        breakdown: { "Dry Waste": 10, "Wet Waste": 14, "Mixed Waste": 6 },
      },
      ewaste: {
        total: 4.1,
        breakdown: {
          "Consumer Electronics": 1.5,
          Batteries: 1,
          "Large Appliances": 1.6,
        },
      },
      medical: {
        total: 1.9,
        breakdown: { Infectious: 0.95, "General Medical": 0.95 },
      },
    },
  },
  "Zone Y": {
    "Ward 12": {
      household: {
        total: 33,
        breakdown: { "Dry Waste": 11, "Wet Waste": 15, "Mixed Waste": 7 },
      },
      ewaste: {
        total: 4.5,
        breakdown: {
          "Consumer Electronics": 1.7,
          Batteries: 1.1,
          "Large Appliances": 1.7,
        },
      },
      medical: {
        total: 2.2,
        breakdown: { Infectious: 1, "General Medical": 1.2 },
      },
    },
  },
};

const PROPERTY_IMPACT: Record<
  keyof typeof PROPERTY_OPTIONS,
  Record<string, number>
> = {
  All: { All: 1 },
  Household: { Apartments: 1.08, "Residences / Villas": 0.97 },
  Commercial: { "Theatre Waste": 1.12, "Medical Waste": 1.25 },
};

const WASTE_CATEGORY_META: Record<
  WasteCategoryKey,
  {
    labelKey: string;
    descriptionKey: string;
    icon: ReactNode;
    gradient: string;
  }
> = {
  household: {
    labelKey: "dashboard.waste_collection.categories.household",
    descriptionKey: "dashboard.waste_collection.categories.household_desc",
    icon: <Home className="h-4 w-4 text-blue-600" />,
    gradient: "from-blue-50 to-blue-100",
  },
  ewaste: {
    labelKey: "dashboard.waste_collection.categories.ewaste",
    descriptionKey: "dashboard.waste_collection.categories.ewaste_desc",
    icon: <Recycle className="h-4 w-4 text-amber-600" />,
    gradient: "from-amber-50 to-amber-100",
  },
  medical: {
    labelKey: "dashboard.waste_collection.categories.medical",
    descriptionKey: "dashboard.waste_collection.categories.medical_desc",
    icon: <BarChart3 className="h-4 w-4 text-rose-600" />,
    gradient: "from-rose-50 to-rose-100",
  },
};

const WASTE_CATEGORY_KEYS: WasteCategoryKey[] = [
  "household",
  "ewaste",
  "medical",
];

type PropertyCollectionRecord = {
  id: string;
  name: string;
  zone: string;
  ward: string;
  dry: number;
  wet: number;
  mixed: number;
  lastPickup: string;
};

const PROPERTY_COLLECTION_DATA: Record<
  keyof typeof PROPERTY_OPTIONS,
  Record<string, PropertyCollectionRecord[]>
> = {
  All: {
    All: [
      {
        id: "GEN-01",
        name: "Central Transfer Hub",
        zone: "Zone A",
        ward: "Ward 1",
        dry: 2.1,
        wet: 3.4,
        mixed: 1.1,
        lastPickup: "Today · 05:10 AM",
      },
      {
        id: "GEN-02",
        name: "North Collection Point",
        zone: "Zone B",
        ward: "Ward 4",
        dry: 1.8,
        wet: 2.7,
        mixed: 0.9,
        lastPickup: "Today · 05:30 AM",
      },
      {
        id: "GEN-03",
        name: "East Yard",
        zone: "Zone C",
        ward: "Ward 7",
        dry: 2.4,
        wet: 3.1,
        mixed: 1.2,
        lastPickup: "Today · 05:45 AM",
      },
      {
        id: "GEN-04",
        name: "South Metro Loop",
        zone: "Zone X",
        ward: "Ward 10",
        dry: 1.6,
        wet: 2.3,
        mixed: 0.7,
        lastPickup: "Yesterday · 06:20 PM",
      },
      {
        id: "GEN-05",
        name: "West Extension",
        zone: "Zone Y",
        ward: "Ward 12",
        dry: 1.9,
        wet: 2.5,
        mixed: 0.8,
        lastPickup: "Yesterday · 04:55 PM",
      },
      {
        id: "GEN-06",
        name: "Market Ring",
        zone: "Zone B",
        ward: "Ward 5",
        dry: 2.2,
        wet: 3,
        mixed: 1,
        lastPickup: "Yesterday · 03:40 PM",
      },
      {
        id: "GEN-07",
        name: "Harbor Line",
        zone: "Zone C",
        ward: "Ward 6",
        dry: 2,
        wet: 2.8,
        mixed: 0.9,
        lastPickup: "Yesterday · 02:10 PM",
      },
      {
        id: "GEN-08",
        name: "Old City Loop",
        zone: "Zone A",
        ward: "Ward 3",
        dry: 1.7,
        wet: 2.4,
        mixed: 0.6,
        lastPickup: "Yesterday · 12:45 PM",
      },
      {
        id: "GEN-09",
        name: "Tech Park Bay",
        zone: "Zone C",
        ward: "Ward 8",
        dry: 2.6,
        wet: 3.6,
        mixed: 1.1,
        lastPickup: "Yesterday · 11:15 AM",
      },
      {
        id: "GEN-10",
        name: "Metro Depot",
        zone: "Zone X",
        ward: "Ward 11",
        dry: 1.5,
        wet: 2.1,
        mixed: 0.5,
        lastPickup: "Yesterday · 09:30 AM",
      },
    ],
  },
  Household: {
    Apartments: [
      {
        id: "APT-101",
        name: "Riverfront Heights",
        zone: "Zone A",
        ward: "Ward 1",
        dry: 0.9,
        wet: 1.6,
        mixed: 0.4,
        lastPickup: "Today · 06:10 AM",
      },
      {
        id: "APT-102",
        name: "Skyline Towers",
        zone: "Zone A",
        ward: "Ward 2",
        dry: 0.8,
        wet: 1.4,
        mixed: 0.3,
        lastPickup: "Today · 05:55 AM",
      },
      {
        id: "APT-103",
        name: "Metro Residency",
        zone: "Zone B",
        ward: "Ward 4",
        dry: 0.7,
        wet: 1.3,
        mixed: 0.3,
        lastPickup: "Today · 05:40 AM",
      },
      {
        id: "APT-104",
        name: "Lotus Greens",
        zone: "Zone B",
        ward: "Ward 5",
        dry: 0.95,
        wet: 1.65,
        mixed: 0.45,
        lastPickup: "Today · 05:20 AM",
      },
      {
        id: "APT-105",
        name: "Harbor View Residency",
        zone: "Zone C",
        ward: "Ward 6",
        dry: 1,
        wet: 1.7,
        mixed: 0.5,
        lastPickup: "Yesterday · 06:00 PM",
      },
      {
        id: "APT-106",
        name: "Park Avenue Suites",
        zone: "Zone C",
        ward: "Ward 7",
        dry: 0.85,
        wet: 1.45,
        mixed: 0.35,
        lastPickup: "Yesterday · 05:10 PM",
      },
      {
        id: "APT-107",
        name: "Silver Meadows",
        zone: "Zone C",
        ward: "Ward 8",
        dry: 0.92,
        wet: 1.5,
        mixed: 0.4,
        lastPickup: "Yesterday · 04:30 PM",
      },
      {
        id: "APT-108",
        name: "Crescent Residency",
        zone: "Zone X",
        ward: "Ward 10",
        dry: 0.78,
        wet: 1.35,
        mixed: 0.32,
        lastPickup: "Yesterday · 03:15 PM",
      },
      {
        id: "APT-109",
        name: "Lakefront Blocks",
        zone: "Zone X",
        ward: "Ward 11",
        dry: 0.81,
        wet: 1.38,
        mixed: 0.34,
        lastPickup: "Yesterday · 01:55 PM",
      },
      {
        id: "APT-110",
        name: "Sunrise Residences",
        zone: "Zone Y",
        ward: "Ward 12",
        dry: 0.87,
        wet: 1.42,
        mixed: 0.36,
        lastPickup: "Yesterday · 12:25 PM",
      },
    ],
    "Residences / Villas": [
      {
        id: "VIL-201",
        name: "Palm Grove Villas",
        zone: "Zone A",
        ward: "Ward 3",
        dry: 0.6,
        wet: 0.9,
        mixed: 0.25,
        lastPickup: "Today · 06:20 AM",
      },
      {
        id: "VIL-202",
        name: "Kingsley Estates",
        zone: "Zone B",
        ward: "Ward 4",
        dry: 0.55,
        wet: 0.82,
        mixed: 0.21,
        lastPickup: "Today · 05:50 AM",
      },
      {
        id: "VIL-203",
        name: "Imperial Villas",
        zone: "Zone B",
        ward: "Ward 5",
        dry: 0.58,
        wet: 0.88,
        mixed: 0.24,
        lastPickup: "Today · 05:10 AM",
      },
      {
        id: "VIL-204",
        name: "Fern Residency",
        zone: "Zone C",
        ward: "Ward 6",
        dry: 0.62,
        wet: 0.95,
        mixed: 0.26,
        lastPickup: "Yesterday · 06:10 PM",
      },
      {
        id: "VIL-205",
        name: "Orchid Enclave",
        zone: "Zone C",
        ward: "Ward 7",
        dry: 0.57,
        wet: 0.89,
        mixed: 0.23,
        lastPickup: "Yesterday · 05:30 PM",
      },
      {
        id: "VIL-206",
        name: "Emerald Meadows",
        zone: "Zone C",
        ward: "Ward 8",
        dry: 0.64,
        wet: 0.97,
        mixed: 0.27,
        lastPickup: "Yesterday · 04:40 PM",
      },
      {
        id: "VIL-207",
        name: "Ruby Hills",
        zone: "Zone X",
        ward: "Ward 10",
        dry: 0.5,
        wet: 0.78,
        mixed: 0.2,
        lastPickup: "Yesterday · 03:05 PM",
      },
      {
        id: "VIL-208",
        name: "Galaxy Greens",
        zone: "Zone X",
        ward: "Ward 11",
        dry: 0.53,
        wet: 0.81,
        mixed: 0.22,
        lastPickup: "Yesterday · 01:40 PM",
      },
      {
        id: "VIL-209",
        name: "Hillcrest Manor",
        zone: "Zone Y",
        ward: "Ward 12",
        dry: 0.59,
        wet: 0.9,
        mixed: 0.25,
        lastPickup: "Yesterday · 12:50 PM",
      },
      {
        id: "VIL-210",
        name: "Cedar Park",
        zone: "Zone A",
        ward: "Ward 2",
        dry: 0.61,
        wet: 0.92,
        mixed: 0.26,
        lastPickup: "Yesterday · 11:35 AM",
      },
    ],
  },
  Commercial: {
    "Theatre Waste": [
      {
        id: "TH-301",
        name: "Galaxy Cinemas",
        zone: "Zone A",
        ward: "Ward 1",
        dry: 1.1,
        wet: 0.6,
        mixed: 0.3,
        lastPickup: "Today · 07:15 AM",
      },
      {
        id: "TH-302",
        name: "Starplex",
        zone: "Zone A",
        ward: "Ward 2",
        dry: 1.05,
        wet: 0.55,
        mixed: 0.28,
        lastPickup: "Today · 06:45 AM",
      },
      {
        id: "TH-303",
        name: "Metro Screens",
        zone: "Zone B",
        ward: "Ward 4",
        dry: 0.98,
        wet: 0.5,
        mixed: 0.25,
        lastPickup: "Today · 06:05 AM",
      },
      {
        id: "TH-304",
        name: "Regal Theatres",
        zone: "Zone B",
        ward: "Ward 5",
        dry: 1.15,
        wet: 0.62,
        mixed: 0.33,
        lastPickup: "Yesterday · 08:20 PM",
      },
      {
        id: "TH-305",
        name: "Studio Drive-In",
        zone: "Zone C",
        ward: "Ward 6",
        dry: 0.9,
        wet: 0.48,
        mixed: 0.22,
        lastPickup: "Yesterday · 07:15 PM",
      },
      {
        id: "TH-306",
        name: "Grand Playhouse",
        zone: "Zone C",
        ward: "Ward 7",
        dry: 0.96,
        wet: 0.5,
        mixed: 0.24,
        lastPickup: "Yesterday · 06:25 PM",
      },
      {
        id: "TH-307",
        name: "Liberty Screens",
        zone: "Zone C",
        ward: "Ward 8",
        dry: 1.02,
        wet: 0.57,
        mixed: 0.29,
        lastPickup: "Yesterday · 05:30 PM",
      },
      {
        id: "TH-308",
        name: "Sunset Plaza Cinema",
        zone: "Zone X",
        ward: "Ward 10",
        dry: 0.88,
        wet: 0.46,
        mixed: 0.21,
        lastPickup: "Yesterday · 04:30 PM",
      },
      {
        id: "TH-309",
        name: "Citylight Multiplex",
        zone: "Zone X",
        ward: "Ward 11",
        dry: 0.93,
        wet: 0.5,
        mixed: 0.23,
        lastPickup: "Yesterday · 03:20 PM",
      },
      {
        id: "TH-310",
        name: "Velvet Cinema",
        zone: "Zone Y",
        ward: "Ward 12",
        dry: 0.99,
        wet: 0.52,
        mixed: 0.25,
        lastPickup: "Yesterday · 02:00 PM",
      },
    ],
    "Medical Waste": [
      {
        id: "MED-401",
        name: "CityCare Hospital",
        zone: "Zone A",
        ward: "Ward 3",
        dry: 0.4,
        wet: 1.5,
        mixed: 0.2,
        lastPickup: "Today · 07:30 AM",
      },
      {
        id: "MED-402",
        name: "Sunrise Diagnostics",
        zone: "Zone B",
        ward: "Ward 4",
        dry: 0.35,
        wet: 1.3,
        mixed: 0.18,
        lastPickup: "Today · 06:50 AM",
      },
      {
        id: "MED-403",
        name: "North Medical Center",
        zone: "Zone B",
        ward: "Ward 5",
        dry: 0.38,
        wet: 1.4,
        mixed: 0.2,
        lastPickup: "Today · 06:25 AM",
      },
      {
        id: "MED-404",
        name: "Green Cross Clinic",
        zone: "Zone C",
        ward: "Ward 6",
        dry: 0.33,
        wet: 1.2,
        mixed: 0.17,
        lastPickup: "Yesterday · 08:00 PM",
      },
      {
        id: "MED-405",
        name: "Starlight Medical",
        zone: "Zone C",
        ward: "Ward 7",
        dry: 0.36,
        wet: 1.3,
        mixed: 0.18,
        lastPickup: "Yesterday · 07:10 PM",
      },
      {
        id: "MED-406",
        name: "Wellness Labs",
        zone: "Zone C",
        ward: "Ward 8",
        dry: 0.34,
        wet: 1.25,
        mixed: 0.19,
        lastPickup: "Yesterday · 06:05 PM",
      },
      {
        id: "MED-407",
        name: "Central Cancer Care",
        zone: "Zone X",
        ward: "Ward 10",
        dry: 0.42,
        wet: 1.55,
        mixed: 0.22,
        lastPickup: "Yesterday · 04:50 PM",
      },
      {
        id: "MED-408",
        name: "Pulse Heart Center",
        zone: "Zone X",
        ward: "Ward 11",
        dry: 0.39,
        wet: 1.45,
        mixed: 0.2,
        lastPickup: "Yesterday · 03:30 PM",
      },
      {
        id: "MED-409",
        name: "Lotus Children Hospital",
        zone: "Zone Y",
        ward: "Ward 12",
        dry: 0.37,
        wet: 1.4,
        mixed: 0.19,
        lastPickup: "Yesterday · 02:25 PM",
      },
      {
        id: "MED-410",
        name: "Grace Geriatric Care",
        zone: "Zone A",
        ward: "Ward 2",
        dry: 0.35,
        wet: 1.32,
        mixed: 0.18,
        lastPickup: "Yesterday · 01:15 PM",
      },
    ],
  },
};
const getMonthDateRange = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return null;

  const paddedMonth = String(month).padStart(2, "0");
  const start = `${yearStr}-${paddedMonth}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const end = `${yearStr}-${paddedMonth}-${String(endDay).padStart(2, "0")}`;

  return { start, end };
};


// ------------------------- MAIN COMPONENT -------------------------
export default function WasteCollection() {
  const { t, i18n } = useTranslation();
  // Core data states
  const [dailyData, setDailyData] = useState<DailyRow[]>(FALLBACK_DAILY_DATA);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedMonthStat, setSelectedMonthStat] = useState<MonthlyStat | null>(
    null
  );
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const locale = i18n.language || "en-US";
  const tonsLabel = t("common.tons");
  const tonsShortLabel = t("dashboard.waste_collection.units.tons_short");

  const pageBgClass = cn(
    "min-h-screen p-6 transition-colors duration-300",
    isDarkMode
      ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
      : "bg-white text-slate-900"
  );

  const heroPanelClass = cn(
    "flex items-center justify-between rounded-2xl p-6 border",
    isDarkMode
      ? "bg-slate-900/80 backdrop-blur border-slate-800"
      : "bg-gradient-to-r from-white via-sky-50 to-slate-100 backdrop-blur border-slate-200"
  );

  const tabsCardClass = cn(
    "border-0",
    isDarkMode
      ? "bg-slate-900/70 border border-slate-800 text-slate-100"
      : "bg-white/85 backdrop-blur-sm text-slate-900 border border-slate-100"
  );

  const tableContainerClass = isDarkMode
    ? "rounded-xl overflow-hidden border border-slate-800 bg-slate-900/70"
    : "rounded-xl overflow-hidden border bg-white";

  const tableHeadClass = isDarkMode ? "bg-slate-900/60 text-slate-200" : "bg-slate-50";
  const tableRowHoverClass = isDarkMode ? "hover:bg-slate-800/60" : "hover:bg-slate-50";
  const paginationFooterClass = cn(
    "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border-t",
    isDarkMode ? "bg-slate-900/60 border-slate-800 text-slate-200" : "bg-slate-50"
  );
  const paginationButtonClass = cn(
    "transition-colors",
    isDarkMode
      ? "bg-slate-900/40 border-slate-700 text-slate-200 hover:bg-slate-800/80"
      : ""
  );
  const paginationLabelClass = cn(
    "text-sm",
    isDarkMode ? "text-slate-300" : "text-slate-600"
  );

  // Zone → Ward → Property drilldown states
  const [selectedCity, setSelectedCity] = useState("Delhi");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zoneDialog, setZoneDialog] = useState(false);

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [wardDialog, setWardDialog] = useState(false);

  const [property, setProperty] =
    useState<keyof typeof PROPERTY_OPTIONS>("All");
  const [subProperty, setSubProperty] = useState("All");
  const [selectedWasteType, setSelectedWasteType] =
    useState<WasteCategoryKey>("household");
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(10);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyRowsPerPage, setMonthlyRowsPerPage] = useState(10);
  const [monthlyFilterMode, setMonthlyFilterMode] =
    useState<MonthlyFilterMode>("all");
  const [dailyDateFilter, setDailyDateFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getLocalDateKey().slice(0, 7));
  const [monthlySelectedMonth, setMonthlySelectedMonth] = useState(
    getLocalDateKey().slice(0, 7)
  );
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [vehicleDialogRange, setVehicleDialogRange] =
    useState<VehicleDialogRange | null>(null);
  const [vehicleSummary, setVehicleSummary] = useState<VehicleCollectionSummary[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const [monthlyVehicleDialogOpen, setMonthlyVehicleDialogOpen] = useState(false);
  const [monthlyVehicleDialogRange, setMonthlyVehicleDialogRange] =
    useState<MonthlyVehicleDialogRange | null>(null);
  const [monthlyVehicleSummary, setMonthlyVehicleSummary] =
    useState<VehicleCollectionSummary[]>([]);
  const [monthlyVehicleLoading, setMonthlyVehicleLoading] = useState(false);
  const [monthlyVehicleError, setMonthlyVehicleError] = useState("");
  const [monthlyDailyDialogOpen, setMonthlyDailyDialogOpen] = useState(false);
  const [monthlyDailyDialogRange, setMonthlyDailyDialogRange] =
    useState<MonthlyDailyDialogRange | null>(null);
  const [monthlyDailyRows, setMonthlyDailyRows] = useState<DailyRow[]>([]);
  const [monthlyDailyLoading, setMonthlyDailyLoading] = useState(false);
  const [monthlyDailyError, setMonthlyDailyError] = useState("");
  const monthlyVehicleCache = useRef(new Map<string, VehicleCollectionSummary[]>());
  const monthlyDailyCache = useRef(new Map<string, DailyRow[]>());
  const dailyDateRef = useRef<HTMLInputElement | null>(null);
  const monthPickerRef = useRef<HTMLInputElement | null>(null);

  const buildDailyRows = useCallback((
    rows: ApiWasteRow[],
    fromDate: string,
    toDate: string
  ) => {
    const activeRows = getActiveWasteRows(rows, fromDate, toDate);
    const zoneLabel = selectedCity || t("dashboard.waste_collection.all_zones");
    return activeRows
      .map(({ row, dateKey }) => {
        const weights = getRowWeightsKg(row as Record<string, any>);
        const wet = toTons(weights.wetKg);
        const dry = toTons(weights.dryKg);
        const mix = toTons(weights.mixKg);
        const total = toTons(weights.totalKg);

        return {
          date: dateKey,
          zone: zoneLabel,
          wet,
          dry,
          total,
          mix,
          target: Number((total * 1.05).toFixed(2)),
          households: Number(row.no_of_household ?? 0),
        };
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }, [selectedCity, t]);

  // ---------------------- Fetch block (same as your old code) ----------------------
  useEffect(() => {
    const available = PROPERTY_OPTIONS[property];
    if (!available.includes(subProperty)) {
      setSubProperty(available[0] ?? "All");
    }
  }, [property, subProperty]);

  useEffect(() => {
    const load = async () => {
      const range = getMonthDateRange(selectedMonth);
      if (!range) return;
      const ok = await fetchWaste(range.start, range.end);
      if (!ok) {
        setDailyData([]);
        setSelectedMonthStat(null);
      }
    };

    load();
  }, [selectedMonth]);

  const fetchWaste = async (fromDate: string, toDate: string) => {
    try {
      const result = await fetchWasteReport<ApiWasteRow>(
        "date_wise_data",
        fromDate,
        toDate
      );
      const rows: ApiWasteRow[] = Array.isArray(result.rows) ? result.rows : [];
      if (!rows.length) return false;

      const activeRows = getActiveWasteRows(rows, fromDate, toDate);
      const formatted = buildDailyRows(rows, fromDate, toDate);

      if (formatted.length) setDailyData(formatted);
      else setDailyData([]);

      // Monthly
      if (!activeRows.length) {
        setSelectedMonthStat(null);
        return true;
      }

      const totals = activeRows.reduce(
        (a, r) => {
          const weights = getRowWeightsKg(r.row as Record<string, any>);
          a.wet += weights.wetKg;
          a.dry += weights.dryKg;
          a.mix += weights.mixKg;
          a.total += weights.totalKg;
          return a;
        },
        { wet: 0, dry: 0, total: 0, mix: 0 }
      );

      const actDays =
        activeRows.filter((r) => Number(r.row.total_net_weight ?? 0) > 0)
          .length ||
        activeRows.length ||
        1;

      setSelectedMonthStat({
        monthKey: fromDate.slice(0, 7),
        wet: toTons(totals.wet),
        dry: toTons(totals.dry),
        mix: toTons(totals.mix),
        total: toTons(totals.total),
        avgDaily: toTons(totals.total / actDays),
      });

      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadMonthlyStats = async () => {
      const endDate = getLocalDateKey();
      try {
        const result = await fetchWasteReport<ApiWasteRow>(
          "date_wise_data",
          ALL_MONTHS_START,
          endDate
        );
        const rows: ApiWasteRow[] = Array.isArray(result.rows) ? result.rows : [];

        const monthMap = new Map<
          string,
          { wetKg: number; dryKg: number; mixKg: number; totalKg: number; days: Set<string> }
        >();

        rows.forEach((row) => {
          const dateKey = getCollectionDateKey(row as Record<string, any>);
          if (!dateKey) return;
          if (dateKey < ALL_MONTHS_START || dateKey > endDate) return;
          const monthKey = dateKey.slice(0, 7);
          const weights = getRowWeightsKg(row as Record<string, any>);
          const entry = monthMap.get(monthKey) ?? {
            wetKg: 0,
            dryKg: 0,
            mixKg: 0,
            totalKg: 0,
            days: new Set<string>(),
          };

          entry.wetKg += weights.wetKg;
          entry.dryKg += weights.dryKg;
          entry.mixKg += weights.mixKg;
          entry.totalKg += weights.totalKg;
          entry.days.add(dateKey);
          monthMap.set(monthKey, entry);
        });

        const stats = Array.from(monthMap.entries())
          .map(([monthKey, totals]) => {
            const days = totals.days.size || 1;
            return {
              monthKey,
              wet: toTons(totals.wetKg),
              dry: toTons(totals.dryKg),
              mix: toTons(totals.mixKg),
              total: toTons(totals.totalKg),
              avgDaily: toTons(totals.totalKg / days),
            };
          })
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        if (!cancelled) {
          setMonthlyStats(stats);
        }
      } catch {
        if (!cancelled) {
          setMonthlyStats([]);
        }
      }
    };

    loadMonthlyStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const wardBaseData = useMemo(() => {
    if (!selectedZone || !selectedWard) return null;
    return WARD_WASTE_SUMMARY[selectedZone]?.[selectedWard] ?? null;
  }, [selectedZone, selectedWard]);

  const wardWasteData = wardBaseData;

  const pieLabels = useMemo(
    () => [
      t("dashboard.waste_collection.categories.household"),
      t("dashboard.waste_collection.categories.ewaste"),
      t("dashboard.waste_collection.categories.medical"),
    ],
    [i18n.language, t],
  );

  const getZonePieChartData = (
    zoneName?: string
  ): ChartData<"pie", number[], string> => {
    const summary = zoneName
      ? ZONE_WASTE_SUMMARY[zoneName]
      : Object.values(ZONE_WASTE_SUMMARY).reduce(
        (acc, zone) => {
          acc.household += zone.household;
          acc.ewaste += zone.ewaste;
          acc.medical += zone.medical;
          return acc;
        },
        { household: 0, ewaste: 0, medical: 0 }
      );

    return {
      labels: pieLabels,
      datasets: [
        {
          data: [
            summary?.household ?? 0,
            summary?.ewaste ?? 0,
            summary?.medical ?? 0,
          ],
          backgroundColor: ["#60A5FA", "#F59E0B", "#EF4444"],
          hoverBackgroundColor: ["#3B82F6", "#D97706", "#DC2626"],
        },
      ],
    };
  };

  const getWardPieChartData = (
    wardData?: WardWasteMap | null
  ): ChartData<"pie", number[], string> => {
    const data = wardData
      ? [
        wardData.household.total,
        wardData.ewaste.total,
        wardData.medical.total,
      ]
      : [0, 0, 0];

    return {
      labels: pieLabels,
      datasets: [
        {
          data,
          backgroundColor: ["#60A5FA", "#F59E0B", "#EF4444"],
          hoverBackgroundColor: ["#3B82F6", "#D97706", "#DC2626"],
        },
      ],
    };
  };

  const computeZoneTotals = (zoneName: string) => {
    const summary = ZONE_WASTE_SUMMARY[zoneName];
    if (!summary) return 0;
    return summary.household + summary.ewaste + summary.medical;
  };

  const wardPieData = useMemo(
    () => getWardPieChartData(wardWasteData),
    [pieLabels, wardWasteData]
  );

  const selectedWardBreakdown =
    wardWasteData && selectedWasteType
      ? wardWasteData[selectedWasteType]
      : null;

  const getPropertyLabel = (value: string) => {
    if (value === "All") return t("dashboard.waste_collection.properties.all");
    if (value === "Household") return t("dashboard.waste_collection.properties.household");
    if (value === "Commercial") return t("dashboard.waste_collection.properties.commercial");
    return value;
  };

  const getSubPropertyLabel = (value: string) => {
    if (value === "All") return t("dashboard.waste_collection.properties.all");
    if (value === "Apartments") return t("dashboard.waste_collection.subproperties.apartments");
    if (value === "Residences / Villas") {
      return t("dashboard.waste_collection.subproperties.residences_villas");
    }
    if (value === "Theatre Waste") return t("dashboard.waste_collection.subproperties.theatre_waste");
    if (value === "Medical Waste") return t("dashboard.waste_collection.subproperties.medical_waste");
    return value;
  };

  const propertyDescriptor =
    property === "All"
      ? t("dashboard.waste_collection.properties.all_properties")
      : `${getPropertyLabel(property)} - ${getSubPropertyLabel(subProperty)}`;

  const zonePieData = useMemo(
    () => getZonePieChartData(selectedZone ?? undefined),
    [pieLabels, selectedZone]
  );

  const zoneTotalDisplay = selectedZone
    ? formatTons(computeZoneTotals(selectedZone), tonsLabel)
    : formatTons(0, tonsLabel);

  const propertyRecords = useMemo(() => {
    const data =
      PROPERTY_COLLECTION_DATA[property]?.[subProperty] ??
      PROPERTY_COLLECTION_DATA.All?.All ??
      [];
    return data.slice(0, 10);
  }, [property, subProperty]);

  const handleWardSelection = (ward: string) => {
    setSelectedWard(ward);
    setSelectedWasteType("household");
    setProperty("All");
    setSubProperty("All");
    setZoneDialog(false);
    setWardDialog(true);
  };

  const buildVehicleSummary = (
    rows: Record<string, any>[],
    fromDate: string,
    toDate: string
  ): VehicleCollectionSummary[] => {
    if (!fromDate || !toDate || fromDate > toDate) return [];
    const filtered = rows.filter((row) => {
      const dateKey = getCollectionDateKey(row);
      if (!dateKey) return true;
      return dateKey >= fromDate && dateKey <= toDate;
    });

    const summaryMap = new Map<
      string,
      { vehicle: string; trips: number; wetKg: number; dryKg: number; mixedKg: number; totalKg: number }
    >();

    filtered.forEach((row) => {
      const vehicle = getVehicleLabel(row).trim() || "Unknown";
      const wetKg = toNumber(
        row.wet_weight ??
          row.wetWeight ??
          row.wet_wt ??
          row.Wet_Wt ??
          row.wet_waste ??
          row.wet ??
          0
      );
      const dryKg = toNumber(
        row.dry_weight ??
          row.dryWeight ??
          row.dry_wt ??
          row.Dry_Wt ??
          row.dry_waste ??
          row.dry ??
          0
      );
      const mixedKg = toNumber(
        row.mix_weight ??
          row.mixWeight ??
          row.mix_wt ??
          row.Mix_Wt ??
          row.mixed_weight ??
          row.mixed_waste ??
          row.mix ??
          0
      );
      let totalKg = toNumber(
        row.total_net_weight ??
          row.net_wt ??
          row.netWeight ??
          row.Net_Wt ??
          row.total_weight ??
          row.totalWeight ??
          row.total ??
          row.weight ??
          row.total_quantity ??
          0
      );
      if (!totalKg) totalKg = wetKg + dryKg + mixedKg;

      const existing = summaryMap.get(vehicle) ?? {
        vehicle,
        trips: 0,
        wetKg: 0,
        dryKg: 0,
        mixedKg: 0,
        totalKg: 0,
      };
      existing.trips += toNumber(
        row.total_trip ?? row.totalTrip ?? row.trips ?? row.trip ?? 1
      );
      existing.wetKg += wetKg;
      existing.dryKg += dryKg;
      existing.mixedKg += mixedKg;
      existing.totalKg += totalKg;
      summaryMap.set(vehicle, existing);
    });

    return Array.from(summaryMap.values())
      .map((item) => ({
        vehicle: item.vehicle,
        trips: item.trips,
        wet: toTons(item.wetKg),
        dry: toTons(item.dryKg),
        mixed: toTons(item.mixedKg),
        total: toTons(item.totalKg),
      }))
      .sort((a, b) => b.total - a.total);
  };

  const openVehicleDialog = (row: DailyRow) => {
    setVehicleDialogRange({
      fromDate: row.date,
      toDate: row.date,
      label: new Date(row.date).toLocaleDateString(locale),
      zone: row.zone,
    });
    setVehicleSummary([]);
    setVehicleError("");
    setVehicleDialogOpen(true);
  };

  const openMonthlyVehicleDialog = (monthKey: string) => {
    const range = getMonthDateRange(monthKey);
    if (!range) return;
    const monthLabel = formatMonthLabel(
      `${monthKey}-01`,
      locale,
      t("dashboard.waste_collection.current_month"),
    );
    setMonthlyVehicleDialogRange({
      fromDate: range.start,
      toDate: range.end,
      label: monthLabel,
      monthKey,
    });
    const cached = monthlyVehicleCache.current.get(monthKey);
    if (cached) {
      setMonthlyVehicleSummary(cached);
      setMonthlyVehicleError(
        cached.length
          ? ""
          : t("common.no_items_found", { item: t("common.vehicle") })
      );
    } else {
      setMonthlyVehicleSummary([]);
      setMonthlyVehicleError("");
    }
    setMonthlyVehicleDialogOpen(true);
  };

  const openMonthlyDailyDialog = (monthKey: string) => {
    const range = getMonthDateRange(monthKey);
    if (!range) return;
    const monthLabel = formatMonthLabel(
      `${monthKey}-01`,
      locale,
      t("dashboard.waste_collection.current_month"),
    );
    setMonthlyDailyDialogRange({
      fromDate: range.start,
      toDate: range.end,
      label: monthLabel,
      monthKey,
    });
    const cached = monthlyDailyCache.current.get(monthKey);
    if (cached) {
      setMonthlyDailyRows(cached);
      setMonthlyDailyError(
        cached.length
          ? ""
          : t("common.no_items_found", { item: t("common.date") })
      );
    } else {
      setMonthlyDailyRows([]);
      setMonthlyDailyError("");
    }
    setMonthlyDailyDialogOpen(true);
  };

  const openNativePicker = (node: HTMLInputElement | null) => {
    if (!node) return;
    const picker = node as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === "function") picker.showPicker();
    node.focus();
  };

  // Latest KPI hooks
  // const latestEntry = useMemo(
  //   () => (dailyData.length ? dailyData[0] : null),
  //   [dailyData]
  // );
  const monthStat = useMemo(() => {
    if (selectedMonthStat) return selectedMonthStat;
    if (!monthlyStats.length) return null;
    const selected = monthlyStats.find(
      (stat) => stat.monthKey === selectedMonth
    );
    return selected ?? monthlyStats[0];
  }, [monthlyStats, selectedMonth, selectedMonthStat]);
  const filteredDailyData = useMemo(() => {
    if (!dailyDateFilter) return dailyData;
    return dailyData.filter(
      (row) => row.date.slice(0, 10) === dailyDateFilter
    );
  }, [dailyData, dailyDateFilter]);

  const totalDailyPages = Math.max(
    1,
    Math.ceil(filteredDailyData.length / dailyPageSize)
  );

  const paginatedDailyData = useMemo(() => {
    const start = (dailyPage - 1) * dailyPageSize;
    return filteredDailyData.slice(start, start + dailyPageSize);
  }, [filteredDailyData, dailyPage, dailyPageSize]);
  const noDataMessage = t("common.no_items_found", { item: "data" });
  const monthlyFilteredStats = useMemo(() => {
    if (monthlyFilterMode === "all") return monthlyStats;
    const selected = monthlyStats.filter(
      (stat) => stat.monthKey === monthlySelectedMonth
    );
    return selected;
  }, [monthlyStats, monthlyFilterMode, monthlySelectedMonth]);
  const totalMonthlyPages =
    Math.ceil(monthlyFilteredStats.length / monthlyRowsPerPage) || 1;
  const paginatedMonthlyStats = useMemo(() => {
    const start = (monthlyPage - 1) * monthlyRowsPerPage;
    return monthlyFilteredStats.slice(start, start + monthlyRowsPerPage);
  }, [monthlyFilteredStats, monthlyPage, monthlyRowsPerPage]);

  useEffect(() => {
    setDailyPage(1);
  }, [dailyPageSize, dailyDateFilter]);

  useEffect(() => {
    setMonthlyPage(1);
  }, [monthlyRowsPerPage, monthlyStats.length, monthlyFilterMode, monthlySelectedMonth]);

  useEffect(() => {
    if (!vehicleDialogOpen || !vehicleDialogRange) return;
    let cancelled = false;

    const loadVehicleSummary = async () => {
      setVehicleLoading(true);
      setVehicleError("");
      try {
        const { fromDate, toDate } = vehicleDialogRange;
        const result = await fetchWasteReport(
          "day_wise_data",
          fromDate,
          toDate
        );
        const rows: Record<string, any>[] = Array.isArray(result.rows)
          ? result.rows
          : [];
        const summary = buildVehicleSummary(rows, fromDate, toDate);

        if (cancelled) return;
        setVehicleSummary(summary);
        if (!summary.length) {
          setVehicleError(t("common.no_items_found", { item: t("common.vehicle") }));
        }
      } catch (error) {
        if (!cancelled) {
          setVehicleSummary([]);
          setVehicleError(t("common.load_failed"));
        }
      } finally {
        if (!cancelled) setVehicleLoading(false);
      }
    };

    loadVehicleSummary();
    return () => {
      cancelled = true;
    };
  }, [vehicleDialogOpen, vehicleDialogRange, t]);

  useEffect(() => {
    if (!monthlyVehicleDialogOpen || !monthlyVehicleDialogRange) return;
    const { fromDate, toDate, monthKey } = monthlyVehicleDialogRange;
    const cached = monthlyVehicleCache.current.get(monthKey);
    if (cached) {
      setMonthlyVehicleSummary(cached);
      setMonthlyVehicleLoading(false);
      setMonthlyVehicleError(
        cached.length
          ? ""
          : t("common.no_items_found", { item: t("common.vehicle") })
      );
      return;
    }

    let cancelled = false;
    const loadMonthlyVehicles = async () => {
      setMonthlyVehicleLoading(true);
      setMonthlyVehicleError("");
      try {
        const result = await fetchWasteReport(
          "day_wise_data",
          fromDate,
          toDate
        );
        const rows: Record<string, any>[] = Array.isArray(result.rows)
          ? result.rows
          : [];
        const summary = buildVehicleSummary(rows, fromDate, toDate);
        if (cancelled) return;
        monthlyVehicleCache.current.set(monthKey, summary);
        setMonthlyVehicleSummary(summary);
        if (!summary.length) {
          setMonthlyVehicleError(
            t("common.no_items_found", { item: t("common.vehicle") })
          );
        }
      } catch {
        if (!cancelled) {
          setMonthlyVehicleSummary([]);
          setMonthlyVehicleError(t("common.load_failed"));
        }
      } finally {
        if (!cancelled) setMonthlyVehicleLoading(false);
      }
    };

    loadMonthlyVehicles();
    return () => {
      cancelled = true;
    };
  }, [monthlyVehicleDialogOpen, monthlyVehicleDialogRange, t]);

  useEffect(() => {
    if (!monthlyDailyDialogOpen || !monthlyDailyDialogRange) return;
    const { fromDate, toDate, monthKey } = monthlyDailyDialogRange;
    const cached = monthlyDailyCache.current.get(monthKey);
    if (cached) {
      setMonthlyDailyRows(cached);
      setMonthlyDailyLoading(false);
      setMonthlyDailyError(
        cached.length
          ? ""
          : t("common.no_items_found", { item: t("common.date") })
      );
      return;
    }

    let cancelled = false;
    const loadMonthlyDaily = async () => {
      setMonthlyDailyLoading(true);
      setMonthlyDailyError("");
      try {
        const result = await fetchWasteReport<ApiWasteRow>(
          "date_wise_data",
          fromDate,
          toDate
        );
        const rows: ApiWasteRow[] = Array.isArray(result.rows)
          ? result.rows
          : [];
        const formatted = buildDailyRows(rows, fromDate, toDate);
        if (cancelled) return;
        monthlyDailyCache.current.set(monthKey, formatted);
        setMonthlyDailyRows(formatted);
        if (!formatted.length) {
          setMonthlyDailyError(
            t("common.no_items_found", { item: t("common.date") })
          );
        }
      } catch {
        if (!cancelled) {
          setMonthlyDailyRows([]);
          setMonthlyDailyError(t("common.load_failed"));
        }
      } finally {
        if (!cancelled) setMonthlyDailyLoading(false);
      }
    };

    loadMonthlyDaily();
    return () => {
      cancelled = true;
    };
  }, [monthlyDailyDialogOpen, monthlyDailyDialogRange, buildDailyRows, t]);

  useEffect(() => {
    const range = getMonthDateRange(monthlySelectedMonth);
    if (!range) return;
    if (monthlyVehicleCache.current.has(monthlySelectedMonth)) return;
    let cancelled = false;

    const prefetchMonthlyVehicles = async () => {
      try {
        const result = await fetchWasteReport(
          "day_wise_data",
          range.start,
          range.end
        );
        const rows: Record<string, any>[] = Array.isArray(result.rows)
          ? result.rows
          : [];
        const summary = buildVehicleSummary(rows, range.start, range.end);
        if (cancelled) return;
        monthlyVehicleCache.current.set(monthlySelectedMonth, summary);
      } catch {
        // Leave cache empty so the dialog can retry on demand.
      }
    };

    prefetchMonthlyVehicles();
    return () => {
      cancelled = true;
    };
  }, [monthlySelectedMonth]);
  const latestEntry = useMemo(
    () => (dailyData.length ? dailyData[0] : null),
    [dailyData]
  );
  const todayEntry = useMemo(() => {
    const today = getLocalDateKey();
    return (
      dailyData.find(
        (row) => row.date.slice(0, 10) === today
      ) || null
    );
  }, [dailyData]);



  // -----------------------------------------------------------------------
  // ---------------------------- RENDER START ------------------------------
  // -----------------------------------------------------------------------
  return (
    <div className={pageBgClass}>
      <div className="space-y-6">
        {/* Header */}
        <div className={heroPanelClass}>
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              {t("dashboard.waste_collection.title")}
            </h2>
            <p className={cn("mt-2 text-lg", isDarkMode ? "text-slate-300" : "text-slate-600")}>
              {t("dashboard.waste_collection.subtitle")}
            </p>
          </div>
          <Button className="gap-2 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white">
            <Download className="h-4 w-4" />
            {t("dashboard.waste_collection.export_report")}
          </Button>
        </div>

        {/* KPI GRID */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {/* TODAY TOTAL */}
          <Card className="border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-indigo-100 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900 text-slate-800 dark:text-slate-100 hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-sky-600 dark:text-sky-200">
                {t("dashboard.waste_collection.kpi_today")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {todayEntry
                  ? formatTons(todayEntry.total, tonsLabel)
                  : "--"}
              </div>
              <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <Trash2 className="h-6 w-6 text-sky-600 dark:text-sky-200" />
              </div>
            </CardContent>
          </Card>

          {/* WET */}
          <Card className="border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-emerald-100 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-900 text-slate-800 dark:text-slate-100 hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-200">
                {t("dashboard.waste_collection.kpi_wet")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {todayEntry
                  ? formatTons(todayEntry.wet, tonsLabel)
                  : "--"}
              </div>
              <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <Droplets className="h-6 w-6 text-emerald-600 dark:text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          {/* DRY */}
          <Card className="border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-rose-100 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-900 text-slate-800 dark:text-slate-100 hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-rose-600 dark:text-rose-200">
                {t("dashboard.waste_collection.kpi_dry")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {todayEntry
                  ? formatTons(todayEntry.dry, tonsLabel)
                  : "--"}
              </div>
              <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <Recycle className="h-6 w-6 text-rose-600 dark:text-rose-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-purple-200 bg-gradient-to-br from-white via-purple-50 to-purple-100 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-900 text-slate-800 dark:text-slate-100 hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-purple-600 dark:text-purple-200">
                {t("dashboard.waste_collection.kpi_mixed")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {todayEntry
                  ? formatTons(todayEntry.mix, tonsLabel)
                  : "--"}
              </div>
              <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded-lg">
                <Recycle className="h-6 w-6 text-purple-600 dark:text-purple-200" />
              </div>
            </CardContent>
          </Card>

          {/* MONTHLY */}
          <Card className="border border-amber-200 bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900 text-slate-800 dark:text-slate-100 hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-amber-600 dark:text-amber-200">
                {t("dashboard.waste_collection.kpi_monthly_total")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {monthStat
                  ? formatTons(monthStat.total, tonsLabel)
                  : formatTons(401, tonsLabel)}
              </div>
              <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <Calendar className="h-6 w-6 text-amber-600 dark:text-amber-200" />
              </div>
            </CardContent>
          </Card>

          {/* HOUSEHOLDS */}
          {/* <Card className="border-0 bg-gradient-to-br from-[#FBCFE8] to-[#F9A8D4] text-white shadow-md hover:-translate-y-1 transition-all">
            <CardHeader className="flex justify-between">
              <CardTitle className="text-sm text-white/90">
                Households
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <Home className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {latestEntry ? latestEntry.households.toLocaleString() : "0"}
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* TABS SECTION */}
        <Card className={tabsCardClass}>
          <Tabs defaultValue="daily" className="p-6">
            <TabsList
              className={cn(
                "grid w-full grid-cols-3 p-1 rounded-xl",
                isDarkMode ? "bg-slate-900/60" : "bg-slate-100"
              )}
            >
              <TabsTrigger
                value="daily"
                className={cn(
                  "rounded-lg transition-colors",
                  isDarkMode
                    ? "text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white"
                    : "text-slate-600 data-[state=active]:bg-white"
                )}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {t("dashboard.waste_collection.tabs.daily")}
              </TabsTrigger>

              <TabsTrigger
                value="monthly"
                className={cn(
                  "rounded-lg transition-colors",
                  isDarkMode
                    ? "text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white"
                    : "text-slate-600 data-[state=active]:bg-white"
                )}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {t("dashboard.waste_collection.tabs.monthly")}
              </TabsTrigger>

              <TabsTrigger
                value="zone"
                className={cn(
                  "rounded-lg transition-colors",
                  isDarkMode
                    ? "text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white"
                    : "text-slate-600 data-[state=active]:bg-white"
                )}
              >
                <MapPin className="h-4 w-4 mr-2" />
                {t("dashboard.waste_collection.tabs.zone")}
              </TabsTrigger>
            </TabsList>

            {/* ---------------- DAILY ---------------- */}
            <TabsContent value="daily" className="mt-6">
              <div className="space-y-4">
                {/* Header + Date Filter */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      {t("dashboard.waste_collection.daily_title")}
                    </h3>
                    <p className="text-slate-600">
                      {t("dashboard.waste_collection.daily_subtitle")}
                    </p>
                  </div>

                  {/* Date Filter */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Input
                        type="date"
                        value={dailyDateFilter}
                        onChange={(e) => setDailyDateFilter(e.target.value)}
                        className="w-44 pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                        ref={dailyDateRef}
                      />
                      <button
                        type="button"
                        onClick={() => openNativePicker(dailyDateRef.current)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700"
                        aria-label={t("dashboard.waste_collection.headers.date")}
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={tableContainerClass}>
                  <Table>
                    <TableHeader>
                      <TableRow className={tableHeadClass}>
                        <TableHead>{t("dashboard.waste_collection.headers.date")}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.zone")}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.wet", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.dry", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.mixed", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.total", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {paginatedDailyData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                            {noDataMessage}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedDailyData.map((row, index) => (
                          <TableRow key={index} className={tableRowHoverClass}>
                            <TableCell>
                              {new Date(row.date).toLocaleDateString(locale)}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant="outline"
                                className={isDarkMode ? "border-slate-600 text-slate-200" : undefined}
                              >
                                {row.zone}
                              </Badge>
                            </TableCell>

                            <TableCell className="font-bold text-emerald-700">
                              {row.wet.toFixed(1)}
                            </TableCell>

                            <TableCell className="font-bold text-sky-700">
                              {row.dry.toFixed(1)}
                            </TableCell>

                            <TableCell className="font-bold text-sky-700">
                              {row.mix.toFixed(1)}
                            </TableCell>

                            <TableCell className="font-bold text-indigo-700">
                              {row.total.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
                                onClick={() => openVehicleDialog(row)}
                              >
                                {t("common.view_all")}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className={paginationFooterClass}>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{t("dashboard.waste_collection.rows_per_page")}</span>
                      <Select
                        value={String(dailyPageSize)}
                        onValueChange={(v) => setDailyPageSize(Number(v))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 50].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dailyPage === 1}
                        onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                        className={paginationButtonClass}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <span className={paginationLabelClass}>
                        {t("dashboard.waste_collection.page_of", {
                          page: dailyPage,
                          totalPages: totalDailyPages,
                        })}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dailyPage >= totalDailyPages}
                        onClick={() =>
                          setDailyPage((p) => Math.min(totalDailyPages, p + 1))
                        }
                        className={paginationButtonClass}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </TabsContent>


            {/* ---------------- MONTHLY ---------------- */}
            <TabsContent value="monthly" className="mt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold">
                    {t("dashboard.waste_collection.monthly_title")}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-slate-500">
                        {t("dashboard.waste_collection.headers.month")}
                      </Label>
                      <div className="relative">
                        <Input
                          type="month"
                          value={monthlySelectedMonth}
                          onChange={(e) => setMonthlySelectedMonth(e.target.value)}
                          className="w-40 pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                          ref={monthPickerRef}
                        />
                        <button
                          type="button"
                          onClick={() => openNativePicker(monthPickerRef.current)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700"
                          aria-label={t("dashboard.waste_collection.headers.month")}
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-slate-500">
                        {t("dashboard.waste_collection.month_filter_label")}
                      </Label>
                      <Select
                        value={monthlyFilterMode}
                        onValueChange={(value) =>
                          setMonthlyFilterMode(value as MonthlyFilterMode)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("dashboard.waste_collection.month_filter_all")}
                          </SelectItem>
                          <SelectItem value="selected">
                            {t("dashboard.waste_collection.month_filter_selected")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className={tableContainerClass}>
                  <Table>
                    <TableHeader>
                      <TableRow className={tableHeadClass}>
                        <TableHead>{t("dashboard.waste_collection.headers.month")}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.wet", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.dry", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.mixed", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.total", { unit: tonsLabel })}</TableHead>
                        <TableHead>{t("dashboard.waste_collection.headers.avg_daily")}</TableHead>
                        <TableHead>{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {monthlyFilteredStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                            {monthlyFilterMode === "selected"
                              ? t("dashboard.waste_collection.no_data_month")
                              : noDataMessage}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedMonthlyStats.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left font-semibold text-indigo-700 underline-offset-2 hover:underline"
                                onClick={() => openMonthlyDailyDialog(row.monthKey)}
                              >
                                {formatMonthLabel(
                                  `${row.monthKey}-01`,
                                  locale,
                                  t("dashboard.waste_collection.current_month"),
                                )}
                              </button>
                            </TableCell>
                            <TableCell>{row.wet.toFixed(1)}</TableCell>
                            <TableCell>{row.dry.toFixed(1)}</TableCell>
                            <TableCell>{row.mix.toFixed(1)}</TableCell>
                            <TableCell>
                              {row.total.toFixed(1)}
                            </TableCell>
                            <TableCell>{row.avgDaily.toFixed(1)}</TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
                                onClick={() => openMonthlyVehicleDialog(row.monthKey)}
                              >
                                {t("common.view_all")}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    {t("dashboard.waste_collection.rows_per_page")}
                    <select
                      value={monthlyRowsPerPage}
                      onChange={(e) => setMonthlyRowsPerPage(Number(e.target.value))}
                      className="border rounded px-2 py-1 bg-white dark:bg-slate-950 dark:border-slate-700"
                    >
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={monthlyPage === 1}
                      onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {t("dashboard.waste_collection.page_of", {
                      page: monthlyPage,
                      totalPages: totalMonthlyPages,
                    })}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={monthlyPage >= totalMonthlyPages}
                      onClick={() =>
                        setMonthlyPage((p) => Math.min(totalMonthlyPages, p + 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Dialog
                  open={monthlyVehicleDialogOpen}
                  onOpenChange={setMonthlyVehicleDialogOpen}
                >
                  <DialogContent
                    className={cn(
                      "max-h-[80vh] overflow-y-auto lg:max-w-4xl",
                      isDarkMode ? "bg-slate-950 text-slate-100" : ""
                    )}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        {t("dashboard.waste_collection.monthly_title")}
                      </DialogTitle>
                      <p className="text-sm text-slate-500">
                        {monthlyVehicleDialogRange?.label ?? ""}
                      </p>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                      {monthlyVehicleLoading && (
                        <div className="text-sm text-slate-500">
                          {t("common.loading")}
                        </div>
                      )}

                      {!monthlyVehicleLoading && monthlyVehicleError && (
                        <div className="text-sm text-red-500">
                          {monthlyVehicleError}
                        </div>
                      )}

                      {!monthlyVehicleLoading && !monthlyVehicleError && (
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className={tableHeadClass}>
                                <TableHead>{t("dashboard.live_map.labels.vehicle")}</TableHead>
                                <TableHead>{t("common.trips")}</TableHead>
                                <TableHead>
                                  {t("dashboard.waste_collection.headers.wet", { unit: tonsLabel })}
                                </TableHead>
                                <TableHead>
                                  {t("dashboard.waste_collection.headers.dry", { unit: tonsLabel })}
                                </TableHead>
                                <TableHead>
                                  {t("dashboard.waste_collection.headers.mixed", { unit: tonsLabel })}
                                </TableHead>
                                <TableHead>
                                  {t("dashboard.waste_collection.headers.total", { unit: tonsLabel })}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthlyVehicleSummary.map((row) => (
                                <TableRow key={row.vehicle} className={tableRowHoverClass}>
                                  <TableCell className="font-semibold">
                                    {row.vehicle}
                                  </TableCell>
                                  <TableCell>{row.trips}</TableCell>
                                  <TableCell>{row.wet.toFixed(1)}</TableCell>
                                  <TableCell>{row.dry.toFixed(1)}</TableCell>
                                  <TableCell>{row.mixed.toFixed(1)}</TableCell>
                                  <TableCell className="font-semibold">
                                    {row.total.toFixed(1)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={monthlyDailyDialogOpen}
                  onOpenChange={setMonthlyDailyDialogOpen}
                >
                  <DialogContent
                    className={cn(
                      "max-h-[80vh] overflow-y-auto lg:max-w-4xl",
                      isDarkMode ? "bg-slate-950 text-slate-100" : ""
                    )}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        {t("dashboard.waste_collection.daily_title")}
                      </DialogTitle>
                      <p className="text-sm text-slate-500">
                        {monthlyDailyDialogRange?.label ?? ""}
                      </p>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                      {monthlyDailyLoading && (
                        <div className="text-sm text-slate-500">
                          {t("common.loading")}
                        </div>
                      )}

                      {monthlyDailyError && (
                        <div className="text-sm text-rose-500">
                          {monthlyDailyError}
                        </div>
                      )}

                      {!monthlyDailyLoading && !monthlyDailyError && (
                        <div className={tableContainerClass}>
                          <Table>
                            <TableHeader>
                              <TableRow className={tableHeadClass}>
                                <TableHead>{t("dashboard.waste_collection.headers.date")}</TableHead>
                                <TableHead>{t("dashboard.waste_collection.headers.zone")}</TableHead>
                                <TableHead>{t("dashboard.waste_collection.headers.wet", { unit: tonsLabel })}</TableHead>
                                <TableHead>{t("dashboard.waste_collection.headers.dry", { unit: tonsLabel })}</TableHead>
                                <TableHead>{t("dashboard.waste_collection.headers.mixed", { unit: tonsLabel })}</TableHead>
                                <TableHead>{t("dashboard.waste_collection.headers.total", { unit: tonsLabel })}</TableHead>
                                <TableHead>{t("common.actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthlyDailyRows.map((row, idx) => (
                                <TableRow key={`${row.date}-${idx}`} className={tableRowHoverClass}>
                                  <TableCell>
                                    {new Date(row.date).toLocaleDateString(locale)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={isDarkMode ? "border-slate-600 text-slate-200" : undefined}
                                    >
                                      {row.zone}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-bold text-emerald-700">
                                    {row.wet.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="font-bold text-sky-700">
                                    {row.dry.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="font-bold text-sky-700">
                                    {row.mix.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="font-bold text-indigo-700">
                                    {row.total.toFixed(1)}
                                  </TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
                                    onClick={() => openVehicleDialog(row)}
                                    >
                                      {t("common.view_all")}
                                    </button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            {/* ---------------- ZONE ANALYSIS (NEW FULL UI) ---------------- */}
            <TabsContent value="zone" className="mt-6">
              <div className="space-y-6">
                {/* City Dropdown */}
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold">
                    {t("dashboard.waste_collection.zone_title")}
                  </h3>

                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder={t("dashboard.waste_collection.select_city")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CITY_DATA).map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Zone Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                  {Object.keys(CITY_DATA[selectedCity].zones).map((zone) => (
                    <Card
                      key={zone}
                      onClick={() => {
                        setSelectedZone(zone);
                        setSelectedWard(null);
                        setSelectedWasteType("household");
                        setProperty("All");
                        setSubProperty("All");
                        setWardDialog(false);
                        setZoneDialog(true);
                      }}
                      className={cn(
                        "cursor-pointer hover:-translate-y-1 transition-all",
                        isDarkMode
                          ? "bg-slate-900/70 border border-slate-800 text-slate-100"
                          : "bg-indigo-50"
                      )}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" /> {zone}
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        <div className="flex justify-between">
                          <span>{t("dashboard.waste_collection.total_collected")}</span>
                          <span className="font-bold">
                            {formatTons(computeZoneTotals(zone), tonsLabel)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* DIALOG 1 — WARDS */}
                <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
                  <DialogContent
                    className={cn(
                      "h-[700px] overflow-y-auto lg:max-w-7xl",
                      isDarkMode ? "bg-slate-950 text-slate-100" : ""
                    )}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        <button
                          className="flex items-center gap-2 mb-2 text-sm text-slate-500"
                          onClick={() => setZoneDialog(false)}
                        >
                          <ArrowLeft className="h-4 w-4" />{" "}
                          {t("dashboard.waste_collection.back")}
                        </button>
                        {t("dashboard.waste_collection.zone_label", {
                          zone: selectedZone,
                        })}
                      </DialogTitle>
                    </DialogHeader>

                    {/* -------------------- PIE CHART -------------------- */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border mb-6",
                        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white"
                      )}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        {t("dashboard.waste_collection.zone_summary_title", {
                          zone: selectedZone,
                        })}
                      </h3>

                      <div className="w-full flex items-center justify-center gap-6">
                        <div className="h-64 w-64">
                          <Pie data={zonePieData} />
                        </div>
                      </div>
                      <div className=" items-center justify-center mt-4 flex">
                        <div className="flex justify-between w-48">
                          <span>{t("dashboard.waste_collection.total_collected")}</span>
                          <span className="font-bold">{zoneTotalDisplay}</span>
                        </div>
                      </div>
                    </div>

                    {/* -------------------- WARD LIST -------------------- */}
                    <div className="space-y-3">
                      {selectedZone &&
                        CITY_DATA[selectedCity].zones[selectedZone].map(
                          (ward) => (
                            <Button
                              key={ward}
                              variant="outline"
                              className={cn(
                                "w-full justify-between",
                                isDarkMode
                                  ? "border-slate-700 text-slate-100 hover:bg-slate-900/60"
                                  : undefined
                              )}
                              onClick={() => handleWardSelection(ward)}
                            >
                              {ward}
                              <Home className="h-4 w-4 text-slate-500" />
                            </Button>
                          )
                        )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* DIALOG 2 — WARD VIEW */}
                <Dialog open={wardDialog} onOpenChange={setWardDialog}>
                  <DialogContent
                    className={cn(
                      "h-[700px]  overflow-y-auto lg:max-w-7xl",
                      isDarkMode ? "bg-slate-950 text-slate-100" : ""
                    )}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        <button
                          className="flex items-center gap-2 mb-2 text-sm text-slate-500"
                          onClick={() => {
                            setWardDialog(false);
                            setZoneDialog(true);
                          }}
                        >
                          <ArrowLeft className="h-4 w-4" />{" "}
                          {t("dashboard.waste_collection.back")}
                        </button>
                        {t("dashboard.waste_collection.ward_label", {
                          ward: selectedWard,
                        })}
                      </DialogTitle>
                    </DialogHeader>

                    {selectedWard ? (
                      <div className="space-y-6">
                        <div
                          className={cn(
                            "rounded-xl p-4 border",
                            isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white"
                          )}
                        >
                          <h3 className="text-lg font-semibold mb-4 text-center">
                            {t("dashboard.waste_collection.ward_mix_title", {
                              ward: selectedWard,
                            })}
                          </h3>
                          <div className="flex flex-col items-center gap-4">
                            <div className="h-64 w-64">
                              <Pie data={wardPieData} />
                            </div>
                            <div className="flex gap-6 text-sm">
                              {WASTE_CATEGORY_KEYS.map((key) => (
                                <div key={key} className="text-center">
                                  <p className="text-slate-500">
                                    {t(WASTE_CATEGORY_META[key].labelKey)}
                                  </p>
                                  <p className="font-bold">
                                    {formatTons(
                                      wardWasteData
                                        ? wardWasteData[key].total
                                        : 0,
                                      tonsLabel,
                                    )}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* <div className="grid gap-4 md:grid-cols-3">
                          {WASTE_CATEGORY_KEYS.map((key) => {
                            const meta = WASTE_CATEGORY_META[key];
                            const total = wardWasteData
                              ? wardWasteData[key].total
                              : 0;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedWasteType(key)}
                                className={`rounded-xl p-4 text-left border bg-gradient-to-br ${meta.gradient} ${
                                  selectedWasteType === key
                                    ? "ring-2 ring-indigo-500"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  {meta.icon}
                                  <div>
                                    <p className="font-semibold">
                                      {meta.label}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {meta.description}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-lg font-bold">
                                  {formatTons(total)}
                                </p>
                              </button>
                            );
                          })}
                        </div> */}
                        {/* 
                        <Card className="border">
                          <CardHeader>
                            <CardTitle>
                              {WASTE_CATEGORY_META[selectedWasteType].label}{" "}
                              Breakdown
                            </CardTitle>
                            <CardDescription>
                              {selectedWard} · {propertyDescriptor}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {selectedWardBreakdown ? (
                              Object.entries(
                                selectedWardBreakdown.breakdown
                              ).map(([label, value]) => {
                                const percent = selectedWardBreakdown.total
                                  ? Math.round(
                                      (value / selectedWardBreakdown.total) *
                                        100
                                    )
                                  : 0;
                                return (
                                  <div key={label} className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium text-slate-600">
                                      <span>{label}</span>
                                      <span>
                                        {value.toFixed(2)} Tons · {percent}%
                                      </span>
                                    </div>
                                    <Progress value={percent} className="h-2" />
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-slate-500 text-sm">
                                No breakdown data available.
                              </p>
                            )}
                          </CardContent>
                        </Card> */}

                        <Card className="border">
                          <CardHeader>
                            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                              <div>
                                <CardTitle>
                                  {t("dashboard.waste_collection.collection_runs", {
                                    descriptor: propertyDescriptor,
                                  })}
                                </CardTitle>
                                <CardDescription>
                                  {t("dashboard.waste_collection.latest_pickups", {
                                    target:
                                      property === "All"
                                        ? t("dashboard.waste_collection.all_property_types")
                                        : `${getSubPropertyLabel(subProperty)} (${getPropertyLabel(property)})`,
                                  })}
                                </CardDescription>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <Label>{t("dashboard.waste_collection.property_label")}</Label>
                                  <Select
                                    value={property}
                                    onValueChange={(v) =>
                                      setProperty(
                                        v as keyof typeof PROPERTY_OPTIONS
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={t("dashboard.waste_collection.property_placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(
                                        Object.keys(
                                          PROPERTY_OPTIONS
                                        ) as Array<
                                          keyof typeof PROPERTY_OPTIONS
                                        >
                                      ).map((p) => (
                                        <SelectItem key={p} value={p}>
                                          {getPropertyLabel(p)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label>{t("dashboard.waste_collection.subproperty_label")}</Label>
                                  <Select
                                    value={subProperty}
                                    onValueChange={(v) => setSubProperty(v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={t("dashboard.waste_collection.subproperty_placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PROPERTY_OPTIONS[property].map((sp) => (
                                        <SelectItem key={sp} value={sp}>
                                          {getSubPropertyLabel(sp)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="rounded-xl border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className={tableHeadClass}>
                                    <TableHead>{t("dashboard.waste_collection.headers.id")}</TableHead>
                                    <TableHead>{t("dashboard.waste_collection.headers.location")}</TableHead>
                                    <TableHead>{t("dashboard.waste_collection.headers.dry_short")}</TableHead>
                                    <TableHead>{t("dashboard.waste_collection.headers.wet_short")}</TableHead>
                                    <TableHead>{t("dashboard.waste_collection.headers.mixed_short")}</TableHead>
                                    <TableHead>{t("dashboard.waste_collection.headers.last_pickup")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {propertyRecords.map((record) => (
                                    <TableRow key={record.id} className={tableRowHoverClass}>
                                      <TableCell className="font-semibold">
                                        {record.id}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span>{record.name}</span>
                                          <span className="text-xs text-slate-500">
                                            {record.zone} · {record.ward}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {record.dry.toFixed(2)} {tonsShortLabel}
                                      </TableCell>
                                      <TableCell>
                                        {record.wet.toFixed(2)} {tonsShortLabel}
                                      </TableCell>
                                      <TableCell>
                                        {record.mixed.toFixed(2)} {tonsShortLabel}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-sm",
                                          isDarkMode ? "text-slate-300" : "text-slate-600"
                                        )}
                                      >
                                        {record.lastPickup}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <p className="text-center text-slate-500">
                        {t("dashboard.waste_collection.select_ward")}
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>
          </Tabs>
          <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
            <DialogContent
              className={cn(
                "max-h-[80vh] overflow-y-auto lg:max-w-4xl",
                isDarkMode ? "bg-slate-950 text-slate-100" : ""
              )}
            >
              <DialogHeader>
                <DialogTitle>
                  {t("dashboard.waste_collection.daily_title")}
                </DialogTitle>
                <p className="text-sm text-slate-500">
                  {vehicleDialogRange
                    ? `${vehicleDialogRange.label}${
                        vehicleDialogRange.zone
                          ? ` · ${vehicleDialogRange.zone}`
                          : ""
                      }`
                    : ""}
                </p>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {vehicleLoading && (
                  <div className="text-sm text-slate-500">
                    {t("common.loading")}
                  </div>
                )}

                {!vehicleLoading && vehicleError && (
                  <div className="text-sm text-red-500">{vehicleError}</div>
                )}

                {!vehicleLoading && !vehicleError && (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className={tableHeadClass}>
                          <TableHead>{t("dashboard.live_map.labels.vehicle")}</TableHead>
                          <TableHead>{t("common.trips")}</TableHead>
                          <TableHead>
                            {t("dashboard.waste_collection.headers.wet", { unit: tonsLabel })}
                          </TableHead>
                          <TableHead>
                            {t("dashboard.waste_collection.headers.dry", { unit: tonsLabel })}
                          </TableHead>
                          <TableHead>
                            {t("dashboard.waste_collection.headers.mixed", { unit: tonsLabel })}
                          </TableHead>
                          <TableHead>
                            {t("dashboard.waste_collection.headers.total", { unit: tonsLabel })}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vehicleSummary.map((row) => (
                          <TableRow key={row.vehicle} className={tableRowHoverClass}>
                            <TableCell className="font-semibold">
                              {row.vehicle}
                            </TableCell>
                            <TableCell>{row.trips}</TableCell>
                            <TableCell>{row.wet.toFixed(1)}</TableCell>
                            <TableCell>{row.dry.toFixed(1)}</TableCell>
                            <TableCell>{row.mixed.toFixed(1)}</TableCell>
                            <TableCell className="font-semibold">
                              {row.total.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </div>
    </div>
  );
}
