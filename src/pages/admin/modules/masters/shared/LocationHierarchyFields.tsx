import { useEffect, useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  areaTypeApi,
  countryApi,
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
} from "@/helpers/admin";
import { mergeWithScopeOptionExtra, scopeFieldState, scopeOption } from "./dataScopeOptions";

type ApiRecord = Record<string, unknown>;

export type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

export type GeoLocationValue = {
  countryId: string;
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: LocalBodyLevel | "";
  localBodyId: string;
};

export const emptyGeo: GeoLocationValue = {
  countryId: "",
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

// Maps each local-body level to the `readAll` fetcher for its master table.
const LOCAL_BODY_API: Record<LocalBodyLevel, { readAll: (config?: { params?: Record<string, string> }) => Promise<unknown> }> = {
  corporation_id: corporationApi,
  municipality_id: municipalityApi,
  town_panchayat_id: townPanchayatApi,
  panchayat_union_id: panchayatUnionApi,
  panchayat_id: panchayatApi,
};

const LOCAL_BODY_LABEL_KEYS: Record<LocalBodyLevel, string[]> = {
  corporation_id: ["corporation_name", "name"],
  municipality_id: ["municipality_name", "name"],
  town_panchayat_id: ["town_panchayat_name", "name"],
  panchayat_union_id: ["union_name", "name"],
  panchayat_id: ["panchayat_name", "name"],
};

type Option = {
  value: string;
  label: string;
  countryId?: string;
  stateId?: string;
  districtId?: string;
};

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
  countryId: idOf(item.country_id ?? item.country),
  stateId: idOf(item.state_id ?? item.state),
  districtId: idOf(item.district_id ?? item.district),
});

