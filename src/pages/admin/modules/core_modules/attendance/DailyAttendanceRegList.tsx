import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import type { DataTableFilterMeta } from "primereact/datatable";
import { InputText } from "primereact/inputtext";

import { api } from "@/api";
import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import Select from "@/components/form/Select";
import Swal from "@/lib/notify";
import { staffCreationApi } from "@/helpers/admin";

type DailyAttendanceRecord = Record<string, unknown>;

type DailyAttendanceResponse = {
  count: number;
  records: DailyAttendanceRecord[];
};

type DailyAttendanceGroup = {
  key: string;
  emp_id: string;
  name: string;
  recognition_date: string;
  first_in_time: string;
  last_out_time: string;
  punch_count: number;
  latitude: unknown;
  longitude: unknown;
  captured_image: unknown;
  user_type: string;
  staff_user_type: string;
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

const ALL_STAFF_TYPES = "__all__";

const IN_PATTERN = /^(in|check[-_ ]?in)$/i;
const OUT_PATTERN = /^(out|check[-_ ]?out)$/i;

// Formats a "HH:mm" / "HH:mm:ss" 24-hour time string as 12-hour with AM/PM (IST, as reported by the device).
const formatTime12h = (value: string): string => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value || "-";
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
};

// Worked hours = Last Out - First In, both "HH:mm[:ss]" strings on the same day.
const getWorkedHours = (firstIn: string, lastOut: string): string => {
  const parse = (value: string): number | null => {
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

// Merges raw per-punch records into one row per staff per day (first-in / last-out).
// `punch_type` values aren't confirmed from the frontend, so classification falls back
// to "first punch chronologically = in, last punch = out" when nothing matches.
const groupDailyAttendance = (rows: DailyAttendanceRecord[]): DailyAttendanceGroup[] => {
  const buckets = new Map<string, DailyAttendanceRecord[]>();

  rows.forEach((row) => {
    const empId = text(row, "emp_id");
    const date = text(row, "recognition_date");
    const key = `${empId}__${date}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  });

  return Array.from(buckets.entries()).map(([key, punches]) => {
    const sorted = [...punches].sort((a, b) =>
      text(a, "recognition_time").localeCompare(text(b, "recognition_time"))
    );

    const inPunch = sorted.find((row) => IN_PATTERN.test(text(row, "punch_type")));
    const outPunch = [...sorted].reverse().find((row) => OUT_PATTERN.test(text(row, "punch_type")));

    const firstIn = inPunch ?? sorted[0];
    const lastOut = outPunch ?? sorted[sorted.length - 1];

    return {
      key,
      emp_id: text(firstIn, "emp_id"),
      name: text(firstIn, "name"),
      recognition_date: text(firstIn, "recognition_date"),
      first_in_time: text(firstIn, "recognition_time"),
      last_out_time: text(lastOut, "recognition_time"),
      punch_count: sorted.length,
      latitude: firstIn.latitude,
      longitude: firstIn.longitude,
      captured_image: firstIn.captured_image,
      user_type: "-",
      staff_user_type: "-",
    };
  });
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

  const groupedRows = useMemo(() => {
    const groups = groupDailyAttendance(rows);
    return groups.map((row) => ({
      ...row,
      user_type: userTypeById.get(row.emp_id) ?? "-",
      staff_user_type: staffUserTypeById.get(row.emp_id) ?? "-",
    }));
  }, [rows, userTypeById, staffUserTypeById]);

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
        paginator
        rows={10}
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
