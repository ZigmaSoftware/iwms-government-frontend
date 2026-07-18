import { useEffect, useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  areaTypeApi,
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
} from "@/helpers/admin";
import { mergeWithScopeOptionExtra, scopeOption } from "./dataScopeOptions";

type ApiRecord = Record<string, unknown>;

export type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

export type GeoLocationValue = {
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: LocalBodyLevel | "";
  localBodyId: string;
};

export const emptyGeo: GeoLocationValue = {
  stateId: "",
  districtId: "",
  areaTypeId: "",
  localBodyLevel: "",
  localBodyId: "",
};

export const LOCAL_BODY_LEVELS: Array<{ value: LocalBodyLevel; label: string; sourceType: string }> = [
  { value: "corporation_id", label: "Corporation", sourceType: "corporation" },
  { value: "municipality_id", label: "Municipality", sourceType: "municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat", sourceType: "town_panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union", sourceType: "panchayat_union" },
  { value: "panchayat_id", label: "Panchayat", sourceType: "panchayat" },
];

type Option = { value: string; label: string; stateId?: string; districtId?: string };

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const normalizeList = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ApiRecord[] }).results;
  }
  return [];
};

const activeOnly = (items: ApiRecord[]) =>
  items.filter((item) => item.is_active !== false && item.is_deleted !== true);

const toOption = (item: ApiRecord, labelKeys: string[]): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(labelKeys.map((key) => item[key]).find(Boolean) ?? item.name ?? item.unique_id ?? ""),
  stateId: idOf(item.state_id ?? item.state),
  districtId: idOf(item.district_id ?? item.district),
});

