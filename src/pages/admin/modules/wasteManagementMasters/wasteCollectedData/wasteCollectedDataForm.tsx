import type { Customer, GeoRow, Option } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import {
  customerCreationApi,
  wasteCollectionApi,
  dailyTripAssignmentApi,
  stateApi,
  districtApi,
  areaTypeApi,
  corporationApi,
  municipalityApi,
  townPanchayatApi,
  panchayatUnionApi,
  panchayatApi,
} from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";

const extractError = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

const idOf = (o: any): string => String(o?.unique_id ?? o?.id ?? "");
const normId = (v: any): string => (v && typeof v === "object" ? idOf(v) : String(v ?? ""));

/* ── local-body levels, keyed by the WasteCollection FK they write to ── */
type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

const LOCAL_BODY_META: Record<LocalBodyLevel, { label: string; nameKey: string }> = {
  corporation_id: { label: "Corporation", nameKey: "corporation_name" },
  municipality_id: { label: "Municipality", nameKey: "municipality_name" },
  town_panchayat_id: { label: "Town Panchayat", nameKey: "town_panchayat_name" },
  panchayat_union_id: { label: "Panchayat Union", nameKey: "union_name" },
  panchayat_id: { label: "Panchayat", nameKey: "panchayat_name" },
};

const URBAN_LEVELS: LocalBodyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id"];
const RURAL_LEVELS: LocalBodyLevel[] = ["panchayat_union_id", "panchayat_id"];

