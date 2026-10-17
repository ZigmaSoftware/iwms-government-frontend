import type { LoginAuditRecord, SessionState } from "./types";

// Keep in step with the backend's ?session_state= filter
// (LoginAuditViewSet.get_queryset) and LoginAuditSerializer.session_state.
export const SESSION_STATES: Record<SessionState, { label: string; badge: string; icon: string }> = {
  active: {
    label: "Active",
    badge: "border-green-200 bg-green-50 text-green-700",
    icon: "pi pi-circle-fill",
  },
  manual: {
    label: "Manual Logout",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "pi pi-sign-out",
  },
  idle_timeout: {
    label: "Idle Timeout",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "pi pi-clock",
  },
  token_expired: {
    label: "Session Expired",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    icon: "pi pi-hourglass",
  },
  failed: {
    label: "Login Failed",
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "pi pi-times-circle",
  },
};

export const SESSION_STATE_OPTIONS = (Object.keys(SESSION_STATES) as SessionState[]).map((value) => ({
  value,
  label: SESSION_STATES[value].label,
}));

// Rows from before `session_state` existed in the API response.
export const sessionStateOf = (row: LoginAuditRecord): SessionState => {
  if (row.session_state) return row.session_state;
  if (!row.success) return "failed";
  if (!row.logout_at) return "active";
  return (row.logout_type as SessionState) ?? "manual";
};
