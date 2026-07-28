import type { DistrictLeader } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { districtLeaderApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import {
  exportRecordsToExcel,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  excelFileToCsvFile,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";
import { adminApi } from "@/helpers/admin/registry";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { capitalize } from "@/utils/capitalize";

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

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await districtLeaderApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof (response as any)?.count === "number" ? (response as any).count : toRecordList(response).length,
      );
    } catch {
      Swal.fire({ icon: "error", title: t("common.error"), text: t("common.load_failed") });
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
  }, [first, rowsPerPage, searchTerm, ordering, refetchTrigger]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

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

  // ── Excel ────────────────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    exportTemplateToExcel(
      DISTRICT_LEADER_TEMPLATE_COLUMNS,
      getAdminScreenExcelFilename("template"),
      "District Leaders",
    );
  };

  const handleDownloadAll = async () => {
    const all = await districtLeaderApi.readAllForExport();
    exportRecordsToExcel(
      all as unknown as Record<string, unknown>[],
      getAdminScreenExcelFilename("all"),
      "District Leaders",
    );
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const csvFile = await excelFileToCsvFile(file, "district_leader_bulk.csv");
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await adminApi.districtLeaders.action("bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const errors = Array.isArray(res.errors) ? res.errors : [];
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "completed",
        success_count: Number(res.success_count ?? 0),
        error_count: errors.length,
      });

      Swal.fire({
        icon: "success",
        title: "Upload Completed",
        html: `<b>Success:</b> ${res.success_count ?? 0}<br/><b>Errors:</b> ${errors.length}`,
      });
      setRefetchTrigger((p) => p + 1);
    } catch {
      recordExcelAudit("upload_excel", { file_name: file.name, status: "failed" });
      Swal.fire("Error", "Upload failed", "error");
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
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
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

  // ── Actions ─────────────────────────────────────────────────────────────────
  const actionTemplate = (row: DistrictLeader) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: DistrictLeader, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  // ── Table header toolbar ─────────────────────────────────────────────────────
  const renderHeader = () => (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 shadow-sm">
        <i className="pi pi-search text-gray-400 text-sm" />
        <input
          type="text"
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder="Search"
          className="border-0 outline-none text-sm bg-transparent text-gray-700 placeholder:text-gray-400 min-w-[180px]"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          label="Download Template"
          icon="pi pi-download"
          severity="secondary"
          className="p-button-sm !text-gray-700 !border-gray-300 !bg-white hover:!bg-gray-50"
          onClick={handleDownloadTemplate}
        />
        <Button
          label="Upload Excel"
          icon="pi pi-upload"
          className="p-button-sm !bg-blue-600 !border-blue-600 hover:!bg-blue-700"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleUploadExcel}
        />
        <Button
          label="Download All Excel"
          icon="pi pi-download"
          className="p-button-sm !bg-green-600 !border-green-600 hover:!bg-green-700"
          onClick={handleDownloadAll}
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">

      {/* ── Page header ── */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">District Leader</h1>
          <p className="text-sm text-gray-500">Manage District Leader records</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            label="Add District Leader"
            icon="pi pi-plus"
            className="p-button-success !bg-green-600 !border-green-600 hover:!bg-green-700"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

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
    </div>
  );
}
