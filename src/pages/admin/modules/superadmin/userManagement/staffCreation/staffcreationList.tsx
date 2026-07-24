import type { Staff, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { type ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { capitalize } from "@/utils/capitalize";

import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const STAFF_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "staff_unique_id", "zigma_id"],
  employee_name: ["employee_name", "name"],
  designation: ["designation"],
  governmentusertype_id: ["governmentusertype_id", "government_user_type", "governmentusertype"],
  doj: ["doj", "date_of_joining"],
  contact_mobile: ["contact_mobile", "mobile"],
  active_status: ["active_status", "is_active"],
  qr_code: ["qr_code"],
};



const humanizeGovUserType = (val?: string | null) => {
  if (!val) return "";
  return String(val)
    .replace(/^govt_/, "")
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
};

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

  const [filterParams, setFilterParams] = useState({
    active_status: "",
    employee_name: "",
  });

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [datatableFilters, setDatatableFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    employee_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    designation: { value: null, matchMode: FilterMatchMode.CONTAINS },
    doj: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encUserManagement, encStaffCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encUserManagement,
    encStaffCreation,
  );

  const globalFilterFields = [
    "employee_name",
    "emp_id",
    "designation",
    "contact_mobile",
  ];

  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const requestParams = {
    active_status: filterParams.active_status,
    employee_name: filterParams.employee_name,
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (mounted) setLoading(true);
      try {
        const payload: any = await adminApi.staffCreation.readAll({ params: requestParams });
        if (!mounted) return;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : payload?.data?.results ?? [];
        // Debug: inspect the rows and their user-type fields returned by the API.
        console.log("[StaffCreationList] staff rows:", data);
        console.log(
          "[StaffCreationList] user types:",
          (data as Staff[]).map((row) => ({
            name: row.employee_name,
            user_type_name: row.user_type_name,
            governmentusertype_name: row.governmentusertype_name,
          })),
        );
        setStaffs(data as Staff[]);
      } catch (err) {
        if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => { mounted = false; };
  }, [refetchTrigger]);

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

  const qrTemplate = (row: Staff) => {
    if (!row.qr_code) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded hover:bg-gray-50 flex justify-center"
        onClick={() => setSelectedQr(row.qr_code!)}
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
          <Button
            label={t("admin.staff_creation.create")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* Filters Row */}
      <div className="grid gap-3 md:grid-cols-5">
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
              body={(row: Staff) => capitalize(row.unique_id)}
            />
          )}

          {showCol("employee_name") && (
            <Column
              field="employee_name"
              header={t("admin.staff_creation.employee_name")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row: Staff) => capitalize(row.employee_name)}
            />
          )}

          <Column
            field="emp_id"
            header="Employee ID"
            sortable
            body={(row: Staff) => capitalize(String(row.emp_id ?? "")) || "-"}
          />

          <Column
            field="user_type_name"
            header="User Type"
            sortable
            body={(row: Staff) => capitalize(row.user_type_name) || "-"}
          />

          <Column
            field="governmentusertype_name"
            header="Government User Type"
            sortable
            body={(row: Staff) => row.governmentusertype_name || "-"}
          />


          {showCol("governmentusertype_id") && (
            <Column
              field="governmentusertype_name"
              header={t("admin.staff_creation.government_user_type")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row: Staff) => humanizeGovUserType(row.governmentusertype_name as string) || "-"}
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

      <Dialog open={Boolean(selectedQr)} onOpenChange={(open) => !open && setSelectedQr(null)}>
        <DialogContent className="w-auto max-w-[90vw] p-4">
          <DialogTitle className="sr-only">{t("admin.staff_creation.qr_title")}</DialogTitle>
          {selectedQr && (
            <img
              src={selectedQr}
              alt={t("admin.staff_creation.qr_title")}
              className="h-auto w-[min(75vw,320px)] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
