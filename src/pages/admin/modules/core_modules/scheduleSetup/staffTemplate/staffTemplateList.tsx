import type { StaffTemplate, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function StaffTemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-template",
    STAFF_TEMPLATE_COLUMN_FIELDS
  );

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

  const { encScheduleSetup, encStaffTemplate } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleSetup,
    encStaffTemplate,
  );

  /* ================= FETCH ================= */

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    staffTemplateApi.readAll()
      .then((rawData: any) => {
        if (!mounted) return;
        const data =
          Array.isArray(rawData) ? rawData :
          Array.isArray(rawData?.data) ? rawData.data :
          rawData?.data?.results ?? [];
        setTemplates(data as StaffTemplate[]);
      })
      .catch(() => {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [t]);

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
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
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
        <Button
          label={t("admin.staff_template.create_button")}
          icon="pi pi-plus"
          className="p-button-success p-button-sm"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
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
