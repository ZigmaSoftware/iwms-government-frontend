import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import type { DataTableFilterMeta, DataTablePageEvent } from "primereact/datatable";
import { InputText } from "primereact/inputtext";

import { api } from "@/api";
import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import Select from "@/components/form/Select";
import Swal from "@/lib/notify";
import { staffCreationApi } from "@/helpers/admin";

// One already-grouped (emp_id, recognition_date) row, as returned directly by
// GET /attendance/records/ — the backend now performs the punch grouping via
// SQL aggregation before pagination, so the frontend no longer groups raw punches.
type DailyAttendanceRow = {
  key: string;
  emp_id: string;
  name: string;
  recognition_date: string;
  first_in_time: string | null;
  last_out_time: string | null;
  punch_count: number;
  latitude: string | null;
  longitude: string | null;
  captured_image: string | null;
};

// A row after the client-added staff-type annotations (from a separate
// staff-type lookup, unrelated to the attendance endpoint) are attached.
type DailyAttendanceGroup = DailyAttendanceRow & {
  user_type: string;
  staff_user_type: string;
};

type DailyAttendanceResponse = {
  count: number;
  records: DailyAttendanceRow[];
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

const text = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "-";
};

const ALL_STAFF_TYPES = "__all__";

// Formats a "HH:mm" / "HH:mm:ss" 24-hour time string as 12-hour with AM/PM (IST, as reported by the device).
const formatTime12h = (value: string | null): string => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return value || "-";
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
};

// Worked hours = Last Out - First In, both "HH:mm[:ss]" strings on the same day.
const getWorkedHours = (firstIn: string | null, lastOut: string | null): string => {
  const parse = (value: string | null): number | null => {
    if (!value) return null;
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] ?? 0) / 60;
  };
  const start = parse(firstIn);
  const end = parse(lastOut);
  if (start === null || end === null || end <= start) return "-";
  const totalMinutes = Math.round(end - start);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export default function DailyAttendanceRegList() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  // One page of already-grouped (emp_id, recognition_date) rows from the backend.
  const [rawRows, setRawRows] = useState<DailyAttendanceRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  const [userTypeById, setUserTypeById] = useState<Map<string, string>>(new Map());
  const [staffUserTypeById, setStaffUserTypeById] = useState<Map<string, string>>(new Map());
  const [staffUserTypeFilter, setStaffUserTypeFilter] = useState(ALL_STAFF_TYPES);

  const normalizeRole = (value: unknown) =>
    String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  useEffect(() => {
    staffCreationApi
      .readAll()
      .then((staffData: Record<string, unknown>[]) => {
        const userTypeMap = new Map<string, string>();
        const staffUserTypeMap = new Map<string, string>();
        (staffData ?? []).forEach((staff) => {
          // The device echoes back Staff.emp_id (the human-facing employee code),
          // not the internal unique_id/staff_unique_id UUID — join on that.
          const empId = String(staff.emp_id ?? "").trim();
          if (!empId) return;

          const userType = normalizeRole(staff.user_type_name);
          if (userType) userTypeMap.set(empId, userType);

          const staffUserType = normalizeRole(
            staff.staffusertype_name ||
              staff.contractorusertype_name ||
              staff.governmentusertype_name
          );
          if (staffUserType) staffUserTypeMap.set(empId, staffUserType);
        });
        setUserTypeById(userTypeMap);
        setStaffUserTypeById(staffUserTypeMap);
      })
      .catch(() => {
        // Non-fatal: attendance still works without the staff-type filter.
      });
  }, []);

  // rawRows is already grouped (one row per staff per day) by the backend —
  // just attach the client-side staff-type annotations.
  const groupedRows = useMemo(() => {
    return rawRows.map((row): DailyAttendanceGroup => ({
      ...row,
      user_type: userTypeById.get(row.emp_id) ?? "-",
      staff_user_type: staffUserTypeById.get(row.emp_id) ?? "-",
    }));
  }, [rawRows, userTypeById, staffUserTypeById]);

  const staffUserTypeOptions = useMemo(() => {
    const distinct = Array.from(new Set(staffUserTypeById.values())).sort();
    return [
      { value: ALL_STAFF_TYPES, label: "All staff types" },
      ...distinct.map((role) => ({ value: role, label: role })),
    ];
  }, [staffUserTypeById]);

  const filteredGroupedRows = useMemo(() => {
    if (staffUserTypeFilter === ALL_STAFF_TYPES) return groupedRows;
    return groupedRows.filter((row) => row.staff_user_type === staffUserTypeFilter);
  }, [groupedRows, staffUserTypeFilter]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DailyAttendanceResponse>("/attendance/records/", {
        params: {
          from_date: fromDate,
          to_date: toDate,
          page: first / rowsPerPage + 1,
          limit: rowsPerPage,
        },
      });
      setRawRows(Array.isArray(data.records) ? data.records : []);
      setTotalRecords(typeof data.count === "number" ? data.count : 0);
    } catch (error: unknown) {
      setRawRows([]);
      setTotalRecords(0);
      Swal.fire(
        "Attendance load failed",
        (error as ApiError).response?.data?.detail ?? "Unable to load attendance records.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, first, rowsPerPage]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

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
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setFirst(0);
                }}
                className="h-10 rounded-md border px-3"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setFirst(0);
                }}
                className="h-10 rounded-md border px-3"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">Staff type</span>
              <Select
                value={staffUserTypeFilter}
                onChange={setStaffUserTypeFilter}
                options={staffUserTypeOptions}
                placeholder="All staff types"
                className="h-10 w-44"
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
        value={filteredGroupedRows}
        dataKey="key"
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading}
        filters={filters}
        onFilter={(event) => setFilters(event.filters as DataTableFilterMeta)}
        globalFilterFields={["emp_id", "name", "recognition_date", "user_type", "staff_user_type"]}
        header={header}
        stripedRows
        showGridlines
        emptyMessage="No attendance records found."
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_: DailyAttendanceGroup, options: { rowIndex: number }) => options.rowIndex + 1} />
        <Column field="emp_id" header="Employee ID" sortable />
        <Column field="name" header="Name" sortable />
        <Column field="recognition_date" header="Date" sortable />
        <Column field="user_type" header="User Type" sortable />
        <Column field="staff_user_type" header="Staff User Type" sortable />
        <Column field="first_in_time" header="First In" body={(row: DailyAttendanceGroup) => formatTime12h(row.first_in_time)} sortable />
        <Column field="last_out_time" header="Last Out" body={(row: DailyAttendanceGroup) => formatTime12h(row.last_out_time)} sortable />
        <Column header="Worked Hours" body={(row: DailyAttendanceGroup) => getWorkedHours(row.first_in_time, row.last_out_time)} />
        <Column field="punch_count" header="Punch Count" sortable />
        <Column
          field="captured_image"
          header="Capture"
          body={(row: DailyAttendanceGroup) => {
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
