import type { RetripStatus, TripRetripRequestRecord } from "./types";
import { RETRIP_STATUS_LABELS } from "./types";
import { useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { Dialog } from "primereact/dialog";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { api } from "@/api";
import { retripRequestApi } from "@/helpers/admin";

/* ── Badge helpers ─────────────────────────────────────────────── */

const STATUS_STYLES: Record<RetripStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

const StatusBadge = ({ value }: { value: RetripStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[value] ?? "bg-gray-100 text-gray-600"}`}>
    {RETRIP_STATUS_LABELS[value] ?? value}
  </span>
);

const extractError = (error: any): string => {
  const data = error?.response?.data;
  if (!data) return "An unexpected error occurred.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "An unexpected error occurred.";
};

const toRecordList = (value: unknown): TripRetripRequestRecord[] => {
  if (Array.isArray(value)) return value as TripRetripRequestRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: TripRetripRequestRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["status", "created_at", "trip_date"]);

/* ── Approve Dialog (Re-Trip) ──────────────────────────────────── */
function ApproveDialog({
  row,
  onClose,
  onConfirm,
  isLoading,
}: {
  row: TripRetripRequestRecord;
  onClose: () => void;
  onConfirm: (collectionPointIds: string[] | undefined, remarks: string) => void;
  isLoading: boolean;
}) {
  const isHousehold = row.collection_type === "household" || row.collection_type === "bulk";
  const bins = row.live_pending?.collection_points ?? [];
  const households = row.live_pending?.households ?? [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(bins.map((b) => b.unique_id)));
  const [remarks, setRemarks] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const carriedCount = isHousehold ? households.length : selected.size;

  const footer = (
    <div className="flex justify-end gap-2 pt-2">
      <Button label="Cancel" className="p-button-text p-button-secondary" onClick={onClose} disabled={isLoading} />
      <Button
        label="Approve Re-Trip"
        icon="pi pi-check"
        className="p-button-success"
        loading={isLoading}
        onClick={() => onConfirm(isHousehold ? undefined : Array.from(selected), remarks)}
      />
    </div>
  );

  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div>
          <p className="text-lg font-bold text-gray-800">Approve Re-Trip Request</p>
          <p className="text-xs text-gray-400 font-normal mt-0.5">{row.unique_id}</p>
        </div>
      }
      footer={footer}
      style={{ width: "560px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm space-y-2">
          {[
            ["Trip", row.assignment_unique_id],
            ["Area", row.area_name ?? "-"],
            ["Vehicle", row.vehicle_no ?? "-"],
            ["Requested by", row.requested_by_name ?? "-"],
            ["Reason", row.reason],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">{label}</span>
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>

        {isHousehold ? (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
            <strong>On approval:</strong> all {households.length} remaining household(s) will be
            reassigned to a new trip for the same driver. The current trip will be closed.
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              Select the collection points to carry over to the new trip ({selected.size} of {bins.length} selected)
            </p>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y">
              {bins.length === 0 && (
                <div className="p-3 text-xs text-gray-400">No pending collection points left.</div>
              )}
              {bins.map((stop) => (
                <label
                  key={stop.unique_id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(stop.unique_id)}
                    onChange={() => toggle(stop.unique_id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-gray-800">{stop.name ?? stop.unique_id}</span>
                  <span className="text-xs text-gray-400">{stop.status}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800">
          A new trip will be created with {carriedCount} stop(s); the current trip
          ({row.assignment_unique_id}) will be marked ended.
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">Remarks (optional)</p>
          <InputTextarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="w-full text-sm"
            placeholder="Add approval remarks…"
            autoResize
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ── Reject Dialog ─────────────────────────────────────────────── */
function RejectDialog({
  row,
  onClose,
  onConfirm,
  isLoading,
}: {
  row: TripRetripRequestRecord;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  isLoading: boolean;
}) {
  const [remarks, setRemarks] = useState("");
  const footer = (
    <div className="flex justify-end gap-2 pt-2">
      <Button label="Cancel" className="p-button-text p-button-secondary" onClick={onClose} disabled={isLoading} />
      <Button
        label="Reject"
        icon="pi pi-times"
        className="p-button-danger"
        loading={isLoading}
        onClick={() => onConfirm(remarks)}
      />
    </div>
  );
  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div>
          <p className="text-lg font-bold text-gray-800">Reject Re-Trip Request</p>
          <p className="text-xs text-gray-400 font-normal mt-0.5">{row.unique_id}</p>
        </div>
      }
      footer={footer}
      style={{ width: "460px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-col gap-4 pt-2">
        <p className="text-sm text-gray-600">
          Trip <strong className="font-mono text-blue-700">{row.assignment_unique_id}</strong> stays{" "}
          <strong>In Progress</strong> — the driver will need to continue the remaining stops.
        </p>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">Remarks (optional)</p>
          <InputTextarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="w-full text-sm"
            placeholder="Let the driver know why…"
            autoResize
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function TripRetripRequestList() {
  const { t } = useTranslation();

  const [rawRows, setRawRows] = useState<TripRetripRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>(-1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<RetripStatus | "">("Pending");

  const [approveTarget, setApproveTarget] = useState<TripRetripRequestRecord | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TripRetripRequestRecord | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  /* ── Fetch ─────────────────────────────────────────────────────── */
  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setLoading(true);
    try {
      const response = await retripRequestApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      setRawRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  /* ── Approve ────────────────────────────────────────────────────── */
  const handleApproveConfirm = async (collectionPointIds: string[] | undefined, remarks: string) => {
    if (!approveTarget) return;
    setIsApproving(true);
    try {
      await api.post(`/schedule-operations/retrip-requests/${approveTarget.unique_id}/approve/`, {
        ...(collectionPointIds !== undefined ? { collection_point_ids: collectionPointIds } : {}),
        ...(remarks ? { remarks } : {}),
      });
      setRawRows((prev) => prev.filter((r) => r.unique_id !== approveTarget.unique_id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      setApproveTarget(null);
      Swal.fire({
        icon: "success",
        title: "Re-Trip Approved",
        text: "A new trip has been created for the remaining stops.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    } finally {
      setIsApproving(false);
    }
  };

  /* ── Reject ─────────────────────────────────────────────────────── */
  const handleRejectConfirm = async (remarks: string) => {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      await api.post(`/schedule-operations/retrip-requests/${rejectTarget.unique_id}/reject/`, {
        ...(remarks ? { remarks } : {}),
      });
      setRawRows((prev) => prev.filter((r) => r.unique_id !== rejectTarget.unique_id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      setRejectTarget(null);
      Swal.fire({
        icon: "info",
        title: "Rejected",
        text: "The driver has been notified to continue the trip.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    } finally {
      setIsRejecting(false);
    }
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  /* ── Action column ──────────────────────────────────────────────── */
  const actionTemplate = (row: TripRetripRequestRecord) => (
    <div className="flex items-center justify-center gap-3">
      {row.status === "Pending" && (
        <button
          title="Re-Trip (Approve)"
          onClick={() => setApproveTarget(row)}
          className="text-green-600 hover:text-green-800 transition-colors"
        >
          <i className="pi pi-check-circle" />
        </button>
      )}
      {row.status === "Pending" && (
        <button
          title="Reject"
          onClick={() => setRejectTarget(row)}
          className="text-orange-500 hover:text-orange-700 transition-colors"
        >
          <i className="pi pi-times-circle" />
        </button>
      )}
    </div>
  );

  /* ── Header ─────────────────────────────────────────────────────── */
  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: "Search Re-Trip requests...",
  });

  /* ════════════════════════════════════════════════════════════════
      RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-3">
      {/* Title row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Re-Trip Requests</h1>
          <p className="text-sm text-gray-500">
            Drivers asking to end a trip early with stops still remaining
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["Pending", "Approved", "Rejected", ""] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setFirst(0);
                setStatusFilter(s);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        value={rawRows}
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
        loading={loading}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No Re-Trip requests found."
      >
        <Column
          header={t("common.s_no")}
          body={(_: any, { rowIndex }: any) => rowIndex + 1}
          style={{ width: 60 }}
        />
        <Column field="unique_id" header="Request ID" style={{ minWidth: 150 }} />
        <Column
          field="assignment_unique_id"
          header="Trip"
          style={{ minWidth: 160 }}
          body={(r: TripRetripRequestRecord) => (
            <div className="text-sm text-gray-800">
              {r.assignment_unique_id}
              {r.trip_date && <div className="text-xs text-gray-400">{r.trip_date}</div>}
            </div>
          )}
        />
        <Column field="area_name" header="Area" style={{ minWidth: 140 }} body={(r: any) => r.area_name || "-"} />
        <Column field="vehicle_no" header="Vehicle" style={{ minWidth: 110 }} body={(r: any) => r.vehicle_no || "-"} />
        <Column
          field="collection_type"
          header="Type"
          style={{ minWidth: 100 }}
          body={(r: TripRetripRequestRecord) => (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
              {r.collection_type ?? "-"}
            </span>
          )}
        />
        <Column
          header="Pending Stops"
          style={{ minWidth: 120 }}
          body={(r: TripRetripRequestRecord) => (
            <span className="font-semibold text-amber-700">
              {r.pending_bin_count + r.pending_household_count}
            </span>
          )}
        />
        <Column field="reason" header="Reason" style={{ minWidth: 220 }} body={(r: any) => (
          <span className="text-xs text-gray-700">{r.reason}</span>
        )} />
        <Column field="requested_by_name" header="Requested By" style={{ minWidth: 140 }} body={(r: any) => r.requested_by_name || "-"} />
        <Column
          field="status"
          header="Status"
          sortable
          style={{ minWidth: 110 }}
          body={(r: TripRetripRequestRecord) => <StatusBadge value={r.status} />}
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ minWidth: 110 }} />
      </DataTable>

      {/* Approve Dialog */}
      {approveTarget && (
        <ApproveDialog
          row={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={handleApproveConfirm}
          isLoading={isApproving}
        />
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <RejectDialog
          row={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          isLoading={isRejecting}
        />
      )}
    </div>
  );
}
