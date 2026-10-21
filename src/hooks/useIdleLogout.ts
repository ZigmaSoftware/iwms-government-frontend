import { useEffect, useRef } from "react";
import {
  endLoginSession,
  getIdleTimeoutMs,
  getLastActivity,
  getLastHeartbeat,
  readSessionClaims,
  recordActivity,
  sendSessionHeartbeat,
  type LogoutReason,
} from "@/utils/loginSession";

// Only real user input counts as activity. Background polling (dashboards,
// live tracking) calls the API every few seconds and would otherwise keep an
// abandoned session alive forever.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const CHECK_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * "ended"      = the server says the session is already closed.
 * "logged_out" = the token was removed (logout in this or another tab).
 */
export type SessionEndCause = LogoutReason | "ended" | "logged_out";

/** Shown on the sign-in page after an automatic logout. */
export const SESSION_END_MESSAGES: Partial<Record<SessionEndCause, string>> = {
  idle_timeout: "You were logged out automatically due to inactivity. Please sign in again.",
  token_expired: "Your session has expired. Please sign in again.",
  ended: "Your session has ended. Please sign in again.",
};

type Options = {
  /** localStorage key holding this portal's access token. */
  tokenKey: string;
  /** Clear the portal's storage and leave the page. */
  onSessionEnd: (cause: SessionEndCause) => void;
  /**
   * Swap an expired access token for a fresh one (the admin portal's
   * refresh token). Resolves to null when the session can't be renewed.
   * Without it, an expired token ends the session.
   */
  renewToken?: () => Promise<string | null>;
};

/**
 * Auto-logout after the idle limit carried in the token (`idle_timeout`
 * claim, 40 min by default), audit the logout on the backend, and keep the
 * backend's last-activity in step through heartbeats.
 */
export function useIdleLogout({ tokenKey, onSessionEnd, renewToken }: Options) {
  const onSessionEndRef = useRef(onSessionEnd);
  const renewTokenRef = useRef(renewToken);
  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
    renewTokenRef.current = renewToken;
  }, [onSessionEnd, renewToken]);

  useEffect(() => {
    let busy = false;
    let lastWrite = 0;
    let trackedToken = localStorage.getItem(tokenKey);

    // Stays mounted across logins: after a session ends, tracking resets and
    // picks up the next token that appears.
    const finish = (cause: SessionEndCause) => {
      trackedToken = null;
      busy = false;
      onSessionEndRef.current(cause);
    };

    const expire = async (reason: LogoutReason) => {
      if (busy) return;
      busy = true;
      await endLoginSession(tokenKey, reason);
      finish(reason);
    };

    const renewOrExpire = async () => {
      if (busy) return;
      const renew = renewTokenRef.current;
      if (renew) {
        busy = true;
        const fresh = await renew();
        busy = false;
        if (fresh) return;
      }
      await expire("token_expired");
    };

    const verifyWithServer = () => {
      void sendSessionHeartbeat(tokenKey).then((alive) => {
        if (!alive && !busy && localStorage.getItem(tokenKey)) finish("ended");
      });
    };

    const check = () => {
      if (busy) return;
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        if (trackedToken) finish("logged_out");
        return;
      }
      trackedToken = token;

      const now = Date.now();
      const lastActivity = getLastActivity(tokenKey);
      if (lastActivity === null) {
        recordActivity(tokenKey, now);
        return;
      }
      if (now - lastActivity >= getIdleTimeoutMs(token)) {
        void expire("idle_timeout");
        return;
      }

      const { exp } = readSessionClaims(token);
      if (exp && exp * 1000 <= now) {
        void renewOrExpire();
        return;
      }

      const lastHeartbeat = getLastHeartbeat(tokenKey) ?? 0;
      if (lastActivity > lastHeartbeat && now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        verifyWithServer();
      }
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
      const token = localStorage.getItem(tokenKey);
      if (!token) return;
      // Activity after the limit doesn't revive the session; the next
      // check logs it out.
      const lastActivity = getLastActivity(tokenKey);
      if (lastActivity && now - lastActivity >= getIdleTimeoutMs(token)) {
        check();
        return;
      }
      lastWrite = now;
      recordActivity(tokenKey, now);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === tokenKey || event.key === null) check();
    };

    const onVisibility = () => {
      // Timers are throttled in background tabs; re-check on return.
      if (document.visibilityState === "visible") check();
    };

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, onActivity, { passive: true, capture: true }),
    );
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, onActivity, { capture: true }),
      );
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tokenKey]);
}
