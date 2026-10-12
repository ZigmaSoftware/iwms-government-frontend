import { useState, useSyncExternalStore } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  getActiveConfirmation,
  settleConfirmation,
  subscribeToConfirmation,
  type ConfirmationRequest,
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
        {/* Keyed so a queued confirmation starts with an empty input. */}
        {request && <ConfirmationBody key={request.id} request={request} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmationBody({ request }: { request: ConfirmationRequest }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { input } = request;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{request.title}</AlertDialogTitle>
        {request.description && (
          <AlertDialogDescription className="whitespace-pre-line">
            {request.description}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      {input && (
        <div className="space-y-1">
          {input.label && (
            <label htmlFor="confirmation-input" className="text-sm font-medium">
              {input.label} <span className="text-destructive">*</span>
            </label>
          )}
          <Textarea
            id="confirmation-input"
            autoFocus
            value={value}
            maxLength={input.maxLength}
            placeholder={input.placeholder}
            aria-invalid={error !== null}
            className={cn(error && "border-destructive")}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => settleConfirmation(false)}>
          {request.cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          className={cn(request.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          onClick={(event) => {
            const message = input?.validate?.(value);
            if (message) {
              // Keep the dialog open until the input is valid.
              event.preventDefault();
              setError(message);
              return;
            }
            settleConfirmation(true, input ? value : undefined);
          }}
        >
          {request.confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
