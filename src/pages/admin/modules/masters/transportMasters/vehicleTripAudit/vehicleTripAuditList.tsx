import type { DailyTripAssignmentRecord } from "./types";
import type { TableFilters, VehicleTripAuditRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";


const buildLookup = (
  items: any[],
  key: string,
  label: string,
  fallbackKey?: string
) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(
        item?.[label] ?? item?.[fallbackKey ?? ""] ?? lookupKey
      );
    }
    return acc;
  }, {});

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.join(", ");
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export default function VehicleTripAuditList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [audits, setAudits] = useState<VehicleTripAuditRecord[]>([]);
  const [dailyTripAssignments, setDailyTripAssignments] = useState<DailyTripAssignmentRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    daily_trip_assignment_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    vehicle_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const { encTransportMaster, encVehicleTripAudit } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encVehicleTripAudit,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      adminApi.vehicleTripAudits.readAll(),
      adminApi.dailyTripAssignment.readAll(),
      adminApi.vehicleCreations.readAll(),
    ])
      .then(([auditsData, tripData, vehicleData]) => {
        if (cancelled) return;
        setAudits(normalizeList(auditsData) as VehicleTripAuditRecord[]);
        setDailyTripAssignments(normalizeList(tripData) as DailyTripAssignmentRecord[]);
        setVehicles(normalizeList(vehicleData));
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoading(false);
        Swal.fire(
          t("common.error"),
          extractErrorMessage(error, t("common.fetch_failed")),
          "error"
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(() => audits as VehicleTripAuditRecord[], [audits]);

  const tripLookup = useMemo(
    () =>
      buildLookup(
        dailyTripAssignments as any[],
        "unique_id",
        "trip_no",
        "unique_id"
      ),
    [dailyTripAssignments]
  );

  const vehicleLookup = useMemo(
    () =>
      buildLookup(
        vehicles,
        "unique_id",
        "vehicle_no"
      ),
    [vehicles]
  );

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (value: string) => {
    const updatedFilters = { ...filters };

    updatedFilters.global.value = value;
    setFilters(updatedFilters);
    setGlobalFilterValue(value);
  };

  const actionTemplate = (row: VehicleTripAuditRecord) => (
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

  const gpsCount = (value?: number[]) => (Array.isArray(value) ? value.length : 0);

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.vehicle_trip_audit.list_title")}
        subtitle={t("admin.vehicle_trip_audit.list_subtitle")}
        actions={
          <Button
            label={t("admin.vehicle_trip_audit.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        }
        className="mb-6"
      />

      <DataTable
        value={records}
        dataKey="id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        onFilter={onFilter}
        globalFilterFields={[
          "daily_trip_assignment_id",
          "vehicle_id",
        ]}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={onGlobalFilterChange}
            searchPlaceholder={t("admin.vehicle_trip_audit.search_placeholder")}
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.vehicle_trip_audit.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column
          header={t("admin.vehicle_trip_audit.daily_trip_assignment")}
          body={(row: VehicleTripAuditRecord) =>
            tripLookup[row.daily_trip_assignment_id] ?? row.daily_trip_assignment_id
          }
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.vehicle_trip_audit.vehicle")}
          body={(row: VehicleTripAuditRecord) =>
            vehicleLookup[row.vehicle_id] ?? row.vehicle_id
          }
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.vehicle_trip_audit.gps_lat")}
          body={(row: VehicleTripAuditRecord) => gpsCount(row.gps_lat)}
        />
        <Column
          header={t("admin.vehicle_trip_audit.gps_lon")}
          body={(row: VehicleTripAuditRecord) => gpsCount(row.gps_lon)}
        />
        <Column field="avg_speed" header={t("admin.vehicle_trip_audit.avg_speed")} />
        <Column field="idle_seconds" header={t("admin.vehicle_trip_audit.idle_seconds")} />
        <Column
          header={t("admin.vehicle_trip_audit.captured_at")}
          body={(row: VehicleTripAuditRecord) => formatDateTime(row.captured_at)}
        />
        <Column
          header={t("common.created_at")}
          body={(row: VehicleTripAuditRecord) => formatDateTime(row.created_at)}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: 120 }}
        />
      </DataTable>
    </div>
  );
}
