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

import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { continentApi, countryApi } from "@/helpers/admin";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "@/pages/admin/modules/masters/shared/GeoFenceCoordinates";

const { encCommonMasters, encCountries } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCommonMasters, encCountries);

const COUNTRY_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  name: ["name"],
  mob_code: ["mob_code"],
  currency: ["currency"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

const normalizeNull = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return normalizeNull(v.unique_id ?? v.id ?? v.value);
  const s = String(v).trim();
  return s || null;
};

/** Try ID match first; fall back to label/name match */
const resolveId = (
  items: SelectOption[],
  id: string | null,
  name?: string | null
): string | null => {
  if (id && items.some((x) => x.value === id)) return id;
  if (!name) return id;
  const normalName = name.trim().toLowerCase();
  return items.find((x) => x.label.trim().toLowerCase() === normalName)?.value ?? id;
};

export default function CountryForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("common-masters", "countries", COUNTRY_FIELDS);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  /* ── form fields ── */
  const [name, setName] = useState("");
  const [mobCode, setMobCode] = useState("");
  const [currency, setCurrency] = useState("");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(null),
  );
  const [isActive, setIsActive] = useState(true);
  const [continentId, setContinentId] = useState("");

  /* ── dropdown data ── */
  const [continents, setContinents] = useState<SelectOption[]>([]);

  /* ── pending for edit prefill ── */
  const [pendingContinentId, setPendingContinentId] = useState("");
  const [pendingContinentName, setPendingContinentName] = useState("");

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
          data
            .filter((c) => c.is_active)
            .map((c) => ({ value: String(c.unique_id), label: String(c.name ?? "") }))
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  /* ── edit mode: fetch record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    countryApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        setName(res.name ?? "");
        setIsActive(Boolean(res.is_active));
        setMobCode(res.mob_code ?? "");
        setCurrency(res.currency ?? "");
        setCoordinates(normalizeCoordinateDrafts(res.coordinates));

        const rawContId = normalizeNull(
          res.continent_id ?? res.continent_unique_id ?? res.continent
        );
        const contName = res.continent_name ?? null;

        if (rawContId) {
          /* Try immediate resolve if continents already loaded */
          const resolved = resolveId(continents, rawContId, contName);
          if (resolved && continents.length > 0) {
            setContinentId(resolved);
          } else {
            setPendingContinentId(rawContId);
            setPendingContinentName(contName ?? "");
          }
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

    const fieldValues: Record<string, unknown> = { name: name.trim(), continent_id: continentId };
    if (getMissingRequiredFields(["name", "continent_id"], (k) => fieldValues[k]).length > 0) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: t("common.missing_fields") });
      return;
    }

    setIsSubmitting(true);
    try {
      const rawPayload = {
        name: name.trim(),
        continent_id: continentId,
        is_active: isActive,
        mob_code: mobCode.trim(),
        currency: currency.trim(),
        coordinates: serializeCoordinateDrafts(coordinates),
      };
      const payload = filterPayload(rawPayload) as typeof rawPayload;

      if (isEdit && id) {
        await countryApi.update(id, payload);
        Swal.fire({ icon: "success", title: t("common.updated_success"), timer: 1500, showConfirmButton: false });
      } else {
        await countryApi.create(payload);
        Swal.fire({ icon: "success", title: t("common.added_success"), timer: 1500, showConfirmButton: false });
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
          ? t("common.edit_item", { item: t("admin.nav.country") })
          : t("common.add_item", { item: t("admin.nav.country") })
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" noValidate>

        {showField("continent_id") && (
          <div>
            <Label htmlFor="continent">
              {t("admin.nav.continent")} <span className="text-red-500">*</span>
            </Label>
            <Select value={continentId} onValueChange={setContinentId}>
              <SelectTrigger id="continent">
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

        {showField("name") && (
          <div>
            <Label htmlFor="countryName">
              {t("common.item_name", { item: t("admin.nav.country") })} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="countryName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", { item: t("admin.nav.country") })}
              required
            />
          </div>
        )}

        {showField("mob_code") && (
          <div>
            <Label htmlFor="mobile_code">
              {t("common.mobile_code")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="mobile_code"
              type="number"
              value={mobCode}
              onChange={(e) => setMobCode(e.target.value)}
              placeholder={t("common.mobile_code_placeholder")}
            />
          </div>
        )}

        {showField("currency") && (
          <div>
            <Label htmlFor="currency">
              {t("common.currency")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder={t("common.currency_placeholder")}
            />
          </div>
        )}

        {showField("coordinates") && (
          <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
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
