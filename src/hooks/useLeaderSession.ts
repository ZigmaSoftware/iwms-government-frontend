import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  SESSION_END_MESSAGES,
  useIdleLogout,
  type SessionEndCause,
} from "@/hooks/useIdleLogout";
import { clearLoginSessionTracking, endLoginSession } from "@/utils/loginSession";

type Options = {
  /** The portal's own access-token key (lb_/db_/st_access_token). */
  tokenKey: string;
  /** Removes the portal's localStorage keys. */
  clearSession: () => void;
  /** The portal's sign-in route. */
  signInPath: string;
};

/**
 * Idle auto-logout + logout audit for a leader portal (local body, district,
 * state). Returns the Logout button's handler.
 */
export function useLeaderSession({ tokenKey, clearSession, signInPath }: Options) {
  const navigate = useNavigate();

  const onSessionEnd = useCallback(
    (cause: SessionEndCause) => {
      clearLoginSessionTracking(tokenKey);
      clearSession();
      navigate(signInPath, {
        replace: true,
        state: { sessionMessage: SESSION_END_MESSAGES[cause] },
      });
    },
    [clearSession, navigate, signInPath, tokenKey],
  );

  useIdleLogout({ tokenKey, onSessionEnd });

  return useCallback(async () => {
    await endLoginSession(tokenKey, "manual");
    clearSession();
    navigate(signInPath, { replace: true });
  }, [clearSession, navigate, signInPath, tokenKey]);
}
