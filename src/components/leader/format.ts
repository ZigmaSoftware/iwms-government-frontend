/* number formatting shared by the State / District leader dashboards */

export const fmtInt = (v?: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));

export const fmtNum = (v?: number | null, dec = 2) =>
  v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec });

/** kg → { value, unit } in kg below a tonne, MT above (1 MT = 1000 kg) */
export const weightParts = (kg?: number | null): { value: string; unit: string } => {
  const v = Number(kg ?? 0);
  if (Math.abs(v) >= 1000) return { value: (v / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 }), unit: "MT" };
  return { value: v.toLocaleString("en-IN", { maximumFractionDigits: 1 }), unit: "kg" };
};

export const fmtWeight = (kg?: number | null) => {
  const { value, unit } = weightParts(kg);
  return `${value} ${unit}`;
};

export const currentMonth = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};

export const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
