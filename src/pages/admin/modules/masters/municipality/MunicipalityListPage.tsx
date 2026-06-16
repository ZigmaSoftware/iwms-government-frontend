import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { municipalityApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { MunicipalityListRecord } from "./types";

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const MUNICIPALITY_COLUMN_FIELDS: Record<string, string[]> = {
  municipality_name: ["municipality_name", "name"],
  state_name: ["state_id", "state", "state_name"],
  district_name: ["district_id", "district", "district_name"],
  is_active: ["is_active"],
};

export default function MunicipalityListPage() {
  const { t } = useTranslation();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "municipalities",
    MUNICIPALITY_COLUMN_FIELDS,
  );
  const [allMunicipalities, setAllMunicipalities] = useState<MunicipalityListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    municipality_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    state_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    district_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId, projectId, projects, companies, isSuperAdmin, setProjectId, onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true,
    initialCompanyId: restoredState?.companyUniqueId,
    initialProjectId: restoredState?.projectId,
  });

  const navigate = useNavigate();
  const { encMasters, encMunicipalities } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encMunicipalities,
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await municipalityApi.readAll();
        if (mounted) setAllMunicipalities(data as MunicipalityListRecord[]);
      } catch (error) {
        if (mounted) Swal.fire({ icon: "error", title: t("common.error"), text: String(error) });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [t]);

  const data = ((): MunicipalityListRecord[] => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];
    return (Array.isArray(allMunicipalities) ? allMunicipalities : []).filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
      return (!companyUniqueId || rowCompanyId === companyUniqueId) &&
             (!projectId || rowProjectId === projectId);
    });
  })();

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: "Search Municipality...",
    });

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const actionTemplate = (row: MunicipalityListRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const statusTemplate = (row: MunicipalityListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      setIsUpdating(true);
      try {
        await municipalityApi.update(row.unique_id, filterPayload({ is_active: value }) as { is_active: boolean });
        setAllMunicipalities((current) =>
          current.map((item) => item.unique_id === row.unique_id ? { ...item, is_active: value } : item)
        );
      } catch (error) {
        console.error("Failed to update municipality status", error);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };
    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === String(row.unique_id)}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const indexTemplate = (_: MunicipalityListRecord, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Municipality</h1>
          <p className="text-sm text-gray-500">Manage Municipality records</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={companyUniqueId || ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <Button
            label="Add Municipality"
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={data}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && data.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage="No municipalities found."
        globalFilterFields={["municipality_name", "state_name", "district_name", "company_name", "project_name"]}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("municipality_name") && (
          <Column field="municipality_name" header="Municipality" sortable filter showFilterMatchModes={false}
            body={(row: MunicipalityListRecord) => cap(row.municipality_name)} />
        )}
        {showCol("district_name") && (
          <Column field="district_name" header={t("common.district")} sortable filter showFilterMatchModes={false}
            body={(row: MunicipalityListRecord) => cap(row.district_name)} />
        )}
        {showCol("state_name") && (
          <Column field="state_name" header={t("common.state")} sortable filter showFilterMatchModes={false}
            body={(row: MunicipalityListRecord) => cap(row.state_name)} />
        )}
        {showCol("is_active") && (
          <Column header={t("common.status")} body={statusTemplate} style={{ width: "140px" }} />
        )}
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: "150px", textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