const areaKind = (label: string): "urban" | "rural" | "" => {
  const normalized = label.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const emptyLocalBodies: Record<LocalBodyLevel, Option[]> = {
  corporation_id: [],
  municipality_id: [],
  town_panchayat_id: [],
  panchayat_union_id: [],
  panchayat_id: [],
};

// If a selected id isn't in the list yet (its scoped fetch is still in
// flight — e.g. right after an edit-mode record loads), keep it selected
// with a placeholder label rather than letting the <select> silently revert
// to blank; the real label swaps in the moment the fetch resolves.
const ensureOption = (items: Option[], selectedValue: string): Option[] => {
  if (!selectedValue || items.some((item) => item.value === selectedValue)) return items;
  return [{ value: selectedValue, label: selectedValue }, ...items];
};

// Cascading Country -> State -> District -> Area Type -> Local Body (Corporation /
// Municipality / Town Panchayat for urban, Panchayat Union / Panchayat for
// rural) selector, shared by any master that needs to place a record within
// the government hierarchy (Collection Point, Vehicle, ...).
//
// Fetching is cascaded rather than downloading every geo-master table in
// full on mount: States are cheap (top-level, ~a handful of rows) and stay
// eager, but Districts/Area Types are only fetched once a State is chosen
// (scoped by state_id), and the local-body-level tables — which at
// Tamil-Nadu scale run from ~120 (municipalities) to ~12,500+ rows
// (panchayats) — are only fetched for the one level actually selected, once
// its prerequisite District + Area Type are chosen, scoped by those ids.
export default function LocationFields({
  value,
  onChange,
}: {
  value: GeoLocationValue;
  onChange: (value: GeoLocationValue) => void;
}) {
  const [countries, setCountries] = useState<Option[]>([]);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);
  const [localBodies, setLocalBodies] = useState<Record<LocalBodyLevel, Option[]>>(emptyLocalBodies);

  const scopedStateId = scopeOption("state")?.value;
  const scopedDistrictId = scopeOption("district")?.value;

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and disabled rather than an editable
  // dropdown — they aren't allowed to place this record outside their own
  // scope. Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const localBodyScopeLevel = LOCAL_BODY_LEVELS.find(
    (item) => item.value === value.localBodyLevel,
  )?.sourceType as
    | "corporation"
    | "municipality"
    | "town_panchayat"
    | "panchayat_union"
    | "panchayat"
    | undefined;
  const localBodyScope = localBodyScopeLevel ? scopeFieldState(localBodyScopeLevel) : null;

  useEffect(() => {
    const patch: Partial<GeoLocationValue> = {};
    if (stateScope.mode === "locked" && !value.stateId) patch.stateId = stateScope.options[0].value;
    if (districtScope.mode === "locked" && !value.districtId) patch.districtId = districtScope.options[0].value;
    if (areaTypeScope.mode === "locked" && !value.areaTypeId) patch.areaTypeId = areaTypeScope.options[0].value;
    if (localBodyScope?.mode === "locked" && !value.localBodyId) {
      patch.localBodyId = localBodyScope.options[0].value;
    }
    if (Object.keys(patch).length) onChange({ ...value, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stateScope.mode,
    districtScope.mode,
    areaTypeScope.mode,
    localBodyScope?.mode,
    value.stateId,
    value.districtId,
    value.areaTypeId,
    value.localBodyId,
  ]);

  // Countries are the root of the hierarchy and can be loaded eagerly.
  useEffect(() => {
    let cancelled = false;
    countryApi
      .readAll()
      .then((res: unknown) => {
        if (cancelled) return;
        setCountries(activeOnly(normalizeList(res)).map((item) => toOption(item, ["name", "country_name"])));
      })
      .catch(() => {
        if (cancelled) return;
        setCountries([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // States — only once a Country is selected, scoped by that country.
  useEffect(() => {
    if (!value.countryId) {
      setStates((prev) => mergeWithScopeOptionExtra(prev, "state", {}));
      return;
    }
    let cancelled = false;
    stateApi
      .readAll({ params: { country: value.countryId } })
      .then((res: unknown) => {
        if (cancelled) return;
        const fetched = activeOnly(normalizeList(res)).map((item) => toOption(item, ["name", "state_name"]));
        setStates(mergeWithScopeOptionExtra(fetched, "state", { countryId: value.countryId }));
      })
      .catch(() => {
        if (cancelled) return;
        setStates((prev) => mergeWithScopeOptionExtra(prev, "state", { countryId: value.countryId }));
      });
    return () => {
      cancelled = true;
    };
  }, [value.countryId]);

  // Districts — only once a State is selected, scoped by that state.
  useEffect(() => {
    const stateId = value.stateId || scopedStateId;
    if (!stateId) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    districtApi
      .readAll({ params: { state_id: stateId } })
      .then((res: unknown) => {
        if (cancelled) return;
        const fetched = activeOnly(normalizeList(res)).map((item) => toOption(item, ["name", "district_name"]));
        setDistricts(mergeWithScopeOptionExtra(fetched, "district", scopedStateId ? { stateId: scopedStateId } : {}));
      })
      .catch(() => {
        if (cancelled) return;
        setDistricts((prev) => mergeWithScopeOptionExtra(prev, "district", scopedStateId ? { stateId: scopedStateId } : {}));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.stateId, scopedStateId]);

  // Area Types — only once a District is selected, scoped by that district.
  useEffect(() => {
    const districtId = value.districtId || scopedDistrictId;
    if (!districtId) {
      setAreaTypes([]);
      return;
    }
    let cancelled = false;
    areaTypeApi
      .readAll({ params: { district_id: districtId } })
      .then((res: unknown) => {
        if (cancelled) return;
        const fetched = activeOnly(normalizeList(res)).map((item) => toOption(item, ["name", "area_type_name"]));
        setAreaTypes(mergeWithScopeOptionExtra(fetched, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {}));
      })
      .catch(() => {
        if (cancelled) return;
        setAreaTypes((prev) => mergeWithScopeOptionExtra(prev, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {}));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.districtId, scopedDistrictId]);

  // Local body — only the selected level's table, only once District + Area
  // Type are both chosen, scoped by both ids. This is the big win: instead of
  // downloading corporation + municipality + town_panchayat + panchayat_union
  // + panchayat in full (the panchayat table alone runs to ~12,500+ rows
  // statewide), only the one relevant table is fetched, and only once it's
  // actually needed.
  useEffect(() => {
    const level = value.localBodyLevel;
    const districtId = value.districtId || scopedDistrictId;
    const areaTypeId = value.areaTypeId;
    if (!level || !districtId || !areaTypeId) {
      setLocalBodies((prev) => (prev === emptyLocalBodies ? prev : emptyLocalBodies));
      return;
    }
    let cancelled = false;
    const api = LOCAL_BODY_API[level];
    const labelKeys = LOCAL_BODY_LABEL_KEYS[level];
    const scopeLevel = LOCAL_BODY_LEVELS.find((item) => item.value === level)?.sourceType as
      | "corporation"
      | "municipality"
      | "town_panchayat"
      | "panchayat_union"
      | "panchayat"
      | undefined;
    api
      .readAll({ params: { district_id: districtId, area_type_id: areaTypeId } })
      .then((res: unknown) => {
        if (cancelled) return;
        const fetched = activeOnly(normalizeList(res)).map((item) => toOption(item, labelKeys));
        setLocalBodies({
          ...emptyLocalBodies,
          [level]: scopeLevel
            ? mergeWithScopeOptionExtra(fetched, scopeLevel, scopedDistrictId ? { districtId: scopedDistrictId } : {})
            : fetched,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLocalBodies((prev) => ({
          ...emptyLocalBodies,
          [level]: scopeLevel
            ? mergeWithScopeOptionExtra(prev[level], scopeLevel, scopedDistrictId ? { districtId: scopedDistrictId } : {})
            : prev[level],
        }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.localBodyLevel, value.districtId, value.areaTypeId, scopedDistrictId]);

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
    () => ensureOption(districts.filter((item) => !value.stateId || item.stateId === value.stateId), value.districtId),
    [districts, value.stateId, value.districtId],
  );
  const filteredStates = useMemo(
    () => ensureOption(states.filter((item) => !value.countryId || item.countryId === value.countryId), value.stateId),
    [states, value.countryId, value.stateId],
  );
  const filteredAreaTypes = useMemo(
    () => ensureOption(areaTypes.filter((item) => !value.districtId || item.districtId === value.districtId), value.areaTypeId),
    [areaTypes, value.districtId, value.areaTypeId],
  );
  const filteredLocalBodies = value.localBodyLevel
    ? ensureOption(
        localBodies[value.localBodyLevel].filter((item) => !value.districtId || item.districtId === value.districtId),
        value.localBodyId,
      )
    : [];

  const emit = (patch: Partial<GeoLocationValue>) => {
    const next = { ...value, ...patch };
    onChange(next);
  };

  return (
    <>
      <div>
        <Label>Country *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.countryId} onChange={(event) => emit({ countryId: event.target.value, stateId: "", districtId: "", areaTypeId: "", localBodyLevel: "", localBodyId: "" })}>
          <option value="">Select Country</option>
          {ensureOption(countries, value.countryId).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>State *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.stateId} onChange={(event) => emit({ stateId: event.target.value, districtId: "", areaTypeId: "", localBodyLevel: "", localBodyId: "" })} disabled={!value.countryId || stateScope.mode === "locked"}>
          <option value="">Select State</option>
          {filteredStates.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>District *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.districtId} onChange={(event) => emit({ districtId: event.target.value, areaTypeId: "", localBodyLevel: "", localBodyId: "" })} disabled={!value.stateId || districtScope.mode === "locked"}>
          <option value="">Select District</option>
          {filteredDistricts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Area Type *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.areaTypeId} onChange={(event) => emit({ areaTypeId: event.target.value, localBodyLevel: "", localBodyId: "" })} disabled={!value.districtId || areaTypeScope.mode === "locked"}>
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
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyId} onChange={(event) => emit({ localBodyId: event.target.value })} disabled={localBodyScope?.mode === "locked"}>
            <option value="">Select</option>
            {filteredLocalBodies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
