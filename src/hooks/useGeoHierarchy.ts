import { useEffect, useMemo, useState } from "react";

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
import { normalizeList } from "@/utils/forms";

export type Option = { value: string; label: string };

export type HierarchyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

export const HIERARCHY_LEVELS: Array<{ value: HierarchyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

export const AREA_TYPE_LEVELS: Record<"urban" | "rural", HierarchyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

export const areaTypeCategoryFromName = (name: string): "urban" | "rural" | "" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const resolveId = (record: any): string => String(record?.unique_id ?? record?.id ?? "");
const resolveName = (record: any): string =>
  String(
    record?.name ??
      record?.corporation_name ??
      record?.municipality_name ??
      record?.town_panchayat_name ??
      record?.union_name ??
      record?.panchayat_name ??
      resolveId(record),
  );
const toGeoOptions = (records: any[]): Option[] =>
  records.filter((r) => resolveId(r)).map((r) => ({ value: resolveId(r), label: resolveName(r) }));

const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value }, ...items];
};

/**
 * Reads a staff template's assigned id for a given hierarchy level, tolerating
 * both the nested read shape (`corporation: { unique_id }`) and flat ids.
 */
export const templateHierarchyId = (template: any, level: HierarchyLevel): string => {
  const key = level.replace("_id", "");
  return String(template?.[key]?.unique_id ?? template?.[`${key}_id`] ?? template?.[level] ?? "");
};

/**
 * True when the staff template belongs to the selected local body. An empty
 * `id` means "no filter applied" so every template passes.
 */
export const staffTemplateInHierarchy = (
  template: any,
  level: HierarchyLevel,
  id: string,
): boolean => {
  if (!id) return true;
  return templateHierarchyId(template, level) === id;
};

const emptyHierarchyRecords = (): Record<HierarchyLevel, any[]> => ({
  corporation_id: [],
  municipality_id: [],
  town_panchayat_id: [],
  panchayat_union_id: [],
  panchayat_id: [],
});

/**
 * Encapsulates the State → District → Area Type → Local Body Type → Local Body
 * cascade shared by Trip Plan, Daily Trip Plan and now the Staff Template forms.
 * Owns both the master data and the selected values, and exposes cascading
 * option lists, a payload builder and a hydrate helper for edit mode.
 */
