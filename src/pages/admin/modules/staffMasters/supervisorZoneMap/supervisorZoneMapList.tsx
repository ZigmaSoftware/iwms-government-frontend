import type { SupervisorZoneMapRecord, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const SUPERVISOR_ZONE_MAP_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "mapping_id"],
  supervisor: ["supervisor_id", "supervisor"],
  district: ["district_id", "district"],
  city: ["city_id", "city"],
  zones: ["zone_ids", "zones", "zone_id"],
  status: ["status"],
  created_at: ["created_at"],
};


const normalizeList = (payload: unknown): any[] =>
  Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.data)
    ? (payload as any).data
    : (payload as any)?.results ?? [];

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

const buildLookup = (items: any[], key: string, label: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? lookupKey);
    }
    return acc;
  }, {});

export default function SupervisorZoneMapList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "supervisor-zone-map",
    SUPERVISOR_ZONE_MAP_COLUMN_FIELDS
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

  const [records, setRecords] = useState<SupervisorZoneMapRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _supervisor_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _district_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _city_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _zone_names: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const [districtLookup, setDistrictLookup] = useState<Record<string, string>>({});
  const [cityLookup, setCityLookup] = useState<Record<string, string>>({});
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [supervisorLookup, setSupervisorLookup] = useState<Record<string, string>>({});

  const { encStaffMasters, encSupervisorZoneMap } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encStaffMasters,
    encSupervisorZoneMap,
  );

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (isSuperAdmin && companies.length === 0) {
        if (mounted) {
          setRecords([]);
          setIsLoading(false);
        }
        return;
      }

      if (!companyUniqueId && !isSuperAdmin) {
        if (mounted) {
          setRecords([]);
          setIsLoading(false);
        }
        return;
      }

      if (mounted) setIsLoading(true);

      try {
        const [mapRes, districtRes, cityRes, zoneRes, userRes] = await Promise.all([
          adminApi.supervisorZoneMap.readAll(),
          adminApi.districts.readAll(),
          adminApi.cities.readAll(),
          adminApi.zones.readAll(),
          adminApi.usersCreation.readAll(),
        ]);

        if (!mounted) return;

        const mapRows = filterByCompanyProject(normalizeList(mapRes), companyUniqueId, projectId);
        const districtRows = filterByCompanyProject(normalizeList(districtRes), companyUniqueId, projectId);
        const cityRows = filterByCompanyProject(normalizeList(cityRes), companyUniqueId, projectId);
        const zoneRows = filterByCompanyProject(normalizeList(zoneRes), companyUniqueId, projectId);
        const userRows = filterByCompanyProject(normalizeList(userRes), companyUniqueId, projectId);

        const users = userRows.filter(
          (u: any) =>
            u?.user_type_name?.toLowerCase() === "staff" &&
            String(u?.staffusertype_name ?? "").trim().toLowerCase() === "supervisor"
        );

        const dLookup = buildLookup(districtRows, "unique_id", "name");
        const cLookup = buildLookup(cityRows, "unique_id", "name");
        const zLookup = buildLookup(zoneRows, "unique_id", "zone_name");
        const sLookup = buildLookup(normalizeList(users), "unique_id", "employee_name");

        const enriched = mapRows.map((rec: any) => ({
          ...rec,
          _supervisor_name: sLookup[rec.supervisor_id] ?? rec.supervisor_id ?? "",
          _district_name: rec.district_id ? (dLookup[String(rec.district_id)] ?? rec.district_id) : "",
          _city_name: rec.city_id ? (cLookup[String(rec.city_id)] ?? rec.city_id) : "",
          _zone_names: Array.isArray(rec.zone_ids)
            ? rec.zone_ids.map((z: string) => zLookup[String(z)] ?? z).join(", ")
            : "",
        }));

        setRecords(enriched);
        setDistrictLookup(dLookup);
        setCityLookup(cLookup);
        setZoneLookup(zLookup);
        setSupervisorLookup(sLookup);
      } catch {
        if (mounted) {
          Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [companyUniqueId, projectId, isSuperAdmin, companies.length, t]);

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

  const resolveDistrict = (row: SupervisorZoneMapRecord) =>
    row.district_id ? districtLookup[String(row.district_id)] ?? row.district_id : "-";

  const resolveCity = (row: SupervisorZoneMapRecord) =>
    row.city_id ? cityLookup[String(row.city_id)] ?? row.city_id : "-";

  const resolveSupervisor = (row: SupervisorZoneMapRecord) =>
    supervisorLookup[row.supervisor_id] ?? row.supervisor_id ?? "-";

  const resolveZones = (row: SupervisorZoneMapRecord) => {
    const zones = Array.isArray(row.zone_ids) ? row.zone_ids : [];
    if (!zones.length) return "-";
    return zones.map((zoneId) => zoneLookup[String(zoneId)] ?? zoneId).join(", ");
  };

  const statusBodyTemplate = (row: SupervisorZoneMapRecord) => {
    const updateStatus = async (checked: boolean) => {
      try {
        await adminApi.supervisorZoneMap.update(row.id, filterPayload({ status: checked ? "ACTIVE" : "INACTIVE" }));
        setRecords((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, status: checked ? "ACTIVE" : "INACTIVE" } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      }
    };

    return (
      <Switch
        checked={row.status === "ACTIVE"}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const actionTemplate = (row: SupervisorZoneMapRecord) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        {t("common.edit")}
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.supervisor_zone_map.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.supervisor_zone_map.list_subtitle")}
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
            label={t("admin.supervisor_zone_map.create_button")}
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
        loading={isLoading}
        filters={filters}
        onFilter={onFilter}
        globalFilterFields={[
          ...(showCol("unique_id") ? ["unique_id"] : []),
          ...(showCol("supervisor") ? ["_supervisor_name"] : []),
          ...(showCol("district") ? ["_district_name"] : []),
          ...(showCol("city") ? ["_city_name"] : []),
          ...(showCol("zones") ? ["_zone_names"] : []),
          "company_name",
          "project_name",
        ]}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.supervisor_zone_map.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />

        {showCol("unique_id") && (
          <Column
            field="unique_id"
            header={t("admin.supervisor_zone_map.mapping_id")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("supervisor") && (
          <Column
            field="_supervisor_name"
            header={t("admin.supervisor_zone_map.supervisor")}
            body={resolveSupervisor}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("district") && (
          <Column
            field="_district_name"
            header={t("admin.supervisor_zone_map.district")}
            body={resolveDistrict}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("city") && (
          <Column
            field="_city_name"
            header={t("admin.supervisor_zone_map.city")}
            body={resolveCity}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("zones") && (
          <Column
            field="_zone_names"
            header={t("admin.supervisor_zone_map.zones")}
            body={resolveZones}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("status") && (
          <Column
            header={t("common.status")}
            body={statusBodyTemplate}
            style={{ width: 120 }}
          />
        )}

        {showCol("created_at") && (
          <Column
            header={t("common.created_at")}
            body={(r: SupervisorZoneMapRecord) =>
              r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"
            }
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
