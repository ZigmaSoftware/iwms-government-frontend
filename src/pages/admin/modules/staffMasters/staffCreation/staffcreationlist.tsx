import type { Staff, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { type ChangeEvent, useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";

import { Switch } from "@/components/ui/switch";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const STAFF_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "staff_unique_id", "zigma_id"],
  employee_name: ["employee_name", "name"],
  designation: ["designation"],
  doj: ["doj", "date_of_joining"],
  site_name: ["site_name", "site"],
  salary_type: ["salary_type"],
  contact_mobile: ["contact_mobile", "mobile"],
  active_status: ["active_status", "is_active"],
  qr_code: ["qr_code"],
};


const cap = (val?: string | number | null) => {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export default function StaffCreationList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-creation",
    STAFF_CREATION_COLUMN_FIELDS
  );
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [filterParams, setFilterParams] = useState({
    salary_type: "",
    active_status: "",
    site_name: "",
    employee_name: "",
  });

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [datatableFilters, setDatatableFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    employee_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    designation: { value: null, matchMode: FilterMatchMode.CONTAINS },
    doj: { value: null, matchMode: FilterMatchMode.CONTAINS },
    site_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encStaffMasters, encStaffCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encStaffMasters,
    encStaffCreation,
  );

  const globalFilterFields = [
    "employee_name",
    "employee_id",
    "designation",
    "site_name",
    "contact_mobile",
    "company_name",
    "project_name",
  ];

  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const requestParams = {
    salary_type: filterParams.salary_type,
    active_status: filterParams.active_status,
    site_name: filterParams.site_name,
    employee_name: filterParams.employee_name,
    company_id: companyUniqueId,
    ...(projectId ? { project_id: projectId } : {}),
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (isSuperAdmin && companies.length === 0) {
        if (mounted) { setStaffs([]); setLoading(false); }
        return;
      }

      if (!companyUniqueId && !isSuperAdmin) {
        if (mounted) { setStaffs([]); setLoading(false); }
        return;
      }

      if (mounted) setLoading(true);
      try {
        const payload: any = await adminApi.staffCreation.readAll({ params: requestParams });
        if (!mounted) return;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : payload?.data?.results ?? [];
        const rows = data as Staff[];

        const hasContextFields = rows.some((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
          return Boolean(rowCompanyId || rowProjectId);
        });

        if (!hasContextFields) {
          setStaffs(rows);
          return;
        }

        const filtered = rows.filter((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

          const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
          const projectMatches = !projectId || rowProjectId === projectId;

          return companyMatches && projectMatches;
        });

        setStaffs(filtered);
      } catch (err) {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => { mounted = false; };
  }, [companyUniqueId, companies.length, isSuperAdmin, projectId, refetchTrigger]);

  const applyFilter = () => {
    setRefetchTrigger((n) => n + 1);
  };

  const handleFilterChange = (
    ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = ev.target;
    setFilterParams((prev) => ({ ...prev, [name]: value }));
  };

  const onFilter = (e: DataTableFilterEvent) => {
    setDatatableFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updated = { ...datatableFilters };
    updated.global.value = e.target.value;
    setGlobalFilterValue(e.target.value);
    setDatatableFilters(updated);
  };

  const statusTemplate = (row: Staff) => {
    const updateStatus = async (value: boolean) => {
      try {
        const formData = new FormData();
        const payload = filterPayload({ active_status: value });
        Object.entries(payload).forEach(([key, entryValue]) => {
          formData.append(key, String(entryValue));
        });

        await adminApi.staffCreation.update(row.unique_id, formData);
        setStaffs((prev) =>
          prev.map((s) =>
            s.unique_id === row.unique_id ? { ...s, active_status: value } : s
          )
        );
      } catch (err) {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      }
    };

    return (
      <Switch checked={row.active_status} onCheckedChange={updateStatus} />
    );
  };

  const openQrPopup = (qrUrl: string) => {
    Swal.fire({
      title: t("admin.staff_creation.qr_title"),
      html: `<div class="flex justify-center">
              <img src="${qrUrl}" style="width:200px;height:200px;" />
            </div>`,
      width: 350,
    });
  };

  const qrTemplate = (row: Staff) => {
    if (!row.qr_code) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded hover:bg-gray-50 flex justify-center"
        onClick={() => openQrPopup(row.qr_code!)}
        title={t("admin.staff_creation.qr_show")}
      >
        <img src={row.qr_code} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const actionTemplate = (row: Staff) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: Staff, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const header = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.staff_creation.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.staff_creation.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={companyUniqueId || ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="h-10 rounded-lg border px-3 text-sm"
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
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.value} value={project.value}>
                {project.label}
              </option>
            ))}
          </select>

          <Button
            label={t("admin.staff_creation.create")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !projectId}
            onClick={() =>
              navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })
            }
          />
        </div>
      </div>

      {/* Filters Row */}
      <div className="grid gap-3 md:grid-cols-5">
        {showCol("salary_type") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">
            {t("admin.staff_creation.salary_type")}
          </span>
          <select
            name="salary_type"
            value={filterParams.salary_type}
            onChange={handleFilterChange}
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">{t("common.all")}</option>
            <option value="Monthly">{t("admin.staff_creation.salary_monthly")}</option>
            <option value="Daily">{t("admin.staff_creation.salary_daily")}</option>
            <option value="Contract">{t("admin.staff_creation.salary_contract")}</option>
          </select>
        </div>
        )}

        {showCol("active_status") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">{t("common.status")}</span>
          <select
            name="active_status"
            value={filterParams.active_status}
            onChange={handleFilterChange}
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">{t("common.all")}</option>
            <option value="1">{t("common.active")}</option>
            <option value="0">{t("common.inactive")}</option>
          </select>
        </div>
        )}

        {showCol("site_name") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">
            {t("admin.staff_creation.site_name")}
          </span>
          <input
            name="site_name"
            value={filterParams.site_name}
            onChange={handleFilterChange}
            placeholder={t("admin.staff_creation.site_placeholder")}
            className="h-10 rounded-lg border px-3 text-sm"
          />
        </div>
        )}

        {showCol("employee_name") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">
            {t("admin.staff_creation.employee_name")}
          </span>
          <input
            name="employee_name"
            value={filterParams.employee_name}
            onChange={handleFilterChange}
            placeholder={t("admin.staff_creation.employee_placeholder")}
            className="h-10 rounded-lg border px-3 text-sm"
          />
        </div>
        )}

        <div className="flex items-end">
          <button
            onClick={applyFilter}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("common.go")}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.staff_creation.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="p-3">
        <DataTable
          value={staffs}
          paginator
          rows={10}
          loading={loading}
          filters={datatableFilters}
          onFilter={onFilter}
          globalFilterFields={globalFilterFields}
          header={header}
          emptyMessage={t("common.no_items_found", {
            item: t("admin.staff_creation.staff_label"),
          })}
          stripedRows
          showGridlines
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 70 }} />

          {showCol("unique_id") && (
            <Column
              field="unique_id"
              header={t("admin.staff_creation.zigma_id")}
              sortable
              body={(row: Staff) => cap(row.unique_id)}
            />
          )}

          {showCol("employee_name") && (
            <Column
              field="employee_name"
              header={t("admin.staff_creation.employee_name")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row: Staff) => cap(row.employee_name)}
            />
          )}

          {showCol("designation") && (
            <Column
              field="designation"
              header={t("admin.staff_creation.designation")}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}

          {showCol("doj") && (
            <Column
              field="doj"
              header={t("admin.staff_creation.doj")}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}

          {showCol("site_name") && (
            <Column
              field="site_name"
              header={t("admin.staff_creation.site_name")}
              sortable
              filter
              showFilterMatchModes={false}
            />
          )}

          {showCol("contact_mobile") && (
            <Column
              header={t("admin.staff_creation.contact")}
              body={(row: Staff) => row.contact_mobile || "-"}
            />
          )}

          {showCol("active_status") && (
            <Column
              header={t("common.status")}
              body={statusTemplate}
              style={{ width: 120 }}
            />
          )}

          {showCol("qr_code") && (
            <Column
              header={t("admin.staff_creation.qr_label")}
              body={qrTemplate}
              style={{ width: 120 }}
            />
          )}

          <Column
            header={t("common.actions")}
            body={actionTemplate}
            style={{ width: 140 }}
          />
        </DataTable>
      </div>
    </>
  );
}
