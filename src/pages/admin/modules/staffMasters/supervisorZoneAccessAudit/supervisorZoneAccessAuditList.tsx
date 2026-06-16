import type { SupervisorZoneAccessAuditRecord } from "./types";
import type { TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const buildLookup = (items: any[], key: string, label: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? lookupKey);
    }
    return acc;
  }, {});

export default function SupervisorZoneAccessAuditList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const auditApi = adminApi.supervisorZoneAccessAudits;
  const zoneApi = adminApi.zones;
  const userCreationApi = adminApi.usersCreation;

  const [records, setRecords] = useState<SupervisorZoneAccessAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  // const [filters, setFilters] = useState<any>({
  //   global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  // });

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    supervisor_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    performed_by: { value: null, matchMode: FilterMatchMode.CONTAINS },
    performed_role: { value: null, matchMode: FilterMatchMode.CONTAINS },
    remarks: { value: null, matchMode: FilterMatchMode.CONTAINS },
    old_zone_ids: { value: null, matchMode: FilterMatchMode.CONTAINS },
    new_zone_ids: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [userLookup, setUserLookup] = useState<Record<string, string>>({});

  const { encStaffMasters, encSupervisorZoneAccessAudit } = getEncryptedRoute();
  const { editPath: ENC_VIEW_PATH } = createCrudRoutePaths(encStaffMasters, encSupervisorZoneAccessAudit);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [auditRes, zoneRes, userRes] = await Promise.all([
        auditApi.readAll(),
        zoneApi.readAll(),
        userCreationApi.readAll(),
      ]);

      const users = normalizeList(userRes).filter(
        (u: any) => u?.user_type_name?.toLowerCase() === "staff"
      );

      setRecords(normalizeList(auditRes));
      setZoneLookup(buildLookup(normalizeList(zoneRes), "unique_id", "name"));
      setUserLookup(buildLookup(users, "unique_id", "staff_name"));
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

  const resolveUser = (id: string) => userLookup[id] ?? id ?? "-";

  const resolveZones = (zoneIds?: Array<number | string> | null) => {
    if (!Array.isArray(zoneIds) || zoneIds.length === 0) return "-";
    return zoneIds.map((zoneId) => zoneLookup[String(zoneId)] ?? zoneId).join(", ");
  };

  const actionTemplate = (row: SupervisorZoneAccessAuditRecord) => (
    <div className="flex justify-center">
      <button
        title={t("common.view")}
        onClick={() => navigate(ENC_VIEW_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        {t("common.view")}
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.supervisor_zone_access_audit.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.supervisor_zone_access_audit.list_subtitle")}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("common.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>

      <DataTable
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={["unique_id", "supervisor_id", "performed_by", "performed_role"]}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.supervisor_zone_access_audit.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column
        field="supervisor_id"
          header={t("admin.supervisor_zone_access_audit.supervisor")}
          body={(r: SupervisorZoneAccessAuditRecord) => resolveUser(r.supervisor_id)}
          filter
          showFilterMatchModes={false}
        />
        <Column
        field="performed_by"
          header={t("admin.supervisor_zone_access_audit.performed_by")}
          body={(r: SupervisorZoneAccessAuditRecord) => resolveUser(r.performed_by)}
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="performed_role"
          header={t("admin.supervisor_zone_access_audit.performed_role")}
          filter  
          showFilterMatchModes={false}
        />
        <Column
        field="old_zone_ids"
          header={t("admin.supervisor_zone_access_audit.old_zones")}
          body={(r: SupervisorZoneAccessAuditRecord) => resolveZones(r.old_zone_ids)}
          filter
          showFilterMatchModes={false}

        />
        <Column
          field="new_zone_ids"
          header={t("admin.supervisor_zone_access_audit.new_zones")}
          body={(r: SupervisorZoneAccessAuditRecord) => resolveZones(r.new_zone_ids)}
          filter
          showFilterMatchModes={false}

        />
        <Column field="remarks" header={t("admin.supervisor_zone_access_audit.remarks")} filter showFilterMatchModes={false} />
        <Column
          header={t("common.created_at")}
          body={(r: SupervisorZoneAccessAuditRecord) =>
            r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"
          }
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 120 }} />
      </DataTable>
    </div>
  );
}
