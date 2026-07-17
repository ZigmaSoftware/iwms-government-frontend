import { useEffect, useMemo, useState } from "react";

import Label from "@/components/form/Label";
import Select, { type SelectOption } from "@/components/form/Select";
import { adminApi } from "@/helpers/admin/registry";

import type { LocalBodyType } from "./types";

type ApiOptionRecord = {
  unique_id?: string;
  id?: string;
  name?: string;
  state_id?: string | { unique_id?: string };
  district_id?: string | { unique_id?: string };
  corporation_name?: string;
  municipality_name?: string;
  town_panchayat_name?: string;
  panchayat_union_name?: string;
  panchayat_name?: string;
};

export const LOCAL_BODY_TYPES: Array<{ value: LocalBodyType; label: string; entity: keyof typeof adminApi }> = [
  { value: "corporation", label: "Corporation", entity: "corporations" },
  { value: "municipality", label: "Municipality", entity: "municipalities" },
  { value: "town_panchayat", label: "Town Panchayat", entity: "townPanchayats" },
  { value: "panchayat_union", label: "Panchayat Union", entity: "panchayatUnions" },
  { value: "panchayat", label: "Panchayat", entity: "panchayats" },
];

const AREA_TYPE_LOCAL_BODY_TYPES: Record<"urban" | "rural", LocalBodyType[]> = {
  urban: ["corporation", "municipality", "town_panchayat"],
  rural: ["panchayat_union", "panchayat"],
};

const areaTypeCategoryFromName = (name: string): "urban" | "rural" | null => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return null;
};

const normalizeEntityId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "unique_id" in (value as Record<string, unknown>)) {
    return String((value as { unique_id?: string }).unique_id ?? "");
  }
  return String(value);
};

const optionLabel = (record: ApiOptionRecord) =>
  record.corporation_name ??
  record.municipality_name ??
  record.town_panchayat_name ??
  record.panchayat_union_name ??
  record.panchayat_name ??
  record.name ??
  record.unique_id ??
  record.id ??
  "";

const toOptions = (records: ApiOptionRecord[]): SelectOption[] =>
  records
    .map((record) => ({ value: String(record.unique_id ?? record.id ?? ""), label: optionLabel(record) }))
    .filter((option) => option.value);

export type LocalBodyValue = {
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyType: LocalBodyType | "";
  localBodyId: string;
};

type Props = {
  value: LocalBodyValue;
  onChange: (value: LocalBodyValue) => void;
  disabled?: boolean;
};

