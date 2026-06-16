import type { ReportResponse, ReportRow } from "./types";
import { useEffect, useMemo, useState } from "react";
import "./monthlyWasteComparison.css";
import { api } from "@/api";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { getAdminScreenExcelFilename } from "@/utils/exportExcel";
import { Download, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";


const initialKpis: ReportResponse["kpis"] = {
  total_agreed_weight: 0,
  total_actual_weight: 0,
  variance_kg: 0,
  collection_efficiency_percent: 0,
  average_weight_per_trip: 0,
  coverage_efficiency_percent: 0,
  total_trips: 0,
  collection_points_covered: 0,
  report_status: "On Target",
};

const currentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

export default function MonthlyWasteComparison() {
  const [monthValue, setMonthValue] = useState(currentMonth());
  const [appliedMonth, setAppliedMonth] = useState(currentMonth());
  const [sortMode, setSortMode] = useState("absolute");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<ReportResponse["monthly_trends"]>([]);
  const [panchayatComparison, setPanchayatComparison] = useState<ReportResponse["panchayat_comparison"]>([]);
  const [kpis, setKpis] = useState<ReportResponse["kpis"]>(initialKpis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<ReportResponse>("/reports/monthly-waste-comparison/", {
        params: {
          month: appliedMonth,
          sort: sortMode,
        },
      });
      setRows(Array.isArray(data?.results) ? data.results : []);
      setMonthlyTrends(Array.isArray(data?.monthly_trends) ? data.monthly_trends : []);
      setPanchayatComparison(Array.isArray(data?.panchayat_comparison) ? data.panchayat_comparison : []);
      setKpis(data?.kpis ?? initialKpis);
    } catch {
      setRows([]);
      setMonthlyTrends([]);
      setPanchayatComparison([]);
      setKpis(initialKpis);
      setError("Unable to load monthly waste comparison report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [appliedMonth, sortMode]);

  const formatNumber = (value?: number | string | null, suffix = "") => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "-";
    return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  };

  const statusBody = (row: ReportRow) => {
    const status = String(row.report_status || "On Target");
    const className =
      status === "Surplus" ? "surplus" : status === "Deficit" ? "deficit" : "target";
    return <span className={`mwc-status ${className}`}>{status}</span>;
  };

  const renderHeader = () => (
    <div className="flex justify-end items-center">
      <div className="mwc-search">
        <Search size={16} color="#6b7280" />
        <InputText
          value={globalFilterValue}
          onChange={(event) => {
            const value = event.target.value;
            setGlobalFilterValue(value);
            setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
          }}
          placeholder="Search report..."
          className="p-inputtext-sm"
        />
      </div>
    </div>
  );

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        month: row.month,
        panchayat_id: row.panchayat_id,
        panchayat_name: row.panchayat_name,
        waste_type: row.waste_type,
        total_agreed_weight: row.total_agreed_weight,
        total_actual_weight: row.total_actual_weight,
        variance_kg: row.variance_kg,
        variance_percent: row.variance_percent,
        report_status: row.report_status,
        total_trips: row.total_trips,
        collection_points_covered: row.collection_points_covered,
        collection_efficiency_percent: row.collection_efficiency_percent,
        coverage_efficiency_percent: row.coverage_efficiency_percent,
        average_weight_per_trip: row.average_weight_per_trip,
      })),
    [rows],
  );

  const handleDownload = () => {
    const filename = getAdminScreenExcelFilename("all");
    recordExcelAudit("download_all_excel", {
      file_name: filename,
      row_count: exportRows.length,
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Waste Comparison");
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      filename,
    );
  };

  return (
    <div className="mwc-page">
      <div className="mwc-header">
        <div className="mwc-title">
          <h1>Monthly Waste Collection Comparison</h1>
          <p>Agreed vs actual collection by month, panchayat, and waste type.</p>
        </div>

        <div className="mwc-actions">
          <input
            type="month"
            value={monthValue}
            max={currentMonth()}
            onChange={(event) => setMonthValue(event.target.value)}
          />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="absolute">Highest variance</option>
            <option value="deficit">Highest deficit</option>
            <option value="surplus">Highest surplus</option>
          </select>
          <button className="mwc-button primary" onClick={() => setAppliedMonth(monthValue)}>
            Go
          </button>
          <button
            className="mwc-button primary"
            onClick={() => {
              setMonthValue("");
              setAppliedMonth("");
            }}
          >
            All Months
          </button>
          <button className="mwc-button success" onClick={handleDownload} disabled={!rows.length}>
            <Download size={16} />
            Download
          </button>
        </div>
      </div>

      {error ? <div className="mwc-error">{error}</div> : null}

      <div className="mwc-kpis">
        <div className="mwc-kpi">
          <span>Collection Efficiency</span>
          <strong>{formatNumber(kpis.collection_efficiency_percent, "%")}</strong>
        </div>
        <div className="mwc-kpi">
          <span>Average Weight / Trip</span>
          <strong>{formatNumber(kpis.average_weight_per_trip, " kg")}</strong>
        </div>
        <div className="mwc-kpi">
          <span>Coverage Efficiency</span>
          <strong>{formatNumber(kpis.coverage_efficiency_percent, "%")}</strong>
        </div>
        <div className="mwc-kpi">
          <span>Variance</span>
          <strong>{formatNumber(kpis.variance_kg, " kg")}</strong>
        </div>
      </div>

      <div className="mwc-visuals">
        <div className="mwc-panel">
          <h2>Monthly Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_agreed_weight" name="Agreed" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="total_actual_weight" name="Actual" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mwc-panel">
          <h2>PLB Performance</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={panchayatComparison.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="panchayat_name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="variance_kg" name="Variance kg" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable
        value={rows}
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        header={renderHeader()}
        loading={loading}
        stripedRows
        showGridlines
        emptyMessage="No monthly comparison data found."
        globalFilterFields={[
          "month",
          "panchayat_id",
          "panchayat_name",
          "waste_type",
          "report_status",
        ]}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        <Column field="month" header="Month" sortable />
        <Column field="panchayat_id" header="Panchayat ID" sortable />
        <Column field="panchayat_name" header="PLB" sortable />
        <Column field="waste_type" header="Waste Type" sortable />
        <Column field="total_agreed_weight" header="Agreed Weight" body={(row) => formatNumber(row.total_agreed_weight)} sortable />
        <Column field="total_actual_weight" header="Actual Weight" body={(row) => formatNumber(row.total_actual_weight)} sortable />
        <Column field="variance_kg" header="Variance kg" body={(row) => formatNumber(row.variance_kg)} sortable />
        <Column field="variance_percent" header="Variance %" body={(row) => formatNumber(row.variance_percent, "%")} sortable />
        <Column field="report_status" header="Status" body={statusBody} sortable />
        <Column field="total_trips" header="Trips" sortable />
        <Column field="collection_points_covered" header="Points Covered" sortable />
        <Column field="collection_efficiency_percent" header="Collection Efficiency %" body={(row) => formatNumber(row.collection_efficiency_percent, "%")} sortable />
        <Column field="coverage_efficiency_percent" header="Coverage Efficiency %" body={(row) => formatNumber(row.coverage_efficiency_percent, "%")} sortable />
        <Column field="average_weight_per_trip" header="Avg Weight / Trip" body={(row) => formatNumber(row.average_weight_per_trip)} sortable />
      </DataTable>
    </div>
  );
}
