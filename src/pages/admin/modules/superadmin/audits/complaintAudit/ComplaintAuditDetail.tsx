import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ComplaintAuditDetail as DetailRecord,
  ComplaintAuditEvent,
  ComplaintAuditEventType,
} from "./types";
import { formatDateTime, formatDuration, STATUS_COLORS } from "./format";

const EVENT_STYLES: Record<ComplaintAuditEventType, { dot: string; icon: string }> = {
  CREATED: { dot: "bg-slate-500", icon: "pi pi-plus" },
  STATUS_CHANGED: { dot: "bg-blue-500", icon: "pi pi-arrow-right" },
  ASSIGNED: { dot: "bg-sky-500", icon: "pi pi-user" },
  ESCALATED: { dot: "bg-red-500", icon: "pi pi-arrow-up" },
  RESOLVED: { dot: "bg-green-600", icon: "pi pi-check" },
  CLOSED: { dot: "bg-emerald-700", icon: "pi pi-lock" },
  REOPENED: { dot: "bg-purple-600", icon: "pi pi-refresh" },
  FEEDBACK: { dot: "bg-amber-500", icon: "pi pi-star" },
  DELETED: { dot: "bg-gray-700", icon: "pi pi-trash" },
};

// Label shown above an event's remarks, so a resolution reads as the
// solution and a reopen as its reason rather than generic "remarks".
const remarksLabel = (type: ComplaintAuditEventType, t: TFunction): string | null => {
  switch (type) {
    case "CREATED":
      return t("admin.complaint_audit.remarks_complaint", "Complaint");
    case "RESOLVED":
      return t("admin.complaint_audit.remarks_resolution", "Resolution / solution");
    case "REOPENED":
      return t("admin.complaint_audit.remarks_reopen", "Reopen reason");
    case "ESCALATED":
      return t("admin.complaint_audit.remarks_escalation", "Escalation reason");
    case "FEEDBACK":
      return t("admin.complaint_audit.remarks_feedback", "Feedback");
    case "DELETED":
      return t("admin.complaint_audit.delete_reason", "Delete reason");
    case "ASSIGNED":
      return t("admin.complaint_audit.remarks_reason", "Reason");
    default:
      return null;
  }
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="break-words text-sm text-gray-800 dark:text-gray-100">{children || "-"}</div>
  </div>
);

function eventDetails(event: ComplaintAuditEvent, t: TFunction): string[] {
  const d = event.details;
  switch (event.type) {
    case "STATUS_CHANGED":
    case "RESOLVED":
    case "CLOSED":
      return d.from_status
        ? [t("admin.complaint_audit.detail_from", "From {{value}}", { value: d.from_status })]
        : [];
    case "REOPENED":
      return d.previous_status
        ? [t("admin.complaint_audit.detail_was", "Was {{value}}", { value: d.previous_status })]
        : [];
    case "ESCALATED":
      return [
        d.automatic
          ? t("admin.complaint_audit.detail_automatic", "Automatic (SLA)")
          : t("admin.complaint_audit.detail_manual", "Manual"),
        ...(d.escalated_from
          ? [t("admin.complaint_audit.detail_from", "From {{value}}", { value: d.escalated_from })]
          : []),
        ...(d.escalated_to
          ? [t("admin.complaint_audit.detail_to", "To {{value}}", { value: d.escalated_to })]
          : []),
      ];
    case "ASSIGNED":
      return [
        ...(d.from_staff
          ? [t("admin.complaint_audit.detail_from", "From {{value}}", { value: d.from_staff })]
          : []),
        ...(d.to_staff ? [t("admin.complaint_audit.detail_to", "To {{value}}", { value: d.to_staff })] : []),
      ];
    case "FEEDBACK":
      return [
        ...(d.rating != null
          ? [t("admin.complaint_audit.detail_rating", "Rating {{rating}}/5", { rating: d.rating })]
          : []),
        d.issue_solved
          ? t("admin.complaint_audit.detail_issue_solved", "Issue solved")
          : t("admin.complaint_audit.detail_issue_not_solved", "Issue not solved"),
      ];
    case "CREATED":
      return [
        ...(d.reporter
          ? [t("admin.complaint_audit.detail_reporter", "Reporter {{value}}", { value: d.reporter })]
          : []),
        ...(d.phone ? [String(d.phone)] : []),
        ...(d.location ? [String(d.location)] : []),
      ];
    default:
      return [];
  }
}