export default function LocalBodySelector({ value, onChange, disabled }: Props) {
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);
  const [districtRecords, setDistrictRecords] = useState<ApiOptionRecord[]>([]);
  const [areaTypeRecords, setAreaTypeRecords] = useState<ApiOptionRecord[]>([]);
  const [localBodyRecords, setLocalBodyRecords] = useState<Record<LocalBodyType, ApiOptionRecord[]>>({
    corporation: [],
    municipality: [],
    town_panchayat: [],
    panchayat_union: [],
    panchayat: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [stateRes, districtRes, areaTypeRes, corpRes, muniRes, townRes, unionRes, panchayatRes] =
          await Promise.allSettled([
            adminApi.states.readAll(),
            adminApi.districts.readAll(),
            adminApi.areatypes.readAll(),
            adminApi.corporations.readAll(),
            adminApi.municipalities.readAll(),
            adminApi.townPanchayats.readAll(),
            adminApi.panchayatUnions.readAll(),
            adminApi.panchayats.readAll(),
          ]);
        if (!mounted) return;
        const valueOrEmpty = (result: PromiseSettledResult<unknown>) =>
          result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];

        setStateOptions(toOptions(valueOrEmpty(stateRes) as ApiOptionRecord[]));
        setDistrictRecords(valueOrEmpty(districtRes) as ApiOptionRecord[]);
        setAreaTypeRecords(valueOrEmpty(areaTypeRes) as ApiOptionRecord[]);
        setLocalBodyRecords({
          corporation: valueOrEmpty(corpRes) as ApiOptionRecord[],
          municipality: valueOrEmpty(muniRes) as ApiOptionRecord[],
          town_panchayat: valueOrEmpty(townRes) as ApiOptionRecord[],
          panchayat_union: valueOrEmpty(unionRes) as ApiOptionRecord[],
          panchayat: valueOrEmpty(panchayatRes) as ApiOptionRecord[],
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const districtOptions = useMemo(() => {
    if (!value.stateId) return [];
    return toOptions(districtRecords.filter((d) => normalizeEntityId(d.state_id) === value.stateId));
  }, [districtRecords, value.stateId]);

  const areaTypeOptions = useMemo(() => {
    if (!value.districtId) return [];
    return toOptions(areaTypeRecords.filter((a) => normalizeEntityId(a.district_id) === value.districtId));
  }, [areaTypeRecords, value.districtId]);

  const selectedAreaTypeCategory = useMemo(() => {
    const record = areaTypeRecords.find((a) => a.unique_id === value.areaTypeId);
    return record ? areaTypeCategoryFromName(String(record.name ?? "")) : null;
  }, [areaTypeRecords, value.areaTypeId]);

  const availableLocalBodyTypes = useMemo(() => {
    if (!selectedAreaTypeCategory) return [];
    const types = AREA_TYPE_LOCAL_BODY_TYPES[selectedAreaTypeCategory];
    return LOCAL_BODY_TYPES.filter((t) => types.includes(t.value));
  }, [selectedAreaTypeCategory]);

  const localBodyOptions = useMemo(() => {
    if (!value.localBodyType || !value.districtId) return [];
    const records = localBodyRecords[value.localBodyType as LocalBodyType] ?? [];
    return toOptions(records.filter((r) => normalizeEntityId(r.district_id) === value.districtId));
  }, [localBodyRecords, value.districtId, value.localBodyType]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="stateId">State</Label>
        <Select
          id="stateId"
          value={value.stateId}
          onChange={(next) =>
            onChange({ stateId: next, districtId: "", areaTypeId: "", localBodyType: "", localBodyId: "" })
          }
          options={stateOptions}
          placeholder={loading ? "Loading..." : "Select state"}
          disabled={disabled || loading}
        />
      </div>
      <div>
        <Label htmlFor="districtId">District</Label>
        <Select
          id="districtId"
          value={value.districtId}
          onChange={(next) =>
            onChange({ ...value, districtId: next, areaTypeId: "", localBodyType: "", localBodyId: "" })
          }
          options={districtOptions}
          placeholder={value.stateId ? "Select district" : "Select a state first"}
          disabled={disabled || !value.stateId}
        />
      </div>
      <div>
        <Label htmlFor="areaTypeId">Area Type</Label>
        <Select
          id="areaTypeId"
          value={value.areaTypeId}
          onChange={(next) => onChange({ ...value, areaTypeId: next, localBodyType: "", localBodyId: "" })}
          options={areaTypeOptions}
          placeholder={value.districtId ? "Select area type" : "Select a district first"}
          disabled={disabled || !value.districtId}
        />
      </div>
      <div>
        <Label htmlFor="localBodyType">Local Body Type</Label>
        <Select
          id="localBodyType"
          value={value.localBodyType}
          onChange={(next) => onChange({ ...value, localBodyType: next as LocalBodyType, localBodyId: "" })}
          options={availableLocalBodyTypes.map((t) => ({ value: t.value, label: t.label }))}
          placeholder={value.areaTypeId ? "Select local body type" : "Select an area type first"}
          disabled={disabled || !value.areaTypeId}
        />
      </div>
      {value.localBodyType && (
        <div className="md:col-span-2">
          <Label htmlFor="localBodyId">
            {LOCAL_BODY_TYPES.find((t) => t.value === value.localBodyType)?.label}
          </Label>
          <Select
            id="localBodyId"
            value={value.localBodyId}
            onChange={(next) => onChange({ ...value, localBodyId: next })}
            options={localBodyOptions}
            placeholder="Select"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
