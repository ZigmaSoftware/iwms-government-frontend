import type { CountryMeta } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { continentApi, countryApi, stateApi } from "@/helpers/admin";

const { encMasters, encStates } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encStates);

const STATE_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  country_id: ["country_id"],
  name: ["name"],
  label: ["label"],
  is_active: ["is_active"],
};


const normalizeNull = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return normalizeNull(v.unique_id ?? v.id ?? v.value);
  const s = String(v).trim();
  return s || null;
};

/** Try ID match first; fall back to label/name match */
const resolveId = (items: SelectOption[], id: string | null, name?: string | null): string | null => {
  if (id && items.some((x) => x.value === id)) return id;
  if (!name) return id;
  const n = name.trim().toLowerCase();
  return items.find((x) => x.label.trim().toLowerCase() === n)?.value ?? id;
};

export default function StateForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "states", STATE_FIELDS);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { applyCompanyProjectFromRecord } = useCompanyProjectSelection({ isEdit });

  /* ── form fields ── */
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [continentId, setContinentId] = useState("");
  const [countryId, setCountryId] = useState("");

  /* ── dropdown data ── */
  const [continents, setContinents] = useState<SelectOption[]>([]);
  const [allCountries, setAllCountries] = useState<CountryMeta[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<SelectOption[]>([]);

  /* ── pending for edit prefill ── */
  const [pendingContinentId, setPendingContinentId] = useState("");
  const [pendingContinentName, setPendingContinentName] = useState("");
  const [pendingCountryId, setPendingCountryId] = useState("");
  const [pendingCountryName, setPendingCountryName] = useState("");

  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── load continents ── */
  useEffect(() => {
    let cancelled = false;
    continentApi.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        setContinents(
          data.filter((c) => c.is_active).map((c) => ({
            value: String(c.unique_id),
            label: String(c.name ?? ""),
          }))
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ── load countries ── */
  useEffect(() => {
    let cancelled = false;
    countryApi.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        setAllCountries(
          data.map((c) => ({
            id: String(c.unique_id),
            name: String(c.name ?? ""),
            continentId: normalizeNull(c.continent_id ?? c.continent_unique_id ?? c.continent),
            isActive: Boolean(c.is_active),
          }))
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ── cascade: countries filtered by continent ── */
  useEffect(() => {
    if (!continentId) { setFilteredCountries([]); return; }

    const filt = allCountries
      .filter((c) => c.isActive && c.continentId === continentId)
      .map((c) => ({ value: c.id, label: c.name }));

    /* Ensure pending country is always visible even if cascade filter returns nothing */
    if (pendingCountryId && !filt.some((x) => x.value === pendingCountryId)) {
      const found = allCountries.find((c) => c.id === pendingCountryId);
      if (found) filt.push({ value: found.id, label: found.name });
    }

    setFilteredCountries(filt);
  }, [continentId, allCountries, pendingCountryId]);

  /* ── apply pending continent once options load ── */
  useEffect(() => {
    if (!pendingContinentId || continents.length === 0) return;
    const resolved = resolveId(continents, pendingContinentId, pendingContinentName);
    if (resolved) {
      setContinentId(resolved);
      setPendingContinentId("");
      setPendingContinentName("");
    }
  }, [pendingContinentId, pendingContinentName, continents]);

  /* ── apply pending country once filtered list has it ── */
  useEffect(() => {
    if (!pendingCountryId || filteredCountries.length === 0) return;

    /* try direct match first */
    if (filteredCountries.some((x) => x.value === pendingCountryId)) {
      setCountryId(pendingCountryId);
      setPendingCountryId("");
      setPendingCountryName("");
      return;
    }

    /* name fallback */
    if (pendingCountryName) {
      const byName = filteredCountries.find(
        (x) => x.label.trim().toLowerCase() === pendingCountryName.trim().toLowerCase()
      );
      if (byName) {
        setCountryId(byName.value);
        setPendingCountryId("");
        setPendingCountryName("");
      }
    }
  }, [pendingCountryId, pendingCountryName, filteredCountries]);

  /* ── edit mode: fetch record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    stateApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        setName(res.name ?? "");
        setLabel(res.label ?? "");
        setIsActive(Boolean(res.is_active));
        applyCompanyProjectFromRecord(res as Record<string, unknown>);

        const rawContId = normalizeNull(res.continent_id ?? res.continent_unique_id ?? res.continent);
        const contName = res.continent_name ?? null;
        const rawCountId = normalizeNull(res.country_id ?? res.country_unique_id ?? res.country);
        const countName = res.country_name ?? null;

        /* Continent */
        if (rawContId) {
          const resolved = resolveId(continents, rawContId, contName);
          if (resolved && continents.length > 0) {
            setContinentId(resolved);
          } else {
            setPendingContinentId(rawContId);
            setPendingContinentName(contName ?? "");
          }
        }

        /* Country — set pending; will resolve once continent cascade is ready */
        if (rawCountId) {
          setPendingCountryId(rawCountId);
          setPendingCountryName(countName ?? "");
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: String(err?.response?.data ?? err?.message ?? t("common.load_failed")) });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const fieldValues: Record<string, unknown> = {
      continent_id: continentId,
      country_id: countryId,
      name: name.trim(),
      label: label.trim(),
    };

    if (getMissingRequiredFields(["continent_id", "country_id", "name", "label"], (k) => fieldValues[k]).length > 0) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: t("common.missing_fields") });
      return;
    }

    setIsSubmitting(true);
    try {
      const rawPayload = { name: name.trim(), label: label.trim(), country_id: countryId, continent_id: continentId, is_active: isActive };
      const payload = filterPayload(rawPayload) as typeof rawPayload;

      if (isEdit && id) {
        await stateApi.update(id, payload);
        Swal.fire({ icon: "success", title: t("common.updated_success") });
      } else {
        await stateApi.create(payload);
        Swal.fire({ icon: "success", title: t("common.added_success") });
      }
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      const data = error?.response?.data;
      const msg = typeof data === "string" ? data :
        data && typeof data === "object" ? Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("\n") :
        error?.message ?? t("common.save_failed_desc");
      Swal.fire({ icon: "error", title: t("common.save_failed"), text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.state") })
          : t("common.add_item", { item: t("admin.nav.state") })
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" noValidate>

        {showField("continent_id") && (
          <div>
            <Label htmlFor="continent">
              {t("admin.nav.continent")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={continentId}
              onValueChange={(val) => { setContinentId(val); setCountryId(""); setFilteredCountries([]); setPendingCountryId(""); }}
            >
              <SelectTrigger id="continent">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.continent") })} />
              </SelectTrigger>
              <SelectContent>
                {continents.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("country_id") && (
          <div>
            <Label htmlFor="country">
              {t("admin.nav.country")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={countryId}
              onValueChange={setCountryId}
              disabled={!continentId || filteredCountries.length === 0}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder={t("common.select_item_placeholder", { item: t("admin.nav.country") })} />
              </SelectTrigger>
              <SelectContent>
                {filteredCountries.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("name") && (
          <div>
            <Label htmlFor="stateName">
              {t("common.item_name", { item: t("admin.nav.state") })} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", { item: t("admin.nav.state") })}
            />
          </div>
        )}

        {showField("label") && (
          <div>
            <Label htmlFor="stateLabel">
              {t("common.label")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stateLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("common.enter_label")}
            />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label>{t("common.status")} <span className="text-red-500">*</span></Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger><SelectValue placeholder={t("common.select_status")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3 mt-2">
          <Button type="submit" disabled={isSubmitting || loadingRecord}>
            {isEdit ? t("common.update") : t("common.save")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => navigate(ENC_LIST_PATH)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
