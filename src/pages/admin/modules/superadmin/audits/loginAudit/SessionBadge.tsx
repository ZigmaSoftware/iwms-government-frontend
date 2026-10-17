import type { LoginAuditRecord } from "./types";
import { SESSION_STATES, sessionStateOf } from "./sessionState";

export default function SessionBadge({ row }: { row: LoginAuditRecord }) {
  const state = SESSION_STATES[sessionStateOf(row)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${state.badge}`}
    >
      <i className={`${state.icon} text-[10px]`} />
      {state.label}
    </span>
  );
}
