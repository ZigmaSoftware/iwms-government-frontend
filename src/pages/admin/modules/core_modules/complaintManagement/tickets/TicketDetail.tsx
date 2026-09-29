import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from "lucide-react";
import notify from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import {
  complaintStatusApi,
  complaintTicketApi,
  ticketActions,
} from "@/features/complaintTicketing/api";
import { AttachmentPreview } from "@/features/complaintTicketing/components/AttachmentPreview";
import type { ComplaintTicket } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime, formatDuration, roleLabel } from "../utils";

const Field = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm text-gray-900">{value ? String(value) : "-"}</div>
  </div>
);

const ACTION_TAB_BUTTON_CLASS = (isActive: boolean) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "!bg-[#22a855] !text-white shadow-sm"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400"
  }`;

type HistoryColumn<T> = { header: string; body: (row: T) => ReactNode };

function HistoryTable<T extends { unique_id: string }>({
  columns,
  rows,
  emptyMessage,
}: {
  columns: HistoryColumn<T>[];
  rows: T[];
  emptyMessage: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-3 py-2 font-medium">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row.unique_id}>
              {columns.map((col) => (
                <td key={col.header} className="px-3 py-2 align-top text-gray-700 dark:text-gray-300">{col.body(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EscalationCountdown = ({ ticket }: { ticket: ComplaintTicket }) => {
  const remaining = ticket.escalation_time_remaining_seconds;
  if (typeof remaining !== "number") {
    return <span className="text-sm text-gray-500">{ticket.escalation_level ? "Top of hierarchy / stopped" : "-"}</span>;
  }
  return remaining < 0 ? (
    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue {formatDuration(remaining)} — escalating</span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Escalates in {formatDuration(remaining)}</span>
  );
};

const levelText = (level?: number | null, name?: string | null) =>
  level ? `L${level}${name ? ` - ${roleLabel(name)}` : ""}` : "-";

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  const [ticket, setTicket] = useState<ComplaintTicket | null>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [activeHistory, setActiveHistory] = useState(0);
  const [statusCode, setStatusCode] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const [ticketRow, statusRows] = await Promise.all([
      complaintTicketApi.read(id),
      complaintStatusApi.readAll().catch(() => []),
    ]);
    setTicket(ticketRow as ComplaintTicket);
    setStatuses(asArray(statusRows));
    setStatusCode((ticketRow as ComplaintTicket).status_code ?? "");
  };

  useEffect(() => {
    load().catch((err) => notify.fire("Error", errorText(err, "Unable to load ticket"), "error"));
  }, [id]);

  const run = async (message: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      notify.fire("Done", message, "success");
      setStatusRemarks("");
      await load();
    } catch (err) {
      notify.fire("Error", errorText(err, "Action failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!ticket || !id) return <div className="p-6">Loading...</div>;

  // Escalated past the viewer: status changes belong to the level it now
  // sits with (the backend refuses them for this viewer too).
  const viewOnly = ticket.can_act === false;

  return (
    <div className="space-y-5 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{ticket.ticket_no || ticket.unique_id}</h1>
          <p className="text-sm text-gray-500">Complaint ticket action center</p>
        </div>
        <button className="rounded border px-4 py-2" onClick={() => navigate(listPath)}>Back</button>
      </div>

      <ComponentCard title="Ticket Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Status" value={ticket.status_name || ticket.status_code} />
          <Field label="Priority" value={ticket.priority_code} />
          <Field label="Category" value={ticket.category_name} />
          <Field label="Subcategory" value={ticket.subcategory_name} />
          <Field label="Customer" value={ticket.customer_name || ticket.profile_name} />
          <Field label="Phone" value={ticket.wa_phone} />
          <Field label="Assigned Staff" value={ticket.assigned_staff_name} />
          <Field label="Escalated To" value={ticket.escalated_to_staff_name} />
          <Field label="Escalation Level" value={levelText(ticket.escalation_level, ticket.escalation_level_name)} />
          <Field label="Next Escalation Due" value={formatDateTime(ticket.next_escalation_due_at)} />
          <div>
            <div className="text-xs font-medium uppercase text-gray-500">Escalation</div>
            <div className="mt-1"><EscalationCountdown ticket={ticket} /></div>
          </div>
          <Field label="Complaint Type" value={ticket.operational_context?.incident_type?.replaceAll("_", " ")} />
          <Field label="Trip Reference" value={ticket.operational_context?.trip_reference} />
          <Field label="Vehicle Reference" value={ticket.operational_context?.vehicle_reference} />
          <Field label="Driver Reference" value={ticket.operational_context?.driver_reference} />
          <Field label="Operator Reference" value={ticket.operational_context?.operator_reference} />
          <Field label="Other Context" value={ticket.operational_context?.other_reference} />
          <Field label="Created" value={formatDateTime(ticket.created)} />
          <Field label="Resolved" value={formatDateTime(ticket.resolved_at)} />
          <Field label="Closed" value={formatDateTime(ticket.closed_at)} />
          <div className="md:col-span-4"><Field label="Title" value={ticket.title} /></div>
          <div className="md:col-span-4"><Field label="Description" value={ticket.description} /></div>
          <div className="md:col-span-4">
            <Field
              label="Location"
              value={
                [ticket.location_text, ticket.city_name, ticket.district_name, ticket.state_name]
                  .filter(Boolean)
                  .join(", ")
              }
            />
          </div>
        </div>
      </ComponentCard>

      <ComponentCard title="Attachments">
        {(ticket.attachments ?? []).length === 0 && (
          <p className="text-sm text-gray-500">No attachments uploaded yet.</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(ticket.attachments ?? []).map((item) => (
            <AttachmentPreview
              key={item.unique_id}
              label={item.file_name || formatDateTime(item.created)}
              fileUrl={item.file_url}
            />
          ))}
        </div>
      </ComponentCard>

      <ComponentCard title="Actions">
        {viewOnly ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This ticket has been escalated to <strong>{ticket.escalated_to_staff_name || "a higher level"}</strong>
            {ticket.escalation_level ? ` (Level ${ticket.escalation_level})` : ""}. You can follow it here, but only
            they can change its status.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
              <button type="button" className={ACTION_TAB_BUTTON_CLASS(true)}>
                <RefreshCcw className="h-4 w-4" />
                Status
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Status</Label>
                <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
                  <option value="">Select status code</option>
                  {statuses.map((item) => <option key={item.unique_id} value={item.status_code}>{item.status_name}</option>)}
                </select>
              </div>
              <div>
                <Label>Remarks</Label>
                <Input className="mt-1" value={statusRemarks} onChange={(e) => setStatusRemarks(e.target.value)} placeholder="Remarks" />
              </div>
              <div className="md:col-span-2">
                <button disabled={busy || !statusCode} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Status updated.", () => ticketActions.changeStatus(id, { status_code: statusCode, remarks: statusRemarks }))}>Update Status</button>
              </div>
            </div>
          </>
        )}
      </ComponentCard>

      <ComponentCard title="History">
        {(() => {
          const statusHistory = ticket.status_history ?? [];
          const escalationHistory = ticket.escalation_history ?? [];
          const historyTabs = [
            { label: "Status History", count: statusHistory.length },
            { label: "Escalations", count: escalationHistory.length },
          ];
          return (
            <>
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
                {historyTabs.map(({ label, count }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveHistory(index)}
                    className={ACTION_TAB_BUTTON_CLASS(activeHistory === index)}
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs ${
                        activeHistory === index ? "bg-white/20" : "bg-gray-200 dark:bg-gray-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {activeHistory === 0 && (
                  <HistoryTable
                    rows={statusHistory}
                    emptyMessage="No status changes yet."
                    columns={[
                      { header: "Status", body: (item) => item.to_status_name || item.to_status_code || "-" },
                      { header: "Changed At", body: (item) => formatDateTime(item.changed_at) },
                      { header: "Remarks", body: (item) => item.remarks || "-" },
                    ]}
                  />
                )}
                {activeHistory === 1 && (
                  <HistoryTable
                    rows={escalationHistory}
                    emptyMessage="No escalations yet."
                    columns={[
                      {
                        header: "Level",
                        body: (item) => (item.escalated_from_level ? `L${item.escalated_from_level} → L${item.escalation_level}` : `L${item.escalation_level ?? "-"}`),
                      },
                      { header: "From Staff", body: (item) => item.escalated_from_staff_name || "-" },
                      { header: "To Staff", body: (item) => item.escalated_to_staff_name || "-" },
                      { header: "By", body: (item) => (item.escalated_by_system ? "Auto (SLA)" : "Manual") },
                      { header: "Escalated At", body: (item) => formatDateTime(item.escalated_at) },
                      { header: "Reason", body: (item) => item.reason || "-" },
                    ]}
                  />
                )}
              </div>
            </>
          );
        })()}
      </ComponentCard>
    </div>
  );
}
