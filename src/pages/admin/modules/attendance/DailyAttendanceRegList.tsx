import { useCallback, useEffect, useState } from "react";
import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import type { DataTableFilterMeta } from "primereact/datatable";
import { InputText } from "primereact/inputtext";

import { api } from "@/api";
import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import Swal from "@/lib/notify";

type DailyAttendanceRecord = Record<string, unknown>;

type DailyAttendanceResponse = {
  count: number;
  records: DailyAttendanceRecord[];
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
      to_date?: string;
    };
  };
};

const today = () => new Date().toISOString().slice(0, 10);

const text = (row: DailyAttendanceRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "-";
};

export default function DailyAttendanceRegList() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [rows, setRows] = useState<DailyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DailyAttendanceResponse>("/attendance/records/", {
        params: {
          from_date: fromDate,
          to_date: toDate,
        },
      });
      setRows(Array.isArray(data.records) ? data.records : []);
    } catch (error: unknown) {
      setRows([]);
      Swal.fire(
        "Attendance load failed",
        (error as ApiError).response?.data?.detail ?? "Unable to load attendance records.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const header = (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Attendance</h1>
            <p className="text-sm text-gray-500">Daily staff attendance records</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-10 rounded-md border px-3"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-10 rounded-md border px-3"
              />
            </label>
            <Button onClick={fetchAttendance} disabled={loading}>
              {loading ? "Loading..." : "Load attendance"}
            </Button>
          </div>
        </div>
        <div className="flex max-w-md items-center gap-3 rounded-full border bg-white px-3 py-1">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={(event) => {
              const value = event.target.value;
              setGlobalFilterValue(value);
              setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
            }}
            placeholder="Search attendance..."
            className="w-full border-none text-sm"
          />
        </div>
      </div>
  );

  return (
    <div className="p-3">
      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading}
        filters={filters}
        onFilter={(event) => setFilters(event.filters as DataTableFilterMeta)}
        globalFilterFields={["emp_id", "name", "recognition_date", "recognition_time", "punch_type"]}
        header={header}
        stripedRows
        showGridlines
        emptyMessage="No attendance records found."
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_: DailyAttendanceRecord, options: { rowIndex: number }) => options.rowIndex + 1} />
        <Column field="emp_id" header="Employee ID" body={(row: DailyAttendanceRecord) => text(row, "emp_id")} sortable />
        <Column field="name" header="Name" body={(row: DailyAttendanceRecord) => text(row, "name")} sortable />
        <Column field="recognition_date" header="Date" body={(row: DailyAttendanceRecord) => text(row, "recognition_date")} sortable />
        <Column field="recognition_time" header="Time" body={(row: DailyAttendanceRecord) => text(row, "recognition_time")} sortable />
        <Column field="punch_type" header="Punch" body={(row: DailyAttendanceRecord) => text(row, "punch_type")} />
        <Column field="similarity_score" header="Similarity" body={(row: DailyAttendanceRecord) => text(row, "similarity_score")} />
        <Column field="latitude" header="Latitude" body={(row: DailyAttendanceRecord) => text(row, "latitude")} />
        <Column field="longitude" header="Longitude" body={(row: DailyAttendanceRecord) => text(row, "longitude")} />
        <Column
          field="captured_image"
          header="Capture"
          body={(row: DailyAttendanceRecord) => {
            const source = row.captured_image;
            return typeof source === "string" && source ? (
              <a href={source} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                View image
              </a>
            ) : "-";
          }}
        />
      </DataTable>
    </div>
  );
}
