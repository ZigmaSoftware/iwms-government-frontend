import { jwtDecode } from "jwt-decode";
import { API_ROOT } from "@/config/configApi";

/* --------------------------------------------------------
   Login session lifecycle (logout audit + idle timeout).

   The backend stamps logout time, logout type and used hours on the
   LoginAudit row the token points at (`login_audit_id` claim). Each portal
   (admin, local body, district, state) keeps its token under its own
   localStorage key, so everything here is keyed by that token key.

   Calls go through fetch, not the shared axios client: its 401 handler
   refreshes and redirects, which must not run for a heartbeat or logout.
-------------------------------------------------------- */

export type LogoutReason = "manual" | "idle_timeout" | "token_expired";

type SessionClaims = {
  exp?: number;
  login_audit_id?: string;
  idle_timeout?: number;
};

/** Fallback when the token predates session tracking (no `idle_timeout`). */
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 40 * 60;

const LOGOUT_REQUEST_TIMEOUT_MS = 5000;

const lastActivityKey = (tokenKey: string) => `${tokenKey}__last_activity`;
const lastHeartbeatKey = (tokenKey: string) => `${tokenKey}__last_heartbeat`;

const readNumber = (key: string): number | null => {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — idle tracking degrades to per-tab */
  }
};

export const readSessionClaims = (token: string | null): SessionClaims => {
  if (!token) return {};
  try {
    return jwtDecode<SessionClaims>(token);
  } catch {
    return {};
  }
};

export const getIdleTimeoutMs = (token: string | null): number =>
  (readSessionClaims(token).idle_timeout ?? DEFAULT_IDLE_TIMEOUT_SECONDS) * 1000;

export const getLastActivity = (tokenKey: string): number | null =>
  readNumber(lastActivityKey(tokenKey));

/** Shared across tabs via localStorage, so activity in any tab counts. */
export const recordActivity = (tokenKey: string, at = Date.now()) =>
  writeNumber(lastActivityKey(tokenKey), at);

export const getLastHeartbeat = (tokenKey: string): number | null =>
  readNumber(lastHeartbeatKey(tokenKey));

export const markHeartbeat = (tokenKey: string, at = Date.now()) =>
  writeNumber(lastHeartbeatKey(tokenKey), at);

/** Call right after storing a fresh login token. */
export const startLoginSession = (tokenKey: string) => {
  recordActivity(tokenKey);
  markHeartbeat(tokenKey);
};

export const clearLoginSessionTracking = (tokenKey: string) => {
  try {
    localStorage.removeItem(lastActivityKey(tokenKey));
    localStorage.removeItem(lastHeartbeatKey(tokenKey));
  } catch {
    /* ignore */
  }
};

const postSession = (path: string, token: string, body: unknown, timeoutMs?: number) => {
  const controller = new AbortController();
  const timer = timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  return fetch(`${API_ROOT}/login/login-user/${path}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
};

const isoOrNull = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

/**
 * Tell the backend this session ended so the logout date/time and used hours
 * are audited. Never throws: the caller always clears local storage after.
 */
export const endLoginSession = async (
  tokenKey: string,
  reason: LogoutReason = "manual",
): Promise<void> => {
  const token = localStorage.getItem(tokenKey);
  const lastActivity = getLastActivity(tokenKey);
  clearLoginSessionTracking(tokenKey);
  if (!token) return;
  try {
    await postSession(
      "logout",
      token,
      { reason, last_activity_at: isoOrNull(lastActivity) },
      LOGOUT_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    console.warn("[Session] Logout audit request failed:", error);
  }
};

/**
 * Report user activity to the backend. Resolves to false when the server
 * says the session has already ended (logged out elsewhere / idle).
 */
export const sendSessionHeartbeat = async (tokenKey: string): Promise<boolean> => {
  const token = localStorage.getItem(tokenKey);
  if (!token) return false;
  const lastActivity = getLastActivity(tokenKey);
  markHeartbeat(tokenKey);
  try {
    const response = await postSession("heartbeat", token, {
      last_activity_at: isoOrNull(lastActivity),
    });
    return response.status !== 401;
  } catch {
    // Network hiccups must not log the user out; only an explicit 401 does.
    return true;
  }
};
