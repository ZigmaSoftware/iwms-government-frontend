import type { TableFilters, UnassignedStaffPoolRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import {
  unassignedStaffPoolApi,
  userCreationApi,
  zoneApi,
  wardApi,
  dailyTripAssignmentApi,
} from "@/helpers/admin";

const UNASSIGNED_STAFF_POOL_COLUMN_FIELDS: Record<string, string[]> = {
  operator: ["operator_id", "operator"],
  driver: ["driver_id", "driver"],
  zone: ["zone_id", "zone"],
  ward: ["ward_id", "ward"],
  status: ["status"],
  daily_trip_assignment: ["daily_trip_assignment_id", "daily_trip_assignment"],
  created_at: ["created_at"],
};


const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const filterByCompanyProject = (
  items: any[],
  companyId: string,
  projectId: string
) => {
  const hasContextFields = items.some((item) => {
    const rowCompanyId = normalizeId(item?.company_id ?? item?.company_unique_id);
    const rowProjectId = normalizeId(item?.project_id ?? item?.project_unique_id);
    return Boolean(rowCompanyId || rowProjectId);
  });

  if (!hasContextFields) {
    return items;
  }

  return items.filter((item) => {
    const rowCompanyId = normalizeId(item?.company_id ?? item?.company_unique_id);
    const rowProjectId = normalizeId(item?.project_id ?? item?.project_unique_id);
    const companyMatches = !companyId || rowCompanyId === companyId;
    const projectMatches = !projectId || rowProjectId === projectId;
    return companyMatches && projectMatches;
  });
};

const buildLookup = (items: any[], key: string, label: string, fallbackKey?: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(
        item?.[label] ?? item?.[fallbackKey ?? ""] ?? lookupKey
      );
    }
    return acc;
  }, {});

