import type { Staff, StaffAddress } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { type ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useTranslation } from "react-i18next";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { capitalize } from "@/utils/capitalize";

import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";
import {
  createStaffQrPdfBlob,
  downloadStaffQrPdf,
  localBodyNameOf,
} from "./staffQrPdf";
import { downloadAllStaffPdf } from "./staffAllDetailsPdf";

const STAFF_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  unique_id: ["unique_id", "staff_unique_id", "zigma_id"],
  employee_name: ["employee_name", "name"],
  governmentusertype_id: ["governmentusertype_id", "government_user_type", "governmentusertype"],
  doj: ["doj", "date_of_joining"],
  contact_mobile: ["contact_mobile", "mobile"],
  active_status: ["active_status", "is_active"],
  qr_code: ["qr_code"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toRecordList = (value: unknown): Staff[] => {
  if (Array.isArray(value)) return value as Staff[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: Staff[] }).results;
  }
  return [];
};

// Backend `ordering_fields` are ["staff_unique_id", "employee_name", "created_at"];
// only staff_unique_id/employee_name map to visible, sortable columns here.
const SORTABLE_FIELDS = new Set(["staff_unique_id", "employee_name"]);

// The "unique_id" column body is `unique_id`, but the backend orders on `staff_unique_id`.
const BACKEND_ORDER_FIELD: Record<string, string> = {
  unique_id: "staff_unique_id",
};

const humanizeGovUserType = (val?: string | null) => {
  if (!val) return "";
  return String(val)
    .replace(/^govt_/, "")
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
};

const staffTypeName = (staff: Staff) =>
  staff.staff_type_name ?? staff.user_type_name ?? "";

const governmentStaffTypeName = (staff: Staff) =>
  staff.government_staff_type_name ?? staff.governmentusertype_name ?? "";

const addressText = (
  address: StaffAddress | string | null | undefined,
  prefix: "present" | "permanent",
  staff: Staff,
) => {
  let parsedAddress: StaffAddress = {};

  if (address && typeof address === "object") {
    parsedAddress = address;
  } else if (typeof address === "string" && address.trim()) {
    try {
      const parsed = JSON.parse(address);
      if (parsed && typeof parsed === "object") parsedAddress = parsed;
    } catch {
      return address.trim();
    }
  }

  const value = (field: keyof StaffAddress) =>
    parsedAddress[field] ?? staff[`${prefix}_${field}`] ?? "";

  return [
    value("building_no"),
    value("street"),
    value("area"),
    value("city"),
    value("district"),
    value("state"),
    value("country"),
    value("pincode"),
  ]
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(", ");
};

const staffExcelRow = (staff: Staff) => ({
  "Zigma ID": staff.unique_id,
  "Staff Unique ID": staff.staff_unique_id,
  "Employee ID": staff.emp_id,
  "Employee Name": staff.employee_name,
  "Staff Type": staffTypeName(staff),
  "Government Staff Type": governmentStaffTypeName(staff),
  "Government Level": staff.governmentusertype_level,
  "Staff Configuration": staff.staff_config_name,
  "Staff Head": staff.staff_head,
  "Date of Joining": staff.doj,
  Status: staff.active_status ? "Active" : "Inactive",
  Username: staff.username,
  "Login Enabled": staff.login_enabled ? "Yes" : "No",
  "Contact Mobile": staff.contact_mobile,
  "Contact Email": staff.contact_email,
  "Office Email": staff.office_email,
  Gender: staff.gender,
  "Date of Birth": staff.dob,
  Age: staff.age,
  "Marital Status": staff.marital_status,
  "Blood Group": staff.blood_group,
  "Physically Challenged": staff.physically_challenged,
  State: staff.state_name,
  District: staff.district_name,
  "Area Type": staff.area_type_name,
  "Local Body": localBodyNameOf(staff),
  "Present Address": addressText(staff.present_address, "present", staff),
  "Permanent Address": addressText(staff.permanent_address, "permanent", staff),
  "Driving Licence Number": staff.driving_licence_no,
  "Driving Licence Expiry": staff.driving_licence_expiry_date,
  "Driving Experience (Years)": staff.driving_experience_years,
  "Driving Licence File": staff.driving_licence_file,
  "Photo URL": staff.photo,
  "Attendance Image URL": staff.attendance_reg_image,
  "QR Code URL": staff.qr_code,
  "Last Login At": staff.last_login_at,
  "Created At": staff.created_at,
  "Updated At": staff.updated_at,
});

