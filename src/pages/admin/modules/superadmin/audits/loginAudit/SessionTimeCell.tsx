import type { LoginAuditRecord } from "./types";
import { formatDate, formatTime, isSameDay } from "./format";

/** Login → logout in one cell; the date is shown once when both fall on the same day. */
export default function SessionTimeCell({ row }: { row: LoginAuditRecord }) {
  if (!row.timestamp) return <span>-</span>;
  const loginAt = row.timestamp;
  const logoutAt = row.logout_at;

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-semibold text-gray-500">{formatDate(loginAt)}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-medium text-gray-900" title="Login">
          <i className="pi pi-sign-in text-[11px] text-green-600" />
          {formatTime(loginAt)}
        </span>
        {row.success ? (
          <>
            <i className="pi pi-arrow-right text-[10px] text-gray-300" />
            {logoutAt ? (
              <span className="inline-flex items-center gap-1 font-medium text-gray-900" title="Logout">
                <i className="pi pi-sign-out text-[11px] text-red-500" />
                {isSameDay(loginAt, logoutAt)
                  ? formatTime(logoutAt)
                  : `${formatDate(logoutAt)}, ${formatTime(logoutAt)}`}
              </span>
            ) : (
              <span className="text-xs font-semibold text-green-600">Now</span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
