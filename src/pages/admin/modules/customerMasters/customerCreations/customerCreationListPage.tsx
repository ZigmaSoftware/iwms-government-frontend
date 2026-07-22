import type { TableFilters } from "./types";
import type { Customer } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { FilterMatchMode } from "primereact/api";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { customerCreationApi, wasteTypeApi } from "@/helpers/admin";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import {
  excelFileToCsvFile,
  exportRecordsToExcel,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";
import HierarchyFilterBar, {
  type HierarchyFilterParams,
} from "@/components/filters/HierarchyFilterBar";
import { createCustomerQrPdfBlob, downloadCustomerQrPdf } from "./customerQrPdf";
import { downloadAllCustomersPdf } from "./customerAllDetailsPdf";


const CUSTOMER_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  customer_name: ["customer_name", "name"],
  contact_no: ["contact_no", "mobile"],
  property_name: ["property_id", "property_name"],
  sub_property_name: ["sub_property_id", "sub_property_name"],
  location_name: ["location_node_id", "location_node", "location_name"],
  waste_types: ["waste_type_ids", "waste_types", "waste_type"],
  qr_code: ["qr_code"],
  is_active: ["is_active"],
};

const localBodyLabel = (customer: Customer): string =>
  customer.corporation_name ||
  customer.municipality_name ||
  customer.town_panchayat_name ||
  customer.panchayat_union_name ||
  customer.panchayat_name ||
  customer.location_name ||
  "-";

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
  // Geography for import: district + panchayat names are resolved to the
  // customer's single hierarchy node server-side (must already exist in the tree).
  { field: "district_name", header: "district_name", required: true, sample: "Erode" },
  { field: "panchayat_name", header: "panchayat_name", required: true, sample: "Sample Panchayat" },
  { field: "property_name", header: "property_name", required: true, sample: "Residential" },
  { field: "sub_property_name", header: "sub_property_name", required: true, sample: "Apartment" },
  { field: "waste_type_ids", header: "waste_type_ids", required: true, sample: "wst-2026abcd01,wst-2026efgh02" },
  { field: "apartment_name", header: "apartment_name", sample: "Sunrise Apt" },
  { field: "block_no", header: "block_no", sample: "A" },
  { field: "flat_no", header: "flat_no", sample: "101" },
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
  const [selectedQrCustomer, setSelectedQrCustomer] = useState<Customer | null>(null);
  const [isPrintingQr, setIsPrintingQr] = useState(false);
  const [isPreviewingQr, setIsPreviewingQr] = useState(false);
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    customer_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    contact_no: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    location_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [wasteTypeIds, setWasteTypeIds] = useState<string[]>([]);
  const [wasteTypeOptions, setWasteTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const navigate = useNavigate();
  const { encCustomerMaster, encCustomerCreation } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encCustomerMaster,
    encCustomerCreation,
  );

  /* ── waste type dropdown options ── */
  useEffect(() => {
    (wasteTypeApi.readAll() as Promise<any[]>)
      .then((data) => {
        const options = (Array.isArray(data) ? data : []).map((wt) => ({
          label: wt.waste_type_name ?? wt.name ?? wt.unique_id,
          value: wt.unique_id,
        }));
        setWasteTypeOptions(options);
      })
      .catch(() => {
        /* non-critical — filter simply shows no options */
      });
  }, []);

  /* ── build server query params from the hierarchy/waste-type filters ── */
  const buildParams = useCallback((): Record<string, any> => {
    const params: Record<string, any> = { ...hierarchyParams };
    if (wasteTypeIds.length > 0) params.waste_type_id = wasteTypeIds.join(",");
    return params;
  }, [hierarchyParams, wasteTypeIds]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    customerCreationApi.readAll({ params: buildParams() })
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
  }, [t, refetchTrigger, buildParams]);

  const customers = useMemo<Customer[]>(() => {
    return allCustomers
      .sort((a, b) =>
        String(a.customer_name ?? "").localeCompare(String(b.customer_name ?? ""))
      );
  }, [allCustomers]);

  const hasActiveFilters =
    Object.keys(hierarchyParams).length > 0 || wasteTypeIds.length > 0;

  const handleClearFilters = () => {
    setHierarchyParams({});
    setWasteTypeIds([]);
    setFilterResetKey((key) => key + 1);
  };

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

  // ── Filtered set used for both on-screen search and exports ──────────────
  const getFilteredExportCustomers = (): Customer[] => {
    const search = globalFilterValue.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((row) => {
      const wasteTypeNames = row.waste_types?.map((w) => w.waste_type_name).join(" ") ?? "";
      const haystack = [
        row.customer_name, row.contact_no, row.property_name, row.sub_property_name, wasteTypeNames,
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  };

  // ── Excel export of the currently filtered customer data ─────────────────
  const handleDownloadExcel = () => {
    setIsExportingExcel(true);
    try {
      const rows = getFilteredExportCustomers();
      if (rows.length === 0) {
        Swal.fire(t("common.warning") || "Warning", "No customers to export", "warning");
        return;
      }
      exportRecordsToExcel(rows, getAdminScreenExcelFilename("all"), "Customers");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ── PDF export: one full-detail page per currently filtered customer ─────
  const handleDownloadPdf = async () => {
    const rows = getFilteredExportCustomers();
    if (rows.length === 0) {
      Swal.fire(t("common.warning") || "Warning", "No customers to export", "warning");
      return;
    }
    setIsExportingPdf(true);
    try {
      await downloadAllCustomersPdf(rows);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the customers PDF.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const header = (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
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
          <Button
            label={isExportingExcel ? "Downloading…" : "Download Excel"}
            icon="pi pi-file-excel"
            className="p-button-outlined"
            disabled={isExportingExcel || customers.length === 0}
            onClick={handleDownloadExcel}
          />
          <Button
            label={isExportingPdf ? "Generating PDF…" : "Download PDF"}
            icon="pi pi-file-pdf"
            className="p-button-outlined"
            disabled={isExportingPdf || customers.length === 0}
            onClick={handleDownloadPdf}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
        <HierarchyFilterBar
          key={filterResetKey}
          className="contents"
          showClear={false}
          onChange={setHierarchyParams}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Waste Type</label>
          <MultiSelect
            value={wasteTypeIds}
            onChange={(e) => {
              const raw = Array.isArray(e.value) ? e.value : [];
              const values = raw.map((v: any) =>
                v && typeof v === "object" ? String(v.value ?? v.unique_id ?? v.id ?? "") : String(v),
              );
              setWasteTypeIds(values);
            }}
            options={wasteTypeOptions}
            optionLabel="label"
            optionValue="value"
            maxSelectedLabels={2}
            placeholder="All waste types"
            className="flex! h-10! w-full! items-center! justify-between! rounded-md! border! border-input! bg-background! px-3! py-2! text-sm! shadow-none! ring-offset-background! focus:outline-none! focus:ring-2! focus:ring-ring! focus:ring-offset-2! disabled:cursor-not-allowed! disabled:opacity-50!"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="pi pi-filter-slash text-xs" />
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );

  const qrTemplate = (customer: Customer) => {
    if (!customer.qr_code) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded bg-white shadow-sm hover:bg-gray-50"
        onClick={() => setSelectedQrCustomer(customer)}
        title={t("admin.customer_creation.qr_show")}
      >
        <img src={customer.qr_code} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const handlePrintQr = async () => {
    if (!selectedQrCustomer) return;
    setIsPrintingQr(true);
    try {
      await downloadCustomerQrPdf(selectedQrCustomer);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the customer QR PDF.",
      });
    } finally {
      setIsPrintingQr(false);
    }
  };

  const handlePreviewQr = async () => {
    if (!selectedQrCustomer) return;

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      Swal.fire({
        icon: "warning",
        title: "Preview blocked",
        text: "Please allow pop-ups for this site to preview the PDF.",
      });
      return;
    }

    previewWindow.document.title = "Preparing customer QR PDF";
    previewWindow.document.body.innerHTML =
      '<p style="font-family:Arial,sans-serif;padding:24px;color:#475569">Preparing PDF preview…</p>';
    setIsPreviewingQr(true);
    try {
      const pdfBlob = await createCustomerQrPdfBlob(selectedQrCustomer);
      const previewUrl = URL.createObjectURL(pdfBlob);
      previewWindow.location.replace(previewUrl);
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 300_000);
    } catch (error) {
      previewWindow.close();
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to preview the customer QR PDF.",
      });
    } finally {
      setIsPreviewingQr(false);
    }
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
    <>
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
            "customer_name", "contact_no", "property_name",
            "sub_property_name", "waste_types",
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
          {showCol("property_name") && (
            <Column
              field="property_name"
              header={t("admin.customer_creation.property") || "Property"}
              body={(row: Customer) => (row.property_name ? cap(row.property_name) : "-")}
              sortable
            />
          )}
          {showCol("sub_property_name") && (
            <Column
              field="sub_property_name"
              header={t("admin.customer_creation.sub_property") || "Sub Property"}
              body={(row: Customer) => (row.sub_property_name ? cap(row.sub_property_name) : "-")}
              sortable
            />
          )}
          {showCol("location_name") && (
            <Column
              field="location_name"
              header={t("common.location") || "Location"}
              body={(row: Customer) => localBodyLabel(row)}
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

      <Dialog
        open={Boolean(selectedQrCustomer)}
        onOpenChange={(open) => !open && setSelectedQrCustomer(null)}
      >
        <DialogContent className="w-auto max-w-[90vw] p-4">
          <DialogTitle className="sr-only">{t("admin.customer_creation.qr_title")}</DialogTitle>
          {selectedQrCustomer?.qr_code && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={selectedQrCustomer.qr_code}
                alt={t("admin.customer_creation.qr_title")}
                className="h-auto w-[min(75vw,320px)] object-contain"
              />
              <div className="text-center">
                <p className="font-semibold text-gray-800">{selectedQrCustomer.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedQrCustomer.unique_id}</p>
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
