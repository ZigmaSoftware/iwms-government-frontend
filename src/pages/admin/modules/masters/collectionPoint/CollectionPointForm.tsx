import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  collectionPointApi,
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";

type Option = { value: string; label: string; stateId?: string; districtId?: string };
type ApiRecord = Record<string, unknown>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

const { encMasters, encCollectionPoints } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encCollectionPoints);

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
  stateId: idOf(item.state_id ?? item.state),
  districtId: idOf(item.district_id ?? item.district),
});

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

  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [cpName, setCpName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [hierarchyOptions, setHierarchyOptions] = useState<Record<HierarchyLevel, Option[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([stateApi.readAll(), districtApi.readAll(), panchayatApi.readAll()]).then(([stateRes, districtRes, panchayatRes]) => {
      setStates(normalizeList(stateRes).map((item) => optionOf(item, "state_name")));
      setDistricts(normalizeList(districtRes).map((item) => optionOf(item, "district_name")));
    });
    Promise.all([
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(([corporationRes, municipalityRes, townRes, unionRes, panchayatRes]) => {
      setHierarchyOptions({
        corporation_id: normalizeList(corporationRes).map((item) => optionOf(item, "corporation_name")),
        municipality_id: normalizeList(municipalityRes).map((item) => optionOf(item, "municipality_name")),
        town_panchayat_id: normalizeList(townRes).map((item) => optionOf(item, "town_panchayat_name")),
        panchayat_union_id: normalizeList(unionRes).map((item) => optionOf(item, "union_name")),
        panchayat_id: normalizeList(panchayatRes).map((item) => optionOf(item, "panchayat_name")),
      });
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    collectionPointApi.read(id).then((record: ApiRecord) => {
      setStateId(idOf(record.state_id ?? record.state));
      setDistrictId(idOf(record.district_id ?? record.district));
      const selectedLevel = hierarchyLevels.find((item) => idOf(record[item.value]));
      if (selectedLevel) {
        setHierarchyLevel(selectedLevel.value);
        setHierarchyId(idOf(record[selectedLevel.value]));
      }
      setCpName(String(record.cp_name ?? ""));
      setLatitude(String(record.latitude ?? ""));
      setLongitude(String(record.longitude ?? ""));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const filteredDistricts = useMemo(
    () => districts.filter((item) => !stateId || !item.stateId || item.stateId === stateId),
    [districts, stateId],
  );
  const filteredHierarchyOptions = useMemo(
    () => hierarchyOptions[hierarchyLevel].filter((item) => !districtId || !item.districtId || item.districtId === districtId),
    [districtId, hierarchyLevel, hierarchyOptions],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stateId || !districtId || !hierarchyId || !cpName.trim()) {
      Swal.fire("Missing details", "State, District, Hierarchy Level and Collection Point Name are required.", "warning");
      return;
    }
    setSubmitting(true);
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
      latitude: latitude || null,
      longitude: longitude || null,
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
        <div>
          <Label>State *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={stateId} onChange={(e) => { setStateId(e.target.value); setDistrictId(""); setHierarchyId(""); }}>
            <option value="">Select State</option>
            {states.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>District *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setHierarchyId(""); }}>
            <option value="">Select District</option>
            {filteredDistricts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Hierarchy Level *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={hierarchyLevel} onChange={(e) => { setHierarchyLevel(e.target.value as HierarchyLevel); setHierarchyId(""); }}>
            {hierarchyLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>{hierarchyLevels.find((item) => item.value === hierarchyLevel)?.label} *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={hierarchyId} onChange={(e) => setHierarchyId(e.target.value)}>
            <option value="">Select {hierarchyLevels.find((item) => item.value === hierarchyLevel)?.label}</option>
            {filteredHierarchyOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
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
