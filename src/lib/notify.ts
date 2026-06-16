import { toast } from "@/components/ui/sonner";

export type NotificationIcon = "success" | "error" | "warning" | "info" | "question";

export type NotifyOptions = {
  title?: unknown;
  text?: unknown;
  html?: unknown;
  icon?: NotificationIcon;
  timer?: number;
  showCancelButton?: boolean;
  confirmButtonText?: unknown;
  cancelButtonText?: unknown;
  [key: string]: unknown;
};

export type NotifyResult = {
  isConfirmed: boolean;
  isDenied: boolean;
  isDismissed: boolean;
};

export type ConfirmationRequest = {
  id: number;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
};

type PendingConfirmation = ConfirmationRequest & {
  resolve: (result: NotifyResult) => void;
};

const listeners = new Set<() => void>();
const confirmationQueue: PendingConfirmation[] = [];
let activeConfirmation: PendingConfirmation | null = null;
let nextConfirmationId = 1;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function toText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function htmlToText(value: unknown): string {
  return toText(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function getDescription(options: NotifyOptions): string {
  return options.text == null ? htmlToText(options.html) : toText(options.text);
}

function result(isConfirmed: boolean): NotifyResult {
  return {
    isConfirmed,
    isDenied: false,
    isDismissed: !isConfirmed,
  };
}

function showToast(options: NotifyOptions) {
  const title = toText(options.title);
  const description = getDescription(options);
  const message = title || description || "Notification";
  const toastOptions = {
    description: title ? description || undefined : undefined,
    duration: options.timer,
  };

  switch (options.icon) {
    case "success":
      toast.success(message, toastOptions);
      break;
    case "error":
      toast.error(message, toastOptions);
      break;
    case "warning":
    case "question":
      toast.warning(message, toastOptions);
      break;
    case "info":
      toast.info(message, toastOptions);
      break;
    default:
      toast(message, toastOptions);
  }
}

function activateNextConfirmation() {
  if (activeConfirmation || confirmationQueue.length === 0) return;
  activeConfirmation = confirmationQueue.shift() ?? null;
  notifyListeners();
}

function requestConfirmation(options: NotifyOptions): Promise<NotifyResult> {
  return new Promise((resolve) => {
    confirmationQueue.push({
      id: nextConfirmationId++,
      title: toText(options.title) || "Are you sure?",
      description: getDescription(options),
      confirmLabel: toText(options.confirmButtonText) || "Confirm",
      cancelLabel: toText(options.cancelButtonText) || "Cancel",
      destructive: options.icon === "warning" || options.icon === "error",
      resolve,
    });
    activateNextConfirmation();
  });
}

export function subscribeToConfirmation(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveConfirmation(): ConfirmationRequest | null {
  return activeConfirmation;
}

export function settleConfirmation(isConfirmed: boolean) {
  if (!activeConfirmation) return;

  const settled = activeConfirmation;
  activeConfirmation = null;
  settled.resolve(result(isConfirmed));
  notifyListeners();
  activateNextConfirmation();
}

function normalizeOptions(
  optionsOrTitle: NotifyOptions | unknown,
  text?: unknown,
  icon?: NotificationIcon,
): NotifyOptions {
  if (
    typeof optionsOrTitle === "object" &&
    optionsOrTitle !== null &&
    !Array.isArray(optionsOrTitle)
  ) {
    return optionsOrTitle as NotifyOptions;
  }

  return { title: optionsOrTitle, text, icon };
}

async function fire(
  optionsOrTitle: NotifyOptions | unknown,
  text?: unknown,
  icon?: NotificationIcon,
): Promise<NotifyResult> {
  const options = normalizeOptions(optionsOrTitle, text, icon);

  if (options.showCancelButton) {
    return requestConfirmation(options);
  }

  showToast(options);
  return result(true);
}

const Notify = { fire };

export default Notify;
