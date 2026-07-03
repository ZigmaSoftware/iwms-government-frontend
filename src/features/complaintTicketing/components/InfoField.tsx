import type { InfoFieldProps } from "@/features/complaintTicketing/types";

export function InfoField({ label, value = "-" }: InfoFieldProps) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="break-words font-semibold">{value ?? "-"}</p>
    </div>
  );
}
