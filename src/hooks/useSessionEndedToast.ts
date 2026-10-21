import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

/** On a sign-in page: explain an automatic logout (idle timeout / session
 *  ended elsewhere) passed along as `state.sessionMessage`. */
export function useSessionEndedToast() {
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const sessionMessage = (location.state as { sessionMessage?: string } | null)?.sessionMessage;
    if (sessionMessage) {
      toast({ title: "Session Ended", description: sessionMessage });
      window.history.replaceState({}, "");
    }
  }, [location.state, toast]);
}
