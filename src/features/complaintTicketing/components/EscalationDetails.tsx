import { useEffect, useState } from "react";
import { ArrowRight, Timer } from "lucide-react";
import { InfoField } from "./InfoField";
import type { ComplaintEscalationHistory, Grievance } from "../types";
import { formatDuration, roleLabel } from "@/pages/admin/modules/core_modules/complaintManagement/utils";

const formatWhen = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** Live "escalates in 12m" / "overdue 3m" for the current level's deadline. */
function Countdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.floor((new Date(dueAt).getTime() - now) / 1000);
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${seconds <= 0 ? "text-red-600" : "text-amber-700"}`}>
      <Timer className="h-4 w-4" />
      {seconds <= 0 ? `Overdue ${formatDuration(seconds)} — escalating` : `Escalates in ${formatDuration(seconds)}`}
    </span>
  );
}

/** Escalation state + hop-by-hop history of one complaint. `history` is
 *  null while the full ticket is loading (or when it couldn't be loaded). */
export function EscalationDetails({
  grievance,
  history,
  loading,
}: {
  grievance: Grievance;
  history: ComplaintEscalationHistory[] | null;
  loading: boolean;
}) {
  const closed = ["resolved", "closed", "rejected", "cancelled"].includes(String(grievance.status));
  const level = grievance.escalation_level
    ? `Level ${grievance.escalation_level}${grievance.escalation_level_name ? ` — ${roleLabel(grievance.escalation_level_name)}` : ""}`
    : "—";
  const hops = [...(history ?? [])].sort(
    (a, b) => new Date(a.escalated_at ?? 0).getTime() - new Date(b.escalated_at ?? 0).getTime(),
  );

  return (
    <div>
      <h3 className="mb-3 font-semibold">Escalation</h3>
      <div className="grid gap-4 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoField label="Current level" value={level} />
        <InfoField label="With" value={grievance.assigned_staff_name || "Unassigned"} />
        <InfoField label="First assigned to" value={grievance.first_assigned_staff_name || "—"} />
        <InfoField
          label="Next escalation"
          value={
            closed ? (
              "Stopped — complaint closed"
            ) : grievance.next_escalation_due_at ? (
              <div className="space-y-1">
                <div>{formatWhen(grievance.next_escalation_due_at)}</div>
                <Countdown dueAt={grievance.next_escalation_due_at} />
              </div>
            ) : grievance.escalation_level ? (
              "Top of the hierarchy"
            ) : (
              "Not on the escalation clock"
            )
          }
        />
      </div>

      <h4 className="mb-2 mt-5 text-sm font-semibold">Escalation history</h4>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading escalation history…</p>
      ) : history === null ? (
        <p className="text-sm text-muted-foreground">Escalation history is not available.</p>
      ) : hops.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not escalated yet{grievance.first_assigned_staff_name ? ` — still with ${grievance.first_assigned_staff_name}` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">From → To</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {hops.map((hop) => (
                <tr key={hop.unique_id}>
                  <td className="whitespace-nowrap px-3 py-2">{formatWhen(hop.escalated_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hop.escalated_from_level ? `L${hop.escalated_from_level} → ` : ""}L{hop.escalation_level}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {hop.escalated_from_staff_name || "—"}
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{hop.escalated_to_staff_name || "—"}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        hop.escalated_by_system ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {hop.escalated_by_system ? "Auto (SLA)" : "Manual"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{hop.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