const areaKind = (label: string): "urban" | "rural" | "" => {
  const normalized = label.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

// Cascading State -> District -> Area Type -> Local Body (Corporation /
// Municipality / Town Panchayat for urban, Panchayat Union / Panchayat for
// rural) selector, shared by any master that needs to place a record within
// the government hierarchy (Collection Point, Vehicle, ...).
export default function LocationFields({
  value,
  onChange,
}: {
  value: GeoLocationValue;
  onChange: (value: GeoLocationValue) => void;
}) {
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);
  const [localBodies, setLocalBodies] = useState<Record<LocalBodyLevel, Option[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  useEffect(() => {
    let cancelled = false;

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates each level's own
    // menu/list, not these dropdowns) — their Data Scope from login always
    // supplies their own hierarchy values regardless.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    const applyScopeFallback = () => {
      setStates((prev) => mergeWithScopeOptionExtra(prev, "state", {}));
      setDistricts((prev) =>
        mergeWithScopeOptionExtra(prev, "district", scopedStateId ? { stateId: scopedStateId } : {})
      );
      setAreaTypes((prev) =>
        mergeWithScopeOptionExtra(prev, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {})
      );
      setLocalBodies((prev) => ({
        corporation_id: mergeWithScopeOptionExtra(prev.corporation_id, "corporation", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        municipality_id: mergeWithScopeOptionExtra(prev.municipality_id, "municipality", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        town_panchayat_id: mergeWithScopeOptionExtra(prev.town_panchayat_id, "town_panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_union_id: mergeWithScopeOptionExtra(prev.panchayat_union_id, "panchayat_union", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_id: mergeWithScopeOptionExtra(prev.panchayat_id, "panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
      }));
    };

    applyScopeFallback();

    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(([stateRes, districtRes, areaTypeRes, corpRes, muniRes, townRes, unionRes, panchayatRes]) => {
      if (cancelled) return;
      const fetchedStates = activeOnly(normalizeList(stateRes)).map((item) => toOption(item, ["name", "state_name"]));
      const fetchedDistricts = activeOnly(normalizeList(districtRes)).map((item) => toOption(item, ["name", "district_name"]));
      const fetchedAreaTypes = activeOnly(normalizeList(areaTypeRes)).map((item) => toOption(item, ["name", "area_type_name"]));
      const fetchedCorp = activeOnly(normalizeList(corpRes)).map((item) => toOption(item, ["corporation_name", "name"]));
      const fetchedMuni = activeOnly(normalizeList(muniRes)).map((item) => toOption(item, ["municipality_name", "name"]));
      const fetchedTown = activeOnly(normalizeList(townRes)).map((item) => toOption(item, ["town_panchayat_name", "name"]));
      const fetchedUnion = activeOnly(normalizeList(unionRes)).map((item) => toOption(item, ["union_name", "name"]));
      const fetchedPanchayat = activeOnly(normalizeList(panchayatRes)).map((item) => toOption(item, ["panchayat_name", "name"]));

      setStates(mergeWithScopeOptionExtra(fetchedStates, "state", {}));
      setDistricts(mergeWithScopeOptionExtra(fetchedDistricts, "district", scopedStateId ? { stateId: scopedStateId } : {}));
      setAreaTypes(mergeWithScopeOptionExtra(fetchedAreaTypes, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {}));
      setLocalBodies({
        corporation_id: mergeWithScopeOptionExtra(fetchedCorp, "corporation", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        municipality_id: mergeWithScopeOptionExtra(fetchedMuni, "municipality", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        town_panchayat_id: mergeWithScopeOptionExtra(fetchedTown, "town_panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_union_id: mergeWithScopeOptionExtra(fetchedUnion, "panchayat_union", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_id: mergeWithScopeOptionExtra(fetchedPanchayat, "panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
      });
    }).catch(() => {
      if (cancelled) return;
      applyScopeFallback();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedArea = areaTypes.find((item) => item.value === value.areaTypeId);
  const selectedAreaKind = areaKind(selectedArea?.label ?? "");
  const allowedLevels = LOCAL_BODY_LEVELS.filter((level) =>
    selectedAreaKind === "urban"
      ? ["corporation_id", "municipality_id", "town_panchayat_id"].includes(level.value)
      : selectedAreaKind === "rural"
        ? ["panchayat_union_id", "panchayat_id"].includes(level.value)
        : false,
  );
  const filteredDistricts = useMemo(
    () => districts.filter((item) => !value.stateId || item.stateId === value.stateId),
    [districts, value.stateId],
  );
  const filteredAreaTypes = useMemo(
    () => areaTypes.filter((item) => !value.districtId || item.districtId === value.districtId),
    [areaTypes, value.districtId],
  );
  const filteredLocalBodies = value.localBodyLevel
    ? localBodies[value.localBodyLevel].filter((item) => !value.districtId || item.districtId === value.districtId)
    : [];

  const emit = (patch: Partial<GeoLocationValue>) => {
    const next = { ...value, ...patch };
    onChange(next);
  };

  return (
    <>
      <div>
        <Label>State *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.stateId} onChange={(event) => emit({ stateId: event.target.value, districtId: "", areaTypeId: "", localBodyLevel: "", localBodyId: "" })}>
          <option value="">Select State</option>
          {states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>District *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.districtId} onChange={(event) => emit({ districtId: event.target.value, areaTypeId: "", localBodyLevel: "", localBodyId: "" })} disabled={!value.stateId}>
          <option value="">Select District</option>
          {filteredDistricts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Area Type *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.areaTypeId} onChange={(event) => emit({ areaTypeId: event.target.value, localBodyLevel: "", localBodyId: "" })} disabled={!value.districtId}>
          <option value="">Select Area Type</option>
          {filteredAreaTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Local Body *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyLevel} onChange={(event) => emit({ localBodyLevel: event.target.value as LocalBodyLevel, localBodyId: "" })} disabled={!value.areaTypeId}>
          <option value="">Select Local Body</option>
          {allowedLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {value.localBodyLevel && (
        <div>
          <Label>{LOCAL_BODY_LEVELS.find((item) => item.value === value.localBodyLevel)?.label} *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyId} onChange={(event) => emit({ localBodyId: event.target.value })}>
            <option value="">Select</option>
            {filteredLocalBodies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
