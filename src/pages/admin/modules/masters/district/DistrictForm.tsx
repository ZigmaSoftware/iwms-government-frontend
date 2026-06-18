import type { DistrictRouteState, DistrictWithProject } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, type FormEvent } from "react";
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
import type { CountryMeta, StateMeta } from "./types";

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";

const DISTRICT_FORM_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  country_id:   ["country_id"],
  state_id:     ["state_id"],
  name:         ["name"],
  is_active:    ["is_active"],
};

const { encMasters, encDistricts } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encDistricts);

const normalize = (
  v:
    | string
    | number
    | { unique_id?: string | number; id?: string | number }
    | null
    | undefined
): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return normalize(v.unique_id ?? v.id);
  return String(v);
};

const normalizeLabel = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const resolveOptionValue = (
  options: SelectOption[],
  id: string | null,
  label: string | null | undefined
) => {
  if (id && options.some((option) => option.value === id)) {
    return id;
  }

  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) {
    return id;
  }

  return (
    options.find((option) => normalizeLabel(option.label) === normalizedLabel)
      ?.value ?? id
  );
};


export default function DistrictForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } = useFieldVisibility(
    "masters",
    "districts",
    DISTRICT_FORM_FIELDS,
  );
  const [districtName, setDistrictName] = useState("");
  const [continentId, setContinentId] = useState<string>("");
  const [countryId, setCountryId] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");

  const [pendingCountryId, setPendingCountryId] = useState<string>("");
  const [pendingStateId, setPendingStateId] = useState<string>("");

  const [continents, setContinents] = useState<SelectOption[]>([]);
  const [allCountries, setAllCountries] = useState<CountryMeta[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<SelectOption[]>([]);
  const [allStates, setAllStates] = useState<StateMeta[]>([]);
  const [filteredStates, setFilteredStates] = useState<SelectOption[]>([]);
  const [isActive, setIsActive] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const routeState = location.state as DistrictRouteState | null;
  const routeStateAppliedRef = useRef(false);
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

  // Single-record fetch (edit mode)
  const [recordData, setRecordData] = useState<DistrictWithProject | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.districts.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: String(err?.response?.data ?? err?.message ?? t("common.load_failed")) });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // Continents list
  const [continentsRaw, setContinentsRaw] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi.continents.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setContinentsRaw(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Countries list
  const [countriesRaw, setCountriesRaw] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi.countries.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setCountriesRaw(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // States list
  const [statesRaw, setStatesRaw] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi.states.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setStatesRaw(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    routeStateAppliedRef.current = false;
  }, [id, location.key]);

  useEffect(() => {
    if (!routeState) return;
    if (routeStateAppliedRef.current) return;

    const routeCompanyId = normalize(routeState.companyUniqueId);
    const routeProjectId = normalize(routeState.projectId);
    let applied = false;

    if (routeCompanyId && routeCompanyId !== companyUniqueId) {
      onCompanyChange(routeCompanyId);
      applied = true;
    }

    if (routeProjectId && routeProjectId !== projectId) {
      setProjectId(routeProjectId);
      applied = true;
    }

    if (!recordData && routeState.district?.name) {
      setDistrictName(String(routeState.district.name));
      applied = true;
    }

    if (applied || routeCompanyId || routeProjectId || routeState.district?.name) {
      routeStateAppliedRef.current = true;
    }
  }, [
    companyUniqueId,
    recordData,
    onCompanyChange,
    projectId,
    routeState,
    setProjectId,
  ]);

  useEffect(() => {
    const data = continentsRaw;
    const activeContinents = data
      .filter((c) => c.is_active)
      .map((c) => ({ value: String(c.unique_id), label: c.name }));
    const district = recordData as DistrictWithProject | undefined;
    const recordContinentId = normalize(
      district?.continent_id ?? district?.continent_unique_id ?? district?.continent
    );
    const resolvedContinentId = resolveOptionValue(
      activeContinents,
      recordContinentId,
      district?.continent_name
    );

    if (
      resolvedContinentId &&
      district?.continent_name &&
      !activeContinents.some((c) => c.value === resolvedContinentId)
    ) {
      setContinents([
        ...activeContinents,
        { value: resolvedContinentId, label: district.continent_name },
      ]);
      return;
    }

    setContinents(activeContinents);
  }, [continentsRaw, recordData]);

  useEffect(() => {
    const district = recordData as DistrictWithProject | undefined;
    const recordContinentId = normalize(
      district?.continent_id ?? district?.continent_unique_id ?? district?.continent
    );
    const resolvedContinentId = resolveOptionValue(
      continents,
      recordContinentId,
      district?.continent_name
    );
    const data = countriesRaw;
    setAllCountries(
      data.map((x) => ({
        id: String(x.unique_id),
        name: x.name,
        continentId:
          normalize(x.continent_id ?? x.continent) === recordContinentId &&
          resolvedContinentId
            ? resolvedContinentId
            : normalize(x.continent_id ?? x.continent),
        isActive: Boolean(x.is_active),
      }))
    );
  }, [countriesRaw, recordData, continents]);

  useEffect(() => {
    const data = statesRaw;
    setAllStates(
      data.map((x) => ({ id: String(x.unique_id), name: x.name, countryId: normalize(x.country_id ?? x.country), isActive: Boolean(x.is_active) }))
    );
  }, [statesRaw]);

  /* ------------------------------
     Filter Countries on Continent change
  ------------------------------ */
  useEffect(() => {
    if (!continentId) {
      setFilteredCountries([]);
      return;
    }

    const filtered = allCountries
      .filter(
        (c) => c.isActive && c.continentId === continentId
      )
      .map((c) => ({
        value: c.id,
        label: c.name,
      }));
    const district = recordData as DistrictWithProject | undefined;
    const resolvedCountryId = resolveOptionValue(
      filtered,
      pendingCountryId,
      district?.country_name
    );

    // Inject pending edit value if missing
    if (
      resolvedCountryId &&
      !filtered.some((o) => o.value === resolvedCountryId)
    ) {
      const found = allCountries.find((c) => c.id === resolvedCountryId);
      if (found) {
        filtered.push({ value: found.id, label: found.name });
      } else if (district?.country_name) {
        filtered.push({ value: resolvedCountryId, label: district.country_name });
      }
    }

    setFilteredCountries(filtered);
  }, [continentId, allCountries, pendingCountryId, recordData]);

  /* ------------------------------
     Filter States on Country change
  ------------------------------ */
  useEffect(() => {
    if (!countryId) {
      setFilteredStates([]);
      return;
    }

    const filtered = allStates
      .filter(
        (s) => s.isActive && s.countryId === countryId
      )
      .map((s) => ({
        value: s.id,
        label: s.name,
      }));
    const district = recordData as DistrictWithProject | undefined;
    const resolvedStateId = resolveOptionValue(
      filtered,
      pendingStateId,
      district?.state_name
    );

    if (
      resolvedStateId &&
      !filtered.some((o) => o.value === resolvedStateId)
    ) {
      const found = allStates.find((s) => s.id === resolvedStateId);
      if (found) {
        filtered.push({ value: found.id, label: found.name });
      } else if (district?.state_name) {
        filtered.push({ value: resolvedStateId, label: district.state_name });
      }
    }

    setFilteredStates(filtered);
  }, [countryId, allStates, pendingStateId, recordData]);

  useEffect(() => {
    if (!recordData) return;
    const data = recordData as DistrictWithProject;

    setDistrictName(data.name ?? "");
    setIsActive(Boolean(data.is_active));

    const rawContinentId = normalize(
      data.continent_id ?? data.continent_unique_id ?? data.continent
    );
    const rawCountryId = normalize(
      data.country_id ?? data.country_unique_id ?? data.country
    );
    const rawStateId = normalize(
      data.state_id ?? data.state_unique_id ?? data.state
    );
    const cont = resolveOptionValue(continents, rawContinentId, data.continent_name);

    setContinentId(cont ?? "");
    setPendingCountryId(rawCountryId ?? "");
    setPendingStateId(rawStateId ?? "");
    applyCompanyProjectFromRecord(data as unknown as Record<string, unknown>);
  }, [recordData, applyCompanyProjectFromRecord, continents]);

  useEffect(() => {
    if (!recordData || projects.length === 0) return;

    const data = recordData as DistrictWithProject;
    const recordProjectId = normalize(
      data.project_id ?? data.project_unique_id ?? data.project
    );
    const resolvedProjectId = resolveOptionValue(
      projects,
      recordProjectId,
      data.project_name
    );

    if (resolvedProjectId && resolvedProjectId !== projectId) {
      setProjectId(resolvedProjectId);
    }
  }, [recordData, projectId, projects, setProjectId]);

  /* ------------------------------
     Auto-resolve missing continent from pending country
  ------------------------------ */
  useEffect(() => {
    if (!continentId && pendingCountryId) {
      const found = allCountries.find((c) => c.id === pendingCountryId);
      if (found?.continentId) {
        setContinentId(found.continentId);
      }
    }
  }, [pendingCountryId, continentId, allCountries]);

  /* ------------------------------
     When filteredCountries are ready, apply pending selection
  ------------------------------ */
  useEffect(() => {
    if (
      pendingCountryId &&
      filteredCountries.some((o) => o.value === pendingCountryId)
    ) {
      setCountryId(pendingCountryId);
      setPendingCountryId(""); // clear
      return;
    }

    if (!pendingCountryId) {
      return;
    }

    const district = recordData as DistrictWithProject | undefined;
    const resolvedCountryId = resolveOptionValue(
      filteredCountries,
      pendingCountryId,
      district?.country_name
    );

    if (
      resolvedCountryId &&
      filteredCountries.some((o) => o.value === resolvedCountryId)
    ) {
      setCountryId(resolvedCountryId);
      setPendingCountryId("");
    }
  }, [filteredCountries, pendingCountryId, recordData]);

  /* ------------------------------
     When filteredStates are ready, apply pending selection
  ------------------------------ */
  useEffect(() => {
    if (
      pendingStateId &&
      filteredStates.some((o) => o.value === pendingStateId)
    ) {
      setStateId(pendingStateId);
      setPendingStateId("");
      return;
    }

    if (!pendingStateId) {
      return;
    }

    const district = recordData as DistrictWithProject | undefined;
    const resolvedStateId = resolveOptionValue(
      filteredStates,
      pendingStateId,
      district?.state_name
    );

    if (
      resolvedStateId &&
      filteredStates.some((o) => o.value === resolvedStateId)
    ) {
      setStateId(resolvedStateId);
      setPendingStateId("");
    }
  }, [filteredStates, pendingStateId, recordData]);

  /* ------------------------------
     Submit
  ------------------------------ */
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, unknown> = {
      continent_id: continentId,
      country_id: countryId,
      state_id: stateId,
      name: districtName.trim(),
    };
    const missingFields = getMissingRequiredFields(
      ["continent_id", "country_id", "state_id", "name"],
      (fieldKey) => fieldValues[fieldKey],
    );

    if (missingFields.length > 0) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.all_fields_required"),
      });
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

    const rawPayload = {
      name: districtName.trim(),
      continent_id: continentId,
      country_id: countryId,
      state_id: stateId,
      is_active: isActive,
      company_id: companyUniqueId,
      project_id: projectId,
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.districts.update(id, payload);
        Swal.fire({ icon: "success", title: t("common.updated_success") });
      } else {
        await adminApi.districts.create(payload);
        Swal.fire({ icon: "success", title: t("common.added_success") });
      }
      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: unknown } }).response?.data;
      const errorMessage =
        typeof errorData === "string"
          ? errorData
          : t("common.unexpected_error");
      Swal.fire({ icon: "error", title: t("common.save_failed"), text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------
     JSX
  ------------------------------ */
  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.district") })
          : t("common.add_item", { item: t("admin.nav.district") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{/* Continent */}
          {showField("continent_id") && (
          <div>
            <Label>{t("admin.nav.continent")} *</Label>
            <Select
              value={continentId}
              onValueChange={(val) => {
                setContinentId(val);
                setCountryId("");
                setStateId("");
                setPendingCountryId("");
                setPendingStateId("");
              }}
            >
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.continent") })} />
              </SelectTrigger>
              <SelectContent>
                {continents.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Country */}
          {showField("country_id") && (
          <div>
            <Label>{t("admin.nav.country")} *</Label>
            <Select value={countryId} onValueChange={(val) => { setCountryId(val); setStateId(""); setPendingStateId(""); }} disabled={!continentId}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.country") })} />
              </SelectTrigger>
              <SelectContent>
                {filteredCountries.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {continentId ? t("common.no_items_found", { item: t("admin.nav.country") }) : t("common.select_item_first", { item: t("admin.nav.continent") })}
                  </div>
                ) : filteredCountries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* State */}
          {showField("state_id") && (
          <div>
            <Label>{t("admin.nav.state")} *</Label>
            <Select value={stateId} onValueChange={setStateId} disabled={!countryId}>
              <SelectTrigger className="input-validate w-full">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.state") })} />
              </SelectTrigger>
              <SelectContent>
                {filteredStates.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {countryId ? t("common.no_items_found", { item: t("admin.nav.state") }) : t("common.select_item_first", { item: t("admin.nav.country") })}
                  </div>
                ) : filteredStates.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* District Name */}
          {showField("name") && (
          <div>
            <Label>{t("common.item_name", { item: t("admin.nav.district") })} *</Label>
            <Input
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              placeholder={t("common.enter_item_name", { item: t("admin.nav.district") })}
              className="input-validate w-full"
              required
            />
          </div>
          )}

          {/* Active */}
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
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="submit" disabled={isSubmitting || loadingRecord}>
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
