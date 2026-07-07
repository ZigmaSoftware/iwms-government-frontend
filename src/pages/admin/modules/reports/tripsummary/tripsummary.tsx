import type { HistoryRow, RawVehicle, TableFilters, TripData, VehicleOption, VisualStatus } from "./types";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, JSX } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { getAdminScreenExcelFilename } from "@/utils/exportExcel";
import "./tripsummary.css";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";


const STATUS_ICONS: Record<VisualStatus, JSX.Element> = {
  moving: (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "16px",
        background:
          "linear-gradient(135deg, rgba(240,253,244,0.35), rgba(16,185,129,0.4))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(16,185,129,0.55)",
        boxShadow: "0 12px 28px rgba(16,185,129,0.35)",
      }}
    >
      <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
        <circle cx="20" cy="20" r="15" fill="none" stroke="#10b981" strokeWidth="2" />
        <path
          d="M13 20h10l-4-4M23 20l-4 4"
          fill="none"
          stroke="#047857"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 16h4M9 24h6"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  ),
  parked: (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "16px",
        background:
          "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.45))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(37,99,235,0.35)",
        boxShadow: "0 10px 25px rgba(59,130,246,0.3)",
      }}
    >
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <path
          d="M6 24V10a2 2 0 012-2h10a6 6 0 010 12H10v4"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="12" r="2.2" fill="#93c5fd" />
      </svg>
    </div>
  ),
  idle: (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "16px",
        background:
          "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(217,119,6,0.45))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(217,119,6,0.35)",
        boxShadow: "0 10px 25px rgba(251,191,36,0.25)",
      }}
    >
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <path
          d="M12 10v12M20 10v12"
          fill="none"
          stroke="#b45309"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="8" r="1.5" fill="#fcd34d" />
        <circle cx="16" cy="24" r="1.5" fill="#fcd34d" />
      </svg>
    </div>
  ),
};


const pad = (value: number) => String(value).padStart(2, "0");
const formatInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;

const isSameDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const shiftRangeByDays = (fromValue: string, toValue: string, offsetDays: number) => {
  const from = new Date(fromValue);
  const to = new Date(toValue);
  from.setDate(from.getDate() + offsetDays);
  to.setDate(to.getDate() + offsetDays);
  return { from: formatInput(from), to: formatInput(to) };
};

const computeInitialRange = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 6 * 60 * 60 * 1000);
  return { from, to };
};

const normalizeVehicle = (record: RawVehicle): VehicleOption | null => {
  const candidate =
    record?.vehicleId ||
    record?.vehicle_id ||
    record?.vehicleNo ||
    record?.regNo ||
    record?.vehicle_number ||
    record?.VehicleNo;
  if (!candidate) return null;
  const text = String(candidate).trim();
  if (!text) return null;
  return { id: text, label: text };
};

