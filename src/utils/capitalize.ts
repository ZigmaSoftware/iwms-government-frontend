export function capitalize(val?: string | number | null): string {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
