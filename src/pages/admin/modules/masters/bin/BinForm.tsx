import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import HierarchyNodeSelect, { type HierarchyLegacyValues } from "@/components/common/HierarchyNodeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { binApi, collectionPointApi, wasteTypeApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";

type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";
type Option = {
  value: string;
  label: string;
  districtId?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};
type ApiRecord = Record<string, unknown>;

const { encMasters, encBins } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encBins);

const normalizeList = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ApiRecord[] }).results;
  }
  return [];
};

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const optionOf = (item: ApiRecord, labelKey: string): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(item[labelKey] ?? item.name ?? item.unique_id ?? item.id ?? ""),
  districtId: idOf(item.district_id ?? item.district),
  corporation_id: idOf(item.corporation_id ?? item.corporation),
  municipality_id: idOf(item.municipality_id ?? item.municipality),
  town_panchayat_id: idOf(item.town_panchayat_id ?? item.town_panchayat),
  panchayat_union_id: idOf(item.panchayat_union_id ?? item.panchayat_union),
  panchayat_id: idOf(item.panchayat_id ?? item.panchayat),
});

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat / PLB" },
];

export default function BinForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [locationNodeId, setLocationNodeId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("panchayat_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [legacyMatch, setLegacyMatch] = useState<{ field: keyof HierarchyLegacyValues; value: string } | null>(null);
  const [collectionPointId, setCollectionPointId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [binName, setBinName] = useState("");
  const [binCapacity, setBinCapacity] = useState("");
  const [binType, setBinType] = useState("");
  const [binQr, setBinQr] = useState("");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(null),
  );
  const [isActive, setIsActive] = useState(true);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      collectionPointApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([cpRes, wasteTypeRes]) => {
      setCollectionPoints(normalizeList(cpRes).map((item) => optionOf(item, "cp_name")));
      setWasteTypes(normalizeList(wasteTypeRes).map((item) => optionOf(item, "waste_type_name")));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binApi.read(id).then((record: ApiRecord) => {
      setDistrictId(idOf(record.district_id ?? record.district));
      const selectedLevel = hierarchyLevels.find((item) => idOf(record[item.value]));
      if (selectedLevel) {
        setHierarchyLevel(selectedLevel.value);
        const matchedId = idOf(record[selectedLevel.value]);
        setHierarchyId(matchedId);
        setLegacyMatch({ field: selectedLevel.value, value: matchedId });
      }
      setCollectionPointId(idOf(record.collection_point_id ?? record.collection_point));
      setWasteTypeId(idOf(record.wastetype_id ?? record.waste_type_id ?? record.waste_type));
      setBinName(String(record.bin_name ?? ""));
      setBinCapacity(String(record.bin_capacity ?? ""));
      setBinType(String(record.bin_type ?? ""));
      setBinQr(String(record.bin_qr ?? ""));
      setCoordinates(normalizeCoordinateDrafts(record.coordinates));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const filteredCollectionPoints = useMemo(
    () =>
      collectionPoints.filter((item) => {
        if (districtId && item.districtId && item.districtId !== districtId) return false;
        if (hierarchyId && item[hierarchyLevel] !== hierarchyId) return false;
        return true;
      }),
    [collectionPoints, districtId, hierarchyId, hierarchyLevel],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!districtId || !collectionPointId || !wasteTypeId || !binName.trim()) {
      Swal.fire("Missing details", "District, Collection Point, Waste Type and Bin Name are required.", "warning");
      return;
    }
    setSubmitting(true);
    const payload = {
      district_id: districtId,
      collection_point_id: collectionPointId,
      wastetype_id: wasteTypeId,
      bin_name: binName.trim(),
      bin_capacity: binCapacity || null,
      bin_type: binType || null,
      bin_qr: binQr || null,
      coordinates: serializeCoordinateDrafts(coordinates),
      is_active: isActive,
    };
    try {
      if (isEdit && id) await binApi.update(id, payload);
      else await binApi.create(payload);
      navigate(LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin" : "Create Bin"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <HierarchyNodeSelect
            value={locationNodeId}
            legacyMatch={legacyMatch}
            allowedSourceTypes={["corporation", "municipality", "town_panchayat", "panchayat_union", "panchayat"]}
            label="Bin Hierarchy"
            placeholder="Select hierarchy to filter collection points"
            onChange={(nodeId, legacy) => {
              setLocationNodeId(nodeId);
              setDistrictId(legacy.district_id ?? "");
              const selected = hierarchyLevels.find((item) => legacy[item.value]);
              setHierarchyLevel(selected?.value ?? "panchayat_id");
              setHierarchyId(selected ? legacy[selected.value] ?? "" : "");
              setCollectionPointId("");
            }}
          />
        </div>
        <div>
          <Label>Collection Point *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={collectionPointId} onChange={(e) => setCollectionPointId(e.target.value)}>
            <option value="">Select Collection Point</option>
            {filteredCollectionPoints.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Waste Type *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={wasteTypeId} onChange={(e) => setWasteTypeId(e.target.value)}>
            <option value="">Select Waste Type</option>
            {wasteTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Bin Name *</Label>
          <Input value={binName} onChange={(e) => setBinName(e.target.value)} />
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" value={binCapacity} onChange={(e) => setBinCapacity(e.target.value)} />
        </div>
        <div>
          <Label>Bin Type</Label>
          <Input value={binType} onChange={(e) => setBinType(e.target.value)} />
        </div>
        <div>
          <Label>QR Code</Label>
          <Input value={binQr} onChange={(e) => setBinQr(e.target.value)} />
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
