export type ExpiryStatus = "expired" | "warning" | "ok";

export const EXPIRY_WARN_DAYS_DEFAULT = 30;

export function getDaysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(
  dateStr: string | null | undefined,
  warnDays: number = EXPIRY_WARN_DAYS_DEFAULT
): ExpiryStatus | null {
  if (!dateStr) return null;
  const daysLeft = getDaysUntil(dateStr);
  if (Number.isNaN(daysLeft)) return null;
  if (daysLeft < 0) return "expired";
  if (daysLeft <= warnDays) return "warning";
  return "ok";
}
