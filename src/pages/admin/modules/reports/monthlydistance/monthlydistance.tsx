import type { HistoryRow, RawVehicle, VehicleDistanceRow, VehicleOption } from "./types";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { getAdminScreenExcelFilename } from "@/utils/exportExcel";

import "./monthlydistance.css";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";
import { Truck } from "lucide-react";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

/* ================= TYPES ================= */


/* ================= CONSTANTS ================= */


const TRIP_SUMMARY_ENDPOINT =
  "https://gpsvtsprobend.vamosys.com/v2/getTripSummary";

const TRIP_SUMMARY_USER_ID = "NMCP2DISPOSAL";

const FALLBACK_VEHICLES: VehicleOption[] = [
  { id: "UP16KT1737", label: "UP16KT1737" },
  { id: "UP16KT1738", label: "UP16KT1738" },
  { id: "UP16KT1739", label: "UP16KT1739" },
];

const CHUNK_SIZE = 6;

/* ================= DATE HELPERS ================= */

const pad = (v: number) => String(v).padStart(2, "0");

const formatMonthInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const IST_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
});

const DISPLAY_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
});

const buildMonthDays = (monthValue: string) => {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return [];
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(y, m - 1, i + 1);
    return {
      iso: IST_DAY_KEY.format(d),
      label: DISPLAY_DAY.format(d).replace(" ", "-"),
    };
  });
};

/* ================= UTILS ================= */

const normalizeVehicle = (r: RawVehicle): VehicleOption | null => {
  const id =
    r?.vehicleId ||
    r?.vehicle_id ||
    r?.vehicleNo ||
    r?.regNo ||
    r?.vehicle_number;
  if (!id) return null;
  return { id: String(id), label: String(id) };
};

const parseTripTimestamp = (v?: number | string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatCellValue = (v?: number) =>
  typeof v === "number" && v > 0 ? v.toFixed(2) : "-";

/* ===== FIXED CONCURRENCY (NO RACE) ===== */

const runWithConcurrency = async <T,>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  const queue = [...items];

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await handler(item);
    }
  });

  await Promise.all(workers);
};

/* ================= COMPONENT ================= */

