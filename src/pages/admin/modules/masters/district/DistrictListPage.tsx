import type { DistrictApiRow } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { useTranslation } from "react-i18next";
import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { districtApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { DistrictListRecord } from "./types";

/**
 * Maps each DataTable column to the backend field names that control its visibility.
 * A column is shown if allowed is null (no restrictions) OR if any of its fieldNames
 * are present in the allowed set.
 */
const DISTRICT_COLUMN_FIELDS: Record<string, string[]> = {
  countryName: ["country_id"],
  stateName: ["state_id"],
  name: ["name"],
  is_active: ["is_active"],
};


const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export default function DistrictListPage() {
  const { t } = useTranslation();
  const { showColumn: showCol } = useFieldVisibility(
    "masters",
    "districts",
    DISTRICT_COLUMN_FIELDS,
  );

  const [allDistricts, setAllDistricts] = useState<DistrictApiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    countryName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    stateName:   { value: null, matchMode: FilterMatchMode.CONTAINS },
    name:        { value: null, matchMode: FilterMatchMode.CONTAINS },
    is_active:   { value: null, matchMode: FilterMatchMode.EQUALS },
  });
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

  const navigate = useNavigate();
  const { encMasters, encDistricts } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encDistricts,
  );

  useEffect(() => {
    let mounted = true;

    const loadDistricts = async () => {
      setIsLoading(true);
      try {
        const data = await districtApi.readAll();
        if (mounted) setAllDistricts(data as DistrictApiRow[]);
      } catch (error) {
        if (mounted) {
          const errorData = (error as { response?: { data?: unknown } })?.response?.data;
          Swal.fire({ icon: "error", title: t("common.error"), text: String(errorData ?? error) });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadDistricts();

    return () => {
      mounted = false;
    };
  }, [t]);

  const districts = ((): DistrictListRecord[] => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];

    const rows: DistrictApiRow[] = Array.isArray(allDistricts)
      ? (allDistricts as unknown as DistrictApiRow[])
      : [];
    const mapped: DistrictListRecord[] = rows.map((d) => ({
      unique_id: String(d.unique_id ?? ""),
      countryName: String(d.country_name ?? ""),
      stateName: String(d.state_name ?? ""),
      name: String(d.name ?? ""),
      is_active: Boolean(d.is_active),
      company_id: d.company_id ? String(d.company_id) : undefined,
      company_unique_id: d.company_unique_id ? String(d.company_unique_id) : undefined,
      company_name: d.company_name ? String(d.company_name) : undefined,
      project_id: d.project_id ? String(d.project_id) : undefined,
      project_unique_id: d.project_unique_id ? String(d.project_unique_id) : undefined,
      project_name: d.project_name ? String(d.project_name) : undefined,
    }));

    const filtered = mapped.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

      const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;

      return companyMatches && projectMatches;
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  })();

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", { item: t("admin.nav.district") }),
    });

  type TextFilterOptions = {
    value?: string | null;
    filterApplyCallback: (value: string | null) => void;
  };

  const textFilterElement = (options: TextFilterOptions) => (
    <InputText
      value={options.value ?? ""}
      onChange={(e) => options.filterApplyCallback(e.target.value)}
      placeholder="Search..."
      className="p-inputtext-sm w-full"
      autoFocus
    />
  );

  const updateStatus = async (row: DistrictListRecord, checked: boolean) => {
    const id = String(row.unique_id);
    setPendingStatusId(id);
    setIsUpdating(true);

    try {
      await districtApi.update(row.unique_id, { is_active: checked });
      setAllDistricts((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id ? { ...item, is_active: checked } : item
        )
      );
    } catch (e) {
      console.error("Toggle update failed:", e);
    } finally {
      setPendingStatusId(null);
      setIsUpdating(false);
    }
  };

  const statusTemplate = (row: DistrictListRecord) => (
    <Switch checked={row.is_active} disabled={isUpdating && pendingStatusId === String(row.unique_id)} onCheckedChange={(checked) => void updateStatus(row, checked)} />
  );
  

  const actionTemplate = (row: DistrictListRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() =>
          navigate(ENC_EDIT_PATH(row.unique_id), {
            state: {
              district: row,
              companyUniqueId: row.company_id ?? row.company_unique_id,
              projectId: row.project_id ?? row.project_unique_id,
            },
          })
        }
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: DistrictListRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.district")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", { item: t("admin.nav.district") })}
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
            label={t("common.add_item", { item: t("admin.nav.district") })}
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() =>
              navigate(ENC_NEW_PATH, {
                state: {
                  companyUniqueId,
                  projectId,
                },
              })
            }
          />
        </div>
      </div>

      <DataTable
        value={districts}
        dataKey="unique_id"
        loading={isLoading && districts.length === 0}
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={(e) => setFilters(e.filters)}
        filterDisplay="menu"
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", { item: t("admin.nav.district") })}
        globalFilterFields={["name", "countryName", "stateName", "company_name", "project_name"]}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        {showCol("countryName") && (
          <Column
            field="countryName"
            header={t("admin.nav.country")}
            body={(row) => cap(row.countryName)}
            sortable
            filter
            filterField="countryName"
            filterElement={textFilterElement}
            filterPlaceholder="Search country"
          />
        )}
        {showCol("stateName") && (
          <Column
            field="stateName"
            header={t("admin.nav.state")}
            body={(row) => cap(row.stateName)}
            sortable
            filter
            filterField="stateName"
            filterElement={textFilterElement}
            filterPlaceholder="Search state"
          />
        )}
        {showCol("name") && (
          <Column
            field="name"
            header={t("admin.nav.district")}
            body={(row) => cap(row.name)}
            sortable
            filter
            filterField="name"
            filterElement={textFilterElement}
            filterPlaceholder="Search district"
          />
        )}
        {showCol("is_active") && (
          <Column
            field="is_active"
            header={t("common.status")}
            body={statusTemplate}
          />
        )}
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "100px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
