import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Eye, Inbox, MapPin, RefreshCcw, Timer } from "lucide-react";
import notify from "@/lib/notify";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { isStoredSuperAdmin } from "@/utils/permissions";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintTicketApi, ticketActions } from "@/features/complaintTicketing/api";
import type { ComplaintTicket } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime, formatDuration, roleLabel } from "../utils";
import TicketLocationFilters from "../tickets/TicketLocationFilters";
import {
  emptyTicketLocationFilter,
  ticketLocationParams,
  type TicketLocationFilterValue,
} from "../tickets/ticketLocationFilter";

const CLOSED_CODES = new Set(["RESOLVED", "CLOSED", "REJECTED", "CANCELLED"]);

// The backend SLA sweep runs every few minutes; polling faster than this
// only adds load.
const POLL_MS = 30000;

const PRIORITY_STYLES: Record<string, string> = {
  P1: "bg-red-50 text-red-700 border-red-200",
  P2: "bg-orange-50 text-orange-700 border-orange-200",
  P3: "bg-amber-50 text-amber-700 border-amber-200",
  P4: "bg-slate-50 text-slate-600 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  ESCALATED: "bg-red-50 text-red-700 border-red-200",
  REOPENED: "bg-purple-50 text-purple-700 border-purple-200",
};

const NEUTRAL_STYLE = "bg-slate-50 text-slate-600 border-slate-200";

/** Ticks every second so the escalation countdown stays live between polls. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Live "time left before this ticket auto-escalates up the Staff Hierarchy". */
function EscalationTimer({ ticket }: { ticket: ComplaintTicket }) {
  const now = useNow();
  if (!ticket.next_escalation_due_at) return null;

  const remainingSeconds = Math.floor((new Date(ticket.next_escalation_due_at).getTime() - now) / 1000);
  const levelLabel = `Level ${ticket.escalation_level ?? 0}${
    ticket.escalation_level_name ? ` — ${roleLabel(ticket.escalation_level_name)}` : ""
  }`;
  const overdue = remainingSeconds <= 0;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
      <Timer className="h-3.5 w-3.5 shrink-0" />
      <span>
        {overdue ? "Overdue — escalating" : `Escalates in ${formatDuration(remainingSeconds)}`}
        {" · "}
        {levelLabel}
      </span>
    </div>
  );
}

