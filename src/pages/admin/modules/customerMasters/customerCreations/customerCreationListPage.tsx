import type { TableFilters } from "./types";
import type { Customer } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { customerCreationApi } from "@/helpers/admin";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import {
  excelFileToCsvFile,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";


const CUSTOMER_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  customer_name: ["customer_name", "name"],
  contact_no: ["contact_no", "mobile"],
  apartment_name: ["apartment_name"],
  unit: ["block_no", "flat_no"],
  state_name: ["state_id", "state_name"],
  panchayat_name: ["panchayat_id", "panchayat_name"],
  waste_types: ["waste_type_ids", "waste_types", "waste_type"],
  qr_code: ["qr_code"],
  is_active: ["is_active"],
};

const CUSTOMER_BULK_TEMPLATE_COLUMNS: ExcelTemplateColumn[] = [
  { field: "customer_name", header: "customer_name", required: true, sample: "John Doe" },
  { field: "contact_no", header: "contact_no", required: true, sample: "9876543210" },
  { field: "id_proof_type", header: "id_proof_type", sample: "Aadhaar" },
  { field: "id_no", header: "id_no", sample: "1234-5678-9012" },
  { field: "building_no", header: "building_no", sample: "12" },
  { field: "street", header: "street", sample: "Main Street" },
  { field: "area", header: "area", sample: "Anna Nagar" },
  { field: "pincode", header: "pincode", sample: "600040" },
  { field: "latitude", header: "latitude", sample: "13.0827" },
  { field: "longitude", header: "longitude", sample: "80.2707" },
  { field: "district_name", header: "district_name", required: true, sample: "Chennai" },
  { field: "state_name", header: "state_name", required: true, sample: "Tamil Nadu" },
  { field: "country_name", header: "country_name", required: true, sample: "India" },
  { field: "property_name", header: "property_name", required: true, sample: "Residential" },
  { field: "sub_property_name", header: "sub_property_name", required: true, sample: "Apartment" },
  { field: "waste_type_ids", header: "waste_type_ids", required: true, sample: "wst-2026abcd01,wst-2026efgh02" },
  { field: "apartment_name", header: "apartment_name", sample: "Sunrise Apt" },
  { field: "block_no", header: "block_no", sample: "A" },
  { field: "flat_no", header: "flat_no", sample: "101" },
  { field: "panchayat_name", header: "panchayat_name" },
];

