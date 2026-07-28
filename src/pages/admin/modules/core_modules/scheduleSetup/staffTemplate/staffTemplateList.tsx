import type { StaffTemplate } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

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

const toRecordList = (value: unknown): StaffTemplate[] => {
  if (Array.isArray(value)) return value as StaffTemplate[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: StaffTemplate[] }).results;
  }
  return [];
};

// Backend `ordering_fields` exposes `display_code`, not `unique_id`. The
// "Template ID" column displays `display_code ?? unique_id` but is keyed by
// the `unique_id` field for visibility/config purposes, so map it to the
// actual backend-sortable field when building the `ordering` query param.
const BACKEND_ORDER_FIELD: Record<string, string> = {
  unique_id: "display_code",
};

const SORTABLE_FIELDS = new Set(["status", "approval_status", "unique_id"]);

export default function StaffTemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-template",
    STAFF_TEMPLATE_COLUMN_FIELDS
  );

  const [rows, setRows] = useState<StaffTemplate[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const { encScheduleSetup, encStaffTemplate } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleSetup,
    encStaffTemplate,
  );

  /* ================= FETCH ================= */

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setLoading(true);
    try {
      const response = await staffTemplateApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${BACKEND_ORDER_FIELD[sortField] ?? sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  /* ================= FILTERS ================= */

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  /* ================= STATUS TOGGLE ================= */

  const statusBodyTemplate = (row: StaffTemplate) => {
    const updateStatus = async (checked: boolean) => {
      const id = row.unique_id;
      setPendingStatusId(id);
      setIsUpdating(true);
      try {
        await staffTemplateApi.update(id, filterPayload({ status: checked ? "ACTIVE" : "INACTIVE" }));
        setRows((current) =>
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
        value={rows}
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        loading={loading}
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
          />
        )}

        {showCol("driver_name") && (
          <Column
            field="driver_name"
            header={t("admin.staff_template.columns.primary_driver")}
            body={(r: StaffTemplate) => r.driver_name}
          />
        )}

        {showCol("operator_name") && (
          <Column
            field="operator_name"
            header={t("admin.staff_template.columns.primary_operator")}
            body={(r: StaffTemplate) => r.operator_name}
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
