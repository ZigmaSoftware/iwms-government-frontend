export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

/** Seconds as the two largest units, e.g. "2d 4h", "3h 20m", "45m". */
export const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return "-";
  if (seconds < 60) return "< 1m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

export const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  ESCALATED: "bg-red-50 text-red-700",
  RESOLVED: "bg-green-50 text-green-700",
  REOPENED: "bg-purple-50 text-purple-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-600",
};