export default function CustomerCreationListPage() {
  const { t } = useTranslation();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "customer-master",
    "customer-creation",
    CUSTOMER_CREATION_COLUMN_FIELDS,
  );

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    customer_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    contact_no: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    state_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    panchayat_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const { encCustomerMaster, encCustomerCreation } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encCustomerMaster,
    encCustomerCreation,
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    customerCreationApi.readAll()
      .then((data: unknown) => {
        if (mounted) setAllCustomers(Array.isArray(data) ? (data as Customer[]) : []);
      })
      .catch((error: unknown) => {
        if (mounted) {
          Swal.fire({
            icon: "error",
            title: t("common.error"),
            text: String((error as { response?: { data?: unknown } })?.response?.data ?? error),
          });
        }
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t, refetchTrigger]);

  const customers = useMemo<Customer[]>(() => {
    return allCustomers
      .sort((a, b) =>
        String(a.customer_name ?? "").localeCompare(String(b.customer_name ?? ""))
      );
  }, [allCustomers]);

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = () => {
    exportTemplateToExcel(
      CUSTOMER_BULK_TEMPLATE_COLUMNS,
      getAdminScreenExcelFilename("template"),
      "Customers",
    );
  };

  // ── Bulk upload ───────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const csvFile = await excelFileToCsvFile(file, "customer_bulk_upload.csv");
      const formDataObj = new FormData();
      formDataObj.append("file", csvFile);

      const result = await customerCreationApi.action<Record<string, unknown>>(
        "bulk-upload",
        formDataObj,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const success = Number(result?.success_count ?? 0);
      const errors = Array.isArray(result?.errors) ? result.errors.length : 0;
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "completed",
        success_count: success,
        error_count: errors,
      });

      Swal.fire({
        title: String(result?.message ?? "Upload Completed"),
        html: `<b>Success:</b> ${success} <br/> <b>Errors:</b> ${errors}`,
        icon: "success",
      });

      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "failed",
      });
      Swal.fire("Error", "Upload failed", "error");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const header = (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3 px-3 py-2">
        <Button
          label={t("admin.customer_creation.add")}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
        <Button
          label="Download Template"
          icon="pi pi-download"
          className="p-button-secondary"
          onClick={downloadTemplate}
        />
        <Button
          label="Upload Excel"
          icon="pi pi-upload"
          className="p-button-info"
          disabled={isUploading}
          onClick={() => document.getElementById("excelUpload")?.click()}
        />
      </div>
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.customer_creation.search_placeholder")}
          className="p-inputtext-sm !border-0 !shadow-none"
        />
        <input
          id="excelUpload"
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );

  const openQrPopup = (qrUrl: string) => {
    Swal.fire({
      title: t("admin.customer_creation.qr_title"),
      html: `<div class="flex justify-center">
              <img src="${qrUrl}" style="width:200px;height:200px;" />
            </div>`,
      width: 350,
    });
  };

  const qrTemplate = (customer: Customer) => {
    if (!customer.qr_code) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded bg-white shadow-sm hover:bg-gray-50"
        onClick={() => openQrPopup(customer.qr_code!)}
      >
        <img src={customer.qr_code} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const statusTemplate = (row: Customer) => {
    const updateStatus = async (value: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        const rawPayload = { ...row, is_active: value };
        await customerCreationApi.update(
          row.unique_id,
          filterPayload(rawPayload) as Record<string, unknown>
        );
        setAllCustomers((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (err) {
        console.error("Status update failed:", err);
        Swal.fire("Error", "Failed to update status", "error");
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        onCheckedChange={updateStatus}
        disabled={isUpdating && pendingStatusId === row.unique_id}
      />
    );
  };

  const actionTemplate = (customer: Customer) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(customer.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: Customer, options: { rowIndex: number }) =>
    options.rowIndex + 1;

  return (
    <div className="p-3 ">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.customer_creation.title")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t("admin.customer_creation.subtitle")}
          </p>
        </div>

        <div />
      </div>

      <DataTable
        value={customers}
        bulkImportable={false}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && customers.length === 0}
        filters={filters}
        globalFilterFields={[
          "customer_name", "contact_no", "apartment_name",
          "block_no", "flat_no", "waste_types",
        ]}
        header={header}
        emptyMessage={t("admin.customer_creation.empty_message")}
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("customer_name") && (
          <Column field="customer_name" header={t("admin.customer_creation.customer")} sortable />
        )}
        {showCol("contact_no") && (
          <Column field="contact_no" header={t("common.mobile")} sortable />
        )}
        {showCol("apartment_name") && (
          <Column
            field="apartment_name"
            header="Apartment"
            body={(row: Customer) =>
              row.apartment_name && row.apartment_name.trim() !== "" ? cap(row.apartment_name) : "-"
            }
          />
        )}
        {showCol("unit") && (
          <Column
            header="Unit"
            body={(row: Customer) =>
              row.block_no && row.flat_no ? `${row.block_no}-${row.flat_no}` : "-"
            }
          />
        )}
        {showCol("state_name") && (
          <Column field="state_name" header={t("common.state")} sortable />
        )}
        {showCol("panchayat_name") && (
          <Column
            field="panchayat_name"
            header={t("admin.nav.panchayat")}
            body={(row: Customer) => row.panchayat_name || "-"}
            sortable
          />
        )}
        {showCol("waste_types") && (
          <Column
            field="waste_types"
            header={t("common.waste_type")}
            body={(row: Customer) =>
              row.waste_types?.length
                ? row.waste_types.map((wasteType) => wasteType.waste_type_name).join(", ")
                : "-"
            }
          />
        )}
        {showCol("qr_code") && (
          <Column header={t("admin.customer_creation.qr_label")} body={qrTemplate} style={{ width: "100px" }} />
        )}
        {showCol("is_active") && (
          <Column field="is_active" header={t("common.status")} body={statusTemplate} />
        )}
        <Column header={t("common.actions")} body={actionTemplate} style={{ textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
