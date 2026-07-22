import type { AlternativeStaffTemplate, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import SearchInput from "@/components/common/SearchInput";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
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

  const { encScheduleSetup, encAlternativeStaffTemplate } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleSetup,
    encAlternativeStaffTemplate,
  );

  useEffect(() => {
    let mounted = true;

    const fetchRecords = async () => {
      if (mounted) setLoading(true);
      try {
        const payload: any = await adminApi.alternativeStaffTemplate.readAll();
        if (!mounted) return;
        const data =
          Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
            ? payload.data
            : payload?.data?.results ?? [];
        setRecords(data as AlternativeStaffTemplate[]);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchRecords();

    return () => { mounted = false; };
  }, [t]);

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
          <Button
            label={t("admin.alternative_staff_template.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <SearchInput
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.alternative_staff_template.search_placeholder")}
        />
      </div>
    </div>
  );

  const indexTemplate = (_: AlternativeStaffTemplate, { rowIndex }: any) =>
    rowIndex + 1;

  const actionTemplate = (row: AlternativeStaffTemplate) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
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
