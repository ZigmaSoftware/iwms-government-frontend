import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import HierarchyNodeSelect, { type HierarchyLegacyValues } from "@/components/common/HierarchyNodeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collectionPointApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { decryptSegment } from "@/utils/routeCrypto";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";

type ApiRecord = Record<string, unknown>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

const { encMasters, encScheduleMasters, encCollectionPoints } = getEncryptedRoute();

// Resolve the correct list path based on which parent module loaded this form.
function useListPath() {
  const { encMaster } = useParams<{ encMaster?: string }>();
  const parent = decryptSegment(encMaster ?? "");
  if (parent === "schedule-masters") {
    return createCrudRoutePaths(encScheduleMasters, encCollectionPoints).listPath;
  }
  return createCrudRoutePaths(encMasters, encCollectionPoints).listPath;
}

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

export default function CollectionPointForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const LIST_PATH = useListPath();

  const [locationNodeId, setLocationNodeId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [legacyMatch, setLegacyMatch] = useState<{ field: keyof HierarchyLegacyValues; value: string } | null>(null);
  const [cpName, setCpName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(null),
  );
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    collectionPointApi.read(id).then((record: ApiRecord) => {
      setStateId(idOf(record.state_id ?? record.state));
      setDistrictId(idOf(record.district_id ?? record.district));
      const selectedLevel = hierarchyLevels.find((item) => idOf(record[item.value]));
      if (selectedLevel) {
        setHierarchyLevel(selectedLevel.value);
        const matchedId = idOf(record[selectedLevel.value]);
        setHierarchyId(matchedId);
        setLegacyMatch({ field: selectedLevel.value, value: matchedId });
      }
      setCpName(String(record.cp_name ?? ""));
      setLatitude(String(record.latitude ?? ""));
      setLongitude(String(record.longitude ?? ""));
      setCoordinates(
        normalizeCoordinateDrafts(record.coordinates, {
          latitude: String(record.latitude ?? ""),
          longitude: String(record.longitude ?? ""),
        }),
      );
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stateId || !districtId || !hierarchyId || !cpName.trim()) {
      Swal.fire("Missing details", "State, District, Hierarchy Level and Collection Point Name are required.", "warning");
      return;
    }
    setSubmitting(true);
    const coordinatePayload = serializeCoordinateDrafts(coordinates);
    const firstCoordinate = coordinatePayload[0];
    const payload = {
      state_id: stateId,
      district_id: districtId,
      corporation_id: null,
      municipality_id: null,
      town_panchayat_id: null,
      panchayat_union_id: null,
      panchayat_id: null,
      [hierarchyLevel]: hierarchyId,
      cp_name: cpName.trim(),
      latitude: firstCoordinate?.latitude ?? (latitude || null),
      longitude: firstCoordinate?.longitude ?? (longitude || null),
      coordinates: coordinatePayload,
      is_active: isActive,
    };
    try {
      if (isEdit && id) await collectionPointApi.update(id, payload);
      else await collectionPointApi.create(payload);
      navigate(LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Collection Point" : "Create Collection Point"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <HierarchyNodeSelect
            value={locationNodeId}
            legacyMatch={legacyMatch}
            allowedSourceTypes={["corporation", "municipality", "town_panchayat", "panchayat_union", "panchayat"]}
            label="Collection Point Hierarchy"
            placeholder="Select the hierarchy node for this collection point"
            onChange={(nodeId, legacy) => {
              setLocationNodeId(nodeId);
              setStateId(legacy.state_id ?? "");
              setDistrictId(legacy.district_id ?? "");
              const selected = hierarchyLevels.find((item) => legacy[item.value]);
              setHierarchyLevel(selected?.value ?? "corporation_id");
              setHierarchyId(selected ? legacy[selected.value] ?? "" : "");
            }}
          />
        </div>
        <div>
          <Label>Collection Point Name *</Label>
          <Input value={cpName} onChange={(e) => setCpName(e.target.value)} />
        </div>
        <div>
          <Label>Latitude</Label>
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
        <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
