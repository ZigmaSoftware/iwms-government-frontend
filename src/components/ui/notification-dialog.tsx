import { useSyncExternalStore } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getActiveConfirmation,
  settleConfirmation,
  subscribeToConfirmation,
} from "@/lib/notify";
import { cn } from "@/lib/utils";

export function NotificationDialog() {
  const request = useSyncExternalStore(
    subscribeToConfirmation,
    getActiveConfirmation,
    getActiveConfirmation,
  );

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settleConfirmation(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && (
            <AlertDialogDescription className="whitespace-pre-line">
              {request.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settleConfirmation(false)}>
            {request?.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(request?.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            onClick={() => settleConfirmation(true)}
          >
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