export default function TripSummary() {
  const { t } = useTranslation();
  const { gpsApiUrl } = useProjectSelector();
  const TRACKING_API_URL = gpsApiUrl;
  const initialRange = useMemo(() => computeInitialRange(), []);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [fromDate, setFromDate] = useState(() => formatInput(initialRange.from));
  const [toDate, setToDate] = useState(() => formatInput(initialRange.to));
  const [summary, setSummary] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [rosterReady, setRosterReady] = useState(false);
  const initialFetchRef = useRef(false);
  const fallbackAppliedRef = useRef(false);
  // const [filters, setFilters] = useState<{
  //   [key: string]: { value: string | null; matchMode: FilterMatchMode };
  // }>({
  //   global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  // });

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    startTime: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    endTime: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    intLoc: { value: null, matchMode: FilterMatchMode.CONTAINS },
    finLoc: { value: null, matchMode: FilterMatchMode.CONTAINS },
    position: { value: null, matchMode: FilterMatchMode.CONTAINS },
    duration: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    tripDistance: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    vehicleName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    startodo: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    endodo: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    totalTripLength: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    moveCount: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    parkCount: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    idleCount: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState("");

  useEffect(() => {
    let aborted = false;
    const loadVehicles = async () => {
      try {
        const res = await fetch(TRACKING_API_URL);
        if (!res.ok) throw new Error(`Roster error (${res.status})`);
        const body = await res.json();
        const payload = Array.isArray(body) ? body : body?.data;
        if (!Array.isArray(payload)) throw new Error("Unexpected roster shape");
        const normalized = payload
          .map((record: RawVehicle) => normalizeVehicle(record))
          .filter((record): record is VehicleOption => Boolean(record));

        if (!aborted) {
          if (normalized.length) {
            setVehicles(normalized);
            setVehicleId((prev) => (normalized.some((item) => item.id === prev) ? prev : normalized[0].id));
            setRosterError("");
          } else {
            setVehicles([]);
            setVehicleId("");
            setRosterError("admin.reports.trip_summary.roster_no_live");
          }
        }
      } catch (error) {
        console.error("Trip summary roster failed:", error);
        if (!aborted) {
          setVehicles([]);
          setVehicleId("");
          setRosterError("admin.reports.trip_summary.roster_unavailable");
        }
      } finally {
        if (!aborted) {
          setRosterReady(true);
        }
      }
    };

    loadVehicles();
    return () => {
      aborted = true;
    };
  }, []);

  const fetchSummary = async (options?: {
    range?: { from: string; to: string };
    allowFallback?: boolean;
  }) => {
    if (!vehicleId) {
      setSummaryError("admin.reports.trip_summary.error_select_vehicle");
      return;
    }
    const range = options?.range ?? { from: fromDate, to: toDate };
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      setSummaryError("admin.reports.trip_summary.error_invalid_range");
      return;
    }
    if (fromMs >= toMs) {
      setSummaryError("admin.reports.trip_summary.error_from_after_to");
      return;
    }

    try {
      setLoading(true);
      setSummaryError("");

      const fromUTC = fromMs;
      const toUTC = toMs;

      const apiUrl = `https://gpsvtsprobend.vamosys.com/v2/getTripSummary?vehicleId=${vehicleId}&fromDateUTC=${fromUTC}&toDateUTC=${toUTC}&userId=NMCP2DISPOSAL&duration=0`;

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`Trip summary error (${res.status})`);
      const data = await res.json();
      const historyRows = data?.data?.historyConsilated ?? [];

      if (data && data.data) {
        setSummary(data.data);
        if (!historyRows.length) {
          const allowFallback = options?.allowFallback;
          const today = new Date();
          if (
            allowFallback &&
            !fallbackAppliedRef.current &&
            isSameDate(new Date(range.from), today) &&
            isSameDate(new Date(range.to), today)
          ) {
            const fallbackRange = shiftRangeByDays(range.from, range.to, -1);
            fallbackAppliedRef.current = true;
            setFromDate(fallbackRange.from);
            setToDate(fallbackRange.to);
            await fetchSummary({ range: fallbackRange, allowFallback: false });
            return;
          }
          setSummaryError("admin.reports.trip_summary.error_no_records");
        }
      } else {
        setSummaryError("admin.reports.trip_summary.error_no_data");
        setSummary(null);
      }
    } catch (err) {
      console.error(err);
      setSummaryError("admin.reports.trip_summary.error_fetch_failed");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rosterReady || initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchSummary({ allowFallback: true });
  }, [rosterReady]);

  const handleExport = () => {
    const dataSource = summary?.historyConsilated ?? [];
    if (!dataSource.length) {
      setSummaryError("admin.reports.trip_summary.error_no_export");
      return;
    }

    const rows = dataSource.map((row, idx) => ({
      [t("admin.reports.trip_summary.columns.s_no")]: idx + 1,
      [t("admin.reports.trip_summary.columns.vehicle_no")]: summary?.vehicleName || vehicleId,
      [t("admin.reports.trip_summary.columns.start_time")]: new Date(row.startTime).toLocaleString(),
      [t("admin.reports.trip_summary.columns.start_address")]: row.intLoc || "-",
      [t("admin.reports.trip_summary.columns.end_time")]: new Date(row.endTime).toLocaleString(),
      [t("admin.reports.trip_summary.columns.end_address")]: row.finLoc || "-",
      [t("admin.reports.trip_summary.columns.position")]: row.position || "-",
      [t("admin.reports.trip_summary.columns.total_minutes")]: Math.floor((row.duration ?? 0) / 60000),
      [t("admin.reports.trip_summary.columns.distance")]: row.tripDistance ?? 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      t("admin.reports.trip_summary.export_sheet"),
    );
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const filename = getAdminScreenExcelFilename("all");
    recordExcelAudit("download_all_excel", {
      file_name: filename,
      row_count: rows.length,
    });
    saveAs(blob, filename);
  };

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const updatedFilters = { ...filters };
    updatedFilters["global"].value = value;
    setFilters(updatedFilters);
    setGlobalFilterValue(value);
  };

  const displaySummary = summary ?? {};
  const historyRows = displaySummary.historyConsilated ?? [];

  if (!gpsApiUrl) {
    return (
      <div className="trip-summary-shell">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">GPS API not configured for this project.</p>
          <p className="text-sm mt-1">Set a GPS API URL in the project settings to enable trip reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-summary-shell">
      <ProjectSelectorBar />
      <div className="trip-summary-container">
        <div className="trip-summary-header">
          <h3>{t("admin.reports.trip_summary.title")}</h3>
          <button className="btn-excel" type="button" onClick={handleExport}>
            <i className="fa fa-file-excel-o" aria-hidden="true" />
            {t("common.download")}
          </button>
        </div>

        <div className="filter-row">
          <div className="filter-field">
            <label>{t("admin.reports.trip_summary.filters.vehicle_id")}</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>{t("admin.reports.trip_summary.filters.from_date")}</label>
            <input
              type="datetime-local"
              className="trip-date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label>{t("admin.reports.trip_summary.filters.to_date")}</label>
            <input
              type="datetime-local"
              className="trip-date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <button className="btn-go" onClick={() => fetchSummary()} disabled={loading}>
            {loading ? t("common.loading") : t("common.go")}
          </button>
        </div>

        {rosterError && <div className="trip-inline-alert">{t(rosterError)}</div>}
        {summaryError && <div className="trip-inline-alert warning">{t(summaryError)}</div>}

        <div className="summary-header">
          <p>
            <span>{t("admin.reports.trip_summary.summary.vehicle_no")}:</span>{" "}
            {displaySummary.vehicleName || "-"}
          </p>
          <p>
            <span>{t("admin.reports.trip_summary.summary.start_km")}:</span>{" "}
            {displaySummary.startOdo ?? "-"}
          </p>
          <p>
            <span>{t("admin.reports.trip_summary.summary.end_km")}:</span>{" "}
            {displaySummary.endOdo ?? "-"}
          </p>
          <p>
            <span>{t("admin.reports.trip_summary.summary.trip_distance")}:</span>{" "}
            {displaySummary.totalTripLength ?? "-"} km
          </p>
        </div>

        <div className="status-cards">
          <div className="card moving">
            <div className="icon-wrap">
              {STATUS_ICONS.moving}
            </div>
            <div>
              <p>{t("admin.reports.trip_summary.status.moving")}</p>
              <strong>{displaySummary.moveCount ?? "-"}</strong>
            </div>
          </div>
          <div className="card parked">
            <div className="icon-wrap">
              {STATUS_ICONS.parked}
            </div>
            <div>
              <p>{t("admin.reports.trip_summary.status.parked")}</p>
              <strong>{displaySummary.parkCount ?? "-"}</strong>
            </div>
          </div>
          <div className="card idle">
            <div className="icon-wrap">
              {STATUS_ICONS.idle}
            </div>
            <div>
              <p>{t("admin.reports.trip_summary.status.idle")}</p>
              <strong>{displaySummary.idleCount ?? "-"}</strong>
            </div>
          </div>
        </div>

        <div className="trip-table-card">
          <DataTable
            value={historyRows}
            paginator
            rows={10}
            filters={filters}
            globalFilterFields={["intLoc", "finLoc", "position"]}
            header={
              <div className="flex justify-between items-center gap-4">
                <div className="text-lg font-semibold text-gray-700">
                  {t("admin.reports.trip_summary.records_title")}
                </div>
                <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
                  <InputText
                    value={globalFilterValue}
                    onChange={onGlobalFilterChange}
                    placeholder={t("admin.reports.trip_summary.search_placeholder")}
                    className="p-inputtext-sm !border-0 !shadow-none"
                  />
                </div>
              </div>
            }
            emptyMessage={t("admin.reports.trip_summary.empty_message")}
            responsiveLayout="stack"
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column
              header={t("admin.reports.trip_summary.columns.s_no")}
              body={(_row, { rowIndex }) => rowIndex + 1}
              style={{ width: "80px" }}
            />
            <Column
              field="startTime"
              header={t("admin.reports.trip_summary.columns.start_time")}
              body={(row: HistoryRow) => new Date(row.startTime).toLocaleString()}
              sortable
              style={{ minWidth: "170px" }}
              filter
              showFilterMatchModes={false}
            />
            <Column
              field="intLoc"
              header={t("admin.reports.trip_summary.columns.start_address")}
              body={(row: HistoryRow) => row.intLoc || "-"}
              style={{ minWidth: "180px" }}
              filter
              showFilterMatchModes={false}
            />
            <Column
              field="endTime"
              header={t("admin.reports.trip_summary.columns.end_time")}
              body={(row: HistoryRow) => new Date(row.endTime).toLocaleString()}
              sortable
              style={{ minWidth: "170px" }}
              filter
              showFilterMatchModes={false}
            />
            <Column
              field="finLoc"
              header={t("admin.reports.trip_summary.columns.end_address")}
              body={(row: HistoryRow) => row.finLoc || "-"}
              style={{ minWidth: "180px" }}
              filter
              showFilterMatchModes={false}

            />
            <Column
              field="vehicleName"
              header={t("admin.reports.trip_summary.columns.vehicle_no")}
              body={() => displaySummary.vehicleName || vehicleId}
              style={{ minWidth: "160px" }}
              filter
              showFilterMatchModes={false}
            />
            <Column
              field="position"
              header={t("admin.reports.trip_summary.columns.position")}
              body={(row: HistoryRow) => row.position || "-"}
              style={{ minWidth: "140px" }}
              filter
              showFilterMatchModes={false}

            />
            <Column
            field="duration"
              header={t("admin.reports.trip_summary.columns.total_minutes")}
              body={(row: HistoryRow) => Math.floor((row.duration ?? 0) / 60000)}
              style={{ width: "150px" }}
              filter
              showFilterMatchModes={false}
            />
            <Column
              field="tripDistance"
              header={t("admin.reports.trip_summary.columns.distance")}
              body={(row: HistoryRow) => row.tripDistance ?? 0}
              style={{ width: "140px" }}
              filter
              showFilterMatchModes={false}
            />
          </DataTable>
        </div>
      </div>
    </div>
  );
}