export default function ComplaintAuditDetail({
  record,
  onClose,
}: {
  record: DetailRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const longestStatus = Math.max(1, ...(record?.status_durations ?? []).map((d) => d.seconds));
  const area = record
    ? [
        record.local_body_name
          ? `${record.local_body_name}${record.local_body_type ? ` (${record.local_body_type})` : ""}`
          : null,
        record.district_name,
        record.state_name,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background px-6 pb-4 pr-12 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{record?.ticket_no}</span>
            {record?.status_name && (
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[record.status_code ?? ""] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {record.status_name}
              </span>
            )}
            {record?.is_deleted && (
              <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-white">
                {t("admin.complaint_audit.deleted_badge", "Deleted")}
              </span>
            )}
          </DialogTitle>
          {record?.title && <p className="text-sm text-gray-500">{record.title}</p>}
        </DialogHeader>

        {record && (
          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <section className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700 md:grid-cols-4">
              <Field label={t("admin.complaint_audit.raised_on", "Raised on")}>{formatDateTime(record.created)}</Field>
              <Field label={t("admin.complaint_audit.raised_by", "Raised by")}>{record.created_by_name}</Field>
              <Field label={t("admin.complaint_audit.reporter", "Reporter")}>{record.reporter_name}</Field>
              <Field label={t("admin.complaint_audit.source", "Source")}>{record.source_name}</Field>
              <Field label={t("admin.complaint_audit.category", "Category")}>
                {[record.category_name, record.subcategory_name].filter(Boolean).join(" / ")}
              </Field>
              <Field label={t("admin.complaint_audit.priority", "Priority")}>{record.priority_name}</Field>
              <Field label={t("admin.complaint_audit.assigned_to", "Assigned to")}>{record.assigned_staff_name}</Field>
              {record.escalated_to_staff_name && (
                <Field label={t("admin.complaint_audit.escalated_to", "Escalated to")}>
                  {record.escalated_to_staff_name}
                </Field>
              )}
              <Field label={t("admin.complaint_audit.area", "Area")}>{area}</Field>
              <Field label={t("admin.complaint_audit.first_resolved_after", "First resolved after")}>
                {formatDuration(record.first_resolution_seconds)}
              </Field>
              <Field
                label={
                  record.completed_at
                    ? t("admin.complaint_audit.total_time_taken", "Total time taken")
                    : t("admin.complaint_audit.open_for", "Open for")
                }
              >
                <span className={record.completed_at ? "" : "font-medium text-amber-700"}>
                  {formatDuration(record.completed_at ? record.total_resolution_seconds : record.open_seconds)}
                </span>
              </Field>
              <Field label={t("admin.complaint_audit.reopened", "Reopened")}>
                {t("admin.complaint_audit.reopened_times", "{{count}} time(s)", { count: record.reopen_count })}
              </Field>
              <Field label={t("admin.complaint_audit.escalations", "Escalations")}>
                {record.escalation_count
                  ? t(
                      "admin.complaint_audit.escalation_summary",
                      "{{count}} (up to level {{level}}, {{auto}} automatic)",
                      {
                        count: record.escalation_count,
                        level: record.max_escalation_level,
                        auto: record.auto_escalation_count,
                      },
                    )
                  : t("admin.complaint_audit.none", "None")}
              </Field>
              {record.feedback_rating != null && (
                <Field label={t("admin.complaint_audit.feedback", "Feedback")}>
                  {`${record.feedback_rating}/5 · ${
                    record.feedback_issue_solved
                      ? t("admin.complaint_audit.solved", "solved")
                      : t("admin.complaint_audit.not_solved", "not solved")
                  }`}
                </Field>
              )}
              {record.is_deleted && (
                <Field label={t("admin.complaint_audit.delete_reason", "Delete reason")}>{record.delete_reason}</Field>
              )}
            </section>

            {record.status_durations.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t("admin.complaint_audit.time_in_status", "Time in each status")}
                </h3>
                <div className="space-y-2">
                  {record.status_durations.map((d) => (
                    <div key={d.status_code ?? d.status_name ?? ""} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate text-gray-600">{d.status_name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{ width: `${Math.max(2, (d.seconds / longestStatus) * 100)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums text-gray-800 dark:text-gray-100">
                        {formatDuration(d.seconds)}
                      </span>
                      {d.times_entered > 1 && (
                        <span className="w-12 shrink-0 text-xs text-gray-500">×{d.times_entered}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t("admin.complaint_audit.timeline", "Timeline")}
              </h3>
              <ol>
                {record.timeline.map((event, index) => {
                  const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.STATUS_CHANGED;
                  const details = eventDetails(event, t);
                  const label = remarksLabel(event.type, t);
                  const isLast = index === record.timeline.length - 1;
                  return (
                    <li key={`${event.type}-${event.at}-${index}`} className="flex gap-3">
                      {/* Icon column: the dot, plus a line down to the next event. */}
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-white ${style.dot}`}
                        >
                          <i className={style.icon} />
                        </span>
                        {!isLast && <span className="w-px flex-1 bg-gray-200" />}
                      </div>
                      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 pt-0.5">
                          <span className="font-medium text-gray-800 dark:text-gray-100">{event.title}</span>
                          <span className="text-xs text-gray-500">
                            {event.at
                              ? formatDateTime(event.at)
                              : t("admin.complaint_audit.time_not_recorded", "Time not recorded")}
                            {event.type !== "CREATED" && event.elapsed_seconds != null
                              ? ` · ${t("admin.complaint_audit.after_creation", "+{{duration}} after creation", {
                                  duration: formatDuration(event.elapsed_seconds),
                                })}`
                              : ""}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {[
                            event.actor_name
                              ? t("admin.complaint_audit.by_actor", "by {{name}}", { name: event.actor_name })
                              : null,
                            ...details,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {event.remarks && (
                          <div className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {label && <div className="mb-0.5 text-xs font-medium text-gray-500">{label}</div>}
                            <div className="whitespace-pre-line">{event.remarks}</div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
