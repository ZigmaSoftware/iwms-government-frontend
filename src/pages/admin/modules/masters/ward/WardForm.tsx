import type { WardCityMeta, WardDistrictMeta, WardRouteState, WardStateMeta, WardWithRelations, WardZoneMeta } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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

import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { continentApi, countryApi, stateApi, districtApi, cityApi, zoneApi, wardApi } from "@/helpers/admin";

const WARD_FORM_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  country_id:   ["country_id"],
  state_id:     ["state_id"],
  district_id:  ["district_id"],
  city_id:      ["city_id"],
  zone_id:      ["zone_id"],
  ward_name:    ["ward_name"],
  is_active:    ["is_active"],
  description:  ["description"],
};
import type { SelectOption } from "@/types";
import type { CountryMeta } from "./types";


/* ------------------------------
    TYPES
------------------------------ */
/* ------------------------------
  UTILITIES
------------------------------ */
const normalizeNullable = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return normalizeNullable(v.unique_id ?? v.id ?? v.value);
  return String(v);
};

const normalizeLabel = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const resolveMetaId = <T extends { id: string; name: string }>(
  items: T[],
  id: string | null,
  name: string | null | undefined
) => {
  if (id && items.some((item) => item.id === id)) {
    return id;
  }

  const normalizedName = normalizeLabel(name);
  if (!normalizedName) {
    return id;
  }

  return (
    items.find((item) => normalizeLabel(item.name) === normalizedName)?.id ?? id
  );
};

const ensureSelectedOption = (
  options: SelectOption[],
  selectedId: string,
  selectedLabel?: string | null
) => {
  if (!selectedId || options.some((option) => option.value === selectedId)) {
    return options;
  }

  return [
    ...options,
    {
      value: selectedId,
      label: selectedLabel?.trim() || selectedId,
    },
  ];
};


/* ------------------------------
  ROUTES
------------------------------ */
const { encMasters, encWards } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encWards);

