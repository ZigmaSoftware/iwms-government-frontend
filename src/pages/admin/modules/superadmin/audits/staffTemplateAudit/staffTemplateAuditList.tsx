import type { StaffTemplateAuditRecord } from "./types";
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

import { staffTemplateAuditLogApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


export default function StaffTemplateAuditList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [records, setRecords] = useState<StaffTemplateAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  // const [filters, setFilters] = useState<any>({
  //   global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  // });

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    entity_type: { value: null, matchMode: FilterMatchMode.CONTAINS },
    entity_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    action: { value: null, matchMode: FilterMatchMode.CONTAINS },
    performed_by: { value: null, matchMode: FilterMatchMode.CONTAINS },
    performed_role: { value: null, matchMode: FilterMatchMode.CONTAINS },
    change_remarks: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });


  const { encAudits, encStaffTemplateAudit } = getEncryptedRoute();
  const { editPath: ENC_VIEW_PATH } = createCrudRoutePaths(encAudits, encStaffTemplateAudit);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const payload: any = await staffTemplateAuditLogApi.readAll();
      setRecords(normalizeList<StaffTemplateAuditRecord>(payload));
    } catch {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
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

  const actionTemplate = (row: StaffTemplateAuditRecord) => (
    <div className="flex justify-center">
      <button
        title={t("common.view")}
        onClick={() => navigate(ENC_VIEW_PATH(String(row.id)))}
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
            {t("admin.staff_template_audit.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.staff_template_audit.list_subtitle")}
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
        dataKey="id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={[
          "entity_type",
          "entity_id",
          "action",
          "performed_by",
          "performed_by_name",
          "performed_role",
          "change_remarks",
        ]}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.staff_template_audit.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column
          header={t("admin.staff_template_audit.entity_type")}
          field="entity_type"
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.staff_template_audit.entity_id")}
          field="entity_id"
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.staff_template_audit.action")}
          field="action"
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="performed_by"
          header={t("admin.staff_template_audit.performed_by")}
          body={(r: StaffTemplateAuditRecord) => r.performed_by_name ?? r.performed_by ?? "-"}
          filter
          showFilterMatchModes={false}

        />
        <Column
          field="performed_role"
          header={t("admin.staff_template_audit.performed_role")}
          body={(r: StaffTemplateAuditRecord) => r.performed_role ?? "-"}
          filter
          showFilterMatchModes={false}

        />
        <Column
          field="change_remarks"
          header={t("admin.staff_template_audit.change_remarks")}
          body={(r: StaffTemplateAuditRecord) => r.change_remarks ?? "-"}
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.staff_template_audit.performed_at")}
          body={(r: StaffTemplateAuditRecord) =>
            r.performed_at ? new Date(r.performed_at).toLocaleString() : "-"
          }
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 120 }} />
      </DataTable>
    </div>
  );
}