function TicketCard({
  ticket,
  busy,
  onResolve,
  onOpen,
}: {
  ticket: ComplaintTicket;
  busy: boolean;
  onResolve: (id: string, remarks: string) => void;
  onOpen: (id: string) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const priorityClass = PRIORITY_STYLES[ticket.priority_code ?? ""] ?? NEUTRAL_STYLE;
  const statusClass = STATUS_STYLES[ticket.status_code ?? ""] ?? NEUTRAL_STYLE;
  // Escalated past this user to a higher level: they keep seeing it, but
  // only the level it now sits with can resolve it.
  const viewOnly = ticket.can_act === false;

  return (
    <Card className="group relative overflow-hidden border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
      {ticket.is_escalated && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-orange-400" />
      )}
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{ticket.ticket_no || ticket.unique_id}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {ticket.category_name}
            {ticket.subcategory_name ? ` · ${ticket.subcategory_name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ticket.priority_code && (
            <Badge variant="outline" className={priorityClass}>
              {ticket.priority_code}
            </Badge>
          )}
          {ticket.is_escalated && (
            <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
              <AlertTriangle className="h-3 w-3" /> {viewOnly ? "Escalated up" : "Escalated to you"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="line-clamp-2 text-sm text-foreground/90">
          {ticket.title || ticket.description || "No description provided."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(ticket.location_text || ticket.city_name) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {ticket.location_text || ticket.city_name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {formatDateTime(ticket.created)}
          </span>
        </div>
        <EscalationTimer ticket={ticket} />
        {viewOnly ? (
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span>
              With {ticket.escalated_to_staff_name || "a higher level"}
              {ticket.escalation_level ? ` · Level ${ticket.escalation_level}` : ""} — view only
            </span>
          </div>
        ) : (
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" className="h-8 text-xs" />
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className={statusClass}>
            {ticket.status_name || ticket.status_code}
          </Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpen(ticket.unique_id)}>
              Open
            </Button>
            {!viewOnly && (
              <Button size="sm" disabled={busy} onClick={() => onResolve(ticket.unique_id, remarks)}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Resolve
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResolvedTicketCard({
  ticket,
  busy,
  onReopen,
  onOpen,
}: {
  ticket: ComplaintTicket;
  busy: boolean;
  onReopen: (id: string, remarks: string) => void;
  onOpen: (id: string) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const priorityClass = PRIORITY_STYLES[ticket.priority_code ?? ""] ?? NEUTRAL_STYLE;

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{ticket.ticket_no || ticket.unique_id}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {ticket.category_name}
            {ticket.subcategory_name ? ` · ${ticket.subcategory_name}` : ""}
          </p>
        </div>
        {ticket.priority_code && (
          <Badge variant="outline" className={priorityClass}>
            {ticket.priority_code}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="line-clamp-2 text-sm text-foreground/90">
          {ticket.title || ticket.description || "No description provided."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Resolved {formatDateTime(ticket.resolved_at)}
          </span>
        </div>
        {ticket.can_act !== false && (
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" className="h-8 text-xs" />
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Resolved
          </Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpen(ticket.unique_id)}>
              Open
            </Button>
            {ticket.can_act !== false && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onReopen(ticket.unique_id, remarks)}>
                <RefreshCcw className="mr-1 h-4 w-4" /> Reopen
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-50/60">
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <Inbox className="h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function MyTasks() {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const { editPath } = createCrudRoutePaths(routes.encComplaintTicket, routes.encComplaint);

  const [tickets, setTickets] = useState<ComplaintTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justResolvedFlash, setJustResolvedFlash] = useState(false);
  const [view, setView] = useState<"open" | "escalated" | "resolved">("open");
  const [location, setLocation] = useState<TicketLocationFilterValue>(emptyTicketLocationFilter);

  // `mine=1`: tickets the requester owns or owned — assigned to them,
  // escalated to them, or escalated up past them — narrowed by the location
  // filter, even for an admin who can otherwise see their whole area.
  const paramsKey = JSON.stringify({ mine: 1, ...ticketLocationParams(location) });
  const fetchOwnTasks = useCallback(
    () => complaintTicketApi.readAll({ params: JSON.parse(paramsKey) }),
    [paramsKey],
  );

  const loadOwnTasks = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(asArray<ComplaintTicket>(await fetchOwnTasks()));
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to load your tasks"), "error");
    } finally {
      setLoading(false);
    }
  }, [fetchOwnTasks]);

  // Silent background poll so a card flips to its escalated state after the
  // backend sweep moves it, without the user clicking Refresh.
  useEffect(() => {
    const id = setInterval(() => {
      fetchOwnTasks()
        .then((rows) => setTickets(asArray<ComplaintTicket>(rows)))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOwnTasks]);

  useEffect(() => {
    void loadOwnTasks();
  }, [loadOwnTasks]);

  const openTickets = useMemo(() => tickets.filter((t) => !CLOSED_CODES.has(String(t.status_code))), [tickets]);
  const escalatedTickets = useMemo(() => openTickets.filter((t) => t.is_escalated), [openTickets]);
  const resolvedTickets = useMemo(() => tickets.filter((t) => String(t.status_code) === "RESOLVED"), [tickets]);

  const handleResolve = async (id: string, remarks: string) => {
    setBusyId(id);
    try {
      await ticketActions.resolve(id, { resolution_note: remarks || undefined });
      setJustResolvedFlash(true);
      setTimeout(() => setJustResolvedFlash(false), 2500);
      await loadOwnTasks();
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to resolve ticket"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReopen = async (id: string, remarks: string) => {
    setBusyId(id);
    try {
      await ticketActions.reopen(id, { reopen_reason: remarks || undefined });
      await loadOwnTasks();
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to reopen ticket"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const summaryCards = [
    { key: "open" as const, label: "Open", value: openTickets.length, className: "text-foreground" },
    { key: "escalated" as const, label: "Escalated", value: escalatedTickets.length, className: "text-red-600" },
    { key: "resolved" as const, label: "Resolved", value: resolvedTickets.length, className: "text-emerald-600" },
  ];

  const openCard = (ticket: ComplaintTicket) => (
    <TicketCard
      key={ticket.unique_id}
      ticket={ticket}
      busy={busyId === ticket.unique_id}
      onResolve={handleResolve}
      onOpen={(id) => navigate(editPath(id))}
    />
  );

  return (
    <div className="space-y-5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {isStoredSuperAdmin()
              ? "All complaints across every area — use the location filters to narrow down."
              : "Complaints assigned or escalated to you. Tickets escalated up from you stay here as view only."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadOwnTasks()} disabled={loading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <TicketLocationFilters value={location} onChange={setLocation} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.key}
            className={`cursor-pointer border-slate-200 transition-colors ${view === card.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setView(card.key)}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.className}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{tickets.length}</p>
          </CardContent>
        </Card>
      </div>

      {justResolvedFlash && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Resolved — checking for your next ticket…
        </div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading your tasks…</div>
      ) : view === "resolved" ? (
        resolvedTickets.length === 0 ? (
          <EmptyState title="No resolved tickets yet" hint="Tickets you resolve will show up here." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resolvedTickets.map((ticket) => (
              <ResolvedTicketCard
                key={ticket.unique_id}
                ticket={ticket}
                busy={busyId === ticket.unique_id}
                onReopen={handleReopen}
                onOpen={(id) => navigate(editPath(id))}
              />
            ))}
          </div>
        )
      ) : view === "escalated" ? (
        escalatedTickets.length === 0 ? (
          <EmptyState
            title="Nothing escalated right now"
            hint="Tickets that breach their level's SLA and escalate to you will show up here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{escalatedTickets.map(openCard)}</div>
        )
      ) : openTickets.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          hint="No open tickets right now — new ones will appear here as they're assigned."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{openTickets.map(openCard)}</div>
      )}
    </div>
  );
}
