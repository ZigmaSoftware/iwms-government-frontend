import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const [statusCode, setStatusCode] = useState("");
  const [team, setTeam] = useState("");
  const [staff, setStaff] = useState("");
  const [remarks, setRemarks] = useState("");
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
      setRemarks("");
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-md border p-4">
            <Label>Status</Label>
            <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
              <option value="">Select status code</option>
              {statuses.map((item) => <option key={item.unique_id} value={item.status_code}>{item.status_name}</option>)}
            </select>
            <Input className="mt-3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
            <button disabled={busy || !statusCode} className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Status updated.", () => ticketActions.changeStatus(id, { status_code: statusCode, remarks }))}>Update Status</button>
          </div>

          <div className="rounded-md border p-4">
            <Label>Assignment</Label>
            <select className="mt-1 h-11 w-full rounded-md border px-3 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Select team</option>
              {teams.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.team_name}</option>)}
            </select>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={district} onChange={(e) => onDistrictChange(e.target.value)}>
                <option value="">All districts</option>
                {districts.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={city} onChange={(e) => onCityChange(e.target.value)} disabled={!district}>
                <option value="">All cities</option>
                {cities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">Staff shown: {staffLoading ? "loading..." : staffScopeLabel || "-"}</p>

            <select className="mt-3 h-11 w-full rounded-md border px-3 text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
              <option value="">Select staff (optional - defaults to team lead)</option>
              {assignableStaff.map((item) => (
                <option key={item.staff_unique_id} value={item.staff_unique_id}>
                  {item.employee_name} - {item.department_name || "No department"} ({item.local_body_name || item.district_name || "No location"})
                </option>
              ))}
            </select>
            <Input className="mt-3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason" />
            <div className="mt-3 flex gap-2">
              <button disabled={busy || !team} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket assigned.", () => ticketActions.assign(id, { team, staff: staff || undefined, reason: remarks }))}>Assign</button>
              <button disabled={busy} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket escalated.", () => ticketActions.escalate(id, { team: team || undefined, reason: remarks }))}>Escalate</button>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <Label>Resolution / Reopen</Label>
            <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Resolution note or reopen reason" />
            <div className="mt-3 flex gap-2">
              <button disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket resolved.", () => ticketActions.resolve(id, { resolution_note: remarks }))}>Resolve</button>
              <button disabled={busy} className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Ticket reopened.", () => ticketActions.reopen(id, { reopen_reason: remarks }))}>Reopen</button>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <Label>Comment</Label>
            <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button disabled={busy || !comment.trim()} className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Comment added.", () => ticketActions.comment(id, { comment_text: comment, is_internal: false }))}>Add Comment</button>
          </div>

          <div className="rounded-md border p-4">
            <Label>Attachment</Label>
            <input className="mt-1 block w-full text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              disabled={busy || !file}
              className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
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

          <div className="rounded-md border p-4">
            <Label>Feedback</Label>
            <Input className="mt-1" type="number" min="1" max="5" value={rating} onChange={(e) => setRating(e.target.value)} />
            <textarea className="mt-3 w-full rounded-md border px-3 py-2 text-sm" rows={2} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Feedback text" />
            <button disabled={busy} className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => run("Feedback submitted.", () => ticketActions.feedback(id, { rating: Number(rating), feedback_text: feedbackText, is_issue_solved: true }))}>Submit Feedback</button>
          </div>
        </div>
      </ComponentCard>

      <ComponentCard title="History">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div>
            <h2 className="mb-2 font-semibold">Status History</h2>
            {(ticket.status_history ?? []).map((item) => (
              <div key={item.unique_id} className="mb-2 rounded border p-3 text-sm">
                <div className="font-medium">{item.to_status_name || item.to_status_code}</div>
                <div className="text-gray-500">{formatDateTime(item.changed_at)}</div>
                <div>{item.remarks || "-"}</div>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Assignments</h2>
            {(ticket.assignment_history ?? []).map((item) => (
              <div key={item.unique_id} className="mb-2 rounded border p-3 text-sm">
                <div>{item.from_team_name || "-"} {"->"} {item.to_team_name || "-"}</div>
                <div className="text-gray-500">{formatDateTime(item.assigned_at)}</div>
                <div>{item.assignment_reason || "-"}</div>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Escalations</h2>
            {(ticket.escalation_history ?? []).length === 0 && (
              <p className="text-sm text-gray-500">No escalations yet.</p>
            )}
            {(ticket.escalation_history ?? []).map((item) => (
              <div key={item.unique_id} className="mb-2 rounded border border-orange-200 bg-orange-50 p-3 text-sm">
                <div className="font-medium">Level {item.escalation_level}: {item.escalated_from_team_name || "-"} {"->"} {item.escalated_to_team_name || "-"}</div>
                <div>Escalated to {item.escalated_to_staff_name || "-"}</div>
                <div className="text-gray-500">{formatDateTime(item.escalated_at)}</div>
                <div>{item.reason || "-"}</div>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Comments</h2>
            {(ticket.comments ?? []).map((item) => (
              <div key={item.unique_id} className="mb-2 rounded border p-3 text-sm">
                <div>{item.comment_text}</div>
                <div className="text-gray-500">{formatDateTime(item.created)}</div>
              </div>
            ))}
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}
