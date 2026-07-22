import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MessageSquare,
  Paperclip,
  RefreshCcw,
  RotateCcw,
  Star,
  UserCog,
} from "lucide-react";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import {
  complaintStatusApi,
  complaintTeamApi,
  complaintTicketApi,
  geoApi,
  ticketActions,
} from "@/features/complaintTicketing/api";
import { AttachmentPreview } from "@/features/complaintTicketing/components/AttachmentPreview";
import type {
  AssignableStaffOption,
  ComplaintTicket,
  GeoOption,
  LocalBodyOption,
} from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime } from "../utils";

const Field = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm text-gray-900">{value ? String(value) : "-"}</div>
  </div>
);

const ACTION_TABS = [
  { label: "Status", icon: RefreshCcw },
  { label: "Assignment", icon: UserCog },
  { label: "Resolve / Reopen", icon: RotateCcw },
  { label: "Comment", icon: MessageSquare },
  { label: "Attachment", icon: Paperclip },
  { label: "Feedback", icon: Star },
] as const;

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

const SlaBadge = ({ ticket }: { ticket: ComplaintTicket }) => {
  if (ticket.sla_breached) {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Breached</span>;
  }
  if (typeof ticket.sla_time_remaining_seconds === "number" && ticket.sla_time_remaining_seconds < 0) {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">On Track</span>;
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  const [ticket, setTicket] = useState<ComplaintTicket | null>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeAction, setActiveAction] = useState(0);
  const [activeHistory, setActiveHistory] = useState(0);
  const [statusCode, setStatusCode] = useState("");
  const [team, setTeam] = useState("");
  const [staff, setStaff] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("5");
  const [feedbackText, setFeedbackText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Staff-head assignment scope: filter the staff dropdown by district/city
  // (flat geo masters, same State -> District cascade as the other forms).
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<LocalBodyOption[]>([]);
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [assignableStaff, setAssignableStaff] = useState<AssignableStaffOption[]>([]);
  const [staffScopeLabel, setStaffScopeLabel] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const loadAssignableStaff = async (scope?: { district?: string; city?: string }) => {
    if (!id) return;
    setStaffLoading(true);
    try {
      const params = scope && (scope.district || scope.city) ? scope : undefined;
      const res = await ticketActions.assignableStaff(id, params);
      setAssignableStaff(res.staff ?? []);
      setStaffScopeLabel(
        res.city_name
          ? `City: ${res.city_name}`
          : res.district_name
            ? `District: ${res.district_name}`
            : "All districts"
      );
    } catch (err) {
      setAssignableStaff([]);
      setStaffScopeLabel(errorText(err, "Unable to load staff for this location"));
    } finally {
      setStaffLoading(false);
    }
  };

  const load = async () => {
    if (!id) return;
    const [ticketRow, statusRows, teamRows, districtRows] = await Promise.all([
      complaintTicketApi.read(id),
      complaintStatusApi.readAll().catch(() => []),
      complaintTeamApi.readAll().catch(() => []),
      geoApi.districts().catch(() => []),
    ]);
    setTicket(ticketRow as ComplaintTicket);
    setStatuses(asArray(statusRows));
    setTeams(asArray(teamRows));
    setDistricts(asArray(districtRows));
    setStatusCode((ticketRow as ComplaintTicket).status_code ?? "");
    setTeam(String((ticketRow as ComplaintTicket).assigned_team ?? ""));
    await loadAssignableStaff({ district, city });
  };

  useEffect(() => {
    load().catch((err) => Swal.fire("Error", errorText(err, "Unable to load ticket"), "error"));
  }, [id]);

  const onDistrictChange = async (value: string) => {
    setDistrict(value);
    setCity("");
    setCities([]);
    setStaff("");
    if (!value) {
      await loadAssignableStaff();
      return;
    }
    const cityRows = await geoApi.localBodies(value).catch(() => []);
    setCities(cityRows);
    await loadAssignableStaff({ district: value });
  };

  const onCityChange = async (value: string) => {
    setCity(value);
    setStaff("");
    await loadAssignableStaff({ district, city: value || undefined });
  };

  const run = async (message: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      Swal.fire("Done", message, "success");
      setStatusRemarks("");
      setAssignReason("");
      setResolutionNote("");
      setComment("");
      setFeedbackText("");
      setFile(null);
      await load();
    } catch (err) {
      Swal.fire("Error", errorText(err, "Action failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!ticket || !id) return <div className="p-6">Loading...</div>;

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
          <Field label="Assigned Team" value={ticket.assigned_team_name} />
          <Field label="Assigned Staff" value={ticket.assigned_staff_name} />
          <Field label="Created" value={formatDateTime(ticket.created)} />
          <Field label="SLA Due" value={formatDateTime(ticket.sla_due_at)} />
          <div>
            <div className="text-xs font-medium uppercase text-gray-500">SLA Status</div>
            <div className="mt-1"><SlaBadge ticket={ticket} /></div>
          </div>
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
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
          {ACTION_TABS.map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveAction(index)}
              className={ACTION_TAB_BUTTON_CLASS(activeAction === index)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {activeAction === 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          )}

          {activeAction === 1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Team</Label>
                <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">Select team</option>
                  {teams.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.team_name}</option>)}
                </select>
              </div>
              <div>
                <Label>Reason</Label>
                <Input className="mt-1" value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="Reason" />
              </div>

              <div>
                <Label>District</Label>
                <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={district} onChange={(e) => onDistrictChange(e.target.value)}>
                  <option value="">All districts</option>
                  {districts.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <Label>City</Label>
                <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={city} onChange={(e) => onCityChange(e.target.value)} disabled={!district}>
                  <option value="">All cities</option>
                  {cities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-500 md:col-span-2">Staff shown: {staffLoading ? "loading..." : staffScopeLabel || "-"}</p>

              <div className="md:col-span-2">
                <Label>Staff</Label>
                <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
                  <option value="">Select staff (optional - defaults to team lead)</option>
                  {assignableStaff.map((item) => (
                    <option key={item.staff_unique_id} value={item.staff_unique_id}>
                      {item.employee_name} - {item.department_name || "No department"} ({item.local_body_name || item.district_name || "No location"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <button disabled={busy || !team} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket assigned.", () => ticketActions.assign(id, { team, staff: staff || undefined, reason: assignReason }))}>Assign</button>
                <button disabled={busy} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket escalated.", () => ticketActions.escalate(id, { team: team || undefined, reason: assignReason }))}>Escalate</button>
              </div>
            </div>
          )}

          {activeAction === 2 && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Resolution / Reopen</Label>
                <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Resolution note or reopen reason" />
              </div>
              <div className="flex gap-2">
                <button disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket resolved.", () => ticketActions.resolve(id, { resolution_note: resolutionNote }))}>Resolve</button>
                <button disabled={busy} className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket reopened.", () => ticketActions.reopen(id, { reopen_reason: resolutionNote }))}>Reopen</button>
              </div>
            </div>
          )}

          {activeAction === 3 && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Comment</Label>
                <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <div>
                <button disabled={busy || !comment.trim()} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Comment added.", () => ticketActions.comment(id, { comment_text: comment, is_internal: false }))}>Add Comment</button>
              </div>
            </div>
          )}

          {activeAction === 4 && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Attachment</Label>
                <input className="mt-1 block w-full text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <button
                disabled={busy || !file}
                className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
                onClick={() => run("Attachment uploaded.", () => {
                  const data = new FormData();
                  if (file) {
                    data.append("file", file);
                    data.append("file_name", file.name);
                    data.append("mime_type", file.type);
                  }
                  return ticketActions.attach(id, data);
                })}
              >
                Upload
              </button>
            </div>
          )}

          {activeAction === 5 && (
            <div className="space-y-3">
              <div>
                <Label>Rating</Label>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(String(value))}
                      aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                      className="text-amber-400 transition hover:scale-110"
                    >
                      <Star
                        className="h-7 w-7"
                        fill={value <= Number(rating) ? "currentColor" : "none"}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
                </div>
              </div>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Feedback text" />
              <button disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Feedback submitted.", () => ticketActions.feedback(id, { rating: Number(rating), feedback_text: feedbackText, is_issue_solved: true }))}>Submit Feedback</button>
            </div>
          )}
        </div>
      </ComponentCard>

      <ComponentCard title="History">
        {(() => {
          const statusHistory = ticket.status_history ?? [];
          const assignmentHistory = ticket.assignment_history ?? [];
          const escalationHistory = ticket.escalation_history ?? [];
          const comments = ticket.comments ?? [];
          const historyTabs = [
            { label: "Status History", count: statusHistory.length },
            { label: "Assignments", count: assignmentHistory.length },
            { label: "Escalations", count: escalationHistory.length },
            { label: "Comments", count: comments.length },
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
                    rows={assignmentHistory}
                    emptyMessage="No assignments yet."
                    columns={[
                      { header: "From Team", body: (item) => item.from_team_name || "-" },
                      { header: "To Team", body: (item) => item.to_team_name || "-" },
                      { header: "Assigned At", body: (item) => formatDateTime(item.assigned_at) },
                      { header: "Reason", body: (item) => item.assignment_reason || "-" },
                    ]}
                  />
                )}
                {activeHistory === 2 && (
                  <HistoryTable
                    rows={escalationHistory}
                    emptyMessage="No escalations yet."
                    columns={[
                      { header: "Level", body: (item) => item.escalation_level ?? "-" },
                      { header: "From Team", body: (item) => item.escalated_from_team_name || "-" },
                      { header: "To Team", body: (item) => item.escalated_to_team_name || "-" },
                      { header: "To Staff", body: (item) => item.escalated_to_staff_name || "-" },
                      { header: "Escalated At", body: (item) => formatDateTime(item.escalated_at) },
                      { header: "Reason", body: (item) => item.reason || "-" },
                    ]}
                  />
                )}
                {activeHistory === 3 && (
                  <HistoryTable
                    rows={comments}
                    emptyMessage="No comments yet."
                    columns={[
                      { header: "Comment", body: (item) => item.comment_text || "-" },
                      { header: "Created At", body: (item) => formatDateTime(item.created) },
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
