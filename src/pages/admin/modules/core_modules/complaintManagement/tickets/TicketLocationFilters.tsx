import { useEffect, useMemo, useState } from "react";
import { geoApi } from "@/features/complaintTicketing/api";
import type { GeoOption, LocalBodyOption, LocalBodyType } from "@/features/complaintTicketing/types";
import { emptyTicketLocationFilter, type TicketLocationFilterValue } from "./ticketLocationFilter";

const LOCAL_BODY_TYPE_LABELS: Record<LocalBodyType, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const LOCAL_BODY_TYPES: LocalBodyType[] = [
  "corporation",
  "municipality",
  "town_panchayat",
  "panchayat_union",
  "panchayat",
];

const AREA_TYPE_LEVELS: Record<"urban" | "rural", LocalBodyType[]> = {
  urban: ["corporation", "municipality", "town_panchayat"],
  rural: ["panchayat_union", "panchayat"],
};

const areaTypeCategoryFromName = (name: string): "urban" | "rural" | "" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const SELECT_CLASS = "h-9 max-w-full rounded-md border px-2 text-sm";

// Geo lists rarely change: cache per key so reopening the filter (which
// remounts it) restores the dropdowns at once instead of refetching.
const geoCache = new Map<string, Promise<unknown>>();
const cached = <T,>(key: string, load: () => Promise<T>): Promise<T> => {
  if (!geoCache.has(key)) {
    geoCache.set(key, load().catch((err) => {
      geoCache.delete(key);
      throw err;
    }));
  }
  return geoCache.get(key) as Promise<T>;
};

/** State -> District -> Area Type -> Local body type -> Local body filter
 *  shared by the Tickets list and My Tasks. */
export default function TicketLocationFilters({
  value,
  onChange,
}: {
  value: TicketLocationFilterValue;
  onChange: (value: TicketLocationFilterValue) => void;
}) {
  const [states, setStates] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [areaTypes, setAreaTypes] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<LocalBodyOption[]>([]);

  useEffect(() => {
    cached("states", geoApi.states).then(setStates).catch(() => setStates([]));
    cached("districts", geoApi.districts).then(setDistricts).catch(() => setDistricts([]));
  }, []);

  // Option lists follow the value (not the change handlers), so a remount
  // with an existing selection shows its area types / local bodies again.
  useEffect(() => {
    setAreaTypes([]);
    if (!value.district) return;
    let live = true;
    cached(`area:${value.district}`, () => geoApi.areaTypes(value.district))
      .then((rows) => live && setAreaTypes(rows))
      .catch(() => live && setAreaTypes([]));
    return () => { live = false; };
  }, [value.district]);

  useEffect(() => {
    setCities([]);
    if (!value.district || !value.areaType || !value.localBodyType) return;
    let live = true;
    const { district, areaType, localBodyType } = value;
    cached(`lb:${district}:${areaType}:${localBodyType}`, () => geoApi.localBodies(district, areaType, localBodyType))
      .then((rows) => live && setCities(rows))
      .catch(() => live && setCities([]));
    return () => { live = false; };
  }, [value.district, value.areaType, value.localBodyType]);

  const filteredDistricts = useMemo(
    () => districts.filter((item) => !value.state || item.state_id === value.state),
    [districts, value.state],
  );
  const filteredAreaTypes = useMemo(
    () => areaTypes.filter((item) => !value.district || !item.district_id || item.district_id === value.district),
    [areaTypes, value.district],
  );
  const selectedAreaCategory = areaTypeCategoryFromName(
    areaTypes.find((item) => item.unique_id === value.areaType)?.name ?? "",
  );
  const availableLocalBodyTypes = selectedAreaCategory ? AREA_TYPE_LEVELS[selectedAreaCategory] : LOCAL_BODY_TYPES;

  const onStateChange = (state: string) => onChange({ ...emptyTicketLocationFilter, state });

  const onDistrictChange = (district: string) =>
    onChange({ ...emptyTicketLocationFilter, state: value.state, district });

  const onAreaTypeChange = (areaType: string) => onChange({ ...value, areaType, localBodyType: "", city: "" });

  const onLocalBodyTypeChange = (type: string) =>
    onChange({ ...value, localBodyType: type as LocalBodyType | "", city: "" });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SELECT_CLASS} value={value.state} onChange={(e) => onStateChange(e.target.value)}>
        <option value="">All states</option>
        {states.map((item) => (
          <option key={item.unique_id} value={item.unique_id}>{item.name}</option>
        ))}
      </select>
      <select className={SELECT_CLASS} value={value.district} onChange={(e) => onDistrictChange(e.target.value)}>
        <option value="">All districts</option>
        {filteredDistricts.map((item) => (
          <option key={item.unique_id} value={item.unique_id}>{item.name}</option>
        ))}
      </select>
      <select
        className={SELECT_CLASS}
        value={value.areaType}
        onChange={(e) => onAreaTypeChange(e.target.value)}
        disabled={!value.district}
      >
        <option value="">All area types</option>
        {filteredAreaTypes.map((item) => (
          <option key={item.unique_id} value={item.unique_id}>{item.name}</option>
        ))}
      </select>
      <select
        className={SELECT_CLASS}
        value={value.localBodyType}
        onChange={(e) => onLocalBodyTypeChange(e.target.value)}
        disabled={!value.areaType}
      >
        <option value="">All local body types</option>
        {availableLocalBodyTypes.map((type) => (
          <option key={type} value={type}>{LOCAL_BODY_TYPE_LABELS[type]}</option>
        ))}
      </select>
      <select
        className={SELECT_CLASS}
        value={value.city}
        onChange={(e) => onChange({ ...value, city: e.target.value })}
        disabled={!value.district || !value.areaType || !value.localBodyType}
      >
        <option value="">All local bodies</option>
        {cities.map((item) => (
          <option key={item.unique_id} value={item.unique_id}>{item.name}</option>
        ))}
      </select>
    </div>
  );
}
