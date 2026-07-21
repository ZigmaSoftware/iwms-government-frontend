import type { LoginAuditRecord } from "./types";
import { useCallback, useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi } from "@/helpers/admin/registry";
import { normalizeList } from "@/utils/forms";


const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const formatAuditValue = (value?: string | boolean | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const JsonViewer = ({ title, value }: { title: string; value?: Record<string, unknown> }) => (
  <div className="min-w-0">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
    <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
      {value ? JSON.stringify(value, null, 2) : "-"}
    </pre>
  </div>
);

export default function LoginAuditList() {
  const { t } = useTranslation();

  const [rows, setRows] = useState<LoginAuditRecord[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<LoginAuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    adminApi.loginAudits
      .readAll()
      .then((data: LoginAuditRecord[]) => {
        if (!mounted) return;
        setRows(normalizeList(data) as LoginAuditRecord[]);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        Swal.fire(t("common.error"), String(err), "error");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  const openDetails = useCallback((record: LoginAuditRecord) => {
    setSelectedAudit(record);
  }, []);

  const closeDetails = useCallback(() => setSelectedAudit(null), []);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
  };

  const actionTemplate = useCallback(
    (row: LoginAuditRecord) => (
      <div className="flex justify-center">
        <button
          title={t("common.view")}
          onClick={() => openDetails(row)}
          className="text-blue-600 hover:text-blue-800"
        >
          {t("common.view")}
        </button>
      </div>
    ),
    [openDetails, t]
  );

  const header = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">{t("admin.nav.login_audit")}</h1>
          <p className="text-sm text-gray-500">{t("admin.login_audit_subtitle", "Login audit records")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1 max-w-md">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.login_audit_search", "Search login audits...")}
          className="border-none text-sm w-full"
        />
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && rows.length === 0}
        filters={filters}
        onFilter={(e) => setFilters(e.filters as DataTableFilterMeta)}
        header={header}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_records")}
        globalFilterFields={["unique_id", "username", "ip_address", "user_agent", "reason"]}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={(_: any, { rowIndex }: any) => rowIndex + 1} style={{ width: 70 }} />
        <Column field="unique_id" header="ID" sortable filter showFilterMatchModes={false} />
        <Column field="username" header="Username" sortable filter showFilterMatchModes={false} />
        <Column field="ip_address" header="IP Address" filter showFilterMatchModes={false} />
        <Column field="user_agent" header="User Agent" filter showFilterMatchModes={false} />
        <Column
          field="success"
          header="Success"
          body={(row: LoginAuditRecord) => formatAuditValue(row.success)}
          filter
          showFilterMatchModes={false}
        />
        <Column field="reason" header="Reason" filter showFilterMatchModes={false} />
        <Column
          field="timestamp"
          header="Timestamp"
          body={(row: LoginAuditRecord) => formatDateTime(row.timestamp)}
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ minWidth: 120 }} />
      </DataTable>

      <Dialog open={Boolean(selectedAudit)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.login_audit_details", "Login Audit Details")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <JsonViewer title="Audit Record" value={selectedAudit ?? undefined} />
            <div className="space-y-2">
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Username</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.username ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">IP Address</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.ip_address ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">User Agent</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.user_agent ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Success</p>
                <p className="font-semibold text-gray-900">{formatAuditValue(selectedAudit?.success)}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Timestamp</p>
                <p className="font-semibold text-gray-900">{formatDateTime(selectedAudit?.timestamp)}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
