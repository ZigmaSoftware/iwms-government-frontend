import { Column } from "primereact/column";
import type { TFunction } from "i18next";
import type { LoginAuditRecord } from "./types";
import { formatModuleName, shortUserAgent } from "./format";
import SessionBadge from "./SessionBadge";
import SessionTimeCell from "./SessionTimeCell";

type Options = {
  t: TFunction;
  onView: (row: LoginAuditRecord) => void;
  /** Index of the page's first row, so S.No keeps counting across pages. */
  first: number;
};

/**
 * The table's <Column> list. Returned as an array (not a component) because
 * DataTable only reads Column elements that are its direct children.
 */
export const renderLoginAuditColumns = ({ t, onView, first }: Options) => [
  <Column
    key="s_no"
    header={t("common.s_no")}
    body={(_: LoginAuditRecord, { rowIndex }: { rowIndex: number }) => first + rowIndex + 1}
    style={{ width: "4%" }}
  />,
  <Column
    key="user"
    field="username"
    header={t("admin.login_audit.user", "User")}
    sortable
    style={{ width: "18%" }}
    body={(row: LoginAuditRecord) => (
      <div className="min-w-0">
        <p className="break-words font-semibold text-gray-900">
          {row.user_name || row.username || "-"}
        </p>
        {row.user_name && row.username ? (
          <p className="break-words text-xs text-gray-600">{row.username}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            {formatModuleName(row.module_name)}
          </span>
          <span className="break-all text-xs text-gray-400">{row.unique_id}</span>
        </div>
      </div>
    )}
  />,
  <Column
    key="device"
    field="ip_address"
    header="Device"
    sortable
    style={{ width: "15%" }}
    body={(row: LoginAuditRecord) => (
      <div className="min-w-0" title={row.user_agent ?? undefined}>
        <p className="break-all font-medium text-gray-800">{row.ip_address || "-"}</p>
        <p className="break-words text-xs text-gray-500">{shortUserAgent(row.user_agent)}</p>
      </div>
    )}
  />,
  <Column
    key="session_time"
    field="timestamp"
    header="Session Time"
    sortable
    style={{ width: "20%" }}
    body={(row: LoginAuditRecord) => <SessionTimeCell row={row} />}
  />,
  <Column
    key="logout_type"
    field="session_state"
    header="Logout Type"
    style={{ width: "13%" }}
    body={(row: LoginAuditRecord) => (
      <div className="min-w-0 space-y-1">
        <SessionBadge row={row} />
        {!row.success && row.reason ? (
          <p className="break-words text-xs text-gray-500">{row.reason}</p>
        ) : null}
      </div>
    )}
  />,
  <Column
    key="used_hours"
    field="session_duration_seconds"
    header="Used Hours"
    sortable
    style={{ width: "9%" }}
    body={(row: LoginAuditRecord) => (
      <span className="font-mono text-sm text-gray-800">{row.used_hours ?? "-"}</span>
    )}
  />,
  <Column
    key="location"
    field="district_name"
    header={t("common.location")}
    style={{ width: "13%" }}
    body={(row: LoginAuditRecord) => (
      <div className="min-w-0">
        <p className="break-words font-medium text-gray-800">{row.local_body_name || "-"}</p>
        <p className="break-words text-xs text-gray-500">
          {[row.local_body_level, row.district_name].filter(Boolean).join(" · ") || "-"}
        </p>
      </div>
    )}
  />,
  <Column
    key="actions"
    header={t("common.actions")}
    style={{ width: "8%" }}
    body={(row: LoginAuditRecord) => (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onView(row)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:border-cyan-300 hover:text-cyan-700"
        >
          <i className="pi pi-eye text-[11px]" />
          {t("common.view")}
        </button>
      </div>
    )}
  />,
];
