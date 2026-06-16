import type { CityRecord } from "./types";
import { appendRouteQuery, createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { cityApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";


const CITY_COLUMN_FIELDS: Record<string, string[]> = {
  country_name: ["country_id"],
  state_name: ["state_id"],
  district_name: ["district_id"],
  name: ["name"],
  is_active: ["is_active"],
};


const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export default function CityList() {
  const { t } = useTranslation();
  const { showColumn: showCol } = useFieldVisibility(
    "masters",
    "cities",
    CITY_COLUMN_FIELDS,
  );

  const [allCities, setAllCities] = useState<CityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    country_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    state_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    district_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
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

  const { encMasters, encCities } = getEncryptedRoute();

  const { newPath: cityNewPath, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encCities,
  );
  const ENC_NEW_PATH = (companyId?: string | null, selectedProjectId?: string | null) =>
    appendRouteQuery(cityNewPath, {
      company_unique_id: companyId,
      project_id: selectedProjectId,
    });

  useEffect(() => {
    let mounted = true;

    const loadCities = async () => {
      setIsLoading(true);
      try {
        const data = await cityApi.readAll();
        if (mounted) setAllCities(data as CityRecord[]);
      } catch (error) {
        if (mounted) {
          const errorData = (error as { response?: { data?: unknown } })?.response?.data;
          Swal.fire({ icon: "error", title: t("common.error"), text: String(errorData ?? error) });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadCities();

    return () => {
      mounted = false;
    };
  }, [t]);

  const cities = useMemo(() => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];

    return allCities.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

      const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;

      return companyMatches && projectMatches;
    });
  }, [allCities, companyUniqueId, companies.length, isSuperAdmin, projectId]);

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters);
  };

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
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.city"),
      }),
    });

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const updateStatus = async (city: CityRecord, checked: boolean) => {
    const cityId = String(city.unique_id);
    setPendingStatusId(cityId);
    setIsUpdating(true);

    try {
      await cityApi.update(city.unique_id, { is_active: checked });
      setAllCities((current) =>
        current.map((item) =>
          item.unique_id === city.unique_id ? { ...item, is_active: checked } : item
        )
      );
    } catch (error) {
      console.error("Status update failed:", error);
    } finally {
      setPendingStatusId(null);
      setIsUpdating(false);
    }
  };

  const statusTemplate = (city: CityRecord) => (
    <Switch checked={city.is_active} disabled={isUpdating && pendingStatusId === String(city.unique_id)} onCheckedChange={(checked) => void updateStatus(city, checked)} />
  );

  const actionTemplate = (city: CityRecord) => (
    <div className="flex gap-3">
      <button
        onClick={() =>
          navigate(ENC_EDIT_PATH(city.unique_id), {
            state: {
              city,
              companyUniqueId: city.company_id ?? city.company_unique_id,
              projectId: city.project_id ?? city.project_unique_id,
            },
          })
        }
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>

      {/* <button
        onClick={() => handleDelete(city.unique_id)}
        className="text-red-600 hover:text-red-800"
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  const indexTemplate = (_: CityRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  return (
    <div className="p-3">
   
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.city")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", { item: t("admin.nav.city") })}
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
              label={t("common.add_item", { item: t("admin.nav.city") })}
              icon="pi pi-plus"
              className="p-button-success"
              disabled={!companyUniqueId || !projectId}
              onClick={() =>
                navigate(ENC_NEW_PATH(companyUniqueId, projectId), {
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
          value={cities}
          dataKey="unique_id"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={isLoading && cities.length === 0}
          filters={filters}
          onFilter={onFilter}
          header={renderHeader()}
          stripedRows
          showGridlines
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.city"),
          })}
          globalFilterFields={[
            "name",
            "country_name",
            "state_name",
            "district_name",
            "company_name",
            "project_name",
          ]}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
          {showCol("country_name") && (
            <Column
              field="country_name"
              header={t("admin.nav.country")}
              body={(r) => cap(r.country_name)}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}
          {showCol("state_name") && (
            <Column
              field="state_name"
              header={t("admin.nav.state")}
              body={(r) => cap(r.state_name)}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}
          {showCol("district_name") && (
            <Column
              field="district_name"
              header={t("admin.nav.district")}
              body={(r) => cap(r.district_name)}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}
          {showCol("name") && (
            <Column
              field="name"
              header={t("admin.nav.city")}
              body={(r) => cap(r.name)}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}
          {showCol("is_active") && (
            <Column header={t("common.status")} body={statusTemplate} />
          )}
          <Column header={t("common.actions")} body={actionTemplate} />
        </DataTable>

    </div>
  );
}
