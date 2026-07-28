import type { TableFilters, TripAttendanceRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { api } from "@/api";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const TRIP_ATTENDANCE_COLUMN_FIELDS: Record<string, string[]> = {
  daily_trip_assignment_id: ["daily_trip_assignment_id", "daily_trip_assignment"],
  staff_id: ["staff_id", "staff"],
  vehicle_id: ["vehicle_id", "vehicle"],
  attendance_time: ["attendance_time"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  source: ["source"],
  photo: ["photo"],
  created_at: ["created_at"],
};

const buildLookup = (items: any[], key: string, label: string, fallbackKey?: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? item?.[fallbackKey ?? ""] ?? lookupKey);
    }
    return acc;
  }, {});

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

export default function TripAttendanceList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol } = useFieldVisibility(
    "transport-master",
    "trip-attendance",
    TRIP_ATTENDANCE_COLUMN_FIELDS
  );

  const tripAttendanceApi = adminApi.tripAttendances;
  const dailyTripAssignmentApi = adminApi.dailyTripAssignment;
  const userApi = adminApi.usersCreation;
  const vehicleApi = adminApi.vehicleCreations;

  const [records, setRecords] = useState<TripAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [tripLookup, setTripLookup] = useState<Record<string, string>>({});
  const [staffLookup, setStaffLookup] = useState<Record<string, string>>({});
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, string>>({});

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    daily_trip_assignment_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    staff_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    vehicle_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    source: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    attendance_time: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const { encTransportMaster, encTripAttendance } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encTripAttendance,
  );

  const backendOrigin = useMemo(
    () => api.defaults.baseURL?.replace(/\/api\/desktop\/?$/, "") || "",
    []
  );

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [attendanceRes, tripRes, userRes, vehicleRes] = await Promise.all([
        tripAttendanceApi.readAll(),
        dailyTripAssignmentApi.readAll(),
        userApi.readAll(),
        vehicleApi.readAll(),
      ]);

      setRecords(normalizeList(attendanceRes) as TripAttendanceRecord[]);
      setTripLookup(
        buildLookup(
          normalizeList(tripRes),
          "unique_id",
          "trip_no",
          "unique_id"
        )
      );
      setStaffLookup(buildLookup(normalizeList(userRes), "unique_id", "staff_name", "unique_id"));
      setVehicleLookup(buildLookup(normalizeList(vehicleRes), "unique_id", "vehicle_no"));
    } catch {
      Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
  };

  const resolveSource = (value?: string) => {
    if (value === "MOBILE") return t("admin.trip_attendance.source_mobile");
    if (value === "VEHICLE_CAM") return t("admin.trip_attendance.source_vehicle_cam");
    return value ?? "-";
  };

  const resolvePhotoLink = (value?: string | null) => {
    if (!value) return "-";
    const url = value.startsWith("http") ? value : `${backendOrigin}${value}`;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
        {t("common.view")}
      </a>
    );
  };

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.trip_attendance.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.trip_attendance.list_subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            label={t("admin.trip_attendance.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.trip_attendance.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  const actionTemplate = (row: TripAttendanceRecord) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.id), { state: { record: row } })}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        value={records}
        dataKey="id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={[
          ...(showCol("daily_trip_assignment_id") ? ["daily_trip_assignment_id"] : []),
          ...(showCol("staff_id") ? ["staff_id"] : []),
          ...(showCol("vehicle_id") ? ["vehicle_id"] : []),
          ...(showCol("source") ? ["source"] : []),
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.trip_attendance.empty_message")}
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 70 }} />
        {showCol("daily_trip_assignment_id") && (
          <Column
            header={t("admin.trip_attendance.daily_trip_assignment")}
            body={(row: TripAttendanceRecord) =>
              tripLookup[row.daily_trip_assignment_id] ?? row.daily_trip_assignment_id
            }
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("staff_id") && (
          <Column
            header={t("admin.trip_attendance.staff")}
            body={(row: TripAttendanceRecord) => staffLookup[row.staff_id] ?? row.staff_id}
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("vehicle_id") && (
          <Column
            header={t("admin.trip_attendance.vehicle")}
            body={(row: TripAttendanceRecord) =>
              vehicleLookup[row.vehicle_id] ?? row.vehicle_id
            }
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("attendance_time") && (
          <Column
            header={t("admin.trip_attendance.attendance_time")}
            body={(row: TripAttendanceRecord) => formatDateTime(row.attendance_time)}
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("latitude") && (
          <Column field="latitude" header={t("admin.trip_attendance.latitude")} />
        )}
        {showCol("longitude") && (
          <Column field="longitude" header={t("admin.trip_attendance.longitude")} />
        )}
        {showCol("source") && (
          <Column
            header={t("admin.trip_attendance.source")}
            body={(row: TripAttendanceRecord) => resolveSource(row.source)}
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("photo") && (
          <Column
            header={t("admin.trip_attendance.photo")}
            body={(row: TripAttendanceRecord) => resolvePhotoLink(row.photo)}
          />
        )}
        {showCol("created_at") && (
          <Column
            header={t("common.created_at")}
            body={(row: TripAttendanceRecord) => formatDateTime(row.created_at)}
            filter
            showFilterMatchModes={false}
          />
        )}
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 120 }} />
      </DataTable>
    </div>
  );
}
