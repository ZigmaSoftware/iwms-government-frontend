import type { DistrictLeader } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { districtLeaderApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import {
  exportRecordsToExcel,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  excelFileToCsvFile,
  readExcelRows,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";
import BulkUploadResultDialog from "@/components/common/BulkUploadResultDialog";
import { normalizeBulkErrors, type BulkUploadResult } from "@/utils/bulkUpload";
import { adminApi } from "@/helpers/admin/registry";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { capitalize } from "@/utils/capitalize";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Can } from "@/contexts/ScreenPermissionContext";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useStatusFilter } from "@/components/filters/useOptionFilter";

// ─── Template columns ──────────────────────────────────────────────────────────
const DISTRICT_LEADER_TEMPLATE_COLUMNS: ExcelTemplateColumn[] = [
  { field: "username",    header: "username",    required: true, sample: "district_leader_01" },
  { field: "password",    header: "password",    required: true, sample: "SecurePass@123" },
  { field: "leader_name", header: "leader_name", required: false, sample: "Ravi Kumar" },
  { field: "email",       header: "email",       required: false, sample: "ravi@example.com" },
  { field: "district_id", header: "district_id", required: true,  sample: "DIST-xxxx" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toRecordList = (value: unknown): DistrictLeader[] => {
  if (Array.isArray(value)) return value as DistrictLeader[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: DistrictLeader[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["username"]);

// ─── Component ────────────────────────────────────────────────────────────────
export default function DistrictLeaderListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { encLeaderLogin, encDistrictLeaderCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH } = createCrudRoutePaths(encLeaderLogin, encDistrictLeaderCreation);
  const { editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encLeaderLogin, encDistrictLeaderCreation);

  const [rows, setRows]                     = useState<DistrictLeader[]>([]);
  const [totalRecords, setTotalRecords]     = useState(0);
  const [first, setFirst]                   = useState(0);
  const [rowsPerPage, setRowsPerPage]       = useState(10);
  const [isLoading, setIsLoading]           = useState(false);
  const [isUpdating, setIsUpdating]         = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm]         = useState("");
  const [sortField, setSortField]           = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder]           = useState<SortOrder>(undefined);
  const BULK_KEY = "district-leaders";
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(() =>
    loadBulkResult(BULK_KEY),
  );
  const [resultOpen, setResultOpen] = useState(false);
  const geo    = useHierarchyFilter(() => setFirst(0));
  const status = useStatusFilter(() => setFirst(0));
  const filterParams = { ...geo.applied, ...status.applied };
  const filterKey = JSON.stringify(filterParams);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await districtLeaderApi.readAllwithPaginated(page, limit, {
        params: {
          ...filterParams,
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof (response as any)?.count === "number" ? (response as any).count : toRecordList(response).length,
      );
    } catch {
      notify.fire({ icon: "error", title: t("common.error"), text: t("common.load_failed") });
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, refetchTrigger, filterKey]);

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

  // ── Excel ────────────────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    await exportTemplateToExcel(
      DISTRICT_LEADER_TEMPLATE_COLUMNS,
      getAdminScreenExcelFilename("template"),
      "District Leaders",
    );
  };

  const handleDownloadAll = async () => {
    const all = await districtLeaderApi.readAllForExport({ params: filterParams });
    await exportRecordsToExcel(
      all as unknown as Record<string, unknown>[],
      getAdminScreenExcelFilename("all"),
      "District Leaders",
    );
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const originalRows = (await readExcelRows(file)) as Record<string, unknown>[];
      const csvFile = await excelFileToCsvFile(file, "district_leader_bulk.csv");
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await adminApi.districtLeaders.action("bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const errors = normalizeBulkErrors(res.errors, originalRows);
      const successCount = Number((res as { success_count?: unknown })?.success_count ?? 0);
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "completed",
        success_count: successCount,
        error_count: errors.length,
      });
      const uploadSummary: BulkUploadResult = { fileName: file.name, successCount, errors, originalRows };
      if (errors.length > 0) saveBulkResult(BULK_KEY, uploadSummary);
      else clearBulkResult(BULK_KEY);
      setUploadResult(uploadSummary);
      setResultOpen(true);

      notify.fire({
        icon: errors.length > 0 ? "warning" : "success",
        title: "Upload Completed",
        text: `Success: ${successCount} · Rejected: ${errors.length}. ${errors.length > 0 ? "See rejected list below." : ""}`,
      });
      setRefetchTrigger((p) => p + 1);
    } catch {
      recordExcelAudit("upload_excel", { file_name: file.name, status: "failed" });
      notify.fire("Error", "Upload failed", "error");
    } finally {
      e.target.value = "";
    }
  };

  // ── Status toggle ────────────────────────────────────────────────────────────
  const statusTemplate = (row: DistrictLeader) => {
    const toggle = async (checked: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await districtLeaderApi.update(row.unique_id, { is_active: checked });
        setRows((prev) =>
          prev.map((r) => r.unique_id === row.unique_id ? { ...r, is_active: checked } : r)
        );
      } catch {
        notify.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={(v) => void toggle(v)}
      />
    );
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirmDelete = await notify.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      await districtLeaderApi.delete(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({ icon: "success", title: "Deleted successfully", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to delete"), "error");
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const actionTemplate = (row: DistrictLeader) => (
    <RowActionsMenu
      onEdit={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      onDelete={() => void handleDelete(String(row.unique_id))}
      editLabel={t("common.edit")}
      deleteLabel={t("common.delete")}
    />
  );

  const indexTemplate = (_: DistrictLeader, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  // ── Table header toolbar ─────────────────────────────────────────────────────
  const renderHeader = () => (
    <FilterBar
      searchValue={globalFilterValue}
      onSearchChange={setGlobalFilterValue}
      searchPlaceholder="Search"
      className="mb-4"
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">

      {/* ── Page header ── */}
      <ListPageHeader
        title="District Leader"
        subtitle="Manage District Leader records"
        actions={
          <Can action="add">
            <Button
              label="Add District Leader"
              icon="pi pi-plus"
              className="p-button-success !bg-green-600 !border-green-600 hover:!bg-green-700"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </Can>
        }
        className="mb-6"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={handleUploadExcel}
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
          downloadFilename="district_leader_rejected.xlsx"
        />
      )}

      {/* ── DataTable ── */}
      <DataTable
        value={rows}
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
        loading={isLoading}
        header={renderHeader()}
        filterPanel={combineFilters(geo, status)}
        documentActions={{
          uploadExcel: { onClick: () => fileInputRef.current?.click() },
          downloadTemplate: { onClick: () => void handleDownloadTemplate() },
          downloadExcel: { onClick: () => void handleDownloadAll() },
        }}
        stripedRows
        showGridlines
        emptyMessage="No District Leader found."
        className="p-datatable-sm"
      >
        <Column header="S.No" body={indexTemplate} style={{ width: "70px" }} />

        <Column
          field="username"
          header="Username"
          sortable
          body={(r: DistrictLeader) => capitalize(r.username)}
        />

        <Column
          field="leader_name"
          header="Leader Name"
          body={(r: DistrictLeader) => capitalize(r.leader_name) || "-"}
        />

        <Column
          field="district_name"
          header="District"
          body={(r: DistrictLeader) => capitalize(r.district_name) || "-"}
        />

        <Column
          field="email"
          header="Email"
          body={(r: DistrictLeader) => r.email || "-"}
        />

        <Column
          header="Status"
          body={statusTemplate}
          style={{ width: "120px" }}
        />

        <Column
          header="Actions"
          body={actionTemplate}
          style={{ width: "100px", textAlign: "center" }}
        />
      </DataTable>

      <BulkUploadResultDialog
        visible={resultOpen}
        onClose={() => setResultOpen(false)}
        title="District leader bulk upload — rejected records"
        result={uploadResult}
        downloadFilename="district_leader_rejected.xlsx"
      />
    </div>
  );
}
