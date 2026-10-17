import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LoginAuditRecord } from "./types";
import { formatDateTime, formatModuleName, shortUserAgent } from "./format";
import { SESSION_STATES, sessionStateOf } from "./sessionState";
import SessionBadge from "./SessionBadge";

const DetailItem = ({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className={`mt-0.5 break-words text-sm text-gray-800 ${mono ? "font-mono text-xs" : ""}`}>
      {value || "-"}
    </dd>
  </div>
);

const DetailCard = ({ icon, title, children }: { icon: string; title: string; children: ReactNode }) => (
  <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      <i className={`${icon} text-cyan-600`} />
      {title}
    </h4>
    <dl className="space-y-3">{children}</dl>
  </section>
);

const TimelineStep = ({
  label,
  time,
  tone,
  note,
}: {
  label: string;
  time?: string | null;
  tone: string;
  note?: ReactNode;
}) => (
  <li className="relative flex-1 pl-4 sm:pl-0 sm:pt-4">
    {/* Dot centred on the 2px rail: left border on mobile, top border from sm. */}
    <span
      className={`absolute -left-[15px] top-1 h-3 w-3 rounded-full ring-4 ring-white sm:-top-[7px] sm:left-0 ${tone}`}
    />
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900">{formatDateTime(time)}</p>
    {note ? <p className="text-xs text-gray-500">{note}</p> : null}
  </li>
);

const SessionTimeline = ({ row }: { row: LoginAuditRecord }) => {
  const state = sessionStateOf(row);
  const idleMinutes = row.idle_timeout_seconds ? Math.round(row.idle_timeout_seconds / 60) : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <i className="pi pi-history text-cyan-600" />
          Session timeline
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <SessionBadge row={row} />
          {row.used_hours ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              Used {row.used_hours}
            </span>
          ) : null}
        </div>
      </div>
      <ol className="relative flex flex-col gap-4 border-l-2 border-gray-200 pl-2 sm:flex-row sm:gap-6 sm:border-l-0 sm:border-t-2 sm:pl-0">
        <TimelineStep label="Login" time={row.timestamp} tone="bg-green-500" />
        <TimelineStep
          label="Last activity"
          time={row.last_activity_at}
          tone="bg-cyan-500"
          note={idleMinutes ? `Idle limit ${idleMinutes} min` : "No idle limit (mobile app)"}
        />
        <TimelineStep
          label="Logout"
          time={row.logout_at}
          tone={state === "active" ? "bg-gray-300" : "bg-red-500"}
          note={state === "active" ? "Still signed in" : SESSION_STATES[state].label}
        />
      </ol>
    </section>
  );
};

const FailedLogin = ({ row }: { row: LoginAuditRecord }) => (
  <section className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
    <i className="pi pi-exclamation-triangle mt-0.5 text-red-600" />
    <div>
      <p className="text-sm font-semibold text-red-800">Login failed</p>
      <p className="text-sm text-red-700">{row.reason || "No reason recorded"}</p>
      <p className="mt-1 text-xs text-red-600">Attempted {formatDateTime(row.timestamp)}</p>
    </div>
  </section>
);

const LoginAuditDetailBody = ({ row }: { row: LoginAuditRecord }) => (
  <div className="space-y-4">
    {row.success ? <SessionTimeline row={row} /> : <FailedLogin row={row} />}

    <div className="grid gap-4 md:grid-cols-3">
      <DetailCard icon="pi pi-user" title="Account">
        <DetailItem label="Name" value={row.user_name} />
        <DetailItem label="Username" value={row.username} />
        <DetailItem label="Module" value={formatModuleName(row.module_name)} />
        <DetailItem label="User ID" value={row.user_unique_id} mono />
        <DetailItem label="Audit ID" value={row.unique_id} mono />
      </DetailCard>
      <DetailCard icon="pi pi-desktop" title="Device">
        <DetailItem label="IP address" value={row.ip_address} mono />
        <DetailItem label="Browser / OS" value={shortUserAgent(row.user_agent)} />
        <DetailItem label="User agent" value={row.user_agent} mono />
      </DetailCard>
      <DetailCard icon="pi pi-map-marker" title="Location">
        <DetailItem label="District" value={row.district_name} />
        <DetailItem label="Local body" value={row.local_body_name} />
        <DetailItem label="Local body type" value={row.local_body_level} />
      </DetailCard>
    </div>
  </div>
);

type Props = {
  audit: LoginAuditRecord | null;
  onClose: () => void;
};

/** View modal for one login audit row. */
export default function LoginAuditDetail({ audit, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(audit)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl gap-0 overflow-y-auto bg-slate-50 p-0">
        {audit ? (
          <>
            <DialogHeader className="border-b border-gray-200 bg-white px-5 py-4 text-left">
              <DialogTitle className="flex flex-wrap items-center gap-3 pr-8 text-lg">
                {audit.user_name || audit.username || "-"}
                <SessionBadge row={audit} />
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("admin.login_audit.detail_title", "Login Audit Details")} · {formatDateTime(audit.timestamp)}
              </DialogDescription>
            </DialogHeader>
            <div className="p-5">
              <LoginAuditDetailBody row={audit} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
