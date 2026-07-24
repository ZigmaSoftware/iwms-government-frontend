import type { StateLeader } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { stateLeaderApi } from "@/helpers/admin";
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
const STATE_LEADER_TEMPLATE_COLUMNS: ExcelTemplateColumn[] = [
  { field: "username",    header: "username",    required: true, sample: "state_leader_01" },
  { field: "password",    header: "password",    required: true, sample: "SecurePass@123" },
  { field: "leader_name", header: "leader_name", required: false, sample: "Ravi Kumar" },
  { field: "email",       header: "email",       required: false, sample: "ravi@example.com" },
  { field: "state_id",    header: "state_id",    required: true,  sample: "STATE-xxxx" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────
export default function StateLeaderListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { encLeaderLogin, encStateLeaderCreation } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH } = createCrudRoutePaths(encLeaderLogin, encStateLeaderCreation);
  const { editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encLeaderLogin, encStateLeaderCreation);

  const [allRecords, setAllRecords]         = useState<StateLeader[]>([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isUpdating, setIsUpdating]         = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global:     { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    username:   { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    leader_name:{ value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    state_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    stateLeaderApi
      .readAll()
      .then((data: unknown) => {
        if (!mounted) return;
        const rows: StateLeader[] = Array.isArray(data)
          ? (data as StateLeader[])
          : ((data as any)?.results ?? []);
        setAllRecords(rows);
      })
      .catch(() => {
        if (mounted)
          Swal.fire({ icon: "error", title: t("common.error"), text: t("common.load_failed") });
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t, refetchTrigger]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as typeof filters);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  // ── Excel ────────────────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    exportTemplateToExcel(
      STATE_LEADER_TEMPLATE_COLUMNS,
      getAdminScreenExcelFilename("template"),
      "State Leaders",
    );
  };

  const handleDownloadAll = () => {
    exportRecordsToExcel(
      allRecords as unknown as Record<string, unknown>[],
      getAdminScreenExcelFilename("all"),
      "State Leaders",
    );
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const csvFile = await excelFileToCsvFile(file, "state_leader_bulk.csv");
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await adminApi.stateLeaders.action("bulk-upload", formData, {
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
  const statusTemplate = (row: StateLeader) => {
    const toggle = async (checked: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await stateLeaderApi.update(row.unique_id, { is_active: checked });
        setAllRecords((prev) =>
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
  const actionTemplate = (row: StateLeader) => (
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

  const indexTemplate = (_: StateLeader, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

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
          <h1 className="text-3xl font-bold text-gray-800 mb-1">State Leader</h1>
          <p className="text-sm text-gray-500">Manage State Leader records</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            label="Add State Leader"
            icon="pi pi-plus"
            className="p-button-success !bg-green-600 !border-green-600 hover:!bg-green-700"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* ── DataTable ── */}
      <DataTable
        value={allRecords}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && allRecords.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage="No State Leader found."
        globalFilterFields={["username", "leader_name", "email", "state_name"]}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={indexTemplate} style={{ width: "70px" }} />

        <Column
          field="username"
          header="Username"
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: StateLeader) => capitalize(r.username)}
        />

        <Column
          field="leader_name"
          header="Leader Name"
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: StateLeader) => capitalize(r.leader_name) || "-"}
        />

        <Column
          field="state_name"
          header="State"
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: StateLeader) => capitalize(r.state_name) || "-"}
        />

        <Column
          field="email"
          header="Email"
          body={(r: StateLeader) => r.email || "-"}
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
