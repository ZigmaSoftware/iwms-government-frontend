import type { VehicleTypeRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { vehicleTypeApi } from "@/helpers/admin";

// ─── Types ────────────────────────────────────────────────────────────────────


const VEHICLE_TYPE_COLUMN_FIELDS: Record<string, string[]> = {
  vehicleType: ["vehicleType", "vehicle_type"],
  company_name: ["company_id", "company_name", "company"],
  project_name: ["project_id", "project_name", "project"],
  is_active: ["is_active", "status", "active_status"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const cap = (str?: string | null) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function VehicleTypeCreationList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-type",
    VEHICLE_TYPE_COLUMN_FIELDS
  );

  const [allVehicleTypes, setAllVehicleTypes] = useState<VehicleTypeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    vehicleType: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    company_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    project_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  // ── Company / project selection ───────────────────────────────────────────
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

  // ── Routes ────────────────────────────────────────────────────────────────
  const { encTransportMaster, encVehicleType } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encVehicleType,
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    vehicleTypeApi.readAll()
      .then((data: unknown) => {
        if (mounted) setAllVehicleTypes(Array.isArray(data) ? (data as VehicleTypeRecord[]) : []);
      })
      .catch((error: unknown) => {
        if (mounted) {
          Swal.fire({ icon: "error", title: t("common.error"), text: String(error) });
        }
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  // ── Derived rows with client-side company/project filter ──────────────────
  const rows = (() => {
    if (isSuperAdmin && companies.length === 0) return [] as VehicleTypeRecord[];
    if (!companyUniqueId && !isSuperAdmin) return [] as VehicleTypeRecord[];

    return allVehicleTypes.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
      const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;
      return companyMatches && projectMatches;
    });
  })();

  // ── Filter handlers ───────────────────────────────────────────────────────
  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

  // ── Status toggle ─────────────────────────────────────────────────────────
  const statusTemplate = (row: VehicleTypeRecord) => {
    const updateStatus = async (value: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await vehicleTypeApi.update(
          row.unique_id,
          filterPayload({
            vehicleType: row.vehicleType,
            description: row.description,
            is_active: value,
          }) as Record<string, unknown>
        );
        setAllVehicleTypes((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error) {
        console.error("Failed to update vehicle type status:", error);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={updateStatus}
      />
    );
  };

  // ── Action buttons ────────────────────────────────────────────────────────
  const actionTemplate = (row: VehicleTypeRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() =>
          navigate(ENC_EDIT_PATH(row.unique_id), {
            state: { companyUniqueId, projectId },
          })
        }
        className="text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (
    _: VehicleTypeRecord,
    { rowIndex }: { rowIndex: number }
  ) => rowIndex + 1;

  // ── Table header ──────────────────────────────────────────────────────────
  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.vehicle_type.search_placeholder"),
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.vehicle_type.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.vehicle_type.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Company filter */}
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

          {/* Project filter */}
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

          {/* Add button */}
          <Button
            label={t("admin.vehicle_type.add")}
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && rows.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        globalFilterFields={[
          ...(showCol("vehicleType") ? ["vehicleType"] : []),
          ...(showCol("company_name") ? ["company_name"] : []),
          ...(showCol("project_name") ? ["project_name"] : []),
        ]}
        emptyMessage={t("admin.vehicle_type.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />

        {showCol("vehicleType") && (
          <Column
            field="vehicleType"
            header={t("admin.vehicle_type.label")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: VehicleTypeRecord) => cap(row.vehicleType)}
            style={{ minWidth: "200px" }}
          />
        )}

        {showCol("company_name") && (
          <Column
            field="company_name"
            header={t("admin.nav.company")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: VehicleTypeRecord) => cap(row.company_name)}
          />
        )}

        {showCol("project_name") && (
          <Column
            field="project_name"
            header={t("admin.nav.project")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: VehicleTypeRecord) => cap(row.project_name)}
          />
        )}

        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "140px" }}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
