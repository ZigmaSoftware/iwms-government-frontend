import type { VehicleCreationRecord, VehicleDocumentHistoryRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScreenAccess } from "@/contexts/screenPermission";
import notify from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import ExpiryBadge from "@/components/common/ExpiryBadge";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { vehicleCreationApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import { API_ROOT } from "@/config/configApi";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import {
  excelFileToCsvFile,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  readExcelRows,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";
import BulkUploadResultDialog from "@/components/common/BulkUploadResultDialog";
import BulkRejectedPanel from "@/components/common/BulkRejectedPanel";
import {
  clearBulkResult,
  loadBulkResult,
  normalizeBulkErrors,
  saveBulkResult,
  type BulkUploadResult,
} from "@/utils/bulkUpload";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Can } from "@/contexts/ScreenPermissionContext";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useStatusFilter } from "@/components/filters/useOptionFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

const VEHICLE_CREATION_COLUMN_FIELDS: Record<string, string[]> = {
  vehicle_no: ["vehicle_no", "vehicle"],
  vehicle_type_name: ["vehicle_type_id", "vehicle_type_name", "vehicle_type"],
  fuel_type_name: ["fuel_type_id", "fuel_type_name", "fuel_type"],
  ulb_name: ["corporation_id", "corporation_name", "municipality_id", "municipality_name", "town_panchayat_id", "town_panchayat_name"],
  rlb_name: ["panchayat_union_id", "panchayat_union_name", "panchayat_id", "panchayat_name"],
  capacity: ["capacity"],
  mileage_per_liter: ["mileage_per_liter", "mileage"],
  fuel_tank_capacity: ["fuel_tank_capacity"],
  vehicle_condition: ["vehicle_condition"],
  insurance_expiry_date: ["insurance_expiry_date"],
  rc_upload: ["rc_upload"],
  vehicle_insurance_file: ["vehicle_insurance_file"],
  is_active: ["is_active", "status", "active_status"],
};

// A vehicle belongs to exactly one urban level (Corporation/Municipality/Town
// Panchayat) or one rural level (Panchayat Union/Panchayat) — resolve
// whichever is populated, same convention as the Collection Point list.
const ULB_LEVELS: Array<{ field: string; label: string }> = [
  { field: "corporation_name", label: "Corporation" },
  { field: "municipality_name", label: "Municipality" },
  { field: "town_panchayat_name", label: "Town Panchayat" },
];

const RLB_LEVELS: Array<{ field: string; label: string }> = [
  { field: "panchayat_union_name", label: "Panchayat Union" },
  { field: "panchayat_name", label: "Panchayat" },
];

const resolveLocalBody = (row: VehicleCreationRecord, levels: Array<{ field: string; label: string }>) => {
  for (const level of levels) {
    const value = (row as Record<string, unknown>)[level.field];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return { name: String(value), level: level.label };
    }
  }
  return null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_ORIGIN = (() => {
  try {
    return new URL(API_ROOT).origin;
  } catch {
    return "";
  }
})();

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

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/media/")) return `${API_ORIGIN}${encodeURI(trimmed)}`;
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  if (withoutLeadingSlash.startsWith("media/")) {
    return `${API_ORIGIN}/${encodeURI(withoutLeadingSlash)}`;
  }
  return `${API_ORIGIN}/media/${encodeURI(withoutLeadingSlash)}`;
};

const fileNameFromPath = (value?: string | null) => {
  if (!value) return "document";
  const cleaned = value.split("?")[0].replace(/\/+$/, "");
  return decodeURIComponent(cleaned.substring(cleaned.lastIndexOf("/") + 1)) || "document";
};

const toRecordList = (value: unknown): VehicleCreationRecord[] => {
  if (Array.isArray(value)) return value as VehicleCreationRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: VehicleCreationRecord[] }).results;
  }
  return [];
};

const toHistoryList = (value: unknown): VehicleDocumentHistoryRecord[] => {
  if (Array.isArray(value)) return value as VehicleDocumentHistoryRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: VehicleDocumentHistoryRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["vehicle_no"]);

