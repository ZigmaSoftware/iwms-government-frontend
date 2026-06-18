import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { SelectOption } from "@/types";

import { wasteTypeApi, districtApi, cityApi, panchayatApi, zoneApi, wardApi, collectionPointApi, binApi } from "@/helpers/admin";

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { BinRecord, CityOption, CollectionPointOption, LocationOption, WardOption } from "./types";

const { encMasters, encBins } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encBins);

const BIN_FIELDS: Record<string, string[]> = {
  district_id: ["district_id", "district"],
  city_id: ["city_id", "city"],
  panchayat_id: ["panchayat_id", "panchayat"],
  zone_id: ["zone_id", "zone"],
  ward_id: ["ward_id", "ward"],
  collection_point_id: ["collection_point_id", "collection_point"],
  bin_capacity: ["bin_capacity", "capacity_liters"],
  bin_type: ["bin_type"],
  wastetype_id: ["wastetype_id", "waste_type_id", "waste_type"],
  bin_name: ["bin_name", "name"],
  bin_image: ["bin_image"],
  bin_qr: ["bin_qr", "qr_code"],
  is_active: ["is_active"],
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    );
  }

  if (value && typeof value === "object") {
    const maybeResults = (value as { results?: unknown }).results;
    if (Array.isArray(maybeResults)) {
      return maybeResults.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item)
      );
    }
  }

  return [];
};

const toStringOrEmpty = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const toNumberOrEmpty = (value: unknown): number | "" => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};

const normalizeIdValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toStringOrEmpty(record.unique_id ?? record.id ?? record.value ?? record.pk ?? "");
  }

  const str = String(value).trim();
  if (!str) return "";

  const inParentheses = str.match(/\(([A-Za-z0-9_-]+)\)\s*$/);
  if (inParentheses?.[1]) return inParentheses[1];
  return str;
};

