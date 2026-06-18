import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { townPanchayatApi, stateApi, districtApi } from "@/helpers/admin";
import type { SelectOption } from "@/types";

const TOWN_PANCHAYAT_FIELDS: Record<string, string[]> = {
  state_id: ["state_id", "state"],
  district_id: ["district_id", "district"],
  town_panchayat_name: ["town_panchayat_name", "name"],
  description: ["description"],
  geofencing_type: ["geofencing_type"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  is_active: ["is_active"],
};

const normalizeNullable = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return normalizeNullable(v.unique_id ?? v.id ?? v.value);
  const raw = String(v).trim();
  if (!raw) return null;
  const inParentheses = raw.match(/\(([A-Za-z0-9_-]+)\)\s*$/);
  return inParentheses?.[1] ?? raw;
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> =>
    !!item && typeof item === "object" && !Array.isArray(item));
  if (value && typeof value === "object") {
    const maybeResults = (value as { results?: unknown }).results;
    if (Array.isArray(maybeResults)) return maybeResults.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)
    );
  }
  return [];
};

const normalizeLabel = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

const resolveId = (items: SelectOption[], id: string | null, name?: string | null): string | null => {
  if (id && items.some((x) => x.value === id)) return id;
  if (!name) return id;
  return items.find((x) => normalizeLabel(x.label) === normalizeLabel(name))?.value ?? id;
};

export default function TownPanchayatForm() {
  const { showField, filterPayload } = useFieldVisibility("masters", "town-panchayats", TOWN_PANCHAYAT_FIELDS);
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const {
    companyUniqueId, projectId, projects, companies, isSuperAdmin, loggedInCompanyUniqueId,
    setProjectId, onCompanyChange, applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const [townPanchayatName, setTownPanchayatName] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [description, setDescription] = useState("");
  const [geofencingType, setGeofencingType] = useState("square");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [pendingState, setPendingState] = useState("");
  const [pendingDistrict, setPendingDistrict] = useState("");

  const [allStates, setAllStates] = useState<SelectOption[]>([]);
  const [allDistricts, setAllDistricts] = useState<SelectOption[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<SelectOption[]>([]);

  const { encMasters, encTownPanchayats } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encTownPanchayats);

  useEffect(() => {
    let cancelled = false;
    stateApi.readAll().then((res: any) => {
      if (cancelled) return;
      setAllStates(toRecordList(res).map((x: any) => ({
        value: normalizeNullable(x.unique_id) ?? "",
        label: String(x.name ?? ""),
      })).filter((x) => x.value && x.label));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const config = companyUniqueId && projectId
      ? { params: { company_id: companyUniqueId, project_id: projectId } }
      : undefined;
    districtApi.readAll(config).then((res: any) => {
      if (cancelled) return;
      setAllDistricts(toRecordList(res).map((x: any) => ({
        value: normalizeNullable(x.unique_id) ?? "",
        label: String(x.name ?? ""),
        stateId: normalizeNullable(x.state_id ?? x.state),
      } as SelectOption & { stateId: string | null })).filter((x) => x.value && x.label));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId]);

  useEffect(() => {
    if (!stateId) { setFilteredDistricts([]); return; }
    const filt = (allDistricts as any[]).filter((d) => d.stateId === stateId)
      .map((d) => ({ value: d.value, label: d.label }));
    if (pendingDistrict && !filt.some((d) => d.value === pendingDistrict)) {
      const found = allDistricts.find((d) => d.value === pendingDistrict);
      if (found) filt.push(found);
    }
    setFilteredDistricts(filt);
  }, [stateId, allDistricts, pendingDistrict]);

  useEffect(() => {
    if (pendingState && allStates.length > 0 && allStates.some((s) => s.value === pendingState)) {
      setStateId(pendingState);
      setPendingState("");
    }
  }, [pendingState, allStates]);

  useEffect(() => {
    if (pendingDistrict && filteredDistricts.length > 0 && filteredDistricts.some((d) => d.value === pendingDistrict)) {
      setDistrictId(pendingDistrict);
      setPendingDistrict("");
    }
  }, [pendingDistrict, filteredDistricts]);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    townPanchayatApi.read(id).then((res: any) => {
      if (cancelled) return;
      setRecordData(res);
      setLoadingRecord(false);
    }).catch((err: any) => {
      if (cancelled) return;
      setLoadingRecord(false);
      Swal.fire({ icon: "error", title: "Error", text: String(err?.response?.data ?? err?.message ?? "Failed to load record") });
    });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit || !recordData) return;
    const data = recordData as any;
    setTownPanchayatName(data.town_panchayat_name ?? "");
    setDescription(data.description ?? "");
    setGeofencingType(data.geofencing_type ?? "square");
    setLatitude(data.latitude ?? "");
    setLongitude(data.longitude ?? "");
    setIsActive(Boolean(data.is_active));
    applyCompanyProjectFromRecord(data as unknown as Record<string, unknown>);

    const rawStateId = normalizeNullable(data.state_id ?? data.state);
    const resolvedState = resolveId(allStates, rawStateId, data.state_name ?? null);
    const rawDistrictId = normalizeNullable(data.district_id ?? data.district);
    const resolvedDistrict = resolveId(allDistricts, rawDistrictId, data.district_name ?? null);

    if (resolvedState) { setStateId(resolvedState); setPendingState(resolvedState); }
    if (resolvedDistrict) { setDistrictId(resolvedDistrict); setPendingDistrict(resolvedDistrict); }
  }, [isEdit, recordData, applyCompanyProjectFromRecord, allStates, allDistricts]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyUniqueId) { Swal.fire("Error", "Company is required", "error"); return; }
    if (!projectId) { Swal.fire("Error", "Project is required", "error"); return; }

    const rawPayload = {
      town_panchayat_name: townPanchayatName,
      company_id: companyUniqueId,
      project_id: projectId,
      state_id: stateId,
      district_id: districtId,
      description: description || null,
      geofencing_type: geofencingType,
      latitude: latitude || null,
      longitude: longitude || null,
      is_active: isActive,
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await townPanchayatApi.update(id, payload);
        Swal.fire("Success", "Updated successfully", "success");
      } else {
        await townPanchayatApi.create(payload);
        Swal.fire("Success", "Created successfully", "success");
      }
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch {
      Swal.fire("Error", "Something went wrong", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Town Panchayat" : "Add Town Panchayat"}>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">{showField("state_id") && (
          <div>
            <Label>State *</Label>
            <Select value={stateId} onValueChange={(value) => { setStateId(value); setDistrictId(""); setFilteredDistricts([]); setPendingDistrict(""); }}>
              <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
              <SelectContent>
                {allStates.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("district_id") && (
          <div>
            <Label>District *</Label>
            <Select value={districtId} onValueChange={setDistrictId} disabled={!stateId}>
              <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("town_panchayat_name") && (
          <div>
            <Label>Town Panchayat Name *</Label>
            <Input value={townPanchayatName} onChange={(e) => setTownPanchayatName(e.target.value)} required />
          </div>
        )}

        {showField("description") && (
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        )}

        {showField("geofencing_type") && (
          <div>
            <Label>GeoFencing Type</Label>
            <Select value={geofencingType} onValueChange={setGeofencingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("latitude") && (
          <div>
            <Label>Latitude</Label>
            <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </div>
        )}

        {showField("longitude") && (
          <div>
            <Label>Longitude</Label>
            <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label>Status</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting || loadingRecord}>{isEdit ? "Update" : "Save"}</Button>
          <Button type="button" variant="destructive" onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}>
            Cancel
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
