import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form/FieldError";

export type GeoCoordinateDraft = {
  latitude: string;
  longitude: string;
};

export type GeoCoordinatePayload = {
  latitude: number;
  longitude: number;
};

export const emptyCoordinate = (): GeoCoordinateDraft => ({
  latitude: "",
  longitude: "",
});

const normalizePoint = (point: unknown): GeoCoordinateDraft | null => {
  if (Array.isArray(point)) {
    return {
      latitude: point[0] == null ? "" : String(point[0]),
      longitude: point[1] == null ? "" : String(point[1]),
    };
  }

  if (!point || typeof point !== "object") {
    return null;
  }

  const value = point as Record<string, unknown>;
  return {
    latitude: value.latitude == null ? String(value.lat ?? "") : String(value.latitude),
    longitude: value.longitude == null ? String(value.lng ?? value.lon ?? "") : String(value.longitude),
  };
};

export const normalizeCoordinateDrafts = (
  value: unknown,
  fallback?: GeoCoordinateDraft,
): GeoCoordinateDraft[] => {
  const points = Array.isArray(value)
    ? value.map(normalizePoint).filter((point): point is GeoCoordinateDraft => Boolean(point))
    : [];

  if (points.length > 0) {
    return points;
  }

  if (fallback && (fallback.latitude || fallback.longitude)) {
    return [fallback];
  }

  return [emptyCoordinate()];
};

export const serializeCoordinateDrafts = (
  points: GeoCoordinateDraft[],
): GeoCoordinatePayload[] =>
  points
    .filter((point) => point.latitude.trim() !== "" && point.longitude.trim() !== "")
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

type GeoCoordinateFieldErrors = {
  latitude?: string;
  longitude?: string;
};

type GeoFenceCoordinatesProps = {
  coordinates: GeoCoordinateDraft[];
  onChange: (coordinates: GeoCoordinateDraft[]) => void;
  label?: string;
  errors?: (GeoCoordinateFieldErrors | undefined)[];
};

export default function GeoFenceCoordinates({
  coordinates,
  onChange,
  label = "Coordinates",
  errors,
}: GeoFenceCoordinatesProps) {
  const updatePoint = (
    index: number,
    field: keyof GeoCoordinateDraft,
    value: string,
  ) => {
    onChange(
      coordinates.map((point, currentIndex) =>
        currentIndex === index ? { ...point, [field]: value } : point,
      ),
    );
  };

  const removePoint = (index: number) => {
    const next = coordinates.filter((_, currentIndex) => currentIndex !== index);
    onChange(next.length > 0 ? next : [emptyCoordinate()]);
  };

  return (
    <div className="md:col-span-2 rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...coordinates, emptyCoordinate()])}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {coordinates.map((point, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <Input
                inputMode="decimal"
                placeholder="Latitude"
                value={point.latitude}
                onChange={(event) => updatePoint(index, "latitude", event.target.value)}
              />
              <FieldError message={errors?.[index]?.latitude} />
            </div>
            <div>
              <Input
                inputMode="decimal"
                placeholder="Longitude"
                value={point.longitude}
                onChange={(event) => updatePoint(index, "longitude", event.target.value)}
              />
              <FieldError message={errors?.[index]?.longitude} />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Remove coordinate"
              onClick={() => removePoint(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