export default function BinForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("assets", "bins", BIN_FIELDS);
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    loggedInCompanyUniqueId,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({ isEdit, initialCompanyId: routeState?.companyUniqueId, initialProjectId: routeState?.projectId });

  const extractErr = useCallback((e: unknown): string => {
    const error = e as {
      response?: { data?: unknown };
      message?: unknown;
    };
    const data = error.response?.data;
    if (data) {
      if (typeof data === "string") return data;
      if (typeof data === "object") {
        return Object.entries(data)
          .map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
            return `${key}: ${String(value)}`;
          })
          .join("\n");
      }
      return String(data);
    }
    if (typeof error.message === "string") return error.message;
    return t("common.unexpected_error");
  }, [t]);

  const [binName, setBinName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [wardId, setWardId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [collectionPointId, setCollectionPointId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [binCapacity, setBinCapacity] = useState<number | "">("");
  const [binType, setBinType] = useState("medium");
  const [binImage, setBinImage] = useState("default.png");
  const [isActive, setIsActive] = useState(true);

  const [zones, setZones] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [wardRecords, setWardRecords] = useState<WardOption[]>([]);
  const [panchayats, setPanchayats] = useState<LocationOption[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<CollectionPointOption[]>([]);
  const [wasteTypes, setWasteTypes] = useState<SelectOption[]>([]);
  // Pending IDs — set when the record loads, flushed once the option list is ready.
  // This ensures Radix Select re-renders with a valid matching option (panchayat pattern).
  const [pendingDistrictId, setPendingDistrictId] = useState("");
  const [pendingCityId, setPendingCityId] = useState("");
  const [pendingZoneId, setPendingZoneId] = useState("");
  const [pendingCollectionPointId, setPendingCollectionPointId] = useState("");
  const [pendingWard, setPendingWard] = useState("");
  const [pendingPanchayat, setPendingPanchayat] = useState("");
  const [pendingWasteType, setPendingWasteType] = useState("");
  const [pendingProjectCandidates, setPendingProjectCandidates] = useState<{
    projectUniqueId: string; projectId: string; projectName: string;
  } | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPanchayatSelected = Boolean(panchayatId);
  const isZoneSelected = Boolean(zoneId);
  const isWardSelected = Boolean(wardId);

  const resetLocationFields = useCallback(() => {
    setDistrictId("");
    setCityId("");
    setPanchayatId("");
    setZoneId("");
    setWardId("");
    setCollectionPointId("");
  }, []);

  /* ==========================================================
      LOAD WASTE TYPES (direct API call, kept as-is)
  ========================================================== */
  useEffect(() => {
    setLookupsLoading(true);

    Promise.all([wasteTypeApi.readAll()])
      .then(([wasteTypeRes]) => {
        const wasteTypeOptions = toRecordList(wasteTypeRes)
          .filter((w) => w.is_active !== false)
          .map((w) => ({
            value: normalizeIdValue(w.unique_id ?? w.waste_type_id ?? w.wastetype_id ?? w.id),
            label: String(
              w.waste_type_name ?? w.wastetype_name ?? w.property_name ?? w.name ?? w.unique_id ?? ""
            ),
          }))
          .filter((w) => w.value && w.label);
        setWasteTypes(wasteTypeOptions);
      })
      .catch((err) => {
        Swal.fire(t("common.error"), extractErr(err), "error");
        setWasteTypes([]);
      })
      .finally(() => setLookupsLoading(false));
  }, [extractErr, t]);

  /* ==========================================================
      LOAD TENANT-FILTERED DROPDOWNS (districts, cities, panchayats, zones, wards)
  ========================================================== */
  useEffect(() => {
    if (!companyUniqueId || !projectId) return;
    let cancelled = false;
    const params = { company_id: companyUniqueId, project_id: projectId };
    Promise.all([
      districtApi.readAll({ params }),
      cityApi.readAll({ params }),
      panchayatApi.readAll({ params }),
      zoneApi.readAll({ params }),
      wardApi.readAll({ params }),
    ])
      .then(([distData, cityData, panData, zoneData, wardData]) => {
        if (cancelled) return;

        setDistricts(
          toRecordList(distData)
            .filter((d) => d.is_active !== false)
            .map((d) => ({
              value: normalizeIdValue(d.unique_id),
              label: String(d.name ?? d.unique_id ?? ""),
            }))
            .filter((d) => d.value && d.label)
        );

        setCities(
          toRecordList(cityData)
            .filter((c) => c.is_active !== false)
            .map((c) => ({
              value: normalizeIdValue(c.unique_id),
              label: String(c.name ?? c.unique_id ?? ""),
              districtId: normalizeIdValue(c.district_id ?? c.district),
            }))
            .filter((c) => c.value && c.label)
        );

        setPanchayats(
          toRecordList(panData)
            .filter((p) => p.is_active !== false)
            .map((p) => ({
              value: normalizeIdValue(p.unique_id),
              label: String(p.panchayat_name ?? p.name ?? p.unique_id ?? ""),
              districtId: normalizeIdValue(p.district_id ?? p.district),
              cityId: normalizeIdValue(p.city_id ?? p.city),
            }))
            .filter((p) => p.value && p.label)
        );

        setZones(
          toRecordList(zoneData)
            .filter((z) => z.is_active !== false)
            .map((z) => ({
              value: normalizeIdValue(z.unique_id),
              label: String(z.zone_name ?? z.name ?? z.unique_id ?? ""),
              districtId: normalizeIdValue(z.district_id),
              cityId: normalizeIdValue(z.city_id),
            }))
            .filter((z) => z.value && z.label)
        );

        setWardRecords(
          toRecordList(wardData)
            .filter((w) => w.is_active !== false)
            .map((w) => ({
              value: normalizeIdValue(w.unique_id),
              label: String(w.ward_name ?? w.name ?? w.unique_id ?? ""),
              districtId: normalizeIdValue(w.district_id ?? w.district),
              cityId: normalizeIdValue(w.city_id ?? w.city),
              panchayatId: normalizeIdValue(w.panchayat_id ?? w.panchayat),
              zoneId: normalizeIdValue(w.zone_id ?? w.zone),
            }))
            .filter((w) => w.value && w.label)
        );
      })
      .catch((err) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ==========================================================
      LOAD COLLECTION POINTS (re-fetches when ward/panchayat changes)
  ========================================================== */
  useEffect(() => {
    if (!companyUniqueId || !projectId || (!wardId && !panchayatId)) return;
    let cancelled = false;
    const params: Record<string, string> = { company_id: companyUniqueId, project_id: projectId };
    if (districtId) params.district = districtId;
    if (cityId) params.city = cityId;
    if (zoneId) params.zone = zoneId;
    if (wardId) params.ward = wardId;
    if (panchayatId) params.panchayat = panchayatId;
    collectionPointApi.readAll({ params })
      .then((res: unknown) => {
        if (cancelled) return;
        setCollectionPoints(
          toRecordList(res)
            .filter((cp) => cp.is_active !== false)
            .map((cp) => ({
              value: normalizeIdValue(cp.unique_id),
              label: String(cp.cp_name ?? cp.collection_point_name ?? cp.unique_id ?? ""),
              districtId: normalizeIdValue(cp.district_id),
              cityId: normalizeIdValue(cp.city_id),
              panchayatId: normalizeIdValue(cp.panchayat_id),
              wardId: normalizeIdValue(cp.ward_id),
            }))
            .filter((cp) => cp.value && cp.label)
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId, wardId, panchayatId, districtId, cityId, zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ==========================================================
      LOAD BIN DATA (edit mode)
  ========================================================== */
  useEffect(() => {
    if (!id || !isEdit) return;
    let cancelled = false;
    binApi.read(id)
      .then((data: unknown) => {
        if (cancelled) return;
        const record = data as BinRecord;
        setBinName(toStringOrEmpty(record.bin_name));
        setBinType(toStringOrEmpty(record.bin_type) || "medium");
        setBinCapacity(toNumberOrEmpty(record.bin_capacity ?? record.capacity_liters));
        setBinImage(toStringOrEmpty(record.bin_image) || "default.png");
        setIsActive(Boolean(record.is_active));
        applyCompanyProjectFromRecord(record);
        setPendingProjectCandidates({
          projectUniqueId: toStringOrEmpty((record as any).project_unique_id ?? (record as any).project?.unique_id ?? ""),
          projectId: toStringOrEmpty((record as any).project_id ?? ""),
          projectName: toStringOrEmpty((record as any).project_name ?? ""),
        });

        // Set all cascade IDs via pending so Radix Select re-renders once options load
        const districtCandidate = normalizeIdValue(record.district_id ?? record.district);
        if (districtCandidate) { setDistrictId(districtCandidate); setPendingDistrictId(districtCandidate); }

        const cityCandidate = normalizeIdValue(record.city_id ?? record.city);
        if (cityCandidate) { setCityId(cityCandidate); setPendingCityId(cityCandidate); }

        const zoneCandidate = normalizeIdValue(record.zone_id ?? record.zone);
        if (zoneCandidate) { setZoneId(zoneCandidate); setPendingZoneId(zoneCandidate); }

        const cpCandidate = normalizeIdValue(record.collection_point_id ?? record.collection_point);
        if (cpCandidate) { setCollectionPointId(cpCandidate); setPendingCollectionPointId(cpCandidate); }

        const panchayatCandidate = normalizeIdValue(record.panchayat_id ?? record.panchayat);
        const wardCandidate = normalizeIdValue(record.ward_id ?? record.ward);

        if (wardCandidate) {
          setPendingWard(wardCandidate);
          setPendingPanchayat("");
        } else if (panchayatCandidate) {
          setPendingPanchayat(panchayatCandidate);
          setPendingWard("");
        }

        const wasteTypeCandidate = normalizeIdValue(
          record.wastetype_id ?? record.waste_type_id ?? record.waste_type
        );
        if (wasteTypeCandidate) setPendingWasteType(wasteTypeCandidate);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush district once the districts list is loaded
  useEffect(() => {
    if (!pendingDistrictId || districts.length === 0) return;
    if (districts.some((d) => d.value === pendingDistrictId)) {
      setDistrictId(pendingDistrictId);
      setPendingDistrictId("");
    }
  }, [pendingDistrictId, districts]);

  // Flush city once the cities list is loaded (city must match the district filter)
  useEffect(() => {
    if (!pendingCityId || cities.length === 0) return;
    if (cities.some((c) => c.value === pendingCityId)) {
      setCityId(pendingCityId);
      setPendingCityId("");
    }
  }, [pendingCityId, cities]);

  // Flush zone once the zones list is loaded
  useEffect(() => {
    if (!pendingZoneId || zones.length === 0) return;
    if (zones.some((z) => z.value === pendingZoneId)) {
      setZoneId(pendingZoneId);
      setPendingZoneId("");
    }
  }, [pendingZoneId, zones]);

  // Flush collection point once the collection points list is loaded
  useEffect(() => {
    if (!pendingCollectionPointId || collectionPoints.length === 0) return;
    if (collectionPoints.some((cp) => cp.value === pendingCollectionPointId)) {
      setCollectionPointId(pendingCollectionPointId);
      setPendingCollectionPointId("");
    }
  }, [pendingCollectionPointId, collectionPoints]);

  useEffect(() => {
    if (!pendingWard || wardRecords.length === 0) return;
    if (!wardRecords.some((w) => w.value === pendingWard)) {
      setWardRecords((prev) => [...prev, { value: pendingWard, label: pendingWard, districtId: "", cityId: "", panchayatId: "", zoneId: "" }]);
    }
    setWardId(pendingWard);
    setPendingWard("");
  }, [pendingWard, wardRecords]);

  useEffect(() => {
    if (!pendingPanchayat || panchayats.length === 0) return;
    if (!panchayats.some((p) => p.value === pendingPanchayat)) {
      setPanchayats((prev) => [...prev, { value: pendingPanchayat, label: pendingPanchayat, districtId: "", cityId: "" }]);
    }
    setPanchayatId(pendingPanchayat);
    setPendingPanchayat("");
  }, [pendingPanchayat, panchayats]);

  useEffect(() => {
    if (!pendingWasteType || wasteTypes.length === 0) return;
    if (!wasteTypes.some((w) => w.value === pendingWasteType)) {
      setWasteTypes((prev) => [...prev, { value: pendingWasteType, label: pendingWasteType }]);
    }
    setWasteTypeId(pendingWasteType);
    setPendingWasteType("");
  }, [pendingWasteType, wasteTypes]);

  /* ── re-apply project after hook loads project list ── */
  useEffect(() => {
    if (!pendingProjectCandidates || projects.length === 0) return;
    const { projectUniqueId, projectId: rawId, projectName } = pendingProjectCandidates;
    let match = projects.find((p) => projectUniqueId && p.value === projectUniqueId);
    if (!match) match = projects.find((p) => rawId && p.value === rawId);
    if (!match && projectName)
      match = projects.find((p) => p.label.toLowerCase() === projectName.toLowerCase());
    if (match) setProjectId(match.value);
    setPendingProjectCandidates(null);
  }, [projects, pendingProjectCandidates, setProjectId]);

  const wardOptions = useMemo(() => {
    const filtered = wardRecords
      .filter((w) => {
        if (zoneId) return w.zoneId === zoneId;
        if (panchayatId) return w.panchayatId === panchayatId;
        if (cityId) return w.cityId === cityId;
        if (districtId) return w.districtId === districtId;
        return true;
      })
      .map((w) => ({ value: w.value, label: w.label }));

    if (!wardId) return filtered;
    if (filtered.some((w) => w.value === wardId)) return filtered;

    const current = wardRecords.find((w) => w.value === wardId);
    return [...filtered, { value: wardId, label: current?.label || wardId }];
  }, [cityId, districtId, panchayatId, wardId, wardRecords, zoneId]);

  const panchayatOptions = useMemo(() => {
    const filtered = panchayats
      .filter((p) => {
        if (cityId) return p.cityId === cityId;
        if (districtId) return p.districtId === districtId;
        return true;
      })
      .map((p) => ({ value: p.value, label: p.label }));

    if (!panchayatId) return filtered;
    if (filtered.some((p) => p.value === panchayatId)) return filtered;
    const current = panchayats.find((p) => p.value === panchayatId);
    return [...filtered, { value: panchayatId, label: current?.label || panchayatId }];
  }, [cityId, districtId, panchayatId, panchayats]);

  const zoneOptions = useMemo(() => {
    const filtered = zones
      .filter((z) => {
        if (cityId) return z.cityId === cityId;
        if (districtId) return z.districtId === districtId;
        return true;
      })
      .map((z) => ({ value: z.value, label: z.label }));

    if (!zoneId) return filtered;
    if (filtered.some((z) => z.value === zoneId)) return filtered;
    const current = zones.find((z) => z.value === zoneId);
    return [...filtered, { value: zoneId, label: current?.label || zoneId }];
  }, [cityId, districtId, zoneId, zones]);

  const collectionPointOptions = useMemo(() => {
    const filtered = collectionPoints
      .filter((cp) => {
        if (wardId) return cp.wardId === wardId;
        if (panchayatId) return cp.panchayatId === panchayatId;
        if (cityId) return cp.cityId === cityId;
        if (districtId) return cp.districtId === districtId;
        return true;
      })
      .map((cp) => ({ value: cp.value, label: cp.label }));

    if (!collectionPointId) return filtered;
    if (filtered.some((cp) => cp.value === collectionPointId)) return filtered;

    const current = collectionPoints.find((cp) => cp.value === collectionPointId);
    return [...filtered, { value: collectionPointId, label: current?.label || collectionPointId }];
  }, [cityId, collectionPointId, collectionPoints, districtId, panchayatId, wardId]);

  useEffect(() => {
    if (!collectionPointId) return;

    const selectedCp = collectionPoints.find((cp) => cp.value === collectionPointId);
    if (!selectedCp) return;

    if (districtId && selectedCp.districtId && selectedCp.districtId !== districtId) {
      setCollectionPointId("");
      return;
    }

    if (cityId && selectedCp.cityId && selectedCp.cityId !== cityId) {
      setCollectionPointId("");
      return;
    }

    if (!districtId && selectedCp.districtId) setDistrictId(selectedCp.districtId);
    if (!cityId && selectedCp.cityId) setCityId(selectedCp.cityId);

    if (wardId && selectedCp.wardId !== wardId) {
      setCollectionPointId("");
      return;
    }

    if (panchayatId && selectedCp.panchayatId && selectedCp.panchayatId !== panchayatId) {
      setCollectionPointId("");
    }
  }, [cityId, collectionPointId, collectionPoints, districtId, panchayatId, wardId]);

  const cityOptions = useMemo(() => {
    const filtered = cities
      .filter((city) => {
        if (districtId) return city.districtId === districtId;
        return true;
      })
      .map((city) => ({ value: city.value, label: city.label }));

    if (!cityId) return filtered;
    if (filtered.some((city) => city.value === cityId)) return filtered;
    return [...filtered, { value: cityId, label: cityId }];
  }, [cities, cityId, districtId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const missingFields: string[] = [];
    const fieldValues: Record<string, unknown> = {
      bin_name: binName.trim(),
      district_id: districtId,
      city_id: cityId,
      panchayat_id: panchayatId,
      ward_id: wardId,
      collection_point_id: collectionPointId,
      wastetype_id: wasteTypeId,
      bin_capacity: typeof binCapacity === "number" && binCapacity > 0 ? binCapacity : "",
    };
    if (getMissingRequiredFields(["bin_name"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      missingFields.push("Bin name");
    }
    if (!companyUniqueId) missingFields.push(t("admin.nav.company"));
    if (!projectId) missingFields.push(t("admin.nav.project"));
    if (getMissingRequiredFields(["district_id"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      missingFields.push(t("common.district"));
    }
    if (getMissingRequiredFields(["city_id"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      missingFields.push(t("common.city"));
    }
    if (!panchayatId && !wardId) {
      missingFields.push(`${t("admin.nav.panchayat")} / ${t("common.ward")}`);
    }
    if (
      getMissingRequiredFields(["collection_point_id"], (fieldKey) => fieldValues[fieldKey])
        .length > 0
    ) {
      missingFields.push(t("admin.nav.collection_point"));
    }
    if (getMissingRequiredFields(["wastetype_id"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      missingFields.push(t("common.waste_type"));
    }
    if (getMissingRequiredFields(["bin_capacity"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      missingFields.push(t("common.bin_capacity"));
    }

    if (missingFields.length > 0) {
      Swal.fire(
        t("common.warning"),
        t("admin.bin.missing_fields", { fields: missingFields.join(", ") }),
        "warning"
      );
      return;
    }

    const rawPayload = {
      company_id: companyUniqueId,
      project_id: projectId,
      district_id: districtId,
      city_id: cityId,
      panchayat_id: panchayatId || null,
      zone_id: zoneId || null,
      ward_id: wardId || null,
      collection_point_id: collectionPointId,
      bin_capacity: Number(binCapacity),
      bin_name: binName.trim(),
      bin_type: binType,
      bin_image: binImage.trim() || "default.png",
      wastetype_id: wasteTypeId,
      is_active: isActive,
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

    try {
      setIsSubmitting(true);
      if (isEdit && id) {
        await binApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await binApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (err: unknown) {
      Swal.fire(t("common.save_failed"), extractErr(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.bin_master") })
          : t("common.add_item", { item: t("admin.nav.bin_creation") })
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" noValidate>
        {showField("district_id") && (
          <div>
            <Label>{t("common.district")} *</Label>
            <Select
              value={districtId}
              onValueChange={(value) => {
                setDistrictId(value);
                setCityId("");
                setPanchayatId("");
                setZoneId("");
                setWardId("");
                setCollectionPointId("");
              }}
            >
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("common.district") })} />
              </SelectTrigger>
              <SelectContent>
                {districts.map((district) => (
                  <SelectItem key={district.value} value={district.value}>
                    {district.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("city_id") && (
          <div>
            <Label>{t("common.city")} *</Label>
            <Select
              value={cityId}
              onValueChange={(value) => {
                setCityId(value);
                setPanchayatId("");
                setZoneId("");
                setWardId("");
                setCollectionPointId("");
              }}
              disabled={!districtId}
            >
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("common.city") })} />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((city) => (
                  <SelectItem key={city.value} value={city.value}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>{t("admin.nav.panchayat")}</Label>
          <Select
            value={panchayatId || "__none__"}
            onValueChange={(value) => {
              const next = value === "__none__" ? "" : value;
              setPanchayatId(next);
              setZoneId("");
              setWardId("");
              setCollectionPointId("");
            }}
            disabled={!cityId || isZoneSelected || isWardSelected}
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue
                placeholder={t("common.select_item_placeholder", { item: t("admin.nav.panchayat") })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("common.not_available")}</SelectItem>
              {panchayatOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("admin.nav.zone")}</Label>
          <Select
            value={zoneId || "__none__"}
            onValueChange={(value) => {
              const next = value === "__none__" ? "" : value;
              setZoneId(next);
              setPanchayatId("");
              setWardId("");
              setCollectionPointId("");
            }}
            disabled={!cityId || isPanchayatSelected}
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.zone") })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("common.not_available")}</SelectItem>
              {zoneOptions.map((z) => (
                <SelectItem key={z.value} value={z.value}>
                  {z.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("common.ward")}</Label>
          <Select
            value={wardId || "__none__"}
            onValueChange={(value) => {
              const next = value === "__none__" ? "" : value;
              setWardId(next);
              if (next) {
                setPanchayatId("");
                setCollectionPointId("");
              }
            }}
            disabled={!cityId || isPanchayatSelected || (!zoneId && !panchayatId)}
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue placeholder={t("common.select_item_placeholder", { item: t("common.ward") })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("common.not_available")}</SelectItem>
              {wardOptions.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showField("collection_point_id") && (
          <div>
            <Label>{t("admin.nav.collection_point")} *</Label>
            <Select value={collectionPointId} onValueChange={setCollectionPointId} disabled={collectionPointOptions.length === 0}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.collection_point") })} />
              </SelectTrigger>
              <SelectContent>
                {collectionPointOptions.map((cp) => (
                  <SelectItem key={cp.value} value={cp.value}>
                    {cp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("bin_capacity") && (
          <div>
            <Label>{t("common.bin_capacity")} *</Label>
            <Input
              type="number"
              value={binCapacity}
              onChange={(e) => setBinCapacity(e.target.value ? Number(e.target.value) : "")}
              min={1}
              required
            />
          </div>
        )}

        {showField("bin_type") && (
          <div>
            <Label>{t("common.bin_type")}</Label>
            <Select value={binType} onValueChange={setBinType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("wastetype_id") && (
          <div>
            <Label>{t("common.waste_type")} *</Label>
            <Select value={wasteTypeId} onValueChange={setWasteTypeId}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("common.waste_type") })} />
              </SelectTrigger>
              <SelectContent>
                {wasteTypes.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("bin_name") && (
          <div>
            <Label>{t("common.item_name", { item: t("admin.nav.bin_master") })} *</Label>
            <Input value={binName} onChange={(e) => setBinName(e.target.value)} required />
          </div>
        )}

        {showField("bin_image") && (
          <div>
            <Label>Bin Image</Label>
            <Input value={binImage} onChange={(e) => setBinImage(e.target.value)} placeholder="default.png" />
          </div>
        )}

{showField("is_active") && (
          <div>
            <Label>{t("common.status")}</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting || lookupsLoading}>
            {isSubmitting || lookupsLoading
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
