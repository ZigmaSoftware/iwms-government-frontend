import type { GrievancePin } from "@/features/complaintTicketing/types";

/** complaint pin states on the public complaint map — reserved status
 *  colours, always shown with a label (legend / tooltip / list text) */
export const PIN_STATUS = {
  escalated: { color: "#d03b3b", label: "Escalated / overdue" },
  open: { color: "#ec835a", label: "Open" },
  resolved: { color: "#0ca30c", label: "Resolved / closed" },
} as const;

export const pinState = (p: GrievancePin): keyof typeof PIN_STATUS =>
  !p.is_open ? "resolved" : p.is_escalated || p.is_overdue ? "escalated" : "open";
