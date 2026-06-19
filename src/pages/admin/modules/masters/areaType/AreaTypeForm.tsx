import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { areaTypeApi, corporationApi, districtApi, municipalityApi, panchayatApi, panchayatUnionApi, stateApi, townPanchayatApi } from "@/helpers/admin";

type Option = { value: string; label: string; stateId?: string; districtId?: string; areaTypeName?: string };
type RecordRow = Record<string, any>;

const normalizeNullable = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return normalizeNullable(value.unique_id ?? value.id ?? value.value);
  return String(value).trim();
};

const toRecordList = (value: unknown): RecordRow[] => {
  if (Array.isArray(value)) return value as RecordRow[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: RecordRow[] }).results;
  }
  return [];
};

const textOf = (row: RecordRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "";
};

const toOption = (row: RecordRow, labelKey: string): Option => ({
  value: normalizeNullable(row.unique_id ?? row.id),
  label: textOf(row, labelKey, "name", "state_name", "district_name", "area_type_name", "union_name"),
  stateId: normalizeNullable(row.state_id ?? row.state),
  districtId: normalizeNullable(row.district_id ?? row.district),
  areaTypeName: textOf(row, "area_type_name", "name"),
});

const AREA_TYPE_FILTER = null;

export default function AreaTypeForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encAreaTypes } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encAreaTypes);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [panchayatUnionId, setPanchayatUnionId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);
  const [panchayatUnions, setPanchayatUnions] = useState<Option[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      panchayatUnionApi.readAll(),
    ])
      .then(([stateRes, districtRes, areaTypeRes, unionRes]) => {
        if (cancelled) return;
        setStates(toRecordList(stateRes).map((row) => toOption(row, "state_name")).filter((item) => item.value && item.label));
        setDistricts(toRecordList(districtRes).map((row) => toOption(row, "district_name")).filter((item) => item.value && item.label));
        setAreaTypes(toRecordList(areaTypeRes).map((row) => toOption(row, "area_type_name")).filter((item) => item.value && item.label));
        setPanchayatUnions(toRecordList(unionRes).map((row) => toOption(row, "union_name")).filter((item) => item.value && item.label));
      })
      .catch(() => Swal.fire("Error", "Failed to load dropdown data", "error"));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    areaTypeApi.read(id)
      .then((record: RecordRow) => {
        if (cancelled) return;
        setName(textOf(record, "name", "name", "state_name", "district_name", "area_type_name"));
        setCode(textOf(record, ""));
        setStateId(normalizeNullable(record.state_id ?? record.state));
        setDistrictId(normalizeNullable(record.district_id ?? record.district));
        setAreaTypeId(normalizeNullable(record.area_type_id ?? record.area_type));
        setPanchayatUnionId(normalizeNullable(record.panchayat_union_id ?? record.panchayat_union));
        setIsActive(record.is_active !== false);
      })
      .catch(() => Swal.fire("Error", "Failed to load Area Type", "error"));
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const filteredDistricts = useMemo(
    () => districts.filter((item) => !stateId || !item.stateId || item.stateId === stateId),
    [districts, stateId],
  );

  const filteredAreaTypes = useMemo(
    () => areaTypes.filter((item) =>
      (!stateId || !item.stateId || item.stateId === stateId) &&
      (!districtId || !item.districtId || item.districtId === districtId) &&
      (!AREA_TYPE_FILTER || item.label === AREA_TYPE_FILTER)
    ),
    [areaTypes, districtId, stateId],
  );

  const filteredPanchayatUnions = useMemo(
    () => panchayatUnions.filter((item) => !districtId || !item.districtId || item.districtId === districtId),
    [districtId, panchayatUnions],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      Swal.fire("Missing details", "Area Type is required", "warning");
      return;
    }
    if (!stateId || !districtId) {
      Swal.fire("Missing details", "State, District required", "warning");
      return;
    }

    const payload: RecordRow = {
      name: name.trim(),
      is_active: isActive,
    };
    
    payload.state_id = stateId;
    payload.district_id = districtId;

    setSubmitting(true);
    try {
      if (isEdit && id) await areaTypeApi.update(id, payload);
      else await areaTypeApi.create(payload);
      Swal.fire("Success", "Area Type saved successfully", "success");
      navigate(LIST_PATH);
    } catch (error: any) {
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to save Area Type"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Area Type" : "Add Area Type"}>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>State *</Label>
          <Select value={stateId} onValueChange={(value) => { setStateId(value); setDistrictId(""); setAreaTypeId(""); setPanchayatUnionId(""); }}>
            <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
            <SelectContent>{states.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>District *</Label>
          <Select value={districtId} onValueChange={(value) => { setDistrictId(value); setAreaTypeId(""); setPanchayatUnionId(""); }} disabled={!stateId}>
            <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
            <SelectContent>{filteredDistricts.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        
        
        <div>
          <Label>Area Type *</Label>
          <Select value={name} onValueChange={setName}>
            <SelectTrigger><SelectValue placeholder="Select Area Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Urban Local Body">Urban Local Body</SelectItem>
              <SelectItem value="Rural Local Body">Rural Local Body</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3 md:col-span-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Active</Label>
        </div>
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
