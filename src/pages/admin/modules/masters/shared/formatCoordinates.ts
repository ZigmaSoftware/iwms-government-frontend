type CoordinateRecord = {
  latitude?: string | number | null;
  longitude?: string | number | null;
  lat?: string | number | null;
  lng?: string | number | null;
  lon?: string | number | null;
};

const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : String(value);
};

const pointToText = (point: unknown): string | null => {
  if (Array.isArray(point)) {
    const latitude = formatNumber(point[0]);
    const longitude = formatNumber(point[1]);
    return latitude && longitude ? `${latitude}, ${longitude}` : null;
  }

  if (!point || typeof point !== "object") return null;

  const record = point as CoordinateRecord;
  const latitude = formatNumber(record.latitude ?? record.lat);
  const longitude = formatNumber(record.longitude ?? record.lng ?? record.lon);

  return latitude && longitude ? `${latitude}, ${longitude}` : null;
};

export const formatCoordinates = (
  value: unknown,
  fallback?: { latitude?: unknown; longitude?: unknown },
): string => {
  const points = Array.isArray(value)
    ? value.map(pointToText).filter((point): point is string => Boolean(point))
    : [];

  if (points.length > 0) return points.join("; ");

  const fallbackLatitude = formatNumber(fallback?.latitude as string | number | null | undefined);
  const fallbackLongitude = formatNumber(fallback?.longitude as string | number | null | undefined);

  return fallbackLatitude && fallbackLongitude ? `${fallbackLatitude}, ${fallbackLongitude}` : "-";
};
