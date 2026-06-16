import type { ApiRow } from "./types";
import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createRoutePath } from "@/utils/routePaths";
import { fetchWasteReport } from "@/utils/wasteApi";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";
import "./datereport.css";
import { useTranslation } from "react-i18next";


const today = new Date();

const getLastDayOfMonth = (y: number, m: number) =>
  new Date(y, m, 0).getDate();

const formatNumber = (v?: number | null) =>
  v !== null && v !== undefined ? v.toLocaleString() : "-";

const formatTime = (v: string | null) => (v ? v : "-");

export default function DateReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { weighmentApiUrl } = useProjectSelector();
  const { encWorkforceManagement } = getEncryptedRoute();

  const initialFromDate = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const initialToDate = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    getLastDayOfMonth(today.getFullYear(), today.getMonth() + 1)
  ).padStart(2, "0")}`;

  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);

  const [rows, setRows] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= Filters ================= */
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters({
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    });
    setGlobalFilterValue(value);
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center">
      <div className="flex gap-3 items-center">
        <label>
          {t("admin.workforce_management.date_report.filters.from")}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ml-2 wf-date-input"
          />
        </label>

        <label>
          {t("admin.workforce_management.date_report.filters.to")}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ml-2 wf-date-input"
          />
        </label>

        <Button
          label={t("common.go")}
          // icon="pi pi-search"
          onClick={loadData}
        />
      </div>

      <span className="p-input-icon-left">
        {/* <span className="pi pi-search" /> */}
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.workforce_management.date_report.search_placeholder")}
        />
      </span>
    </div>
  );

  /* ================= Fetch ================= */
  async function loadData() {
    if (new Date(fromDate) > new Date(toDate)) {
      setError("admin.workforce_management.date_report.error_from_after_to");
      return;
    }

    if (!weighmentApiUrl) {
      setError("admin.workforce_management.date_report.error_no_api");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { rows: apiRows } = await fetchWasteReport<ApiRow>(
        weighmentApiUrl,
        "date_wise_data",
        fromDate,
        toDate
      );

      if (!apiRows.length) {
        setRows([]);
        setError("admin.workforce_management.date_report.error_no_data");
        return;
      }

      setRows(apiRows);
    } catch (e) {
      setRows([]);
      setError("admin.workforce_management.date_report.error_load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const indexTemplate = (_: ApiRow, { rowIndex }: any) => rowIndex + 1;

  /* ================= UI ================= */
  return (
    <>
    <ProjectSelectorBar />
    <div className="p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {t("admin.workforce_management.date_report.title")}
            </h1>
            <p className="text-sm text-gray-500">
              {t("admin.workforce_management.date_report.subtitle")}
            </p>
          </div>

          <Button
            icon="pi pi-arrow-left"
            label={t("common.back")}
            severity="success"
            onClick={() =>
              navigate(createRoutePath(encWorkforceManagement, encWorkforceManagement))
            }
          />
        </div>

        {error && (
          <p className="text-red-600 mb-3">{t(error)}</p>
        )}

        {/* ================= TABLE ================= */}
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
          globalFilterFields={[
            "date",
            "Start_Time",
            "End_Time",
            "total_trip",
            "dry_weight",
            "wet_weight",
            "mix_weight",
            "total_net_weight",
            "average_weight_per_trip",
          ]}
          emptyMessage={t("admin.workforce_management.date_report.empty_message")}
          className="p-datatable-sm"
        >
          <Column
            header={t("admin.workforce_management.date_report.columns.s_no")}
            body={indexTemplate}
            style={{ width: "80px" }}
          />

          <Column
            field="date"
            header={t("admin.workforce_management.date_report.columns.date")}
            sortable
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.start_time")}
            body={(r) => formatTime(r.Start_Time)}
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.end_time")}
            body={(r) => formatTime(r.End_Time)}
          />
          <Column
            field="total_trip"
            header={t("admin.workforce_management.date_report.columns.trips")}
            sortable
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.dry")}
            body={(r) => formatNumber(r.dry_weight)}
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.wet")}
            body={(r) => formatNumber(r.wet_weight)}
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.mixed")}
            body={(r) => formatNumber(r.mix_weight)}
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.net")}
            body={(r) => formatNumber(r.total_net_weight)}
            sortable
          />
          <Column
            header={t("admin.workforce_management.date_report.columns.avg_trip")}
            body={(r) =>
              Number(r.average_weight_per_trip).toFixed(2)
            }
          />
        </DataTable>
      </div>
    </div>
    </>
  );
}