export function useGeoHierarchy() {
  const [stateId, setStateIdRaw] = useState("");
  const [districtId, setDistrictIdRaw] = useState("");
  const [areaTypeId, setAreaTypeIdRaw] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [hierarchyLevel, setHierarchyLevelRaw] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");

  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);
  const [hierarchyRecords, setHierarchyRecords] = useState<Record<HierarchyLevel, any[]>>(
    emptyHierarchyRecords(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ])
      .then(([stateRes, districtRes, areaTypeRes, corpRes, muniRes, townRes, unionRes, panRes]) => {
        if (!mounted) return;
        setStates(normalizeList(stateRes));
        setDistricts(normalizeList(districtRes));
        setAreaTypes(normalizeList(areaTypeRes));
        setHierarchyRecords({
          corporation_id: normalizeList(corpRes),
          municipality_id: normalizeList(muniRes),
          town_panchayat_id: normalizeList(townRes),
          panchayat_union_id: normalizeList(unionRes),
          panchayat_id: normalizeList(panRes),
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Cascading resets — mirror the Trip Plan form behaviour.
  const setStateId = (value: string) => {
    setStateIdRaw(value);
    setDistrictIdRaw("");
    setAreaTypeIdRaw("");
    setAreaTypeCategory("");
    setHierarchyId("");
  };
  const setDistrictId = (value: string) => {
    setDistrictIdRaw(value);
    setAreaTypeIdRaw("");
    setAreaTypeCategory("");
    setHierarchyId("");
  };
  const setAreaTypeId = (value: string) => {
    const selected = areaTypes.find((a) => resolveId(a) === value);
    setAreaTypeIdRaw(value);
    setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? "")));
    setHierarchyId("");
  };
  const setHierarchyLevel = (value: HierarchyLevel) => {
    setHierarchyLevelRaw(value);
    setHierarchyId("");
  };

  const stateOptions = useMemo(() => toGeoOptions(states), [states]);
  const districtOptions = useMemo(
    () => toGeoOptions(districts.filter((d) => !stateId || String(d.state_id ?? d.state ?? "") === stateId)),
    [districts, stateId],
  );
  const areaTypeOptions = useMemo(
    () =>
      toGeoOptions(
        areaTypes.filter((a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId),
      ),
    [areaTypes, districtId],
  );

  const availableHierarchyLevels = useMemo(() => {
    if (areaTypeCategory) {
      return HIERARCHY_LEVELS.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value));
    }
    return [
      {
        value: hierarchyLevel,
        label: HIERARCHY_LEVELS.find((item) => item.value === hierarchyLevel)?.label ?? "Local Body",
      },
    ];
  }, [areaTypeCategory, hierarchyLevel]);

  const hierarchyOptions = useMemo(() => {
    const options = toGeoOptions(
      (hierarchyRecords[hierarchyLevel] ?? []).filter(
        (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
      ),
    );
    if (hierarchyId && !options.some((o) => o.value === hierarchyId)) {
      const current = (hierarchyRecords[hierarchyLevel] ?? []).find((item) => resolveId(item) === hierarchyId);
      return ensureOption(options, hierarchyId, current ? resolveName(current) : hierarchyId);
    }
    return options;
  }, [hierarchyRecords, hierarchyLevel, districtId, hierarchyId]);

  const hierarchyLabel =
    HIERARCHY_LEVELS.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body";

  /** Reads nested geo objects from a saved record (edit mode). */
  const hydrate = (record: any) => {
    setStateIdRaw(String(record?.state?.unique_id ?? record?.state_id ?? ""));
    setDistrictIdRaw(String(record?.district?.unique_id ?? record?.district_id ?? ""));
    const areaTypeIdValue = String(record?.area_type?.unique_id ?? record?.area_type_id ?? "");
    setAreaTypeIdRaw(areaTypeIdValue);

    const hierarchyMap: Record<HierarchyLevel, string | undefined> = {
      corporation_id: record?.corporation?.unique_id ?? record?.corporation_id,
      municipality_id: record?.municipality?.unique_id ?? record?.municipality_id,
      town_panchayat_id: record?.town_panchayat?.unique_id ?? record?.town_panchayat_id,
      panchayat_union_id: record?.panchayat_union?.unique_id ?? record?.panchayat_union_id,
      panchayat_id: record?.panchayat?.unique_id ?? record?.panchayat_id,
    };
    const detectedLevel = HIERARCHY_LEVELS.find((item) => hierarchyMap[item.value]);

    // Resolve the ULB/RLB category so the Local Body Type prefills: prefer the
    // area type's name (nested or from the loaded master list), else derive it
    // from the detected local-body level (Panchayat Union / Panchayat → rural).
    const areaTypeName = String(
      record?.area_type?.name ??
        areaTypes.find((a) => resolveId(a) === areaTypeIdValue)?.name ??
        "",
    );
    let category = areaTypeCategoryFromName(areaTypeName);
    if (!category && detectedLevel) {
      category = AREA_TYPE_LEVELS.urban.includes(detectedLevel.value) ? "urban" : "rural";
    }
    setAreaTypeCategory(category);

    if (detectedLevel) {
      setHierarchyLevelRaw(detectedLevel.value);
      setHierarchyId(String(hierarchyMap[detectedLevel.value] ?? ""));
    }
  };

  /** Builds the *_id payload fields — all levels nulled, then the active one set. */
  const buildPayload = (): Record<string, any> => ({
    state_id: stateId || null,
    district_id: districtId || null,
    area_type_id: areaTypeId || null,
    corporation_id: null,
    municipality_id: null,
    town_panchayat_id: null,
    panchayat_union_id: null,
    panchayat_id: null,
    [hierarchyLevel]: hierarchyId || null,
  });

  return {
    stateId,
    districtId,
    areaTypeId,
    areaTypeCategory,
    hierarchyLevel,
    hierarchyId,
    setStateId,
    setDistrictId,
    setAreaTypeId,
    setHierarchyLevel,
    setHierarchyId,
    stateOptions,
    districtOptions,
    areaTypeOptions,
    availableHierarchyLevels,
    hierarchyOptions,
    hierarchyLabel,
    loading,
    hydrate,
    buildPayload,
  };
}

export type GeoHierarchy = ReturnType<typeof useGeoHierarchy>;
