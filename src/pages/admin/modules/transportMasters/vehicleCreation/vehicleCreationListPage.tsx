import type { VehicleCreationRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon, TrashBinIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { vehicleCreationApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import {
  excelFileToCsvFile,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";

// ─── Types ────────────────────────────────────────────────────────────────────


const VEHICLE_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  vehicle_no: ["vehicle_no", "vehicle"],
  vehicle_type_name: ["vehicle_type_id", "vehicle_type_name", "vehicle_type"],
  fuel_type_name: ["fuel_type_id", "fuel_type_name", "fuel_type"],
  capacity: ["capacity"],
  mileage_per_liter: ["mileage_per_liter", "mileage"],
  fuel_tank_capacity: ["fuel_tank_capacity"],
  vehicle_condition: ["vehicle_condition"],
  insurance_expiry_date: ["insurance_expiry_date"],
  rc_upload: ["rc_upload"],
  vehicle_insurance_file: ["vehicle_insurance_file"],
  is_active: ["is_active", "status", "active_status"],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FILE_ICON = "/images/pdfimage/download.png";

const VEHICLE_BULK_TEMPLATE_COLUMNS: ExcelTemplateColumn[] = [
  { field: "vehicle_no", header: "vehicle_no", required: true, sample: "KA01AB1234" },
  { field: "vehicle_type", header: "vehicle_type", sample: "Compactor" },
  { field: "fuel_type", header: "fuel_type", sample: "Diesel" },
  { field: "capacity", header: "capacity", sample: "7500" },
  { field: "mileage_per_liter", header: "mileage_per_liter", sample: "5.4" },
  { field: "service_record", header: "service_record", sample: "Service at 2024-11-30" },
  { field: "vehicle_insurance", header: "vehicle_insurance", sample: "ICICI Lombard" },
  { field: "insurance_expiry_date", header: "insurance_expiry_date", sample: "2026-05-31" },
  { field: "vehicle_condition", header: "vehicle_condition", sample: "NEW" },
  { field: "fuel_tank_capacity", header: "fuel_tank_capacity", sample: "400" },
  { field: "is_active", header: "is_active", sample: "true" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const formatDate = (value?: string | null) =>
  value ? String(value).split("T")[0] : "-";

const isImageUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VehicleCreationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-creation",
    VEHICLE_CREATION_COLUMN_FIELDS,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: {
      value: null as string | null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    vehicle_no: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    vehicle_type_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    fuel_type_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    vehicle_condition: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    insurance_expiry_date: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
  });

  const [allVehicles, setAllVehicles] = useState<VehicleCreationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // ── Routes ────────────────────────────────────────────────────────────────
  const { encTransportMaster, encVehicleCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encVehicleCreation,
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    vehicleCreationApi
      .readAll()
      .then((data: unknown) => {
        if (!mounted) return;
        const list = Array.isArray(data)
          ? (data as VehicleCreationRecord[])
          : [];
        const seen = new Set<string>();
        setAllVehicles(
          list.filter((row) => {
            const key = row.unique_id?.toString();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
      })
      .catch((error: unknown) => {
        if (mounted) {
          Swal.fire({
            icon: "error",
            title: t("common.error"),
            text: String(error),
          });
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t, refetchTrigger]);

  const rows = allVehicles;

  // ── Filter handlers ───────────────────────────────────────────────────────
  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

  // ── Bulk upload ───────────────────────────────────────────────────────────
  const downloadVehicleTemplate = () => {
    exportTemplateToExcel(
      VEHICLE_BULK_TEMPLATE_COLUMNS,
      getAdminScreenExcelFilename("template"),
      "Vehicles",
    );
  };

  const handleVehicleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const csvFile = await excelFileToCsvFile(file, "vehicle_bulk_upload.csv");
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await adminApi.vehicleCreations.action(
        "bulk-upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const errors = Array.isArray(res.errors) ? res.errors : [];
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "completed",
        success_count: Number(res.success_count ?? 0),
        error_count: errors.length,
      });
      const errorPreview =
        errors.length > 0
          ? `<hr/><div class="text-left text-xs mt-2">${errors
              .slice(0, 3)
              .map((entry: { row: number; error: unknown }) => {
                const detail =
                  typeof entry.error === "string"
                    ? entry.error
                    : JSON.stringify(entry.error);
                return `Row ${entry.row}: ${detail}`;
              })
              .join("<br/>")}</div>`
          : "";

      Swal.fire({
        icon: "success",
        title: "Upload Completed",
        html: `<b>Success:</b> ${res.success_count}<br/><b>Errors:</b> ${errors.length}${errorPreview}`,
      });

      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Vehicle bulk upload failed:", err);
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "failed",
      });
      Swal.fire("Error", "Upload failed", "error");
    } finally {
      event.target.value = "";
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirmDelete = await Swal.fire({
      title: t("common.confirm_title"),
      text: t("common.confirm_delete_text"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });
    if (!confirmDelete.isConfirmed) return;

    try {
      await vehicleCreationApi.delete(id);
      setAllVehicles((current) =>
        current.filter((item) => item.unique_id !== id),
      );
      Swal.fire({
        icon: "success",
        title: t("common.deleted_success"),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to delete vehicle:", error);
      Swal.fire({
        icon: "error",
        title: t("common.delete_failed"),
        text: t("common.request_failed"),
      });
    }
  };

  // ── File preview ──────────────────────────────────────────────────────────
  const openFile = (fileUrl?: string | null) => {
    if (!fileUrl) return;
    if (isImageUrl(fileUrl)) {
      setModalImage(fileUrl);
    } else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const renderFilePreview = (value?: string | null) =>
    value ? (
      <button onClick={() => openFile(value)}>
        <img
          src={isImageUrl(value) ? value : FILE_ICON}
          className="w-28 h-16 object-cover rounded border"
        />
      </button>
    ) : (
      "-"
    );

  // ── Status toggle ─────────────────────────────────────────────────────────
  const statusTemplate = (row: VehicleCreationRecord) => {
    const updateStatus = async (value: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await vehicleCreationApi.update(
          row.unique_id,
          filterPayload({
            vehicle_no: row.vehicle_no,
            vehicle_type_id: row.vehicle_type_id ?? null,
            fuel_type_id: row.fuel_type_id ?? null,
            capacity: row.capacity ?? null,
            mileage_per_liter: row.mileage_per_liter ?? null,
            service_record: row.service_record ?? null,
            vehicle_insurance: row.vehicle_insurance ?? null,
            insurance_expiry_date: row.insurance_expiry_date ?? null,
            vehicle_condition: row.vehicle_condition ?? "NEW",
            fuel_tank_capacity: row.fuel_tank_capacity ?? null,
            is_active: value,
          }) as Record<string, unknown>,
        );
        setAllVehicles((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id
              ? { ...item, is_active: value }
              : item,
          ),
        );
      } catch (error) {
        console.error("Status update failed:", error);
        Swal.fire({
          icon: "error",
          title: t("common.update_status_failed"),
          text: t("common.request_failed"),
        });
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={updateStatus}
      />
    );
  };

  // ── Action buttons ────────────────────────────────────────────────────────
  const actionTemplate = (row: VehicleCreationRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
      <button
        onClick={() => handleDelete(row.unique_id)}
        className="inline-flex items-center justify-center text-red-600 hover:text-red-800"
        title={t("common.delete")}
      >
        <TrashBinIcon className="size-5" />
      </button>
    </div>
  );

  const conditionLabel = (value?: string | null) => {
    if (value === "SECOND_HAND")
      return t("admin.vehicle_creation.condition_second_hand");
    if (value === "NEW") return t("admin.vehicle_creation.condition_new");
    return value || "-";
  };

  // ── Table header ──────────────────────────────────────────────────────────
  const renderHeader = () => (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.vehicle_creation.search_placeholder")}
          className="p-inputtext-sm !border-0 !shadow-none !outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          label={t("admin.vehicle_creation.download_template", {
            defaultValue: "Download Template",
          })}
          icon="pi pi-download"
          severity="secondary"
          className="p-button-sm"
          onClick={downloadVehicleTemplate}
        />
        <Button
          label={t("admin.vehicle_creation.upload_csv", {
            defaultValue: "Upload Excel",
          })}
          icon="pi pi-upload"
          className="p-button-sm"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleVehicleFileUpload}
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.vehicle_creation.title")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t("admin.vehicle_creation.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Add button */}
          <Button
            label={t("admin.vehicle_creation.add")}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        value={rows}
        bulkImportable={false}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && rows.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        globalFilterFields={[
          ...(showCol("vehicle_no") ? ["vehicle_no"] : []),
          ...(showCol("vehicle_type_name") ? ["vehicle_type_name"] : []),
          ...(showCol("fuel_type_name") ? ["fuel_type_name"] : []),
        ]}
        emptyMessage={t("admin.vehicle_creation.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(
            _: VehicleCreationRecord,
            { rowIndex }: { rowIndex: number },
          ) => rowIndex + 1}
          style={{ width: "80px" }}
        />
        {showCol("vehicle_no") && (
          <Column
            field="vehicle_no"
            header={t("admin.vehicle_creation.vehicle_no")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("vehicle_type_name") && (
          <Column
            field="vehicle_type_name"
            header={t("admin.vehicle_creation.vehicle_type")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("fuel_type_name") && (
          <Column
            field="fuel_type_name"
            header={t("admin.vehicle_creation.fuel_type")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("capacity") && (
          <Column
            field="capacity"
            header={t("admin.vehicle_creation.capacity")}
            sortable
          />
        )}
        {showCol("mileage_per_liter") && (
          <Column
            field="mileage_per_liter"
            header={t("admin.vehicle_creation.mileage_per_liter")}
            sortable
          />
        )}
        {showCol("fuel_tank_capacity") && (
          <Column
            field="fuel_tank_capacity"
            header={t("admin.vehicle_creation.fuel_tank_capacity")}
            sortable
          />
        )}
        {showCol("vehicle_condition") && (
          <Column
            field="vehicle_condition"
            header={t("admin.vehicle_creation.vehicle_condition")}
            body={(row: VehicleCreationRecord) =>
              conditionLabel(row.vehicle_condition)
            }
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("insurance_expiry_date") && (
          <Column
            field="insurance_expiry_date"
            header={t("admin.vehicle_creation.insurance_expiry_date")}
            body={(row: VehicleCreationRecord) =>
              formatDate(row.insurance_expiry_date)
            }
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}
        {showCol("rc_upload") && (
          <Column
            field="rc_upload"
            header={t("admin.vehicle_creation.rc_upload")}
            body={(row: VehicleCreationRecord) =>
              renderFilePreview(row.rc_upload)
            }
          />
        )}
        {showCol("vehicle_insurance_file") && (
          <Column
            field="vehicle_insurance_file"
            header={t("admin.vehicle_creation.vehicle_insurance_file")}
            body={(row: VehicleCreationRecord) =>
              renderFilePreview(row.vehicle_insurance_file)
            }
          />
        )}
        {showCol("is_active") && (
          <Column
            field="is_active"
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "150px" }}
          />
        )}
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px" }}
        />
      </DataTable>

      {/* Image modal */}
      {modalImage && (
        <div className="fixed inset-0 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded shadow relative">
            <button
              className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded"
              onClick={() => setModalImage(null)}
            >
              X
            </button>
            <img
              src={modalImage}
              className="w-[400px] h-[400px] max-w-[92vw] max-h-[92vw] rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
