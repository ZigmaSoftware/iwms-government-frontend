import type { AlternativeStaffTemplate, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const ALTERNATIVE_STAFF_TEMPLATE_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "display_code"],
  staff_template: ["staff_template", "staff_template_display_code", "staff_template_id"],
  effective_date: ["effective_date"],
  driver_name: ["driver", "driver_id", "driver_name"],
  operator_name: ["operator", "operator_id", "operator_name"],
  extra_operator: ["extra_operator", "extra_operator_id", "extra_staff"],
  change_reason: ["change_reason"],
  approval_status: ["approval_status"],
  created_at: ["created_at"],
};


export default function AlternativeStaffTemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol } = useFieldVisibility(
    "staff-masters",
    "alternative-staff-template",
    ALTERNATIVE_STAFF_TEMPLATE_COLUMN_FIELDS
  );
  const location = useLocation();
  const [searchParams] = useSearchParams();
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
    defaultToAll: true,
    initialCompanyId:
      restoredState?.companyUniqueId ?? searchParams.get("company_unique_id") ?? undefined,
    initialProjectId: restoredState?.projectId ?? searchParams.get("project_id") ?? undefined,
  });

  const [records, setRecords] = useState<AlternativeStaffTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [datatableFilters, setDatatableFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    effective_date: { value: null, matchMode: FilterMatchMode.CONTAINS },
    driver_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    operator_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    change_reason: { value: null, matchMode: FilterMatchMode.CONTAINS },
    approval_status: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encScheduleMasters, encAlternativeStaffTemplate } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encAlternativeStaffTemplate,
  );
  const selectedProjectId =
    projectId && projects.some((project) => project.value === projectId)
      ? projectId
      : "";
  const selectedContext = { companyUniqueId, projectId: selectedProjectId };

  const normalizeId = (value: unknown): string =>
    value === null || value === undefined ? "" : String(value).trim();

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
        const params = {
          company_id: companyUniqueId,
          ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
        };
        const payload: any = await adminApi.alternativeStaffTemplate.readAll({ params });
        if (!mounted) return;
        const data =
          Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
            ? payload.data
            : payload?.data?.results ?? [];
        const rows = data as AlternativeStaffTemplate[];

        const hasContextFields = rows.some((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
          return Boolean(rowCompanyId || rowProjectId);
        });

        if (!hasContextFields) {
          setRecords(rows);
          return;
        }

        const filtered = rows.filter((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
          const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
          const projectMatches = !selectedProjectId || rowProjectId === selectedProjectId;
          return companyMatches && projectMatches;
        });

        setRecords(filtered);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchRecords();

    return () => { mounted = false; };
  }, [companyUniqueId, companies.length, isSuperAdmin, selectedProjectId, t]);

  const onFilter = (e: DataTableFilterEvent) => {
    setDatatableFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setDatatableFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.alternative_staff_template.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.alternative_staff_template.list_subtitle")}
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
            value={selectedProjectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.value} value={project.value}>
                {project.label || project.value}
              </option>
            ))}
          </select>

          <Button
            label={t("admin.alternative_staff_template.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !selectedProjectId}
            onClick={() =>
              navigate(
                `${ENC_NEW_PATH}?company_unique_id=${encodeURIComponent(
                  companyUniqueId
                )}&project_id=${encodeURIComponent(selectedProjectId)}`
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
            placeholder={t("admin.alternative_staff_template.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  const indexTemplate = (_: AlternativeStaffTemplate, { rowIndex }: any) =>
    rowIndex + 1;

  const actionTemplate = (row: AlternativeStaffTemplate) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() =>
          navigate(`${ENC_EDIT_PATH(row.unique_id)}?company_unique_id=${encodeURIComponent(
            companyUniqueId
          )}&project_id=${encodeURIComponent(selectedProjectId)}`, {
            state: { record: row, ...selectedContext },
          })
        }
        className="text-blue-600 hover:text-blue-800"
      >
        <i className="pi pi-pencil" />
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        value={records}
        paginator
        rows={10}
        loading={loading}
        filters={datatableFilters}
        onFilter={onFilter}
        globalFilterFields={[
          ...(showCol("unique_id") ? ["unique_id", "display_code"] : []),
          ...(showCol("staff_template") ? ["staff_template", "staff_template_display_code"] : []),
          ...(showCol("driver_name") ? ["driver", "driver_name"] : []),
          ...(showCol("operator_name") ? ["operator", "operator_name"] : []),
          ...(showCol("change_reason") ? ["change_reason"] : []),
          ...(showCol("approval_status") ? ["approval_status"] : []),
          "company_name",
          "project_name",
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.alternative_staff_template.empty_message")}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 70 }} />

        {showCol("unique_id") && (
          <Column
            header={t("admin.alternative_staff_template.columns.template_id")}
            body={(row: AlternativeStaffTemplate) => row.display_code ?? row.unique_id}
            sortable
          />
        )}

        {showCol("staff_template") && (
          <Column
            header={t("admin.alternative_staff_template.columns.staff_template")}
            body={(row: AlternativeStaffTemplate) =>
              row.staff_template_display_code ?? row.staff_template
            }
          />
        )}

        {/* {showCol("effective_date") && (
          <Column
            field="effective_date"
            header={t("admin.alternative_staff_template.columns.effective_date")}
            filter
            showFilterMatchModes={false}
          />
        )} */}

        {showCol("driver_name") && (
          <Column
            field="driver_name"
            header={t("admin.alternative_staff_template.columns.driver")}
            body={(row: AlternativeStaffTemplate) => row.driver_name ?? row.driver}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("operator_name") && (
          <Column
            field="operator_name"
            header={t("admin.alternative_staff_template.columns.operator")}
            body={(row: AlternativeStaffTemplate) => row.operator_name ?? row.operator}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("extra_operator") && (
          <Column
            header={t("admin.alternative_staff_template.columns.extra_operator")}
            body={(row: AlternativeStaffTemplate) => {
              const names = Array.isArray(row.extra_operator_names)
                ? row.extra_operator_names
                : [];
              if (names.length) return names.join(", ");
              if (Array.isArray(row.extra_operator)) return row.extra_operator.join(", ");
              return row.extra_operator || "-";
            }}
          />
        )}

        {showCol("change_reason") && (
          <Column
            field="change_reason"
            header={t("admin.alternative_staff_template.columns.change_reason")}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("approval_status") && (
          <Column
            field="approval_status"
            header={t("admin.alternative_staff_template.columns.approval_status")}
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("created_at") && (
          <Column
            header={t("common.created_at")}
            body={(r: AlternativeStaffTemplate) =>
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