export default function MonthlyDistance() {
  const { t, i18n } = useTranslation();
  const { gpsApiUrl } = useProjectSelector();
  const TRACKING_API_URL = gpsApiUrl;
  const [vehicles, setVehicles] = useState<VehicleOption[]>(FALLBACK_VEHICLES);
  const [monthInput, setMonthInput] = useState(formatMonthInput(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(monthInput);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingFleet, setLoadingFleet] = useState(false);

  const [fleetRows, setFleetRows] = useState<VehicleDistanceRow[]>([]);
  const [rosterError, setRosterError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const isLoading = loadingVehicles || loadingFleet;

  /* ===== PrimeReact Filters ===== */

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ===== VEHICLE + MONTH CACHE ===== */

  const cacheRef = useRef<Record<string, VehicleDistanceRow>>({});
  const requestIdRef = useRef(0);

  const monthDays = useMemo(
    () => buildMonthDays(selectedMonth),
    [selectedMonth]
  );

  const monthHeadline = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const formatter = new Intl.DateTimeFormat(i18n.language || "en-US", {
      month: "long",
      year: "numeric",
    });
    return y && m
      ? formatter.format(new Date(y, m - 1, 1))
      : "";
  }, [i18n.language, selectedMonth]);

  /* ================= LOAD VEHICLES ================= */

  useEffect(() => {
    setLoadingVehicles(true);
    fetch(TRACKING_API_URL)
      .then((r) => r.json())
      .then((res) => {
        const list = (Array.isArray(res) ? res : res?.data || [])
          .map(normalizeVehicle)
          .filter(Boolean) as VehicleOption[];

        const deduped = Array.from(
          new Map(list.map((item) => [item.id, item])).values(),
        );

        setVehicles(deduped.length ? deduped : FALLBACK_VEHICLES);
        setRosterError(
          deduped.length ? "" : "admin.reports.monthly_distance.error_fallback",
        );
      })
      .catch(() => {
        setVehicles(FALLBACK_VEHICLES);
        setRosterError("admin.reports.monthly_distance.error_unavailable");
      })
      .finally(() => {
        setLoadingVehicles(false);
      });
  }, []);

  /* ================= FETCH MONTH DATA (FAST) ================= */

  const fetchFleetData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!vehicles.length || !monthDays.length) {
      if (requestId === requestIdRef.current) {
        setLoadingFleet(false);
      }
      return;
    }

    setFleetRows([]);
    setFetchError("");
    setLoadingFleet(true);

    const [y, m] = selectedMonth.split("-").map(Number);
    const from = new Date(y, m - 1, 1).getTime();
    const to = new Date(y, m, 0, 23, 59, 59).getTime();

    const rowMap = new Map<string, VehicleDistanceRow>();

    const commitRow = (row: VehicleDistanceRow) => {
      if (requestId !== requestIdRef.current) return;
      rowMap.set(row.vehicleId, row);
      setFleetRows((prev) => {
        if (requestId !== requestIdRef.current) return prev;
        return Array.from(rowMap.values()).sort((a, b) =>
          a.vehicleId.localeCompare(b.vehicleId)
        );
      });
    };

    try {
      await runWithConcurrency(vehicles, CHUNK_SIZE, async (v) => {
        if (requestId !== requestIdRef.current) return;
        const cacheKey = `${selectedMonth}_${v.id}`;

        if (cacheRef.current[cacheKey]) {
          commitRow(cacheRef.current[cacheKey]);
          return;
        }

        try {
          const url = `${TRIP_SUMMARY_ENDPOINT}?vehicleId=${v.id}&fromDateUTC=${from}&toDateUTC=${to}&userId=${TRIP_SUMMARY_USER_ID}&duration=0`;
          const res = await fetch(url);
          const json = await res.json();

          const history: HistoryRow[] =
            json?.data?.historyConsilated || [];

          const totals: Record<string, number> = {};
          monthDays.forEach((d) => (totals[d.iso] = 0));

          for (const h of history) {
            const ts = parseTripTimestamp(h.startTime ?? h.endTime);
            if (!ts) continue;
            const key = IST_DAY_KEY.format(ts);
            if (key in totals) {
              totals[key] += Number(h.tripDistance || 0);
            }
          }

          const total = Object.values(totals).reduce((a, b) => a + b, 0);

          const row: VehicleDistanceRow = {
            vehicleId: v.id,
            vehicleName: v.label,
            distances: totals,
            total,
          };

          cacheRef.current[cacheKey] = row;

          commitRow(row);
        } catch {
          if (requestId === requestIdRef.current) {
            setFetchError("admin.reports.monthly_distance.error_partial");
          }
        }
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingFleet(false);
      }
    }
  }, [vehicles, monthDays, selectedMonth]);

  useEffect(() => {
    fetchFleetData();
  }, [fetchFleetData]);

  /* ================= SEARCH ================= */

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.reports.monthly_distance.search_placeholder"),
    });

  /* ================= EXPORT ================= */
  const exportLabels = useMemo(
    () => ({
      index: t("admin.reports.monthly_distance.columns.index"),
      vehicle: t("admin.reports.monthly_distance.columns.vehicle_id"),
      total: t("admin.reports.monthly_distance.columns.total"),
      sheetName: t("admin.reports.monthly_distance.export_sheet"),
      filePrefix: t("admin.reports.monthly_distance.export_file_prefix"),
    }),
    [i18n.language, t],
  );

  const handleExport = () => {
    const data = fleetRows.map((r, i) => {
      const rec: Record<string, string> = {
        [exportLabels.index]: String(i + 1),
        [exportLabels.vehicle]: r.vehicleId,
      };
      monthDays.forEach((d) => {
        rec[d.label] = formatCellValue(r.distances[d.iso]);
      });
      rec[exportLabels.total] = formatCellValue(r.total);
      return rec;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportLabels.sheetName);
    const filename = getAdminScreenExcelFilename("all");
    recordExcelAudit("download_all_excel", {
      file_name: filename,
      row_count: data.length,
    });

    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      filename
    );
  };

  /* ================= UI ================= */

  if (!gpsApiUrl) {
    return (
      <div className="p-3">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">GPS API not configured for this project.</p>
          <p className="text-sm mt-1">Set a GPS API URL in the project settings to enable distance reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <ProjectSelectorBar />
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {t("admin.reports.monthly_distance.title")} (KM)
            </h1>
            <p className="text-sm text-gray-500">{monthHeadline}</p>
          </div>

          <div className="flex gap-3">
            <input
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="md-month-input"
            />
            <button
              onClick={() => setSelectedMonth(monthInput)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {t("common.go")}
            </button>
            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              {t("common.download")}
            </button>
          </div>
        </div>

        {rosterError && <div className="p-2 text-blue-600">{t(rosterError)}</div>}
        {fetchError && <div className="p-2 text-red-600">{t(fetchError)}</div>}
        <div className="relative">
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3 shadow-lg">
                <div className="relative h-7 w-7">
                  <Truck className="h-6 w-6 text-sky-600 animate-bounce" />
                  <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-sky-200 animate-pulse" />
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">
                    {loadingFleet
                      ? t("admin.reports.monthly_distance.loading_distances")
                      : t("admin.reports.monthly_distance.loading_vehicles")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.reports.monthly_distance.title")}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DataTable
            value={fleetRows}
            loading={false}
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            filters={filters}
            header={renderHeader()}
            stripedRows
            showGridlines
            responsiveLayout="scroll"
            globalFilterFields={["vehicleId"]}
            className="p-datatable-sm"
          >
          <Column
            header={t("admin.reports.monthly_distance.columns.index")}
            body={(_, o) => o.rowIndex + 1}
            style={{ width: "80px" }}
          />

          <Column
            field="vehicleId"
            header={t("admin.reports.monthly_distance.columns.vehicle_id")}
            sortable
          />

          {monthDays.map((d) => (
            <Column
              key={d.iso}
              header={d.label}
              body={(r: VehicleDistanceRow) =>
                formatCellValue(r.distances[d.iso])
              }
            />
          ))}

          <Column
            header={t("admin.reports.monthly_distance.columns.total")}
            body={(r: VehicleDistanceRow) => formatCellValue(r.total)}
            style={{ width: "120px" }}
          />
          </DataTable>
        </div>
      
    </div>
  );
}