export default function UnassignedStaffPoolList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "unassigned-staff-pool",
    UNASSIGNED_STAFF_POOL_COLUMN_FIELDS
  );
  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    setProjectId,
    onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true, initialCompanyId: restoredState?.companyUniqueId, initialProjectId: restoredState?.projectId });

  const [records, setRecords] = useState<UnassignedStaffPoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);

  const [userLookup, setUserLookup] = useState<Record<string, string>>({});
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [wardLookup, setWardLookup] = useState<Record<string, string>>({});
  const [dailyTripAssignmentLookup, setDailyTripAssignmentLookup] = useState<Record<string, string>>({});

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _operator_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _driver_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _zone_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _ward_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _daily_trip_assignment_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encStaffMasters, encUnassignedStaffPool } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encStaffMasters,
    encUnassignedStaffPool,
  );

  useEffect(() => {
    let mounted = true;

    const fetchRecords = async () => {
      if (isSuperAdmin && companies.length === 0) {
        if (mounted) { setRecords([]); setLoading(false); }
        return;
      }

      if (!companyUniqueId && !isSuperAdmin) {
        if (mounted) { setRecords([]); setLoading(false); }
        return;
      }

      if (mounted) setLoading(true);
      try {
        const listParams: Record<string, string> = {};
        if (companyUniqueId) listParams.company_id = companyUniqueId;
        if (projectId) listParams.project_id = projectId;

        const [poolRes, userRes, zoneRes, wardRes, tripRes] = await Promise.all([
          unassignedStaffPoolApi.readAll({ params: listParams }),
          userCreationApi.readAll({ params: listParams }),
          zoneApi.readAll({ params: listParams }),
          wardApi.readAll({ params: listParams }),
          dailyTripAssignmentApi.readAll({ params: listParams }),
        ]);

        const poolRows = filterByCompanyProject(normalizeList(poolRes), companyUniqueId, projectId);
        const userRows = filterByCompanyProject(normalizeList(userRes), companyUniqueId, projectId);
        const zoneRows = filterByCompanyProject(normalizeList(zoneRes), companyUniqueId, projectId);
        const wardRows = filterByCompanyProject(normalizeList(wardRes), companyUniqueId, projectId);
        const tripRows = filterByCompanyProject(normalizeList(tripRes), companyUniqueId, projectId);

        const uLookup = buildLookup(userRows, "unique_id", "staff_name", "unique_id");
        const znLookup = buildLookup(zoneRows, "unique_id", "name");
        const wLookup = buildLookup(wardRows, "unique_id", "name");
        const tLookup = buildLookup(tripRows, "unique_id", "trip_no");

        const enriched = poolRows.map((rec: any) => ({
          ...rec,
          _operator_name: rec.operator_id ? (uLookup[rec.operator_id] ?? rec.operator_id) : "",
          _driver_name: rec.driver_id ? (uLookup[rec.driver_id] ?? rec.driver_id) : "",
          _zone_name: znLookup[rec.zone_id] ?? rec.zone_id,
          _ward_name: wLookup[rec.ward_id] ?? rec.ward_id,
          _daily_trip_assignment_name: rec.daily_trip_assignment_id ? (tLookup[rec.daily_trip_assignment_id] ?? rec.daily_trip_assignment_id) : "",
        }));

        if (mounted) {
          setRecords(enriched);
          setUserLookup(uLookup);
          setZoneLookup(znLookup);
          setWardLookup(wLookup);
          setDailyTripAssignmentLookup(tLookup);
        }
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchRecords();

    return () => { mounted = false; };
  }, [companyUniqueId, companies.length, isSuperAdmin, projectId, t]);

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

  const statusBodyTemplate = (row: UnassignedStaffPoolRecord) => {
    const updateStatus = async (checked: boolean) => {
      setPendingStatusId(row.id);
      setIsUpdating(true);
      try {
        await unassignedStaffPoolApi.update(row.id, filterPayload({ status: checked ? "AVAILABLE" : "ASSIGNED" }));
        setRecords((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, status: checked ? "AVAILABLE" : "ASSIGNED" } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={row.status === "AVAILABLE"}
        disabled={isUpdating && pendingStatusId === row.id}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const resolveDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : "-";

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.unassigned_staff_pool.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.unassigned_staff_pool.list_subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={companyUniqueId || ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.value} value={company.value}>
                {company.label}
              </option>
            ))}
          </select>

          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.value} value={project.value}>
                {project.label}
              </option>
            ))}
          </select>

          <Button
            label={t("admin.unassigned_staff_pool.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !projectId}
            onClick={() =>
              navigate(
                `${ENC_NEW_PATH}?company_unique_id=${encodeURIComponent(
                  companyUniqueId
                )}&project_id=${encodeURIComponent(projectId)}`
              )
            }
          />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.unassigned_staff_pool.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  const actionTemplate = (row: UnassignedStaffPoolRecord) => (
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
        onFilter={onFilter}
        globalFilterFields={[
          ...(showCol("operator") ? ["_operator_name"] : []),
          ...(showCol("driver") ? ["_driver_name"] : []),
          ...(showCol("zone") ? ["_zone_name"] : []),
          ...(showCol("ward") ? ["_ward_name"] : []),
          ...(showCol("status") ? ["status"] : []),
          ...(showCol("daily_trip_assignment") ? ["_daily_trip_assignment_name"] : []),
          "company_name",
          "project_name",
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.unassigned_staff_pool.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />

        {showCol("operator") && (
          <Column
            field="_operator_name"
            header={t("admin.unassigned_staff_pool.operator")}
            body={(row: UnassignedStaffPoolRecord) =>
              row.operator_id ? userLookup[row.operator_id] ?? row.operator_id : "-"
            }
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("driver") && (
          <Column
            field="_driver_name"
            header={t("admin.unassigned_staff_pool.driver")}
            body={(row: UnassignedStaffPoolRecord) =>
              row.driver_id ? userLookup[row.driver_id] ?? row.driver_id : "-"
            }
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("zone") && (
          <Column
            field="_zone_name"
            header={t("admin.unassigned_staff_pool.zone")}
            body={(row: UnassignedStaffPoolRecord) =>
              zoneLookup[row.zone_id] ?? row.zone_id
            }
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("ward") && (
          <Column
            field="_ward_name"
            header={t("admin.unassigned_staff_pool.ward")}
            body={(row: UnassignedStaffPoolRecord) =>
              wardLookup[row.ward_id] ?? row.ward_id
            }
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("status") && (
          <Column
            field="status"
            header={t("admin.unassigned_staff_pool.status")}
            body={statusBodyTemplate}
            style={{ width: 120 }}
          />
        )}

        {showCol("daily_trip_assignment") && (
          <Column
            field="_daily_trip_assignment_name"
            header={t("admin.unassigned_staff_pool.daily_trip_assignment")}
            body={(row: UnassignedStaffPoolRecord) =>
              row.daily_trip_assignment_id
                ? dailyTripAssignmentLookup[row.daily_trip_assignment_id] ?? row.daily_trip_assignment_id
                : "-"
            }
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("created_at") && (
          <Column
            header={t("admin.unassigned_staff_pool.created_at")}
            body={(row: UnassignedStaffPoolRecord) => resolveDateTime(row.created_at)}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: 120 }}
        />
      </DataTable>
    </div>
  );
}
