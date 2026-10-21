import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  clearAuthSession,
  refreshAccessToken,
  scheduleProactiveRefresh,
} from "@/utils/authStorage";
import {
  SESSION_END_MESSAGES,
  useIdleLogout,
  type SessionEndCause,
} from "@/hooks/useIdleLogout";

// The leader portals keep their own tokens and run their own guard; the
// public grievance pages need no session at all.
const UNGUARDED_PREFIXES = ["/auth", "/localbody", "/district", "/state", "/publicgrivence"];

const isUnguardedPath = (pathname: string) =>
  UNGUARDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const renewAdminToken = async () => {
  const token = await refreshAccessToken();
  if (token) scheduleProactiveRefresh();
  return token;
};

/** Auto-logout for the main (admin / dashboard) app session. */
export default function SessionIdleGuard() {
  const navigate = useNavigate();
  const { setUser } = useUser();

  const onSessionEnd = useCallback(
    (cause: SessionEndCause) => {
      clearAuthSession();
      setUser(null);
      if (isUnguardedPath(window.location.pathname)) return;
      navigate("/auth", {
        replace: true,
        state: { sessionMessage: SESSION_END_MESSAGES[cause] },
      });
    },
    [navigate, setUser],
  );

  useIdleLogout({
    tokenKey: ACCESS_TOKEN_STORAGE_KEY,
    onSessionEnd,
    renewToken: renewAdminToken,
  });
  return null;
}
