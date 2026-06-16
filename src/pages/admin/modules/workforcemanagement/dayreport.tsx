import type { ApiRow } from "./types";
import { useEffect, useState } from "react";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { Button } from "primereact/button";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import "./dayreport.css";
import { useTranslation } from "react-i18next";


const today = new Date();

const getLastDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const formatNumber = (v?: number | null) =>
  v !== null && v !== undefined ? v.toLocaleString() : "-";

export default function DayReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { weighmentApiUrl } = useProjectSelector();

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
  const [error, setError] = useState<string | null>(null);

  /* ================= Filters ================= */
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          {t("admin.workforce_management.day_report.filters.from")}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ml-2 wf-date-input"
          />
        </label>

        <label>
          {t("admin.workforce_management.day_report.filters.to")}
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
          onClick={fetchData}
        />
      </div>

      <span className="p-input-icon-left">
        {/* <span className="pi pi-search" /> */}
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.workforce_management.day_report.search_placeholder")}
        />
      </span>
    </div>
  );

  /* ================= Fetch ================= */
  async function fetchData() {
    if (new Date(fromDate) > new Date(toDate)) {
      setError("admin.workforce_management.day_report.error_from_after_to");
      return;
    }

    setError(null);

    if (!weighmentApiUrl) {
      setError("admin.workforce_management.day_report.error_no_api");
      return;
    }

    try {
      const res = await fetch(
        `${weighmentApiUrl}?action=day_wise_data&from_date=${fromDate}&to_date=${toDate}&key=ZIGMA-DELHI-WEIGHMENT-2025-SECURE`
      );
      const json = await res.json();

      if (!json.data?.length) {
        setRows([]);
        setError("admin.workforce_management.day_report.error_no_data");
        return;
      }

      const mapped: ApiRow[] = json.data.map((row: any) => {
        const dry = Number(row.Dry_Wt.replace(/,/g, ""));
        const wet = Number(row.Wet_Wt.replace(/,/g, ""));
        const mix = Number(row.Mix_Wt.replace(/,/g, ""));
        const net = Number(row.Net_Wt.replace(/,/g, ""));

        return {
          Ticket_No: row.Ticket_No,
          Vehicle_No: row.Vehicle_No,
          date: row.Date.split(" ")[0],
          Start_Time: row.Date.split(" ")[1] || null,
          total_trip: 1,
          dry_weight: dry,
          wet_weight: wet,
          mix_weight: mix,
          total_net_weight: net,
          average_weight_per_trip: net,
        };
      });

      setRows(mapped);
    } catch (e) {
      setError("admin.workforce_management.day_report.error_load_failed");
      setRows([]);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const indexTemplate = (_: ApiRow, { rowIndex }: any) => rowIndex + 1;

  /* ================= UI ================= */
  return (
    <>
      <ProjectSelectorBar />
         <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {t("admin.workforce_management.day_report.title")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("admin.workforce_management.day_report.subtitle")}
            </p>
          </div>

          <Button
            icon="pi pi-arrow-left"
            label={t("common.back")}
            severity="success"
            onClick={() => navigate(-1)}
          />
        </div>

        {error && <p className="text-red-600 mb-3">{t(error)}</p>}

        <DataTable
          value={rows}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          filters={filters}
          header={renderHeader()}
          globalFilterFields={["Ticket_No", "Vehicle_No", "date"]}
          stripedRows
          showGridlines
          emptyMessage={t("admin.workforce_management.day_report.empty_message")}
          className="p-datatable-sm"
        >
          <Column
            header={t("admin.workforce_management.day_report.columns.s_no")}
            body={indexTemplate}
            style={{ width: "70px" }}
          />
          <Column
            field="date"
            header={t("admin.workforce_management.day_report.columns.date")}
            sortable
          />
          <Column
            field="Start_Time"
            header={t("admin.workforce_management.day_report.columns.start_time")}
          />
          <Column
            field="Ticket_No"
            header={t("admin.workforce_management.day_report.columns.ticket_no")}
            sortable
          />
          <Column
            field="Vehicle_No"
            header={t("admin.workforce_management.day_report.columns.vehicle_no")}
            sortable
          />
          <Column
            field="dry_weight"
            header={t("admin.workforce_management.day_report.columns.dry")}
            body={(r) => formatNumber(r.dry_weight)}
          />
          <Column
            field="wet_weight"
            header={t("admin.workforce_management.day_report.columns.wet")}
            body={(r) => formatNumber(r.wet_weight)}
          />
          <Column
            field="mix_weight"
            header={t("admin.workforce_management.day_report.columns.mixed")}
            body={(r) => formatNumber(r.mix_weight)}
          />
          <Column
            field="total_net_weight"
            header={t("admin.workforce_management.day_report.columns.net")}
            body={(r) => formatNumber(r.total_net_weight)}
          />
          <Column
            header={t("admin.workforce_management.day_report.columns.avg_trip")}
            body={(r) => r.average_weight_per_trip.toFixed(2)}
          />
        </DataTable>
    </>
 
   
    
  );
}
