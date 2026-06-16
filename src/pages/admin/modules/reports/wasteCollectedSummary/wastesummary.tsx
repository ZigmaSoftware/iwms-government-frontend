import type { ApiRow } from "./types";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./wastesummary.css";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { customerCreationApi, wasteCollectionApi } from "@/helpers/admin";

import {
  filterActiveCustomers,
  normalizeCustomerArray,
} from "@/utils/customerUtils";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";


/* ================= TYPES ================= */


/* ================= COMPONENT ================= */

export default function WasteSummary() {
  const { t, i18n } = useTranslation();
  const { weighmentApiUrl, gpsApiUrl } = useProjectSelector();
  const WEIGHMENT_API_URL = weighmentApiUrl;
  const VEHICLE_TRACKING_API = gpsApiUrl;
  const today = new Date();
  const todayKey = today.toISOString().split("T")[0];
  const initialMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  /** month input (UI only) */
  const [monthValue, setMonthValue] = useState(initialMonth);

  /** applied month (used for API) */
  const [appliedMonth, setAppliedMonth] = useState(initialMonth);

  const [rows, setRows] = useState<ApiRow[]>([]);

  const [totalHouseholdCount, setTotalHouseholdCount] = useState<number | null>(null);
  const [totalCollectedCount, setTotalCollectedCount] = useState<number | null>(null);
  const [vehicleTrackingCount, setVehicleTrackingCount] = useState<number | null>(null);
  const [collectedByDate, setCollectedByDate] = useState<Record<string, number>>({});

  /* ===== PrimeReact Search ===== */

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ================= HELPERS ================= */

  const parseNum = (v?: number | string | null) => {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const toDateKey = (value?: string | null) => {
    if (!value) return "";
    const raw = String(value).trim();
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return raw;
  };

  const formatNum = (v?: number | string | null) => {
    const n = parseNum(v);
    return n !== null ? n.toLocaleString() : "-";
  };

  const getCollectionDateValue = (entry: any) =>
    entry?.collection_date ??
    entry?.collectionDate ??
    entry?.created_at ??
    entry?.createdAt ??
    entry?.date ??
    entry?.created_date ??
    entry?.createdDate;

  const getVehicleCount = (row: ApiRow) => {
    const values = [
      row.total_vehicle,
      row.vehicle_count,
      row.total_vehicle_count,
      row.vehicles,
      row.no_of_vehicle,
      row.no_of_vehicles,
    ];
    for (const v of values) {
      const n = parseNum(v);
      if (n !== null) return n;
    }
    return vehicleTrackingCount;
  };

  const getCollectedCount = (dateValue?: string | null) => {
    const dateKey = toDateKey(dateValue ?? "");
    if (dateKey && collectedByDate[dateKey] !== undefined) {
      return collectedByDate[dateKey];
    }
    const rawKey = String(dateValue ?? "").trim();
    if (rawKey && collectedByDate[rawKey] !== undefined) {
      return collectedByDate[rawKey];
    }
    return 0;
  };

  const displayRows = useMemo(() => {
    const map = new Map<string, ApiRow>();

    rows.forEach((row) => {
      const rawDate = String(row.date ?? "").trim();
      const dateKey = toDateKey(rawDate) || rawDate;
      if (!dateKey) return;
      if (!map.has(dateKey)) {
        map.set(
          dateKey,
          rawDate ? row : { ...row, date: dateKey }
        );
      }
    });

    Object.keys(collectedByDate).forEach((dateKey) => {
      if (map.has(dateKey)) return;
      map.set(dateKey, {
        date: dateKey,
        dry_weight: 0,
        wet_weight: 0,
        mix_weight: 0,
        total_net_weight: 0,
        average_weight_per_trip: 0,
      });
    });

    return Array.from(map.values())
      .filter((row) => {
        const dateKey = toDateKey(row.date) || row.date;
        if (!dateKey) return false;
        return dateKey <= todayKey;
      })
      .sort((a, b) => {
      const aKey = toDateKey(a.date) || a.date;
      const bKey = toDateKey(b.date) || b.date;
      if (aKey === bKey) return 0;
      return aKey > bKey ? -1 : 1;
    });
  }, [rows, collectedByDate, todayKey]);

  /* ================= FETCH MONTH DATA ================= */

  const fetchMonthData = async (month: string) => {
    try {
      const url = `${WEIGHMENT_API_URL}?from_date=${month}-01&key=ZIGMA-DELHI-WEIGHMENT-2025-SECURE`;
      const res = await fetch(url);
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      const normalized = data.map((row: any) => ({
        ...row,
        date:
          row?.date ??
          row?.Date ??
          row?.collection_date ??
          row?.collectionDate ??
          "",
      }));
      setRows(normalized);
    } catch {
      setRows([]);
    }
  };

  /** fetch only when Go is clicked */
  useEffect(() => {
    fetchMonthData(appliedMonth);
  }, [appliedMonth]);

  /* ================= MASTER COUNTS ================= */

  const fetchHouseholdStats = useCallback(async (month: string) => {
    let totalHouseholds = 0;
    try {
      const response = await customerCreationApi.readAll();
      const normalized = normalizeCustomerArray(response);
      const activeCustomers = filterActiveCustomers(normalized);
      totalHouseholds = activeCustomers.length;
      setTotalHouseholdCount(totalHouseholds);
    } catch {
      setTotalHouseholdCount(0);
    }

    try {
      const response = await wasteCollectionApi.readAll();
      const data = Array.isArray(response) ? response : [];
      const filtered = month
        ? data.filter((row: any) =>
            toDateKey(getCollectionDateValue(row)).startsWith(month)
          )
        : data;
      const countsByDateSets: Record<string, Set<string>> = {};
      const totalCollectedSet = new Set<string>();
      filtered.forEach((entry: any, index: number) => {
        const dateKey = toDateKey(getCollectionDateValue(entry));
        if (!dateKey) return;
        const customerId = String(
          entry.customer ?? entry.customer_id ?? entry.customer_unique_id ?? ""
        ).trim();
        const entryKey = String(
          customerId ||
            entry.unique_id ||
            entry.id ||
            entry.collection_id ||
            index
        ).trim();
        if (!countsByDateSets[dateKey]) {
          countsByDateSets[dateKey] = new Set();
        }
        countsByDateSets[dateKey].add(entryKey);
        if (entryKey) {
          totalCollectedSet.add(entryKey);
        }
      });

      const countsByDate: Record<string, number> = {};
      Object.entries(countsByDateSets).forEach(([dateKey, idSet]) => {
        countsByDate[dateKey] = idSet.size;
      });

      setCollectedByDate(countsByDate);
      setTotalCollectedCount(totalCollectedSet.size);
    } catch {
      setCollectedByDate({});
      setTotalCollectedCount(0);
    }
  }, []);

  useEffect(() => {
    fetchHouseholdStats(appliedMonth);
  }, [appliedMonth, fetchHouseholdStats]);

  useEffect(() => {
    (async () => {
      const res = await fetch(VEHICLE_TRACKING_API);
      const body = await res.json();
      const list = Array.isArray(body?.data) ? body.data : body;
      const set = new Set<string>();
      list?.forEach((r: any) => {
        Object.values(r).forEach((v) => v && set.add(String(v)));
      });
      setVehicleTrackingCount(set.size);
    })();
  }, []);

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
      placeholder: t("admin.reports.waste_summary.search_placeholder"),
    });

  /* ================= EXPORT ================= */
  const exportLabels = useMemo(
    () => ({
      date: t("admin.reports.waste_summary.columns.date"),
      totalHousehold: t("admin.reports.waste_summary.columns.total_household"),
      collected: t("admin.reports.waste_summary.columns.collected"),
      notCollected: t("admin.reports.waste_summary.columns.not_collected"),
      vehicleCount: t("admin.reports.waste_summary.columns.vehicle_count"),
      tripCount: t("admin.reports.waste_summary.columns.trip_count"),
      dryWeight: t("admin.reports.waste_summary.columns.dry_weight"),
      wetWeight: t("admin.reports.waste_summary.columns.wet_weight"),
      mixedWeight: t("admin.reports.waste_summary.columns.mixed_weight"),
      weighment: t("admin.reports.waste_summary.columns.weighment"),
      avgPerTrip: t("admin.reports.waste_summary.columns.avg_per_trip"),
      sheetName: t("admin.reports.waste_summary.export_sheet"),
      filePrefix: t("admin.reports.waste_summary.export_file_prefix"),
    }),
    [i18n.language, t],
  );

  const handleDownload = () => {
    const exportRows = displayRows.map((r) => ({
      [exportLabels.date]: r.date,
      [exportLabels.totalHousehold]: totalHouseholdCount,
      [exportLabels.collected]: totalCollectedCount,
      [exportLabels.notCollected]:
        totalHouseholdCount !== null
          ? Math.max(
              totalHouseholdCount - (totalCollectedCount ?? 0),
              0
            )
          : null,
      [exportLabels.vehicleCount]: getVehicleCount(r),
      [exportLabels.tripCount]: parseNum(r.total_trip),
      [exportLabels.dryWeight]: parseNum(r.dry_weight),
      [exportLabels.wetWeight]: parseNum(r.wet_weight),
      [exportLabels.mixedWeight]: parseNum(r.mix_weight),
      [exportLabels.weighment]: parseNum(r.total_net_weight),
      [exportLabels.avgPerTrip]: parseNum(r.average_weight_per_trip),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportLabels.sheetName);
    const filename = getAdminScreenExcelFilename("all");
    recordExcelAudit("download_all_excel", {
      file_name: filename,
      row_count: exportRows.length,
    });

    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      filename
    );
  };

  /* ================= UI ================= */

  if (!weighmentApiUrl) {
    return (
      <div className="p-3">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">Weighment API not configured for this project.</p>
          <p className="text-sm mt-1">Set a Weighment API URL in the project settings to enable waste reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <ProjectSelectorBar />
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.reports.waste_summary.title")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("admin.reports.waste_summary.subtitle")}
            </p>
          </div>

          {/* 🔹 MONTH + GO + DOWNLOAD */}
          <div className="flex gap-3 items-center">
            <input
              type="month"
              value={monthValue}
              max={initialMonth}
              onChange={(e) => setMonthValue(e.target.value)}
              className="border px-2 py-1 rounded"
            />

            <button
              onClick={() => setAppliedMonth(monthValue)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {t("common.go")}
            </button>

            <button
              onClick={handleDownload}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              {t("common.download")}
            </button>
          </div>
        </div>

        <DataTable
          value={displayRows}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          filters={filters}
          header={renderHeader()}
          stripedRows
          showGridlines
          emptyMessage={t("admin.reports.waste_summary.empty_message")}
          globalFilterFields={[
            "date",
            "total_trip",
            "dry_weight",
            "wet_weight",
            "mix_weight",
            "total_net_weight",
          ]}
          className="p-datatable-sm"
        >
          <Column
            header={t("admin.reports.waste_summary.columns.s_no")}
            body={(_, o) => o.rowIndex + 1}
            style={{ width: "80px" }}
          />
          <Column field="date" header={t("admin.reports.waste_summary.columns.date")} sortable />
          <Column
            header={t("admin.reports.waste_summary.columns.total_household")}
            body={() => formatNum(totalHouseholdCount)}
          />
          <Column
            header={t("admin.reports.waste_summary.columns.collected")}
            body={() => formatNum(totalCollectedCount)}
          />
          <Column
            header={t("admin.reports.waste_summary.columns.not_collected")}
            body={(row) =>
              formatNum(
                totalHouseholdCount !== null
                  ? Math.max(
                      totalHouseholdCount - (totalCollectedCount ?? 0),
                      0
                    )
                  : null
              )
            }
          />
          <Column
            header={t("admin.reports.waste_summary.columns.vehicle_count")}
            body={(r) => formatNum(getVehicleCount(r))}
          />
          <Column field="total_trip" header={t("admin.reports.waste_summary.columns.trip_count")} sortable />
          <Column field="dry_weight" header={t("admin.reports.waste_summary.columns.dry_weight")} sortable />
          <Column field="wet_weight" header={t("admin.reports.waste_summary.columns.wet_weight")} sortable />
          <Column field="mix_weight" header={t("admin.reports.waste_summary.columns.mixed_weight")} sortable />
          <Column field="total_net_weight" header={t("admin.reports.waste_summary.columns.weighment")} sortable />
          <Column
            field="average_weight_per_trip"
            header={t("admin.reports.waste_summary.columns.avg_per_trip")}
            body={(r) => Number(r.average_weight_per_trip).toFixed(2)}
          />
        </DataTable>

    </div>
  );
}
