import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  binApi,
  collectionPointApi,
  wardApi,
  wasteTypeApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { toSwalMessage } from "@/lib/zodErrors";
import { binSchema } from "@/schemas/masters/wasteMasters/bin.schema";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { mergeWithScopeOptionExtra, scopeFieldState } from "../../shared/dataScopeOptions";
import LocationFields, {
  emptyGeo,
  LOCAL_BODY_LEVELS,
  type GeoLocationValue,
  type LocalBodyLevel,
} from "../../shared/LocationHierarchyFields";
import { capitalize } from "@/utils/capitalize";

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

const { encWasteMasters, encBins } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encWasteMasters, encBins);

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

const BIN_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export default function BinForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);
  const [collectionPointId, setCollectionPointId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [wardId, setWardId] = useState("");
  const [binName, setBinName] = useState("");
  const [binCapacity, setBinCapacity] = useState("");
  const [binType, setBinType] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [isActive, setIsActive] = useState(true);
  const wardScope = scopeFieldState("ward");

  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [wards, setWards] = useState<Option[]>([]);
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
    if (!geo.districtId || !geo.localBodyLevel || !geo.localBodyId) {
      setWards([]);
      setWardId("");
      return;
    }
    let cancelled = false;
    wardApi
      .readAll({
        params: {
          district_id: geo.districtId,
          [geo.localBodyLevel]: geo.localBodyId,
        },
      })
      .then((response: unknown) => {
        if (cancelled) return;
        const records = (
          Array.isArray(response)
            ? response
            : ((response as { results?: unknown[] })?.results ?? [])
        ) as Array<Record<string, unknown>>;
        const options = records
          .filter((ward) => ward.is_active !== false && ward.is_deleted !== true)
          .map((ward) => ({
            value: idOf(ward.unique_id ?? ward.id),
            label: String(ward.ward_name ?? ward.unique_id ?? ""),
          }))
          .filter((option) => option.value);
        const merged = mergeWithScopeOptionExtra(options, "ward", {});
        setWards(merged);
        setWardId((current) =>
          current && merged.some((option) => option.value === current) ? current : "",
        );
      })
      .catch(() => {
        if (cancelled) return;
        const merged = mergeWithScopeOptionExtra([], "ward", {});
        setWards(merged);
      });
    return () => {
      cancelled = true;
    };
  }, [geo.districtId, geo.localBodyLevel, geo.localBodyId]);

  // Auto-select ward when scope has exactly one value.
  useEffect(() => {
    if (wardScope.mode === "locked" && !wardId && wards.some((option) => option.value === wardScope.options[0].value)) {
      setWardId(wardScope.options[0].value);
    }
  }, [wardScope.mode, wardId, wards]);

  useEffect(() => {
    if (!id) return;
    binApi.read(id).then((record: ApiRecord) => {
      const nextGeo: GeoLocationValue = {
        ...emptyGeo,
        countryId: idOf(record.country_id ?? record.country),
        stateId: idOf(record.state_id ?? record.state),
        districtId: idOf(record.district_id ?? record.district),
        areaTypeId: idOf(record.area_type_id ?? record.area_type),
      };
      const selectedLevel = LOCAL_BODY_LEVELS.find((item) => idOf(record[item.value]));
      if (selectedLevel) {
        const matchedId = idOf(record[selectedLevel.value]);
        nextGeo.localBodyLevel = selectedLevel.value;
        nextGeo.localBodyId = matchedId;
      }
      setGeo(nextGeo);
      setCollectionPointId(idOf(record.collection_point_id ?? record.collection_point));
      setWasteTypeId(idOf(record.wastetype_id ?? record.waste_type_id ?? record.waste_type));
      setWardId(idOf(record.ward_id ?? record.ward));
      setBinName(String(record.bin_name ?? ""));
      setBinCapacity(String(record.bin_capacity ?? ""));
      setBinType(String(record.bin_type ?? ""));
      setLatitude(String(record.latitude ?? ""));
      setLongitude(String(record.longitude ?? ""));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const filteredCollectionPoints = useMemo(
    () => {
      if (!geo.localBodyLevel || !geo.localBodyId) return [];
      return collectionPoints.filter((item) => {
        if (geo.districtId && item.districtId && item.districtId !== geo.districtId) return false;
        return item[geo.localBodyLevel as LocalBodyLevel] === geo.localBodyId;
      });
    },
    [collectionPoints, geo.districtId, geo.localBodyId, geo.localBodyLevel],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = binSchema.safeParse({
      countryId: geo.countryId,
      stateId: geo.stateId,
      districtId: geo.districtId,
      areaTypeId: geo.areaTypeId,
      localBodyLevel: geo.localBodyLevel,
      localBodyId: geo.localBodyId,
      collectionPointId,
      wardId,
      wasteTypeId,
      binName: binName.trim(),
      binCapacity,
      binType,
      latitude,
      longitude,
      isActive,
    });
    if (!validation.success) {
      Swal.fire("Missing details", toSwalMessage(validation.error), "warning");
      return;
    }
    const latitudeNumber = latitude ? Number(latitude) : null;
    const longitudeNumber = longitude ? Number(longitude) : null;
    setSubmitting(true);
    const payload = {
      district_id: geo.districtId,
      collection_point_id: collectionPointId,
      ward_id: wardId,
      wastetype_id: wasteTypeId,
      bin_name: binName.trim(),
      bin_capacity: binCapacity || null,
      bin_type: binType || null,
      latitude: latitudeNumber,
      longitude: longitudeNumber,
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
        <LocationFields value={geo} onChange={(next) => { setGeo(next); setCollectionPointId(""); setWardId(""); }} />
        <div>
          <Label>Ward *</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={wardId}
            onChange={(e) => setWardId(e.target.value)}
            disabled={!geo.localBodyLevel || !geo.localBodyId || wardScope.mode === "locked"}
          >
            <option value="">
              {geo.localBodyLevel && geo.localBodyId
                ? "Select Ward"
                : "Select local body first"}
            </option>
            {wards.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Collection Point *</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={collectionPointId}
            onChange={(e) => setCollectionPointId(e.target.value)}
            disabled={!geo.localBodyLevel || !geo.localBodyId}
          >
            <option value="">
              {geo.localBodyLevel && geo.localBodyId
                ? "Select Collection Point"
                : "Select local body first"}
            </option>
            {filteredCollectionPoints.map((item) => <option key={item.value} value={item.value}>{capitalize(item.label)}</option>)}
          </select>
        </div>
        <div>
          <Label>Waste Type *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" value={wasteTypeId} onChange={(e) => setWasteTypeId(e.target.value)}>
            <option value="">Select Waste Type</option>
            {wasteTypes.map((item) => <option key={item.value} value={item.value}>{capitalize(item.label)}</option>)}
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
          <select className="h-10 w-full rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" value={binType} onChange={(e) => setBinType(e.target.value)}>
            <option value="">Select Bin Type</option>
            {BIN_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="Enter latitude"
          />
        </div>
        <div>
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="Enter longitude"
          />
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
