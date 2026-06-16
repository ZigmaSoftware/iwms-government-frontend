import type { Project, TableFilters } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { appendRouteQuery, createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { projectApi } from "@/helpers/admin";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";


const normalizeIsActive = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return true;
};

const { encSuperAdminMaster: encSuperAdminMasters, encProjectCreation } = getEncryptedRoute();

const {
  listPath: ENC_LIST_PATH,
  newPath: PROJECT_NEW_PATH,
  editPath: projectEditPath,
} = createCrudRoutePaths(encSuperAdminMasters, encProjectCreation);
const ENC_NEW_PATH = (companyUniqueId?: string | null) =>
  appendRouteQuery(PROJECT_NEW_PATH, { company_unique_id: companyUniqueId });
const ENC_EDIT_PATH = (id: string, companyUniqueId?: string | null) =>
  appendRouteQuery(projectEditPath(id), { company_unique_id: companyUniqueId });

export default function ProjectListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const companyUniqueId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("company_unique_id");
  }, [location.search]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    company_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    company_unique_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    description: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectApi.readAll({
        params: companyUniqueId ? { company_unique_id: companyUniqueId } : undefined,
      });
      const normalized = Array.isArray(data)
        ? data.map((project) => ({
            ...project,
            is_active: normalizeIsActive(project?.is_active),
          }))
        : [];
      setProjects(normalized);
    } catch {
      Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  }, [companyUniqueId, t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...filters };
    updated.global.value = e.target.value;
    setFilters(updated);
    setGlobalFilterValue(e.target.value);
  };

  const actionBodyTemplate = (row: Project) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id, companyUniqueId))}
        className="text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const statusBodyTemplate = (row: Project) => {
    const updateStatus = async (checked: boolean) => {
      setUpdatingStatusId(row.unique_id);
      try {
        await projectApi.update(row.unique_id, { is_active: checked });
        setProjects((prev) =>
          prev.map((project) =>
            project.unique_id === row.unique_id
              ? { ...project, is_active: checked }
              : project
          )
        );
      } catch (error: unknown) {
        const axiosError = error as { response?: { data?: unknown } };
        const errorData = axiosError.response?.data;
        const errorMessage =
          typeof errorData === "string"
            ? errorData
            : t("common.update_status_failed");
        Swal.fire(t("common.error"), errorMessage, "error");
      } finally {
        setUpdatingStatusId(null);
        fetchProjects();
      }
    };

    return (
      <Switch
        checked={row.is_active}
        onCheckedChange={updateStatus}
        disabled={updatingStatusId === row.unique_id}
      />
    );
  };

  const indexTemplate = (_: unknown, options: { rowIndex: number }) => options.rowIndex + 1;

  const descriptionTemplate = (row: Project) => row.description || t("common.not_available");

  const header = (
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-end">
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("common.search_placeholder", { item: t("admin.nav.project") })}
          className="p-inputtext-sm border-0 shadow-none"
        />
      </div>
      {companyUniqueId ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{t("admin.project.filtered_company", { id: companyUniqueId })}</span>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 font-medium"
            onClick={() => navigate(ENC_LIST_PATH)}
          >
            {t("common.view_all")}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{t("admin.nav.project")}</h1>
          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", {
              item: t("admin.nav.project"),
            })}
          </p>
        </div>

        <Button
          label={t("common.add_item", { item: t("admin.nav.project") })}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH(companyUniqueId))}
        />
      </div>

      <DataTable
        value={projects}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading}
        filters={filters}
        onFilter={onFilter}
        globalFilterFields={["name", "company_name", "company_unique_id", "description"]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

        <Column
          field="name"
          header={t("common.item_name", { item: t("admin.nav.project") })}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: "220px" }}
        />

        <Column
          field="company_name"
          header={t("admin.project.company_name")}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: "220px" }}
        />

        <Column
          field="description"
          header={t("common.description")}
          body={descriptionTemplate}
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: "240px" }}
        />

        <Column
          header={t("common.status")}
          body={statusBodyTemplate}
          style={{ width: "140px", textAlign: "center" }}
        />

        <Column
          header={t("common.actions")}
          body={actionBodyTemplate}
          style={{ width: "120px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
