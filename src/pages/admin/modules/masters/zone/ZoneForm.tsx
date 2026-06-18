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
import type { SelectOption } from "@/types";
import type { CountryMeta, StateMeta, ZoneRouteState, ZoneWithRelations, ZoneCityMeta, ZoneDistrictMeta } from "./types";

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { continentApi, countryApi, stateApi, districtApi, cityApi, zoneApi } from "@/helpers/admin";
import GeoFenceCoordinates, {
  emptyCoordinate,
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";

const ZONE_FORM_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  country_id:   ["country_id"],
  state_id:     ["state_id"],
  district_id:  ["district_id"],
  city_id:      ["city_id"],
  zone_name:    ["zone_name"],
  latitude:     ["latitude"],
  longitude:    ["longitude"],
  geofencing_type: ["geofencing_type"],
  coordinates:  ["coordinates"],
  is_active:    ["is_active"],
  description:  ["description"],
};

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
const { encMasters, encZones } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encZones);


/* ==========================================================
      COMPONENT
========================================================== */
export default function ZoneForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } = useFieldVisibility(
    "masters",
    "zones",
    ZONE_FORM_FIELDS,
  );
  /* FORM FIELDS */
  const [zoneName, setZoneName] = useState("");
  const [continentId, setContinentId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geofencingType, setGeofencingType] = useState("polygon");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>([emptyCoordinate()]);

  /* PENDING CHAINS (Edit Support) */
  const [pendingContinent, setPendingContinent] = useState("");
  const [pendingCountry, setPendingCountry] = useState("");
  const [pendingState, setPendingState] = useState("");
  const [pendingDistrict, setPendingDistrict] = useState("");
  const [pendingCity, setPendingCity] = useState("");

  /* MASTER DATA */
  const [continents, setContinents] = useState<SelectOption[]>([]);
  const [allCountries, setAllCountries] = useState<CountryMeta[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<SelectOption[]>([]);

  const [allStates, setAllStates] = useState<StateMeta[]>([]);
  const [filteredStates, setFilteredStates] = useState<SelectOption[]>([]);

  const [allDistricts, setAllDistricts] = useState<ZoneDistrictMeta[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<SelectOption[]>([]);

  const [allCities, setAllCities] = useState<ZoneCityMeta[]>([]);
  const [filteredCities, setFilteredCities] = useState<SelectOption[]>([]);

  /* EDIT DATA */
  const [zoneData, setZoneData] = useState<ZoneWithRelations | null>(null);

  /* SUBMITTING */
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const routeState = location.state as ZoneRouteState | null;
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
      LOAD MASTER DATA (all 5 dropdowns in one Promise.all)
  ========================================================== */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      continentApi.readAll(),
      countryApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      cityApi.readAll(),
    ])
      .then(([continentRes, countryRes, stateRes, districtRes, cityRes]) => {
        if (cancelled) return;

        const contData = (continentRes as any[]) ?? [];
        setContinents(
          contData
            .filter((x: any) => x.is_active)
            .map((x: any) => ({ value: String(x.unique_id), label: x.name }))
        );

        const ctrData = (countryRes as any[]) ?? [];
        setAllCountries(
          ctrData.map((c: any) => ({
            id: String(c.unique_id),
            name: c.name,
            continentId: normalizeNullable(c.continent_id ?? c.continent_unique_id ?? c.continent),
            isActive: Boolean(c.is_active),
          }))
        );

        const steData = (stateRes as any[]) ?? [];
        setAllStates(
          steData.map((s: any) => ({
            id: String(s.unique_id),
            name: s.name,
            countryId: normalizeNullable(s.country_id ?? s.country_unique_id ?? s.country),
            isActive: Boolean(s.is_active),
          }))
        );

        const disData = (districtRes as any[]) ?? [];
        setAllDistricts(
          disData.map((d: any) => ({
            id: String(d.unique_id),
            name: d.name,
            stateId: normalizeNullable(d.state_id ?? d.state_unique_id ?? d.state),
            countryId: normalizeNullable(d.country_id ?? d.country_unique_id ?? d.country),
            continentId: normalizeNullable(d.continent_id ?? d.continent_unique_id ?? d.continent),
            isActive: Boolean(d.is_active),
          }))
        );

        const cityData = (cityRes as any[]) ?? [];
        setAllCities(
          cityData.map((c: any) => ({
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
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ==========================================================
      LOAD ZONE DATA (edit mode)
  ========================================================== */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    zoneApi.read(id)
      .then((data: any) => {
        if (cancelled) return;
        setZoneData(data as ZoneWithRelations);
      })
      .catch((err) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEdit) return;

    const searchParams = new URLSearchParams(location.search);
    const routeCompanyId = normalizeNullable(
      routeState?.companyUniqueId ?? searchParams.get("company_unique_id")
    );
    const routeProjectId = normalizeNullable(
      routeState?.projectId ?? searchParams.get("project_id")
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
    const ensureId = pendingCountry || countryId;
    if (ensureId && !filt.some((o) => o.value === ensureId)) {
      const found = allCountries.find((c) => c.id === ensureId);
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
      .filter((s) => s.isActive && (s.countryId === effectiveCountryId))
      .map((s) => ({ value: s.id, label: s.name }));

    // Always keep the currently-selected state visible
    const ensureId = pendingState || stateId;
    if (ensureId && !filt.some((o) => o.value === ensureId)) {
      const found = allStates.find((s) => s.id === ensureId);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (zoneData?.state_name) {
        filt.push({ value: ensureId, label: zoneData.state_name });
      }
    }
    setFilteredStates(filt);
  }, [countryId, pendingCountry, allStates, stateId, pendingState, zoneData]);

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
    const ensureId = pendingDistrict || districtId;
    if (ensureId && !filt.some((o) => o.value === ensureId)) {
      const found = allDistricts.find((d) => d.id === ensureId);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (zoneData?.district_name) {
        filt.push({ value: ensureId, label: zoneData.district_name });
      }
    }
    setFilteredDistricts(filt);
  }, [stateId, pendingState, allDistricts, districtId, pendingDistrict, zoneData]);


  useEffect(() => {
    // Always keep the currently-selected city visible even when districtId is empty/mismatched
    const ensureId = pendingCity || cityId;
    const effectiveDistrictId = districtId || pendingDistrict;

    if (!effectiveDistrictId && !ensureId) {
      setFilteredCities([]);
      return;
    }

    const filt = effectiveDistrictId
      ? allCities
          .filter((c) => c.isActive && c.districtId === effectiveDistrictId)
          .map((c) => ({ value: c.id, label: c.name }))
      : [];

    const resolvedCityId = ensureId
      ? resolveMetaId(allCities, ensureId, zoneData?.city_name)
      : null;

    if (resolvedCityId && !filt.some((o) => o.value === resolvedCityId)) {
      const found = allCities.find((c) => c.id === resolvedCityId);
      if (found) {
        filt.push({ value: found.id, label: found.name });
      } else if (zoneData?.city_name) {
        filt.push({ value: resolvedCityId, label: zoneData.city_name });
      }
    }

    setFilteredCities(filt);
  }, [districtId, pendingDistrict, allCities, cityId, pendingCity, zoneData]);

  /* ==========================================================
        EDIT MODE
  ========================================================== */
  useEffect(() => {
    if (!zoneData) return;
    const data = zoneData;

    setZoneName(data.zone_name ?? "");
    setIsActive(Boolean(data.is_active));
    setDescription(data.description ?? data.remarks ?? data.notes ?? "");
    setLatitude(data.latitude == null ? "" : String(data.latitude));
    setLongitude(data.longitude == null ? "" : String(data.longitude));
    setGeofencingType(data.geofencing_type ?? "polygon");
    setCoordinates(
      normalizeCoordinateDrafts(data.coordinates, {
        latitude: data.latitude == null ? "" : String(data.latitude),
        longitude: data.longitude == null ? "" : String(data.longitude),
      }),
    );

    let cont = resolveMetaId(
      continents.map((continent) => ({
        id: continent.value,
        name: continent.label,
      })),
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

    const selectedCity = cty ? allCities.find((city) => city.id === cty) : undefined;

    if (!dis && selectedCity?.districtId) {
      dis = selectedCity.districtId;
    }

    const selectedDistrict = dis
      ? allDistricts.find((district) => district.id === dis)
      : undefined;

    if (!ste) {
      ste = selectedCity?.stateId || selectedDistrict?.stateId || null;
    }

    const selectedState = ste
      ? allStates.find((state) => state.id === ste)
      : undefined;

    if (!ctr) {
      ctr = selectedCity?.countryId || selectedDistrict?.countryId || selectedState?.countryId || null;
    }

    const selectedCountry = ctr
      ? allCountries.find((country) => country.id === ctr)
      : undefined;

    if (!cont) {
      cont = selectedCity?.continentId || selectedDistrict?.continentId || selectedCountry?.continentId || null;
    }

    if (!ste && dis) {
      ste = allDistricts.find((district) => district.id === dis)?.stateId ?? null;
    }

    if (!ctr && ste) {
      ctr = allStates.find((state) => state.id === ste)?.countryId ?? null;
    }

    if (!cont && ctr) {
      cont = allCountries.find((country) => country.id === ctr)?.continentId ?? null;
    }

    if (cont) {
      setContinentId(cont);
      setPendingContinent(cont);
    }
    if (ctr) {
      setCountryId(ctr);
      setPendingCountry(ctr);
    }
    if (ste) {
      setStateId(ste);
      setPendingState(ste);
    }
    if (dis) {
      setDistrictId(dis);
      setPendingDistrict(dis);
    }
    if (cty) {
      setCityId(cty);
      setPendingCity(cty);
    }
    applyCompanyProjectFromRecord(data as unknown as Record<string, unknown>);
  }, [
    zoneData,
    applyCompanyProjectFromRecord,
    continents,
    allCountries,
    allStates,
    allDistricts,
    allCities,
  ]);

  useEffect(() => {
    if (!zoneData || projects.length === 0) return;
    const data = zoneData as any;
    const rawProjectId = normalizeNullable(
      data.project_id ?? data.project_unique_id ?? data.project
    );
    const projectName =
      typeof data.project_name === "string" ? data.project_name.trim().toLowerCase() : "";
    const resolvedProjectId =
      rawProjectId && projects.some((project) => project.value === rawProjectId)
        ? rawProjectId
        : projects.find((project) => project.label.trim().toLowerCase() === projectName)
            ?.value;

    if (resolvedProjectId && resolvedProjectId !== projectId) {
      setProjectId(resolvedProjectId);
    }
  }, [zoneData, projects, projectId, setProjectId]);

  /* ==========================================================
        AUTO-INFER CHAINS
  ========================================================== */
  useEffect(() => {
    if (
      !pendingContinent &&
      !pendingCountry &&
      !pendingState &&
      !pendingDistrict &&
      !pendingCity
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
  }, [
    pendingContinent,
    pendingCountry,
    pendingState,
    pendingDistrict,
    pendingCity,
    continents,
    filteredCountries,
    filteredStates,
    filteredDistricts,
    filteredCities,
  ]);


  const countryOptions = ensureSelectedOption(
    filteredCountries,
    countryId,
    zoneData?.country_name
  );
  const recordCountryId =
    normalizeNullable(zoneData?.country_unique_id ?? zoneData?.country_id ?? zoneData?.country) ?? "";
  const recordStateId =
    normalizeNullable(zoneData?.state_unique_id ?? zoneData?.state_id ?? zoneData?.state) ?? "";
  const recordDistrictId =
    normalizeNullable(zoneData?.district_unique_id ?? zoneData?.district_id ?? zoneData?.district) ?? "";
  const recordCityId =
    normalizeNullable(zoneData?.city_unique_id ?? zoneData?.city_id ?? zoneData?.city) ?? "";
  const effectiveStateId =
    stateId || (countryId === recordCountryId ? recordStateId : "");
  const effectiveDistrictId =
    districtId || (effectiveStateId === recordStateId ? recordDistrictId : "");
  const effectiveCityId =
    cityId || (effectiveDistrictId === recordDistrictId ? recordCityId : "");
  const stateOptions = ensureSelectedOption(
    filteredStates,
    effectiveStateId,
    zoneData?.state_name
  );
  const districtOptions = ensureSelectedOption(
    filteredDistricts,
    effectiveDistrictId,
    zoneData?.district_name
  );
  const cityOptions = ensureSelectedOption(
    filteredCities,
    effectiveCityId,
    zoneData?.city_name
  );

  /* ==========================================================
        FORM SUBMIT
  ========================================================== */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, unknown> = {
      continent_id: continentId,
      country_id: countryId,
      state_id: effectiveStateId,
      city_id: effectiveCityId,
      zone_name: zoneName.trim(),
    };
    const missingFields = getMissingRequiredFields(
      ["continent_id", "country_id", "state_id", "city_id", "zone_name"],
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

    if (!projectId) {
      Swal.fire("Error", "Project is required", "error");
      return;
    }

    const coordinatePayload = serializeCoordinateDrafts(coordinates);
    if (geofencingType === "polygon" && coordinatePayload.length > 0 && coordinatePayload.length < 3) {
      Swal.fire("Warning", "Polygon geofence needs at least 3 coordinate points.", "warning");
      return;
    }

    const firstPoint = coordinatePayload[0];

    try {
      setIsSubmitting(true);
      const rawPayload = {
        zone_name: zoneName.trim(),
        continent_id: continentId,
        country_id: countryId,
        state_id: effectiveStateId,
        district_id: effectiveDistrictId || null,
        city_id: effectiveCityId,
        latitude: latitude || firstPoint?.latitude || null,
        longitude: longitude || firstPoint?.longitude || null,
        geofencing_type: geofencingType,
        coordinates: coordinatePayload,
        description,
        is_active: isActive,
        company_id: companyUniqueId,
        project_id: projectId,
      };
      const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

      if (isEdit && id) {
        await zoneApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await zoneApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
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
          ? t("common.edit_item", { item: t("admin.nav.zone") })
          : t("common.add_item", { item: t("admin.nav.zone") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{/* Continent */}
          {showField("continent_id") && (
          <div>
            <Label>{t("admin.nav.continent")} *</Label>
            <Select value={continentId} onValueChange={(val) => { setContinentId(val); setCountryId(""); setStateId(""); setDistrictId(""); setCityId(""); setPendingCountry(""); setPendingState(""); setPendingDistrict(""); setPendingCity(""); }}>
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
            <Select value={countryId} onValueChange={(val) => { setCountryId(val); setStateId(""); setDistrictId(""); setCityId(""); setPendingState(""); setPendingDistrict(""); setPendingCity(""); }}>
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
            <Select value={effectiveStateId} onValueChange={(val) => { setStateId(val); setDistrictId(""); setCityId(""); setPendingDistrict(""); setPendingCity(""); }}>
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
            <Select value={effectiveDistrictId} onValueChange={(val) => { setDistrictId(val); setCityId(""); setPendingCity(""); }}>
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
            <Label>{t("admin.nav.city")} *</Label>
            <Select value={effectiveCityId} onValueChange={setCityId}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.city") })} />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Zone Name */}
          {showField("zone_name") && (
          <div>
            <Label>{t("common.item_name", { item: t("admin.nav.zone") })} *</Label>
            <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder={t("common.enter_item_name", { item: t("admin.nav.zone") })} required />
          </div>
          )}

          {showField("latitude") && (
          <div>
            <Label>Latitude</Label>
            <Input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </div>
          )}

          {showField("longitude") && (
          <div>
            <Label>Longitude</Label>
            <Input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </div>
          )}

          {showField("geofencing_type") && (
          <div>
            <Label>GeoFencing Type</Label>
            <Select value={geofencingType} onValueChange={setGeofencingType}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}

          {showField("coordinates") && (
          <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
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
            onClick={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
