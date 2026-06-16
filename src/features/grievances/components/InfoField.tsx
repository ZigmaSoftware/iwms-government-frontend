import type { InfoFieldProps } from "@/features/grievances/types";

export function InfoField({ label, value = "-" }: InfoFieldProps) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold break-words">{value ?? "-"}</p>
    </div>
  );
}