export default function StaffCreationList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-creation",
    STAFF_CREATION_COLUMN_FIELDS
  );

  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [filterParams, setFilterParams] = useState({
    active_status: "",
    employee_name: "",
  });

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [selectedQrStaff, setSelectedQrStaff] = useState<Staff | null>(null);
  const [isPrintingQr, setIsPrintingQr] = useState(false);
  const [isPreviewingQr, setIsPreviewingQr] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const { encUserManagement, encStaffCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encUserManagement,
    encStaffCreation,
  );

  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const requestParams = {
    active_status: filterParams.active_status,
    employee_name: filterParams.employee_name,
  };

  const loadRows = async (
    page: number,
    limit: number,
    params: Record<string, unknown>,
    ordering?: string,
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.staffCreation.readAllwithPaginated(page, limit, {
        params: { ...params, ...(ordering ? { ordering } : {}) },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof (response as any)?.count === "number"
          ? (response as any).count
          : toRecordList(response).length,
      );
    } catch (err) {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const mappedSortField = sortField ? BACKEND_ORDER_FIELD[sortField] ?? sortField : undefined;
  const ordering =
    mappedSortField && SORTABLE_FIELDS.has(mappedSortField)
      ? `${sortOrder === -1 ? "-" : ""}${mappedSortField}`
      : undefined;

  useEffect(() => {
    const params: Record<string, unknown> = { ...requestParams };
    if (globalSearchTerm) params.search = globalSearchTerm;
    void loadRows(first / rowsPerPage + 1, rowsPerPage, params, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, globalSearchTerm, sortField, sortOrder, refetchTrigger]);

  const applyFilter = () => {
    setFirst(0);
    setRefetchTrigger((n) => n + 1);
  };

  const handleFilterChange = (
    ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = ev.target;
    setFilterParams((prev) => ({ ...prev, [name]: value }));
  };

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setGlobalSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const statusTemplate = (row: Staff) => {
    const updateStatus = async (value: boolean) => {
      try {
        const formData = new FormData();
        const payload = filterPayload({ active_status: value });
        Object.entries(payload).forEach(([key, entryValue]) => {
          formData.append(key, String(entryValue));
        });

        await adminApi.staffCreation.update(row.unique_id, formData);
        setRows((prev) =>
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
        onClick={() => setSelectedQrStaff(row)}
        title={t("admin.staff_creation.qr_show")}
      >
        <img src={row.qr_code} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const fetchStaffDetail = async (staff: Staff): Promise<Staff> => {
    const detail = await adminApi.staffCreation.read(staff.unique_id) as Staff;
    return {
      ...staff,
      ...detail,
      qr_code: detail.qr_code ?? staff.qr_code,
    };
  };

  const hydrateStaff = async (staffRows: Staff[]): Promise<Staff[]> => {
    const hydrated: Staff[] = [];
    const batchSize = 8;
    for (let index = 0; index < staffRows.length; index += batchSize) {
      const batch = staffRows.slice(index, index + batchSize);
      const details = await Promise.all(
        batch.map((staff) => fetchStaffDetail(staff).catch(() => staff)),
      );
      hydrated.push(...details);
    }
    return hydrated;
  };

  const fetchExportStaff = async (): Promise<Staff[]> => {
    const staffRows = toRecordList(await adminApi.staffCreation.readAllForExport());
    return hydrateStaff(staffRows);
  };

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      const exportRows = await fetchExportStaff();
      if (exportRows.length === 0) {
        Swal.fire(t("common.warning") || "Warning", "No staff to export", "warning");
        return;
      }
      exportRecordsToExcel(
        exportRows.map(staffExcelRow),
        getAdminScreenExcelFilename("all"),
        "Staff",
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to export staff.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const exportRows = await fetchExportStaff();
      if (exportRows.length === 0) {
        Swal.fire(t("common.warning") || "Warning", "No staff to export", "warning");
        return;
      }
      await downloadAllStaffPdf(exportRows);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the staff PDF.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintQr = async () => {
    if (!selectedQrStaff) return;
    setIsPrintingQr(true);
    try {
      const detailedStaff = await fetchStaffDetail(selectedQrStaff);
      setSelectedQrStaff(detailedStaff);
      await downloadStaffQrPdf(detailedStaff);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the staff QR PDF.",
      });
    } finally {
      setIsPrintingQr(false);
    }
  };

  const handlePreviewQr = async () => {
    if (!selectedQrStaff) return;

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      Swal.fire({
        icon: "warning",
        title: "Preview blocked",
        text: "Please allow pop-ups for this site to preview the PDF.",
      });
      return;
    }

    previewWindow.document.title = "Preparing staff QR PDF";
    previewWindow.document.body.innerHTML =
      '<p style="font-family:Arial,sans-serif;padding:24px;color:#475569">Preparing PDF preview…</p>';
    setIsPreviewingQr(true);
    try {
      const detailedStaff = await fetchStaffDetail(selectedQrStaff);
      setSelectedQrStaff(detailedStaff);
      const pdfBlob = await createStaffQrPdfBlob(detailedStaff);
      const previewUrl = URL.createObjectURL(pdfBlob);
      previewWindow.location.replace(previewUrl);
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 300_000);
    } catch (error) {
      previewWindow.close();
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to preview the staff QR PDF.",
      });
    } finally {
      setIsPreviewingQr(false);
    }
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
            label={isExportingExcel ? "Downloading…" : "Download Excel"}
            icon="pi pi-file-excel"
            className="p-button-outlined p-button-sm"
            disabled={isExportingExcel}
            onClick={handleDownloadExcel}
          />
          <Button
            label={isExportingPdf ? "Generating PDF…" : "Download PDF"}
            icon="pi pi-file-pdf"
            className="p-button-outlined p-button-sm"
            disabled={isExportingPdf}
            onClick={handleDownloadPdf}
          />
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
              sortable={SORTABLE_FIELDS.has("staff_unique_id")}
              body={(row: Staff) => capitalize(row.unique_id)}
            />
          )}

          {showCol("employee_name") && (
            <Column
              field="employee_name"
              header={t("admin.staff_creation.employee_name")}
              sortable={SORTABLE_FIELDS.has("employee_name")}
              body={(row: Staff) => capitalize(row.employee_name)}
            />
          )}

          <Column
            field="emp_id"
            header="Employee ID"
            body={(row: Staff) => capitalize(String(row.emp_id ?? "")) || "-"}
          />

          <Column
            field="user_type_name"
            header="Staff Type"
            body={(row: Staff) => capitalize(staffTypeName(row)) || "-"}
          />

          <Column
            field="governmentusertype_name"
            header="Government Staff Type"
            body={(row: Staff) => governmentStaffTypeName(row) || "-"}
          />


          {showCol("governmentusertype_id") && (
            <Column
              field="governmentusertype_name"
              header={t("admin.staff_creation.government_user_type")}
              body={(row: Staff) => humanizeGovUserType(governmentStaffTypeName(row)) || "-"}
            />
          )}

          {showCol("doj") && (
            <Column
              field="doj"
              header={t("admin.staff_creation.doj")}
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

      <Dialog
        open={Boolean(selectedQrStaff)}
        onOpenChange={(open) => !open && setSelectedQrStaff(null)}
      >
        <DialogContent className="w-auto max-w-[90vw] p-4">
          <DialogTitle className="sr-only">{t("admin.staff_creation.qr_title")}</DialogTitle>
          {selectedQrStaff?.qr_code && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={selectedQrStaff.qr_code}
                alt={t("admin.staff_creation.qr_title")}
                className="h-auto w-[min(75vw,320px)] object-contain"
              />
              <div className="text-center">
                <p className="font-semibold text-gray-800">{selectedQrStaff.employee_name}</p>
                <p className="text-sm text-gray-500">{selectedQrStaff.staff_unique_id}</p>
              </div>
              <div className="flex w-full gap-2">
                <Button
                  label={isPreviewingQr ? "Preparing…" : "Preview"}
                  icon="pi pi-eye"
                  loading={isPreviewingQr}
                  disabled={isPreviewingQr || isPrintingQr}
                  onClick={handlePreviewQr}
                  className="flex-1 p-button-outlined"
                />
                <Button
                  label={isPrintingQr ? "Preparing PDF…" : "Print"}
                  icon="pi pi-print"
                  loading={isPrintingQr}
                  disabled={isPrintingQr || isPreviewingQr}
                  onClick={handlePrintQr}
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