export default function WasteCollectedForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { encScheduleMasters, encWasteCollectedData } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encWasteCollectedData);

  /* ── form fields ── */
  const [customerId, setCustomerId] = useState("");
  const [tripAssignmentId, setTripAssignmentId] = useState("");

  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [localBodyType, setLocalBodyType] = useState<LocalBodyLevel | "">("");
  const [localBodyId, setLocalBodyId] = useState("");

  const [wetWaste, setWetWaste] = useState(0);
  const [dryWaste, setDryWaste] = useState(0);
  const [mixedWaste, setMixedWaste] = useState(0);
  const totalQuantity = wetWaste + dryWaste + mixedWaste;

  /* ── dropdown data ── */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tripAssignments, setTripAssignments] = useState<Option[]>([]);
  const [states, setStates] = useState<GeoRow[]>([]);
  const [districts, setDistricts] = useState<GeoRow[]>([]);
  const [areaTypes, setAreaTypes] = useState<GeoRow[]>([]);
  const [corporations, setCorporations] = useState<GeoRow[]>([]);
  const [municipalities, setMunicipalities] = useState<GeoRow[]>([]);
  const [townPanchayats, setTownPanchayats] = useState<GeoRow[]>([]);
  const [panchayatUnions, setPanchayatUnions] = useState<GeoRow[]>([]);
  const [panchayats, setPanchayats] = useState<GeoRow[]>([]);

  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guards autofill so it only fires on user-initiated selections, not on record load.
  const userChangedCustomerRef = useRef(false);

  /* ── load dropdowns ── */
  useEffect(() => {
    const toList = (res: any): any[] => (Array.isArray(res) ? res : res?.results ?? []);

    setFetchingCustomers(true);
    customerCreationApi.readAll()
      .then((res: any) => setCustomers(toList(res)))
      .catch(() => Swal.fire(t("common.error"), t("common.load_failed"), "error"))
      .finally(() => setFetchingCustomers(false));

    dailyTripAssignmentApi.readAll()
      .then((res: any) =>
        setTripAssignments(toList(res).map((a) => ({ value: String(a.unique_id), label: String(a.unique_id) }))),
      )
      .catch(() => {});

    stateApi.readAll().then((r: any) => setStates(toList(r))).catch(() => {});
    districtApi.readAll().then((r: any) => setDistricts(toList(r))).catch(() => {});
    areaTypeApi.readAll().then((r: any) => setAreaTypes(toList(r))).catch(() => {});
    corporationApi.readAll().then((r: any) => setCorporations(toList(r))).catch(() => {});
    municipalityApi.readAll().then((r: any) => setMunicipalities(toList(r))).catch(() => {});
    townPanchayatApi.readAll().then((r: any) => setTownPanchayats(toList(r))).catch(() => {});
    panchayatUnionApi.readAll().then((r: any) => setPanchayatUnions(toList(r))).catch(() => {});
    panchayatApi.readAll().then((r: any) => setPanchayats(toList(r))).catch(() => {});
  }, [t]);

  /* ── edit mode: load record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    wasteCollectionApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setWetWaste(Number(res.wet_waste) || 0);
        setDryWaste(Number(res.dry_waste) || 0);
        setMixedWaste(Number(res.mixed_waste) || 0);
        setCustomerId(String(res.customer_id ?? res.customer ?? ""));
        const tripId = String(res.trip_assignment_id ?? "");
        if (tripId && tripId !== "null") setTripAssignmentId(tripId);

        setStateId(normId(res.state_id));
        setDistrictId(normId(res.district_id));
        setAreaTypeId(normId(res.area_type_id));
        // Resolve which local-body level is populated
        const level = (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as LocalBodyLevel[])
          .find((lvl) => normId(res[lvl]));
        if (level) {
          setLocalBodyType(level);
          setLocalBodyId(normId(res[level]));
        }
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? t("common.load_failed") });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  /* ── area type kind (urban/rural) drives which local-body levels apply ── */
  const areaTypeKind = useMemo<"urban" | "rural" | "">(() => {
    const at = areaTypes.find((a) => idOf(a) === areaTypeId);
    const name = String(at?.area_type_name ?? at?.name ?? "").toLowerCase();
    if (name.includes("urban")) return "urban";
    if (name.includes("rural")) return "rural";
    return "";
  }, [areaTypes, areaTypeId]);

  const localBodyLevels = useMemo<LocalBodyLevel[]>(() => {
    if (areaTypeKind === "urban") return URBAN_LEVELS;
    if (areaTypeKind === "rural") return RURAL_LEVELS;
    return [...URBAN_LEVELS, ...RURAL_LEVELS];
  }, [areaTypeKind]);

  /* ── filtered dropdown options ── */
  const filteredDistricts = useMemo(
    () => districts.filter((d) => !stateId || normId(d.state_id) === stateId),
    [districts, stateId],
  );
  const filteredAreaTypes = useMemo(
    () => areaTypes.filter((a) => !districtId || normId(a.district_id) === districtId),
    [areaTypes, districtId],
  );

  const localBodyRowsByLevel = useMemo<Record<LocalBodyLevel, GeoRow[]>>(
    () => ({
      corporation_id: corporations,
      municipality_id: municipalities,
      town_panchayat_id: townPanchayats,
      panchayat_union_id: panchayatUnions,
      panchayat_id: panchayats,
    }),
    [corporations, municipalities, townPanchayats, panchayatUnions, panchayats],
  );

  const localBodyOptions = useMemo<Option[]>(() => {
    if (!localBodyType) return [];
    const rows = localBodyRowsByLevel[localBodyType] ?? [];
    const nameKey = LOCAL_BODY_META[localBodyType].nameKey;
    return rows
      .filter((row) => {
        if (areaTypeId && normId(row.area_type_id) === areaTypeId) return true;
        if (districtId) return normId(row.district_id) === districtId;
        return true;
      })
      .map((row) => ({ value: idOf(row), label: String(row[nameKey] ?? row.name ?? idOf(row)) }));
  }, [localBodyType, localBodyRowsByLevel, areaTypeId, districtId]);

  /* ── households filtered by the chosen geography (selected one always kept) ── */
  const filteredCustomers = useMemo(() => {
    const matches = customers.filter((c) => {
      if (districtId && normId(c.district_id) !== districtId) return false;
      if (areaTypeId && normId(c.area_type_id) !== areaTypeId) return false;
      if (localBodyType && localBodyId && normId(c[localBodyType]) !== localBodyId) return false;
      return true;
    });
    const selected = customers.find((c) => resolveCustomerId(c) === customerId);
    if (selected && !matches.some((c) => resolveCustomerId(c) === customerId)) {
      return [selected, ...matches];
    }
    return matches;
  }, [customers, districtId, areaTypeId, localBodyType, localBodyId, customerId]);

  const selectedCustomer = customers.find((c) => resolveCustomerId(c) === customerId);

  /* ── autofill geography from the selected household (user-initiated only) ── */
  useEffect(() => {
    if (!userChangedCustomerRef.current) return;
    userChangedCustomerRef.current = false;
    if (!selectedCustomer) return;

    setStateId(normId(selectedCustomer.state_id));
    setDistrictId(normId(selectedCustomer.district_id));
    setAreaTypeId(normId(selectedCustomer.area_type_id));

    const level = (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as LocalBodyLevel[])
      .find((lvl) => normId((selectedCustomer as any)[lvl]));
    setLocalBodyType(level ?? "");
    setLocalBodyId(level ? normId((selectedCustomer as any)[level]) : "");
  }, [customerId, selectedCustomer]);

  /* ── handlers: changing an upper level resets the levels below it ── */
  const onStateChange = (v: string) => {
    setStateId(v);
    setDistrictId("");
    setAreaTypeId("");
    setLocalBodyType("");
    setLocalBodyId("");
  };
  const onDistrictChange = (v: string) => {
    setDistrictId(v);
    setAreaTypeId("");
    setLocalBodyType("");
    setLocalBodyId("");
  };
  const onAreaTypeChange = (v: string) => {
    setAreaTypeId(v);
    setLocalBodyType("");
    setLocalBodyId("");
  };
  const onLocalBodyTypeChange = (v: string) => {
    setLocalBodyType((v as LocalBodyLevel) || "");
    setLocalBodyId("");
  };
  const onCustomerChange = (v: string) => {
    userChangedCustomerRef.current = true;
    setCustomerId(v);
  };

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      Swal.fire(t("common.warning"), t("admin.household_collection_event.customer_required"), "warning");
      return;
    }

    const payload: Record<string, unknown> = {
      customer: customerId,
      wet_waste: wetWaste,
      dry_waste: dryWaste,
      mixed_waste: mixedWaste,
      trip_assignment_id: tripAssignmentId || null,
      state_id: stateId || null,
      district_id: districtId || null,
      area_type_id: areaTypeId || null,
      corporation_id: localBodyType === "corporation_id" ? localBodyId || null : null,
      municipality_id: localBodyType === "municipality_id" ? localBodyId || null : null,
      town_panchayat_id: localBodyType === "town_panchayat_id" ? localBodyId || null : null,
      panchayat_union_id: localBodyType === "panchayat_union_id" ? localBodyId || null : null,
      panchayat_id: localBodyType === "panchayat_id" ? localBodyId || null : null,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await wasteCollectionApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await wasteCollectionApi.create(payload);
        Swal.fire(t("common.success"), t("admin.household_collection_event.save_success"), "success");
      }
      navigate(LIST_PATH);
    } catch (err: any) {
      Swal.fire(t("common.save_failed"), extractError(err) ?? t("common.save_failed_desc"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={isEdit ? t("admin.household_collection_event.title_edit") : t("admin.household_collection_event.title_add")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Geography cascade ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* State */}
            <div>
              <Label>{t("common.state")}</Label>
              <Select
                value={stateId}
                onChange={onStateChange}
                options={states.map((s) => ({ value: idOf(s), label: String(s.name ?? s.state_name ?? idOf(s)) }))}
                placeholder={t("common.state")}
              />
            </div>

            {/* District */}
            <div>
              <Label>{t("common.district")}</Label>
              <Select
                value={districtId}
                onChange={onDistrictChange}
                options={filteredDistricts.map((d) => ({ value: idOf(d), label: String(d.district_name ?? d.name ?? idOf(d)) }))}
                placeholder={t("common.district")}
                disabled={!stateId}
              />
            </div>

            {/* Area Type (ULB / RLB) */}
            <div>
              <Label>{t("common.area_type")}</Label>
              <Select
                value={areaTypeId}
                onChange={onAreaTypeChange}
                options={filteredAreaTypes.map((a) => ({ value: idOf(a), label: String(a.area_type_name ?? a.name ?? idOf(a)) }))}
                placeholder={t("common.area_type")}
                disabled={!districtId}
              />
            </div>

            {/* Local Body Type */}
            <div>
              <Label>{t("admin.household_collection_event.local_body_type")}</Label>
              <Select
                value={localBodyType}
                onChange={onLocalBodyTypeChange}
                options={localBodyLevels.map((lvl) => ({ value: lvl, label: LOCAL_BODY_META[lvl].label }))}
                placeholder={t("admin.household_collection_event.local_body_type")}
                disabled={!areaTypeId}
              />
            </div>

            {/* Local Body */}
            <div>
              <Label>{t("admin.household_collection_event.local_body")}</Label>
              <Select
                value={localBodyId}
                onChange={setLocalBodyId}
                options={localBodyOptions}
                placeholder={t("admin.household_collection_event.local_body")}
                disabled={!localBodyType}
              />
            </div>

            {/* Trip Assignment (optional) */}
            <div>
              <Label>{t("admin.household_collection_event.trip_assignment")}</Label>
              <Select
                value={tripAssignmentId}
                onChange={(v) => setTripAssignmentId(v === "__none__" ? "" : v)}
                options={[{ value: "__none__", label: t("admin.household_collection_event.no_trip_assignment") }, ...tripAssignments]}
                placeholder={t("admin.household_collection_event.trip_assignment")}
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ── Household + waste ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer / Household */}
            <div>
              <Label>
                {t("admin.household_collection_event.customer")}
                <span className="text-red-500"> *</span>
              </Label>
              <Select
                value={customerId}
                onChange={onCustomerChange}
                options={filteredCustomers.map((c) => ({ value: resolveCustomerId(c), label: c.customer_name }))}
                placeholder={fetchingCustomers ? t("common.loading") : t("admin.household_collection_event.customer")}
                disabled={fetchingCustomers}
              />
            </div>

            {/* Address (read-only) */}
            <div>
              <Label>{t("admin.household_collection_event.customer_address")}</Label>
              <Input
                disabled
                className="bg-gray-100"
                value={
                  selectedCustomer
                    ? [selectedCustomer.building_no, selectedCustomer.street, selectedCustomer.area]
                        .filter(Boolean)
                        .join(", ")
                    : ""
                }
              />
            </div>

            {/* Dry Waste */}
            <div>
              <Label>{t("admin.household_collection_event.dry_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={dryWaste}
                onChange={(e) => setDryWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Wet Waste */}
            <div>
              <Label>{t("admin.household_collection_event.wet_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={wetWaste}
                onChange={(e) => setWetWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Mixed Waste */}
            <div>
              <Label>{t("admin.household_collection_event.mixed_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={mixedWaste}
                onChange={(e) => setMixedWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Total (read-only, auto-calculated) */}
            <div>
              <Label>{t("admin.household_collection_event.total_quantity")}</Label>
              <Input disabled className="bg-gray-100" value={totalQuantity} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || loadingRecord}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(LIST_PATH)}
              className="rounded-lg bg-red-400 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}

/* Resolve a customer's stable id (unique_id preferred, else pk). */
function resolveCustomerId(c: Customer): string {
  return String(c.unique_id ?? c.id);
}
