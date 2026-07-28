import { getDaysUntil, getExpiryStatus, EXPIRY_WARN_DAYS_DEFAULT } from "@/utils/expiry";

export default function ExpiryBadge({
  label,
  date,
  warnDays = EXPIRY_WARN_DAYS_DEFAULT,
}: {
  label: string;
  date: string | null | undefined;
  warnDays?: number;
}) {
  const status = getExpiryStatus(date, warnDays);
  if (!status) return null;

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
        {label} Expired
      </span>
    );
  }

  if (status === "warning") {
    const daysLeft = getDaysUntil(date as string);
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
        <span className="material-symbols-outlined text-[14px] leading-none">schedule</span>
        {label} Expiring Soon ({daysLeft} days left)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
      {label} OK
    </span>
  );
}