function DocumentHistoryDialog({
  vehicle,
  rows,
  loading,
  error,
  onClose,
  onOpenFile,
}: {
  vehicle: VehicleCreationRecord;
  rows: VehicleDocumentHistoryRecord[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenFile: (fileUrl?: string | null) => void;
}) {
  const documentLabel = (value?: string | null) => {
    if (value === "INSURANCE") return "Insurance";
    if (value === "RC") return "RC";
    return value || "-";
  };

  const renderFileLink = (value?: string | null) =>
    resolveMediaUrl(value) ? (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`View ${fileNameFromPath(value)}`}
          title="View"
          onClick={() => onOpenFile(resolveMediaUrl(value))}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-900"
        >
          <span className="pi pi-eye" aria-hidden="true" />
        </button>
        <a
          href={resolveMediaUrl(value)}
          download={fileNameFromPath(value)}
          aria-label={`Download ${fileNameFromPath(value)}`}
          title="Download"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-green-100 text-green-700 hover:bg-green-50 hover:text-green-900"
        >
          <span className="pi pi-download" aria-hidden="true" />
        </a>
      </div>
    ) : (
      <span className="text-gray-400">-</span>
    );

  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div>
          <p className="text-lg font-semibold text-gray-800">Document History</p>
          <p className="mt-0.5 text-xs font-normal text-gray-500">{vehicle.vehicle_no}</p>
        </div>
      }
      style={{ width: "min(980px, 94vw)" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="pt-2">
        {loading && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading document history">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 rounded-md bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">No document history yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Renewed insurance or RC changes will appear here after the vehicle is updated.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Old No.</th>
                  <th className="px-3 py-2">New No.</th>
                  <th className="px-3 py-2">Old Expiry</th>
                  <th className="px-3 py-2">New Expiry</th>
                  <th className="px-3 py-2">Old File</th>
                  <th className="px-3 py-2">New File</th>
                  <th className="px-3 py-2">Updated By</th>
                  <th className="px-3 py-2">Updated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((item) => (
                  <tr key={item.unique_id} className="align-top">
                    <td className="px-3 py-3 font-medium text-gray-800">{documentLabel(item.document_type)}</td>
                    <td className="px-3 py-3 text-gray-600">{item.previous_document_number || "-"}</td>
                    <td className="px-3 py-3 text-gray-800">{item.new_document_number || "-"}</td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(item.previous_expiry_date)}</td>
                    <td className="px-3 py-3 text-gray-800">{formatDate(item.new_expiry_date)}</td>
                    <td className="px-3 py-3">{renderFileLink(item.previous_file)}</td>
                    <td className="px-3 py-3">{renderFileLink(item.new_file)}</td>
                    <td className="px-3 py-3 text-gray-600">{item.changed_by_name || item.changed_by_id || "-"}</td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(item.changed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VehicleCreationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canAdd } = useScreenAccess();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-creation",
    VEHICLE_CREATION_COLUMN_FIELDS,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const [rawRows, setRawRows] = useState<VehicleCreationRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [historyVehicle, setHistoryVehicle] = useState<VehicleCreationRecord | null>(null);
  const [historyRows, setHistoryRows] = useState<VehicleDocumentHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const BULK_KEY = "vehicle-creation";
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(() =>
    loadBulkResult(BULK_KEY),
  );
  const [resultOpen, setResultOpen] = useState(false);
  const geo = useHierarchyFilter(() => setFirst(0));
  const status = useStatusFilter(() => setFirst(0));
  const filterParams = { ...geo.applied, ...status.applied };
  const filterKey = JSON.stringify(filterParams);

  // ── Routes ────────────────────────────────────────────────────────────────
  const { encTransportMaster, encVehicleCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encVehicleCreation,
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadRows = async (
    page: number,
    limit: number,
    search: string,
    ordering?: string,
  ) => {
    setIsLoading(true);
    try {
      const response = await vehicleCreationApi.readAllwithPaginated(page, limit, {
        params: {
          ...filterParams,
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      const list = toRecordList(response);
      setRawRows(list);
      setTotalRecords(
        typeof response?.count === "number" ? response.count : list.length,
      );
    } catch (error: unknown) {
      notify.fire({
        icon: "error",
        title: t("common.error"),
        text: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ordering =
    sortField && SORTABLE_FIELDS.has(sortField)
      ? `${sortOrder === -1 ? "-" : ""}${sortField}`
      : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, refetchTrigger, filterKey]);

  useEffect(() => {
    setFirst(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTrigger]);

  const rows = rawRows.map((row) => {
    const ulb = resolveLocalBody(row, ULB_LEVELS);
    const rlb = resolveLocalBody(row, RLB_LEVELS);
    return {
      ...row,
      _ulb_name: ulb?.name ?? "",
      _ulb_level: ulb?.level ?? "",
      _rlb_name: rlb?.name ?? "",
      _rlb_level: rlb?.level ?? "",
    };
  });

  // ── Pagination / sort / filter handlers ──────────────────────────────────
  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onExportRequest = async () =>
    toRecordList(await vehicleCreationApi.readAllForExport({ params: filterParams }));

  // ── Bulk upload ───────────────────────────────────────────────────────────
  const downloadVehicleTemplate = async () => {
    await exportTemplateToExcel(
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
      const originalRows = (await readExcelRows(file)) as Record<string, unknown>[];
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

      const errors = normalizeBulkErrors(res.errors, originalRows);
      const successCount = Number(res.success_count ?? 0);
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "completed",
        success_count: successCount,
        error_count: errors.length,
      });
      const result: BulkUploadResult = {
        fileName: file.name,
        successCount,
        errors,
        originalRows,
      };
      // Persist rejected rows so they stay visible across table refetch / reload.
      if (errors.length > 0) saveBulkResult(BULK_KEY, result);
      else clearBulkResult(BULK_KEY);
      setUploadResult(result);
      setResultOpen(true);

      notify.fire({
        icon: errors.length > 0 ? "warning" : "success",
        title: "Upload Completed",
        text: `Success: ${successCount} · Rejected: ${errors.length}. ${errors.length > 0 ? "See rejected list below." : ""}`,
      });

      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Vehicle bulk upload failed:", err);
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "failed",
      });
      notify.fire("Error", "Upload failed", "error");
    } finally {
      event.target.value = "";
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirmDelete = await notify.fire({
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
      setRawRows((current) =>
        current.filter((item) => item.unique_id !== id),
      );
      notify.fire({
        icon: "success",
        title: t("common.deleted_success"),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to delete vehicle:", error);
      notify.fire({
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
    resolveMediaUrl(value) ? (
      <div className="flex items-center justify-center">
        <button
          type="button"
          aria-label={`View current document ${fileNameFromPath(value)}`}
          title="View current document"
          onClick={() => openFile(resolveMediaUrl(value))}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-900"
        >
          <span className={isImageUrl(value) ? "pi pi-image" : "pi pi-file-pdf"} aria-hidden="true" />
        </button>
      </div>
    ) : (
      "-"
    );

  const openDocumentHistory = async (row: VehicleCreationRecord) => {
    setHistoryVehicle(row);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(true);

    try {
      const response = await vehicleCreationApi.read(`${row.unique_id}/document-history/`);
      setHistoryRows(toHistoryList(response));
    } catch (error) {
      console.error("Failed to load vehicle document history:", error);
      setHistoryError(t("common.request_failed"));
    } finally {
      setHistoryLoading(false);
    }
  };

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
        setRawRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id
              ? { ...item, is_active: value }
              : item,
          ),
        );
      } catch (error) {
        console.error("Status update failed:", error);
        notify.fire({
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
    <RowActionsMenu
      onEdit={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      onDelete={() => void handleDelete(row.unique_id)}
      editLabel={t("common.edit")}
      deleteLabel={t("common.delete")}
      extraItems={[
        {
          label: "Document History",
          icon: <span className="pi pi-history text-sm" aria-hidden="true" />,
          onClick: () => void openDocumentHistory(row),
        },
      ]}
    />
  );

  const conditionLabel = (value?: string | null) => {
    if (value === "SECOND_HAND")
      return t("admin.vehicle_creation.condition_second_hand");
    if (value === "NEW") return t("admin.vehicle_creation.condition_new");
    return value || "-";
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.vehicle_creation.title")}
        subtitle={t("admin.vehicle_creation.subtitle")}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleVehicleFileUpload}
            />
            <Can action="add">
              <Button
                label={t("admin.vehicle_creation.add")}
                icon="pi pi-plus"
                className="p-button-success"
                onClick={() => navigate(ENC_NEW_PATH)}
              />
            </Can>
          </>
        }
        className="mb-6"
      />

      {uploadResult && uploadResult.errors.length > 0 && (
        <BulkRejectedPanel
          result={uploadResult}
          onClear={() => {
            clearBulkResult(BULK_KEY);
            setUploadResult(null);
          }}
          onReupload={() => fileInputRef.current?.click()}
          onViewAll={() => setResultOpen(true)}
          downloadFilename="vehicle_rejected.xlsx"
        />
      )}

      {/* Table */}
      <DataTable
        value={rows}
        bulkImportable={false}
        filterPanel={combineFilters(geo, status)}
        documentActions={{
          uploadExcel: {
            onClick: () => fileInputRef.current?.click(),
            hidden: !canAdd,
          },
          downloadTemplate: { onClick: () => void downloadVehicleTemplate() },
        }}
        dataKey="unique_id"
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && rows.length === 0}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder={t("admin.vehicle_creation.search_placeholder")}
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        className="p-datatable-sm"
        tableStyle={{ minWidth: "1120px" }}
        onExportRequest={onExportRequest}
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
            sortable={SORTABLE_FIELDS.has("vehicle_no")}
          />
        )}
        {showCol("vehicle_type_name") && (
          <Column
            field="vehicle_type_name"
            header={t("admin.vehicle_creation.vehicle_type")}
          />
        )}
        {showCol("fuel_type_name") && (
          <Column
            field="fuel_type_name"
            header={t("admin.vehicle_creation.fuel_type")}
          />
        )}
        {showCol("ulb_name") && (
          <Column
            field="_ulb_name"
            header="ULB"
            body={(row: VehicleCreationRecord & { _ulb_name?: string; _ulb_level?: string }) =>
              row._ulb_name ? (
                <span>
                  {row._ulb_name} <span className="text-xs text-gray-400">({row._ulb_level})</span>
                </span>
              ) : (
                "-"
              )
            }
          />
        )}
        {showCol("rlb_name") && (
          <Column
            field="_rlb_name"
            header="RLB"
            body={(row: VehicleCreationRecord & { _rlb_name?: string; _rlb_level?: string }) =>
              row._rlb_name ? (
                <span>
                  {row._rlb_name} <span className="text-xs text-gray-400">({row._rlb_level})</span>
                </span>
              ) : (
                "-"
              )
            }
          />
        )}
        {showCol("capacity") && (
          <Column
            field="capacity"
            header={t("admin.vehicle_creation.capacity")}
          />
        )}
        {showCol("mileage_per_liter") && (
          <Column
            field="mileage_per_liter"
            header={t("admin.vehicle_creation.mileage_per_liter")}
          />
        )}
        {showCol("fuel_tank_capacity") && (
          <Column
            field="fuel_tank_capacity"
            header={t("admin.vehicle_creation.fuel_tank_capacity")}
          />
        )}
        {showCol("vehicle_condition") && (
          <Column
            field="vehicle_condition"
            header={t("admin.vehicle_creation.vehicle_condition")}
            body={(row: VehicleCreationRecord) =>
              conditionLabel(row.vehicle_condition)
            }
          />
        )}
        {showCol("insurance_expiry_date") && (
          <Column
            field="insurance_expiry_date"
            header={t("admin.vehicle_creation.insurance_expiry_date")}
            body={(row: VehicleCreationRecord) => (
              <div className="flex flex-col gap-1">
                <span>{formatDate(row.insurance_expiry_date)}</span>
                <ExpiryBadge label="Insurance" date={row.insurance_expiry_date} />
              </div>
            )}
          />
        )}
        {showCol("rc_upload") && (
          <Column
            field="rc_upload"
            header={t("admin.vehicle_creation.rc_upload")}
            body={(row: VehicleCreationRecord) =>
              renderFilePreview(row.rc_upload)
            }
            style={{ width: "96px" }}
            bodyStyle={{ textAlign: "center" }}
          />
        )}
        {showCol("vehicle_insurance_file") && (
          <Column
            field="vehicle_insurance_file"
            header={t("admin.vehicle_creation.vehicle_insurance_file")}
            body={(row: VehicleCreationRecord) =>
              renderFilePreview(row.vehicle_insurance_file)
            }
            style={{ width: "110px" }}
            bodyStyle={{ textAlign: "center" }}
          />
        )}
        {showCol("is_active") && (
          <Column
            field="is_active"
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "92px" }}
            bodyStyle={{ textAlign: "center" }}
          />
        )}
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "88px" }}
          bodyStyle={{ textAlign: "center" }}
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

      {historyVehicle && (
        <DocumentHistoryDialog
          vehicle={historyVehicle}
          rows={historyRows}
          loading={historyLoading}
          error={historyError}
          onClose={() => setHistoryVehicle(null)}
          onOpenFile={openFile}
        />
      )}

      <BulkUploadResultDialog
        visible={resultOpen}
        onClose={() => setResultOpen(false)}
        title="Vehicle bulk upload — rejected records"
        result={uploadResult}
        downloadFilename="vehicle_rejected.xlsx"
      />
    </div>
  );
}
