/** 1234 → "1.2k", 1_700_000 → "1.7M" (map bubbles, summary pills) */
export const compactNumber = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return `${Math.round(v)}`;
};