/* ==========================================================
      COMPONENT
========================================================== */
export default function WardForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } = useFieldVisibility(
    "masters",
    "wards",
    WARD_FORM_FIELDS,
  );
  /* FORM FIELDS */
  const [wardName, setWardName] = useState("");
  const [continentId, setContinentId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");

  /* PENDING CHAINS (Edit Support) */
  const [pendingContinent, setPendingContinent] = useState("");
  const [pendingCountry, setPendingCountry] = useState("");
  const [pendingState, setPendingState] = useState("");
  const [pendingDistrict, setPendingDistrict] = useState("");
  const [pendingCity, setPendingCity] = useState("");
  const [pendingZone, setPendingZone] = useState("");

  /* MASTER DATA */
  const [continents, setContinents] = useState<SelectOption[]>([]);
  const [allCountries, setAllCountries] = useState<CountryMeta[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<SelectOption[]>([]);

  const [allStates, setAllStates] = useState<WardStateMeta[]>([]);
  const [filteredStates, setFilteredStates] = useState<SelectOption[]>([]);

  const [allDistricts, setAllDistricts] = useState<WardDistrictMeta[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<SelectOption[]>([]);

  const [allCities, setAllCities] = useState<WardCityMeta[]>([]);
  const [filteredCities, setFilteredCities] = useState<SelectOption[]>([]);

  const [allZones, setAllZones] = useState<WardZoneMeta[]>([]);
  const [filteredZones, setFilteredZones] = useState<SelectOption[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const routeState = location.state as WardRouteState | null;
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
  } = useCompanyProjectSelection({ isEdit });

  const extractErr = (e: any): string => {
    if (e?.response?.data) return String(e.response.data);
    if (e?.message) return e.message;
    return t("common.unexpected_error");
  };

  /* ==========================================================
      SINGLE-RECORD FETCH (edit mode)
  ========================================================== */
  const [wardRecordData, setWardRecordData] = useState<WardWithRelations | null>(null);
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    wardApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setWardRecordData(res);
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire({ icon: "error", title: t("common.error"), text: String(err?.response?.data ?? err?.message ?? t("common.load_failed")) });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  /* ==========================================================
      LOAD MASTER DATA (all in one Promise.all to avoid race conditions)
  ========================================================== */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      continentApi.readAll(),
      countryApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      cityApi.readAll(),
      zoneApi.readAll(),
    ]).then(([continentRes, countryRes, stateRes, districtRes, cityRes, zoneRes]) => {
      if (cancelled) return;

      const contData = (continentRes as any[]) ?? [];
      setContinents(
        contData.filter((x: any) => x.is_active).map((x: any) => ({ value: String(x.unique_id), label: x.name }))
      );

      const ctrData = (countryRes as any[]) ?? [];
      setAllCountries(ctrData.map((c: any) => ({
        id: String(c.unique_id),
        name: c.name,
        continentId: normalizeNullable(c.continent_id ?? c.continent_unique_id ?? c.continent),
        isActive: Boolean(c.is_active),
      })));

      const steData = (stateRes as any[]) ?? [];
      setAllStates(steData.map((s: any) => ({
        id: String(s.unique_id),
        name: s.name,
        countryId: normalizeNullable(s.country_id ?? s.country_unique_id ?? s.country),
        continentId: normalizeNullable(s.continent_id ?? s.continent_unique_id ?? s.continent),
        countryName: s.country_name ?? null,
        isActive: Boolean(s.is_active),
      })));

      const disData = (districtRes as any[]) ?? [];
      setAllDistricts(disData.map((d: any) => ({
        id: String(d.unique_id),
        name: d.name,
        stateId: normalizeNullable(d.state_id ?? d.state_unique_id ?? d.state),
        countryId: normalizeNullable(d.country_id ?? d.country_unique_id ?? d.country),
        continentId: normalizeNullable(d.continent_id ?? d.continent_unique_id ?? d.continent),
        stateName: d.state_name ?? null,
        countryName: d.country_name ?? null,
        continentName: d.continent_name ?? null,
        isActive: Boolean(d.is_active),
      })));

      const cityData = (cityRes as any[]) ?? [];
      setAllCities(cityData.map((c: any) => ({
        id: String(c.unique_id),
        name: c.name ?? c.city_name,
        continentId: normalizeNullable(c.continent_id ?? c.continent_unique_id ?? c.continent),
        countryId: normalizeNullable(c.country_id ?? c.country_unique_id ?? c.country),
        stateId: normalizeNullable(c.state_id ?? c.state_unique_id ?? c.state),
        districtId: normalizeNullable(c.district_id ?? c.district_unique_id ?? c.district),
        continentName: c.continent_name ?? null,
        countryName: c.country_name ?? null,
        stateName: c.state_name ?? null,
        districtName: c.district_name ?? null,
        isActive: Boolean(c.is_active),
      })));

      const zoneData = (zoneRes as any[]) ?? [];
      setAllZones(zoneData.map((z: any) => ({
        id: String(z.unique_id),
        name: z.zone_name,
        continentId: normalizeNullable(z.continent_id ?? z.continent_unique_id ?? z.continent),
        countryId: normalizeNullable(z.country_id ?? z.country_unique_id ?? z.country),
        stateId: normalizeNullable(z.state_id ?? z.state_unique_id ?? z.state),
        districtId: normalizeNullable(z.district_id ?? z.district_unique_id ?? z.district),
        cityId: normalizeNullable(z.city_id ?? z.city_unique_id ?? z.city),
        cityName: z.city_name ?? null,
        districtName: z.district_name ?? null,
        stateName: z.state_name ?? null,
        isActive: Boolean(z.is_active),
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isEdit) return;

    const searchParams = new URLSearchParams(location.search);
    const storedCompanyId =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("selected_company_unique_id");
    const storedProjectId =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("selected_project_id");
    const routeCompanyId = normalizeNullable(
      routeState?.companyUniqueId ??
        searchParams.get("company_unique_id") ??
        storedCompanyId
    );
    const routeProjectId = normalizeNullable(
      routeState?.projectId ?? searchParams.get("project_id") ?? storedProjectId
    );

    if (routeCompanyId && routeCompanyId !== companyUniqueId) {
      onCompanyChange(routeCompanyId);
      return;
    }

    const routeProjectReady =
      routeProjectId &&
      (!routeCompanyId || routeCompanyId === companyUniqueId) &&
      projects.some((project) => project.value === routeProjectId);

    if (routeProjectReady && routeProjectId !== projectId) {
      setProjectId(routeProjectId);
    }
  }, [
    companyUniqueId,
    isEdit,
    location.search,
    onCompanyChange,
    projectId,
    projects,
    routeState,
    setProjectId,
  ]);

  /* ==========================================================
        FILTER CHAINS
  ========================================================== */
  useEffect(() => {
    if (!continentId) {
      setFilteredCountries([]);
      return;
    }

    const filt = allCountries
      .filter((c) => c.isActive && (c.continentId === continentId || (pendingContinent && c.continentId === pendingContinent)))
      .map((c) => ({ value: c.id, label: c.name }));

    // Always keep the currently-selected country visible — prevents blank after pending is cleared
    const ensureCountry = pendingCountry || countryId;
    if (ensureCountry && !filt.some((o) => o.value === ensureCountry)) {
      const found = allCountries.find((c) => c.id === ensureCountry);
      if (found) filt.push({ value: found.id, label: found.name });
    }

    setFilteredCountries(filt);
  }, [continentId, allCountries, countryId, pendingContinent, pendingCountry]);

  useEffect(() => {
    if (!countryId && !pendingCountry) {
      setFilteredStates([]);
      return;
    }

    const effectiveCountryId = countryId || pendingCountry;
    const filt = allStates
      .filter((s) => s.isActive && s.countryId === effectiveCountryId)
      .map((s) => ({ value: s.id, label: s.name }));

    // Always keep the currently-selected state visible
    const ensureState = pendingState || stateId;
    if (ensureState && !filt.some((o) => o.value === ensureState)) {
      const found = allStates.find((s) => s.id === ensureState);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (wardRecordData?.state_name) {
        filt.push({ value: ensureState, label: wardRecordData.state_name });
      }
    }

    setFilteredStates(filt);
  }, [countryId, pendingCountry, allStates, stateId, pendingState, wardRecordData]);

  useEffect(() => {
    const effectiveStateId = stateId || pendingState;
    if (!effectiveStateId) {
      setFilteredDistricts([]);
      return;
    }

    const filt = allDistricts
      .filter((d) => d.isActive && d.stateId === effectiveStateId)
      .map((d) => ({ value: d.id, label: d.name }));

    // Always keep the currently-selected district visible
    const ensureDistrict = pendingDistrict || districtId;
    if (ensureDistrict && !filt.some((o) => o.value === ensureDistrict)) {
      const found = allDistricts.find((d) => d.id === ensureDistrict);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (wardRecordData?.district_name) {
        filt.push({ value: ensureDistrict, label: wardRecordData.district_name });
      }
    }

    setFilteredDistricts(filt);
  }, [stateId, pendingState, allDistricts, districtId, pendingDistrict, wardRecordData]);

  useEffect(() => {
    // Always keep the currently-selected city visible even when districtId is empty/mismatched
    const ensureCity = pendingCity || cityId;
    const effectiveDistrictId = districtId || pendingDistrict;

    if (!effectiveDistrictId && !ensureCity) {
      setFilteredCities([]);
      return;
    }

    const filt = effectiveDistrictId
      ? allCities
          .filter((c) => c.isActive && c.districtId === effectiveDistrictId)
          .map((c) => ({ value: c.id, label: c.name }))
      : [];

    if (ensureCity && !filt.some((o) => o.value === ensureCity)) {
      const found = allCities.find((c) => c.id === ensureCity);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (wardRecordData?.city_name) {
        filt.push({ value: ensureCity, label: wardRecordData.city_name });
      }
    }

    setFilteredCities(filt);
  }, [districtId, pendingDistrict, allCities, cityId, pendingCity, wardRecordData]);

  useEffect(() => {
    // Always keep the currently-selected zone visible even when cityId is empty/mismatched
    const ensureZone = pendingZone || zoneId;
    const effectiveCityId = cityId || pendingCity;

    if (!effectiveCityId && !ensureZone) {
      setFilteredZones([]);
      return;
    }

    const filt = effectiveCityId
      ? allZones
          .filter((z) => z.isActive && z.cityId === effectiveCityId)
          .map((z) => ({ value: z.id, label: z.name }))
      : [];

    if (ensureZone && !filt.some((o) => o.value === ensureZone)) {
      const found = allZones.find((z) => z.id === ensureZone);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (wardRecordData?.zone_name) {
        filt.push({ value: ensureZone, label: wardRecordData.zone_name });
      }
    }

    setFilteredZones(filt);
  }, [cityId, pendingCity, allZones, zoneId, pendingZone, wardRecordData]);

  /* ==========================================================
        EDIT MODE
  ========================================================== */
  useEffect(() => {
    if (!wardRecordData) return;
    const data = wardRecordData as WardWithRelations;

    setWardName(data.ward_name ?? data.name ?? "");
    setIsActive(Boolean(data.is_active));
    setDescription(data.description ?? data.remarks ?? data.notes ?? "");

    let cont = resolveMetaId(
      continents.map((c) => ({ id: c.value, name: c.label })),
      normalizeNullable(data.continent_unique_id ?? data.continent_id ?? data.continent),
      data.continent_name
    );
    let ctr = resolveMetaId(
      allCountries,
      normalizeNullable(data.country_unique_id ?? data.country_id ?? data.country),
      data.country_name
    );
    let ste = resolveMetaId(
      allStates,
      normalizeNullable(data.state_unique_id ?? data.state_id ?? data.state),
      data.state_name
    );
    let dis = resolveMetaId(
      allDistricts,
      normalizeNullable(data.district_unique_id ?? data.district_id ?? data.district),
      data.district_name
    );
    const cty = resolveMetaId(
      allCities,
      normalizeNullable(data.city_unique_id ?? data.city_id ?? data.city),
      data.city_name
    );
    const zne = resolveMetaId(
      allZones,
      normalizeNullable(data.zone_unique_id ?? data.zone_id ?? data.zone),
      data.zone_name
    );

    // Resolve missing parent IDs by walking up from child records
    const selectedCity = cty ? allCities.find((c) => c.id === cty) : undefined;

    if (!dis && selectedCity?.districtId) dis = selectedCity.districtId;

    const resolvedDistrict = dis ? allDistricts.find((d) => d.id === dis) : undefined;

    if (!ste) ste = selectedCity?.stateId || resolvedDistrict?.stateId || null;
    if (!ste && dis) ste = allDistricts.find((d) => d.id === dis)?.stateId ?? null;

    const resolvedState = ste ? allStates.find((s) => s.id === ste) : undefined;

    if (!ctr) ctr = selectedCity?.countryId || resolvedDistrict?.countryId || resolvedState?.countryId || null;
    if (!ctr && ste) ctr = allStates.find((s) => s.id === ste)?.countryId ?? null;

    const resolvedCountry = ctr ? allCountries.find((c) => c.id === ctr) : undefined;

    if (!cont) cont = resolvedCountry?.continentId || null;
    if (!cont && ctr) cont = allCountries.find((c) => c.id === ctr)?.continentId ?? null;

    if (cont) { setContinentId(cont); setPendingContinent(cont); }
    if (ctr) { setCountryId(ctr); setPendingCountry(ctr); }
    if (ste) { setStateId(ste); setPendingState(ste); }
    if (dis) { setDistrictId(dis); setPendingDistrict(dis); }
    if (cty) { setCityId(cty); setPendingCity(cty); }
    if (zne) { setZoneId(zne); setPendingZone(zne); }

    applyCompanyProjectFromRecord(data as unknown as Record<string, unknown>);
  }, [
    wardRecordData,
    applyCompanyProjectFromRecord,
    continents,
    allCountries,
    allStates,
    allDistricts,
    allCities,
    allZones,
  ]);

  useEffect(() => {
    if (!wardRecordData || projects.length === 0) return;

    const rawProjectId = normalizeNullable(
      wardRecordData.project_unique_id ?? wardRecordData.project_id ?? wardRecordData.project
    );
    const projectName =
      typeof wardRecordData.project_name === "string"
        ? wardRecordData.project_name.trim().toLowerCase()
        : "";
    const resolvedProjectId =
      rawProjectId && projects.some((project) => project.value === rawProjectId)
        ? rawProjectId
        : projects.find((project) => project.label.trim().toLowerCase() === projectName)
            ?.value;

    if (resolvedProjectId && resolvedProjectId !== projectId) {
      setProjectId(resolvedProjectId);
    }
  }, [wardRecordData, projects, projectId, setProjectId]);

  /* ==========================================================
        AUTO-INFER CHAINS
  ========================================================== */
  useEffect(() => {
    if (
      !pendingContinent &&
      !pendingCountry &&
      !pendingState &&
      !pendingDistrict &&
      !pendingCity &&
      !pendingZone
    ) {
      return;
    }

    if (pendingContinent && continents.some((c) => c.value === pendingContinent)) {
      setContinentId(pendingContinent);
    }

    if (
      pendingCountry &&
      filteredCountries.length > 0 &&
      filteredCountries.some((o) => o.value === pendingCountry)
    ) {
      setCountryId(pendingCountry);
      setPendingCountry("");
      setPendingContinent("");
    }

    if (
      pendingState &&
      filteredStates.length > 0 &&
      filteredStates.some((o) => o.value === pendingState)
    ) {
      setStateId(pendingState);
      setPendingState("");
    }

    if (
      pendingDistrict &&
      filteredDistricts.length > 0 &&
      filteredDistricts.some((o) => o.value === pendingDistrict)
    ) {
      setDistrictId(pendingDistrict);
      setPendingDistrict("");
    }

    if (
      pendingCity &&
      filteredCities.length > 0 &&
      filteredCities.some((o) => o.value === pendingCity)
    ) {
      setCityId(pendingCity);
      setPendingCity("");
    }

    if (
      pendingZone &&
      filteredZones.length > 0 &&
      filteredZones.some((o) => o.value === pendingZone)
    ) {
      setZoneId(pendingZone);
      setPendingZone("");
    }
  }, [
    pendingContinent,
    pendingCountry,
    pendingState,
    pendingDistrict,
    pendingCity,
    pendingZone,
    continents,
    filteredCountries,
    filteredStates,
    filteredDistricts,
    filteredCities,
    filteredZones,
  ]);

  const recordContinentId =
    normalizeNullable(
      wardRecordData?.continent_unique_id ?? wardRecordData?.continent_id ?? wardRecordData?.continent
    ) ?? "";
  const recordCompanyId =
    normalizeNullable(
      wardRecordData?.company_unique_id ?? wardRecordData?.company_id ?? wardRecordData?.company
    ) ?? "";
  const recordCountryId =
    normalizeNullable(
      wardRecordData?.country_unique_id ?? wardRecordData?.country_id ?? wardRecordData?.country
    ) ?? "";
  const recordProjectId =
    normalizeNullable(
      wardRecordData?.project_unique_id ?? wardRecordData?.project_id ?? wardRecordData?.project
    ) ?? "";
  const recordStateId =
    normalizeNullable(
      wardRecordData?.state_unique_id ?? wardRecordData?.state_id ?? wardRecordData?.state
    ) ?? "";
  const recordDistrictId =
    normalizeNullable(
      wardRecordData?.district_unique_id ?? wardRecordData?.district_id ?? wardRecordData?.district
    ) ?? "";
  const recordCityId =
    normalizeNullable(
      wardRecordData?.city_unique_id ?? wardRecordData?.city_id ?? wardRecordData?.city
    ) ?? "";
  const recordZoneId =
    normalizeNullable(
      wardRecordData?.zone_unique_id ?? wardRecordData?.zone_id ?? wardRecordData?.zone
    ) ?? "";
  const effectiveCountryId =
    countryId || (continentId === recordContinentId ? recordCountryId : "");
  const effectiveProjectId =
    (recordProjectId && (companyUniqueId === recordCompanyId || !recordCompanyId)
      ? recordProjectId
      : projectId);
  const effectiveStateId =
    stateId || (effectiveCountryId === recordCountryId ? recordStateId : "");
  const effectiveDistrictId =
    districtId || (effectiveStateId === recordStateId ? recordDistrictId : "");
  const effectiveCityId =
    cityId || (effectiveDistrictId === recordDistrictId ? recordCityId : "");
  const effectiveZoneId =
    zoneId || (effectiveCityId === recordCityId ? recordZoneId : "");

  const countryOptions = ensureSelectedOption(
    filteredCountries,
    effectiveCountryId,
    wardRecordData?.country_name
  );
  const projectOptions = ensureSelectedOption(
    projects,
    effectiveProjectId,
    wardRecordData?.project_name
  );
  const stateOptions = ensureSelectedOption(
    filteredStates,
    effectiveStateId,
    wardRecordData?.state_name
  );
  const districtOptions = ensureSelectedOption(
    filteredDistricts,
    effectiveDistrictId,
    wardRecordData?.district_name
  );
  const cityOptions = ensureSelectedOption(
    filteredCities,
    effectiveCityId,
    wardRecordData?.city_name
  );
  const zoneOptions = ensureSelectedOption(
    filteredZones,
    effectiveZoneId,
    wardRecordData?.zone_name
  );

    /* ==========================================================
      FORM SUBMIT
    ========================================================== */
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, unknown> = {
      continent_id: continentId,
      country_id: effectiveCountryId,
      state_id: effectiveStateId,
      ward_name: wardName.trim(),
    };
    const missingFields = getMissingRequiredFields(
      ["continent_id", "country_id", "state_id", "ward_name"],
      (fieldKey) => fieldValues[fieldKey],
    );

    if (missingFields.length > 0) {
      Swal.fire(t("common.warning"), t("common.all_fields_required"), "warning");
      return;
    }

    if (!companyUniqueId) {
      Swal.fire(
        "Error",
        !loggedInCompanyUniqueId && !isSuperAdmin
          ? "Company is not mapped to this login. Only super admin can choose a company."
          : "Company is required",
        "error"
      );
      return;
    }

    if (!effectiveProjectId) {
      Swal.fire("Error", "Project is required", "error");
      return;
    }

    const rawPayload = {
      ward_name: wardName.trim(),
      continent_id: continentId,
      country_id: effectiveCountryId,
      state_id: effectiveStateId,
      district_id: effectiveDistrictId || null,
      city_id: effectiveCityId || null,
      zone_id: effectiveZoneId || null,
      description,
      is_active: isActive,
      company_id: companyUniqueId,
      project_id: effectiveProjectId,
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await wardApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await wardApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId: effectiveProjectId } });
    } catch (err) {
      Swal.fire(t("common.save_failed"), extractErr(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==========================================================
        JSX
  ========================================================== */
  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.ward") })
          : t("common.add_item", { item: t("admin.nav.ward") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Company *</Label>
            <Select
              value={companyUniqueId}
              onValueChange={onCompanyChange}
              disabled={
                Boolean(loggedInCompanyUniqueId) ||
                (!isSuperAdmin && !loggedInCompanyUniqueId) ||
                companies.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loggedInCompanyUniqueId
                      ? "Company from logged-in profile"
                      : isSuperAdmin
                        ? "Select Company"
                        : "Only super admin can select company"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.value} value={company.value}>
                    {company.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loggedInCompanyUniqueId && !isSuperAdmin && (
              <p className="mt-1 text-xs text-red-500">
                Company is not mapped to this login. Only super admin can view
                all companies.
              </p>
            )}
            {isSuperAdmin && !loggedInCompanyUniqueId && companies.length === 0 && (
              <p className="mt-1 text-xs text-red-500">No companies found.</p>
            )}
          </div>

          <div>
            <Label>Project *</Label>
            <Select
              value={effectiveProjectId}
              onValueChange={setProjectId}
              disabled={!companyUniqueId || projectOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((project) => (
                  <SelectItem key={project.value} value={project.value}>
                    {project.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companyUniqueId && projects.length === 0 && (
              <p className="mt-1 text-xs text-red-500">
                No projects found for this company.
              </p>
            )}
          </div>

          {/* Continent */}
          {showField("continent_id") && (
          <div>
            <Label>{t("admin.nav.continent")} *</Label>
            <Select value={continentId} onValueChange={(val) => { setContinentId(val); setCountryId(""); setStateId(""); setDistrictId(""); setCityId(""); setZoneId(""); setPendingCountry(""); setPendingState(""); setPendingDistrict(""); setPendingCity(""); setPendingZone(""); }}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.continent") })} />
              </SelectTrigger>
              <SelectContent>
                {continents.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Country */}
          {showField("country_id") && (
          <div>
            <Label>{t("admin.nav.country")} *</Label>
            <Select value={effectiveCountryId} onValueChange={(val) => { setCountryId(val); setStateId(""); setDistrictId(""); setCityId(""); setZoneId(""); setPendingState(""); setPendingDistrict(""); setPendingCity(""); setPendingZone(""); }}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.country") })} />
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* State */}
          {showField("state_id") && (
          <div>
            <Label>{t("admin.nav.state")} *</Label>
            <Select value={effectiveStateId} onValueChange={(val) => { setStateId(val); setDistrictId(""); setCityId(""); setZoneId(""); setPendingDistrict(""); setPendingCity(""); setPendingZone(""); }}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.state") })} />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* District */}
          {showField("district_id") && (
          <div>
            <Label>{t("admin.nav.district")}</Label>
            <Select value={effectiveDistrictId} onValueChange={(val) => { setDistrictId(val); setCityId(""); setZoneId(""); setPendingCity(""); setPendingZone(""); }}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.district") })} />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* City */}
          {showField("city_id") && (
          <div>
            <Label>{t("admin.nav.city")}</Label>
            <Select value={effectiveCityId} onValueChange={(val) => { setCityId(val); setZoneId(""); setPendingZone(""); }}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.city") })} />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Zone */}
          {showField("zone_id") && (
          <div>
            <Label>{t("admin.nav.zone")}</Label>
            <Select value={effectiveZoneId} onValueChange={setZoneId}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.zone") })} />
              </SelectTrigger>
              <SelectContent>
                {zoneOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Ward Name */}
          {showField("ward_name") && (
          <div>
            <Label>{t("common.item_name", { item: t("admin.nav.ward") })} *</Label>
            <Input value={wardName} onChange={(e) => setWardName(e.target.value)} placeholder={t("common.enter_item_name", { item: t("admin.nav.ward") })} required />
          </div>
          )}

          {/* Active Status */}
          {showField("is_active") && (
          <div>
            <Label>{t("common.status")} *</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Description */}
          {showField("description") && (
          <div className="md:col-span-2">
            <Label>{t("common.description")}</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("common.description_optional")} className="w-full border rounded-md p-2 focus:ring focus:ring-green-200 outline-none" rows={3} />
          </div>
          )}
        </div>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId: effectiveProjectId } })}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
