import type { VehicleBreakdownRecord, BreakdownStatus, ApprovalStatus } from "./types";
import { BREAKDOWN_REASON_LABELS } from "./types";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dialog } from "primereact/dialog";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { api } from "@/api";
import { vehicleBreakdownApi } from "@/helpers/admin";

/* ── Badge helpers ─────────────────────────────────────────────── */

const STATUS_STYLES: Record<BreakdownStatus, string> = {
  REPORTED: "bg-amber-100 text-amber-800",
  REPLACEMENT_ARRANGED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
};
const STATUS_LABELS: Record<BreakdownStatus, string> = {
  REPORTED: "Reported",
  REPLACEMENT_ARRANGED: "Replacement Arranged",
  REJECTED: "Rejected",
};
const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const StatusBadge = ({ value }: { value: BreakdownStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[value] ?? "bg-gray-100 text-gray-600"}`}>
    {STATUS_LABELS[value] ?? value}
  </span>
);

const ApprovalBadge = ({ value }: { value: ApprovalStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${APPROVAL_STYLES[value] ?? "bg-gray-100 text-gray-600"}`}>
    {value}
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

/* ── Verify Dialog ─────────────────────────────────────────────── */
function VerifyDialog({
  row,
  onClose,
  onConfirm,
  isLoading,
}: {
  row: VehicleBreakdownRecord;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  isLoading: boolean;
}) {
  const [remarks, setRemarks] = useState("");
  const footer = (
    <div className="flex justify-end gap-2 pt-2">
      <Button label="Cancel" className="p-button-text p-button-secondary" onClick={onClose} disabled={isLoading} />
      <Button
        label="Approve & Assign"
        icon="pi pi-check"
        className="p-button-success"
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
          <p className="text-lg font-bold text-gray-800">Verify & Approve Breakdown</p>
          <p className="text-xs text-gray-400 font-normal mt-0.5">{row.unique_id}</p>
        </div>
      }
      footer={footer}
      style={{ width: "500px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm space-y-2">
          {[
            ["Trip ID", row.trip_assignment_id],
            ["Trip Date", row.trip_assignment_detail?.trip_date ?? "-"],
            ["Broken Vehicle", row.breakdown_vehicle_detail?.vehicle_no ?? row.breakdown_vehicle_id],
            ["Replacement Vehicle", row.replacement_vehicle_detail?.vehicle_no ?? row.replacement_vehicle_id],
            ["Replacement Driver", row.replacement_driver_detail?.name ?? "-"],
            ["Replacement Operator", row.replacement_operator_detail?.name ?? "-"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-gray-500 w-40 shrink-0">{label}</span>
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800">
          <strong>On approval:</strong> Trip{" "}
          <span className="font-mono">{row.trip_assignment_id}</span> will be updated to use the
          replacement vehicle and new driver/operator. The original trip ID remains unchanged.
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
  row: VehicleBreakdownRecord;
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
        disabled={!remarks.trim()}
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
          <p className="text-lg font-bold text-gray-800">Reject Breakdown Request</p>
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
          The original vehicle{" "}
          <strong className="text-red-600">
            {row.breakdown_vehicle_detail?.vehicle_no ?? row.breakdown_vehicle_id}
          </strong>{" "}
          will remain assigned to trip{" "}
          <strong className="font-mono text-blue-700">{row.trip_assignment_id}</strong>.
        </p>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">
            Rejection Reason <span className="text-red-500">*</span>
          </p>
          <InputTextarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="w-full text-sm"
            placeholder="Provide a reason for rejection…"
            autoResize
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function VehicleBreakdownList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encScheduleMasters, encVehicleBreakdown } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encScheduleMasters, encVehicleBreakdown);

  const [records, setRecords] = useState<VehicleBreakdownRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    unique_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    trip_assignment_id: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _breakdown_vehicle: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _replacement_vehicle: { value: null, matchMode: FilterMatchMode.CONTAINS },
    _breakdown_reason: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.CONTAINS },
    approval_status: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const [verifyTarget, setVerifyTarget] = useState<VehicleBreakdownRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<VehicleBreakdownRecord | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  /* ── Fetch ─────────────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (vehicleBreakdownApi.readAll() as Promise<any>)
      .then((data: any) => {
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : data?.results ?? [];
        setRecords(rows);
      })
      .catch(() => { if (mounted) Swal.fire(t("common.error"), t("common.load_failed"), "error"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  /* ── Enrich rows for global filter ──────────────────────────────── */
  const rows = records.map((r) => ({
    ...r,
    _trip_date: r.trip_assignment_detail?.trip_date ?? "",
    _location: r.trip_assignment_detail?.location_name ?? "",
    _breakdown_vehicle: r.breakdown_vehicle_detail?.vehicle_no ?? r.breakdown_vehicle_id,
    _replacement_vehicle: r.replacement_vehicle_detail?.vehicle_no ?? r.replacement_vehicle_id,
    _repl_driver: r.replacement_driver_detail?.name ?? "",
    _repl_operator: r.replacement_operator_detail?.name ?? "",
    _breakdown_reason: BREAKDOWN_REASON_LABELS[r.breakdown_reason] ?? r.breakdown_reason,
  }));

  /* ── Delete ─────────────────────────────────────────────────────── */
  const handleDelete = async (row: VehicleBreakdownRecord) => {
    const result = await Swal.fire({
      title: t("common.confirm_title"),
      text: `Delete breakdown record ${row.unique_id}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: t("common.delete"),
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await vehicleBreakdownApi.delete(row.unique_id);
      setRecords((prev) => prev.filter((r) => r.unique_id !== row.unique_id));
      Swal.fire(t("common.success"), t("common.deleted_success"), "success");
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    }
  };

  /* ── Verify ─────────────────────────────────────────────────────── */
  const handleVerifyConfirm = async (remarks: string) => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      await api.patch(
        `/schedule-masters/vehicle-breakdowns/${verifyTarget.unique_id}/verify/`,
        { remarks },
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.unique_id === verifyTarget.unique_id
            ? { ...r, status: "REPLACEMENT_ARRANGED", approval_status: "APPROVED" }
            : r,
        ),
      );
      setVerifyTarget(null);
      Swal.fire({ icon: "success", title: "Approved", text: "Replacement vehicle assigned to the trip.", timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    } finally {
      setIsVerifying(false);
    }
  };

  /* ── Reject ─────────────────────────────────────────────────────── */
  const handleRejectConfirm = async (remarks: string) => {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      await api.patch(
        `/schedule-masters/vehicle-breakdowns/${rejectTarget.unique_id}/reject/`,
        { rejection_remarks: remarks },
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.unique_id === rejectTarget.unique_id
            ? { ...r, status: "REJECTED", approval_status: "REJECTED" }
            : r,
        ),
      );
      setRejectTarget(null);
      Swal.fire({ icon: "info", title: "Rejected", text: "Breakdown request has been rejected.", timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    } finally {
      setIsRejecting(false);
    }
  };

  /* ── Filters ─────────────────────────────────────────────────────── */
  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
  };

  /* ── Action column ──────────────────────────────────────────────── */
  const actionTemplate = (row: VehicleBreakdownRecord) => (
    <div className="flex items-center justify-center gap-3">
      {/* Edit — only pending records */}
      {row.approval_status === "PENDING" && (
        <button
          title={t("common.edit")}
          onClick={() => navigate(editPath(row.unique_id))}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <i className="pi pi-pencil" />
        </button>
      )}

      {/* Verify — only pending records */}
      {row.approval_status === "PENDING" && (
        <button
          title="Verify & Approve"
          onClick={() => setVerifyTarget(row)}
          className="text-green-600 hover:text-green-800 transition-colors"
        >
          <i className="pi pi-check-circle" />
        </button>
      )}

      {/* Reject — only pending records */}
      {row.approval_status === "PENDING" && (
        <button
          title="Reject"
          onClick={() => setRejectTarget(row)}
          className="text-orange-500 hover:text-orange-700 transition-colors"
        >
          <i className="pi pi-times-circle" />
        </button>
      )}

      {/* Delete — not allowed on approved records */}
      {row.approval_status !== "APPROVED" && (
        <button
          title={t("common.delete")}
          onClick={() => handleDelete(row)}
          className="text-red-600 hover:text-red-800 transition-colors"
        >
          <i className="pi pi-trash" />
        </button>
      )}
    </div>
  );

  /* ── Header ─────────────────────────────────────────────────────── */
  const header = (
    <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white w-fit">
      <i className="pi pi-search text-gray-500" />
      <InputText
        value={globalFilterValue}
        onChange={onGlobalFilterChange}
        placeholder="Search breakdowns…"
        className="border-none text-sm"
      />
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
      RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-3">
      {/* Title row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Vehicle Breakdown</h1>
          <p className="text-sm text-gray-500">Report breakdowns and arrange replacement vehicles for trips</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label="Report Breakdown"
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(newPath)}
          />
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading}
        filters={filters}
        onFilter={onFilter}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No breakdown records found."
        globalFilterFields={[
          "unique_id",
          "trip_assignment_id",
          "_trip_date",
          "_location",
          "_breakdown_vehicle",
          "_replacement_vehicle",
          "_repl_driver",
          "_repl_operator",
          "_breakdown_reason",
          "status",
          "approval_status",
        ]}
      >
        <Column
          header={t("common.s_no")}
          body={(_: any, { rowIndex }: any) => rowIndex + 1}
          style={{ width: 60 }}
        />
        <Column
          field="unique_id"
          header="Breakdown ID"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 150 }}
        />
        <Column
          field="trip_assignment_id"
          header="Trip ID"
          sortable
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 150 }}
        />
        <Column
          field="_trip_date"
          header="Trip Date"
          sortable
          style={{ minWidth: 110 }}
          body={(r: any) => r._trip_date || "-"}
        />
        <Column
          field="_location"
          header="Location"
          style={{ minWidth: 140 }}
          body={(r: any) => r._location || "-"}
        />
        <Column
          field="_breakdown_vehicle"
          header="Broken Vehicle"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 140 }}
          body={(r: any) => (
            <span className="font-semibold text-red-700">{r._breakdown_vehicle}</span>
          )}
        />
        <Column
          field="_replacement_vehicle"
          header="Replacement Vehicle"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 160 }}
          body={(r: any) => (
            <span className="font-semibold text-green-700">{r._replacement_vehicle}</span>
          )}
        />
        <Column
          field="_repl_driver"
          header="Repl. Driver"
          style={{ minWidth: 130 }}
          body={(r: any) => r._repl_driver || "-"}
        />
        <Column
          field="_repl_operator"
          header="Repl. Operator"
          style={{ minWidth: 130 }}
          body={(r: any) => r._repl_operator || "-"}
        />
        <Column
          field="_breakdown_reason"
          header="Reason"
          filter
          showFilterMatchModes={false}
          style={{ minWidth: 140 }}
          body={(r: any) => r._breakdown_reason}
        />
        <Column
          field="status"
          header="Status"
          filter
          showFilterMatchModes={false}
          sortable
          style={{ minWidth: 170 }}
          body={(r: VehicleBreakdownRecord) => <StatusBadge value={r.status} />}
        />
        <Column
          field="approval_status"
          header="Approval"
          filter
          showFilterMatchModes={false}
          sortable
          style={{ minWidth: 110 }}
          body={(r: VehicleBreakdownRecord) => <ApprovalBadge value={r.approval_status} />}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ minWidth: 220 }}
        />
      </DataTable>

      {/* Verify Dialog */}
      {verifyTarget && (
        <VerifyDialog
          row={verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onConfirm={handleVerifyConfirm}
          isLoading={isVerifying}
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
