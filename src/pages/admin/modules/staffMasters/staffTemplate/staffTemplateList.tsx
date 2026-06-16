import type { StaffTemplate, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
// import { useEffect, useState } from "react";
// import { useNavigate, useLocation} from "react-router-dom";
// import Swal from "@/lib/notify";
// import { useTranslation } from "react-i18next";

// import { DataTable } from "@/components/common/SafeDataTable";
// import { Column } from "primereact/column";
// import { Button } from "primereact/button";
// import { InputText } from "primereact/inputtext";
// import { FilterMatchMode } from "primereact/api";

// import { PencilIcon } from "@/icons";
// import { staffCreationApi, staffTemplateApi } from "@/helpers/admin";
// import { getEncryptedRoute } from "@/utils/routeCache";
// import { Switch } from "@/components/ui/switch";

// /* ================= TYPES ================= */

// type StaffTemplate = {
//   id: number;
//   unique_id: string;
//   display_code?: string;

//   driver_id: string;
//   driver_name: string;

//   operator_id: string;
//   operator_name: string;

//   extra_operator_id?: string[];

//   status: string;
//   approval_status: string;

//   created_at: string;
//   updated_at: string;
// };

// /* ================= COMPONENT ================= */

// export default function StaffTemplateList() {
//   const { t } = useTranslation();
//   const navigate = useNavigate();

//   const [templates, setTemplates] = useState<StaffTemplate[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [globalFilterValue, setGlobalFilterValue] = useState("");

//   const [datatableFilters, setDatatableFilters] = useState<any>({
//     global: { value: null, matchMode: FilterMatchMode.CONTAINS },
//   });

//   const { encScheduleMasters, encStaffTemplate } = getEncryptedRoute();
//   const ENC_NEW_PATH = `/${encScheduleMasters}/${encStaffTemplate}/new`;
//   const ENC_EDIT_PATH = (id: string) => `/${encScheduleMasters}/${encStaffTemplate}/${id}/edit`;
//     `/${encScheduleMasters}/${encStaffTemplate}/${id}/edit`;

//   /* ================= FETCH ================= */

//   const fetchTemplates = async () => {
//     setLoading(true);
//     try {
//       const payload: any = await staffTemplateApi.readAll(); // GET
//       const data =
//         Array.isArray(payload) ? payload :
//         Array.isArray(payload?.data) ? payload.data :
//         payload?.data?.results ?? [];
//       setTemplates(data);
//     } catch {
//       Swal.fire(t("common.error"), t("common.load_failed"), "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchTemplates();
//   }, []);

//   /* ================= FILTER ================= */

//   const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     setGlobalFilterValue(value);
//     setDatatableFilters({
//       global: { value, matchMode: FilterMatchMode.CONTAINS },
//     });
//   };

//   /* ================= STATUS TOGGLE ================= */
//   const statusBodyTemplate = (row: StaffTemplate) => {
//     const updateStatus = async (checked: boolean) => {
//       try {
//         await staffTemplateApi.update(row.unique_id, {
//           status: checked ? "ACTIVE" : "INACTIVE",
//         });
//         fetchTemplates();
//       } catch {
//         Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
//       }
//     };

//     return (
//       <Switch
//         checked={row.status === "ACTIVE"}
//         onCheckedChange={updateStatus}
//       />
//     );
//   };

//   /* ================= ACTIONS ================= */

//   const actionTemplate = (row: StaffTemplate) => (
//     <div className="flex justify-center">
//       <button
//         title={t("common.edit")}
//         onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
//         className="text-blue-600 hover:text-blue-800"
//       >
//         <PencilIcon className="size-5" />
//       </button>
//     </div>
//   );

//   const indexTemplate = (_: StaffTemplate, { rowIndex }: any) => rowIndex + 1;

//   /* ================= HEADER ================= */

//   const header = (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <div>
//           <h1 className="text-2xl font-semibold text-gray-800">
//             {t("admin.staff_template.list_title")}
//           </h1>
//           <p className="text-sm text-gray-500">
//             {t("admin.staff_template.list_subtitle")}
//           </p>
//         </div>

//         <Button
//           label={t("admin.staff_template.create_button")}
//           icon="pi pi-plus"
//           className="p-button-success p-button-sm"
//           onClick={() => navigate(ENC_NEW_PATH)}
//         />
//       </div>

//       <div className="flex justify-end">
//         <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
//           <i className="pi pi-search text-gray-500" />
//           <InputText
//             value={globalFilterValue}
//             onChange={onGlobalFilterChange}
//             placeholder={t("admin.staff_template.search_placeholder")}
//             className="border-none text-sm"
//           />
//         </div>
//       </div>
//     </div>
//   );

//   /* ================= RENDER ================= */

//   return (
//     <div className="p-3">
//       <DataTable
//         value={templates}
//         paginator
//         rows={10}
//         loading={loading}
//         filters={datatableFilters}
//         globalFilterFields={[
//           "unique_id",
//           "display_code",
//           "driver_name",
//           "operator_name",
//           "status",
//           "approval_status",
//         ]}
//         header={header}
//         stripedRows
//         showGridlines
//         className="p-datatable-sm"
//         emptyMessage={t("admin.staff_template.empty_message")}
//       >
//         <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 70 }} />

//         <Column
//           header={t("admin.staff_template.columns.template_id")}
//           body={(r: StaffTemplate) => r.display_code ?? r.unique_id}
//           sortable
//           field="unique_id"
//         />

//         <Column
//           header={t("admin.staff_template.columns.primary_driver")}
//           body={(r: StaffTemplate) => r.driver_name}
//           sortable
//         />

//         <Column
//           header={t("admin.staff_template.columns.primary_operator")}
//           body={(r: StaffTemplate) => r.operator_name}
//           sortable
//         />

//         <Column
//           header={t("admin.staff_template.columns.extra_staff")}
//           body={(r: StaffTemplate) =>
//             r.extra_operator_id?.length ?? 0
//           }
//           style={{ width: 130 }}
//         />

//         <Column
//           header={t("common.status")}
//           body={statusBodyTemplate}
//           style={{ width: 120 }}
//         />

//         <Column
//           field="approval_status"
//           header={t("admin.staff_template.columns.approval_status")}
//           sortable
//         />

//         <Column
//           header={t("admin.staff_template.columns.created_at")}
//           body={(r: StaffTemplate) =>
//             new Date(r.created_at).toLocaleDateString()
//           }
//         />

//         <Column
//             header={t("admin.staff_template.columns.updated_at")}
//             body={(r: StaffTemplate)=>
//                 new Date(r.updated_at).toLocaleDateString()
//             }
//         />

//         <Column
//           header={t("common.actions")}
//           body={actionTemplate}
//           style={{ width: 120 }}
//         />
//       </DataTable>
//     </div>
//   );
// }


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

import { PencilIcon } from "@/icons";
import { staffTemplateApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const STAFF_TEMPLATE_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "display_code", "template_id"],
  driver_name: ["driver_id", "driver_name", "primary_driver", "driver"],
  operator_name: ["operator_id", "operator_name", "primary_operator", "operator"],
  extra_operator_id: ["extra_operator_id", "extra_staff", "extra_operator"],
  status: ["status", "active_status"],
  approval_status: ["approval_status"],
  created_at: ["created_at"],
  updated_at: ["updated_at"],
};

/* ================= TYPES ================= */


/* ================= COMPONENT ================= */

export default function StaffTemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-template",
    STAFF_TEMPLATE_COLUMN_FIELDS
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

  const [templates, setTemplates] = useState<StaffTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [datatableFilters, setDatatableFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    driver_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    operator_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    approval_status: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encScheduleMasters, encStaffTemplate } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encStaffTemplate,
  );
  const selectedProjectId =
    projectId && projects.some((project) => project.value === projectId)
      ? projectId
      : "";
  const selectedContext = { companyUniqueId, projectId: selectedProjectId };

  const normalizeId = (value: unknown): string =>
    value === null || value === undefined ? "" : String(value).trim();

  /* ================= FETCH ================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (isSuperAdmin && companies.length === 0) {
        if (mounted) { setTemplates([]); setLoading(false); }
        return;
      }

      if (!companyUniqueId && !isSuperAdmin) {
        if (mounted) { setTemplates([]); setLoading(false); }
        return;
      }

      if (mounted) setLoading(true);
      try {
        const requestParams: Record<string, string> = {};
        if (companyUniqueId) requestParams.company_id = companyUniqueId;
        if (selectedProjectId) requestParams.project_id = selectedProjectId;
        const rawData = await staffTemplateApi.readAll({ params: requestParams });
        const payload: any = rawData ?? [];
        const data =
          Array.isArray(payload) ? payload :
          Array.isArray(payload?.data) ? payload.data :
          payload?.data?.results ?? [];
        const rows = data as StaffTemplate[];

        const hasContextFields = rows.some((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
          return Boolean(rowCompanyId || rowProjectId);
        });

        if (!hasContextFields) {
          if (mounted) setTemplates(rows);
          return;
        }

        const filtered = rows.filter((row) => {
          const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
          const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
          const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
          const projectMatches = !selectedProjectId || rowProjectId === selectedProjectId;
          return companyMatches && projectMatches;
        });

        if (mounted) setTemplates(filtered);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => { mounted = false; };
  }, [companyUniqueId, companies.length, isSuperAdmin, selectedProjectId, t]);

  /* ================= FILTERS ================= */

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

  /* ================= STATUS TOGGLE ================= */

  const statusBodyTemplate = (row: StaffTemplate) => {
    const updateStatus = async (checked: boolean) => {
      const id = row.unique_id;
      setPendingStatusId(id);
      setIsUpdating(true);
      try {
        await staffTemplateApi.update(id, filterPayload({ status: checked ? "ACTIVE" : "INACTIVE" }));
        setTemplates((current) =>
          current.map((item) =>
            item.unique_id === id ? { ...item, status: checked ? "ACTIVE" : "INACTIVE" } : item
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
        checked={row.status === "ACTIVE"}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  /* ================= ACTIONS ================= */

  const actionTemplate = (row: StaffTemplate) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() =>
          navigate(ENC_EDIT_PATH(row.unique_id), {
            state: { ...selectedContext, record: row },
          })
        }
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: StaffTemplate, { rowIndex }: any) => rowIndex + 1;

  /* ================= HEADER ================= */

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.staff_template.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.staff_template.list_subtitle")}
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
            label={t("admin.staff_template.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !selectedProjectId}
            onClick={() =>
              navigate(ENC_NEW_PATH, { state: selectedContext })
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
            placeholder={t("admin.staff_template.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  /* ================= RENDER ================= */

  return (
    <div className="p-3">
      <DataTable
        value={templates}
        paginator
        rows={10}
        loading={loading}
        filters={datatableFilters}
        onFilter={onFilter}
        globalFilterFields={[
          ...(showCol("unique_id") ? ["unique_id", "display_code"] : []),
          ...(showCol("driver_name") ? ["driver_name"] : []),
          ...(showCol("operator_name") ? ["operator_name"] : []),
          ...(showCol("status") ? ["status"] : []),
          ...(showCol("approval_status") ? ["approval_status"] : []),
          "company_name",
          "project_name",
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.staff_template.empty_message")}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 70 }} />

        {showCol("unique_id") && (
          <Column
            field="unique_id"
            header={t("admin.staff_template.columns.template_id")}
            body={(r: StaffTemplate) => r.display_code ?? r.unique_id}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("driver_name") && (
          <Column
            field="driver_name"
            header={t("admin.staff_template.columns.primary_driver")}
            body={(r: StaffTemplate) => r.driver_name}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("operator_name") && (
          <Column
            field="operator_name"
            header={t("admin.staff_template.columns.primary_operator")}
            body={(r: StaffTemplate) => r.operator_name}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("extra_operator_id") && (
          <Column
            header={t("admin.staff_template.columns.extra_staff")}
            body={(r: StaffTemplate) => r.extra_operator_id?.length ?? 0}
            style={{ width: 130 }}
          />
        )}

        {showCol("status") && (
          <Column
            header={t("common.status")}
            body={statusBodyTemplate}
            style={{ width: 120 }}
          />
        )}

        {showCol("approval_status") && (
          <Column
            field="approval_status"
            header={t("admin.staff_template.columns.approval_status")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("created_at") && (
          <Column
            header={t("admin.staff_template.columns.created_at")}
            body={(r: StaffTemplate) => new Date(r.created_at).toLocaleDateString()}
          />
        )}

        {showCol("updated_at") && (
          <Column
            header={t("admin.staff_template.columns.updated_at")}
            body={(r: StaffTemplate) => new Date(r.updated_at).toLocaleDateString()}
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
