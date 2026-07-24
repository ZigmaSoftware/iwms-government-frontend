import type { Customer, GeoRow, Option, WasteCollection } from "./types";
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
  wardApi,
} from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { wasteCollectedDataSchema } from "@/schemas/core_modules/dailyOperations/wasteCollectedData.schema";
import { toSwalMessage } from "@/lib/zodErrors";
import { filterLocalBodyLevelsByScope, mergeWithScopeOptionExtra, scopeFieldState } from "../../../masters/shared/dataScopeOptions";

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
const textOf = (...values: any[]): string => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "";
};
const toList = (res: any): any[] => (Array.isArray(res) ? res : res?.results ?? []);

/* ── local-body levels, keyed by the WasteCollection FK they write to ── */
type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

const SCOPE_LEVEL_BY_LOCAL_BODY: Record<LocalBodyLevel, "corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat"> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

const LOCAL_BODY_META: Record<LocalBodyLevel, { label: string; nameKey: string }> = {
  corporation_id: { label: "Corporation", nameKey: "corporation_name" },
  municipality_id: { label: "Municipality", nameKey: "municipality_name" },
  town_panchayat_id: { label: "Town Panchayat", nameKey: "town_panchayat_name" },
  panchayat_union_id: { label: "Panchayat Union", nameKey: "union_name" },
  panchayat_id: { label: "Panchayat", nameKey: "panchayat_name" },
};

const URBAN_LEVELS: LocalBodyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id"];
const RURAL_LEVELS: LocalBodyLevel[] = ["panchayat_union_id", "panchayat_id"];

const LOCAL_BODY_LEVELS: LocalBodyLevel[] = [
  "corporation_id",
  "municipality_id",
  "town_panchayat_id",
  "panchayat_union_id",
  "panchayat_id",
];

const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value }, ...items];
};

/* Resolve a customer's stable id (unique_id preferred, else pk). */
function resolveCustomerId(c: Customer): string {
  return String(c.unique_id ?? c.id);
}

/* ── shape carrying every field the editor needs to initialise from,
   derived straight from the loaded WasteCollection record (plus its own
   serialized display names) so the form never looks blank on open ── */
type EditorInitial = {
  customerId: string;
  customerLabel: string;
  tripAssignmentId: string;
  tripAssignmentLabel: string;
  stateId: string;
  stateLabel: string;
  districtId: string;
  districtLabel: string;
  areaTypeId: string;
  areaTypeLabel: string;
  localBodyType: LocalBodyLevel | "";
  localBodyId: string;
  localBodyLabel: string;
  wardId: string;
  wetWaste: number;
  dryWaste: number;
  mixedWaste: number;
  sanitaryWaste: number;
  status: string;
  collectionDate: string;
};

// Same status vocabulary as DailyTripHouseholdCollection (daily_trip_household_collection.py)
// — the canonical household-stop status used across the app.
const COLLECTION_STATUS_OPTIONS: Option[] = [
  { value: "Pending", label: "Pending" },
  { value: "Collected", label: "Collected" },
  { value: "Not Available", label: "Not Available" },
  { value: "Collect Later", label: "Collect Later" },
];

const EMPTY_INITIAL: EditorInitial = {
  customerId: "",
  customerLabel: "",
  tripAssignmentId: "",
  tripAssignmentLabel: "",
  stateId: "",
  stateLabel: "",
  districtId: "",
  districtLabel: "",
  areaTypeId: "",
  areaTypeLabel: "",
  localBodyType: "",
  localBodyId: "",
  localBodyLabel: "",
  wardId: "",
  wetWaste: 0,
  dryWaste: 0,
  mixedWaste: 0,
  sanitaryWaste: 0,
  status: "Pending",
  collectionDate: "",
};

const LOCAL_BODY_RECORD_NAME_KEY: Record<LocalBodyLevel, string> = {
  corporation_id: "corporation_name",
  municipality_id: "municipality_name",
  town_panchayat_id: "town_panchayat_name",
  panchayat_union_id: "panchayat_union_name",
  panchayat_id: "panchayat_name",
};

const initialFromRecord = (record: WasteCollection): EditorInitial => {
  const level = LOCAL_BODY_LEVELS.find((lvl) => normId((record as any)[lvl]));
  return {
    customerId: String(record.customer_id ?? record.customer_unique_id ?? record.customer ?? ""),
    customerLabel: textOf(record.customer_name),
    tripAssignmentId: normId((record as any).trip_assignment_id),
    tripAssignmentLabel: textOf((record as any).trip_assignment_display, (record as any).trip_assignment_id),
    stateId: normId((record as any).state_id),
    stateLabel: textOf(record.state_name),
    districtId: normId((record as any).district_id),
    districtLabel: textOf(record.district_name),
    areaTypeId: normId((record as any).area_type_id),
    areaTypeLabel: textOf(record.area_type_name),
    localBodyType: level ?? "",
    localBodyId: level ? normId((record as any)[level]) : "",
    localBodyLabel: level ? textOf((record as any)[LOCAL_BODY_RECORD_NAME_KEY[level]], record.location_name) : "",
    wardId: normId((record as any).ward_id ?? (record as any).ward),
    wetWaste: Number(record.wet_waste) || 0,
    dryWaste: Number(record.dry_waste) || 0,
    mixedWaste: Number(record.mixed_waste) || 0,
    sanitaryWaste: Number(record.sanitary_waste) || 0,
    status: textOf(record.status) || "Pending",
    collectionDate: textOf(record.collection_date),
  };
};

/* ── small/cheap master lists shared by the editor ── */
type MasterData = {
  states: GeoRow[];
  districts: GeoRow[];
  areaTypes: GeoRow[];
  corporations: GeoRow[];
  municipalities: GeoRow[];
  townPanchayats: GeoRow[];
  panchayatUnions: GeoRow[];
  panchayats: GeoRow[];
  wards: GeoRow[];
};

const EMPTY_MASTERS: MasterData = {
  states: [],
  districts: [],
  areaTypes: [],
  corporations: [],
  municipalities: [],
  townPanchayats: [],
  panchayatUnions: [],
  panchayats: [],
  wards: [],
};

type EditorProps = MasterData & {
  initial: EditorInitial;
  isEdit: boolean;
  id?: string;
  listPath: string;
  onDone: () => void;
};

/* ── inner editor: owns all form field state, initialised from `initial`;
   mounted (via a `key` on the record id) only once the record itself has
   loaded, so every useState(initial.xxx) is correct from the first render ── */
function WasteCollectedEditor({
  initial,
  isEdit,
  id,
  listPath,
  onDone,
  states,
  districts,
  areaTypes,
  corporations,
  municipalities,
  townPanchayats,
  panchayatUnions,
  panchayats,
  wards,
}: EditorProps) {
  const { t } = useTranslation();

  /* ── form fields ── */
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [tripAssignmentId, setTripAssignmentId] = useState(initial.tripAssignmentId);

  const [stateId, setStateId] = useState(initial.stateId);
  const [districtId, setDistrictId] = useState(initial.districtId);
  const [areaTypeId, setAreaTypeId] = useState(initial.areaTypeId);
  const [localBodyType, setLocalBodyType] = useState<LocalBodyLevel | "">(initial.localBodyType);
  const [localBodyId, setLocalBodyId] = useState(initial.localBodyId);
  const [wardId, setWardId] = useState(initial.wardId);

  const [wetWaste, setWetWaste] = useState(String(initial.wetWaste || ""));
  const [dryWaste, setDryWaste] = useState(String(initial.dryWaste || ""));
  const [mixedWaste, setMixedWaste] = useState(String(initial.mixedWaste || ""));
  const [sanitaryWaste, setSanitaryWaste] = useState(String(initial.sanitaryWaste || ""));
  const [status, setStatus] = useState(initial.status);
  const [collectionDate, setCollectionDate] = useState(initial.collectionDate);
  const totalQuantity = (Number(wetWaste) || 0) + (Number(dryWaste) || 0) + (Number(mixedWaste) || 0) + (Number(sanitaryWaste) || 0);

  /* ── heavy dropdown data — owned here, fetched scoped to the current geo
     selection (not the whole table), re-fetched whenever that scope changes.
     In edit mode this fires immediately since the geo state above already
     initialises from the record, so the very first fetch is already scoped. ── */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tripAssignments, setTripAssignments] = useState<Option[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A single value in the logged-in user's Data Scope is shown pre-filled and
  // locked. Multiple values remain selectable, restricted to those values.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const localBodyScope = localBodyType
    ? scopeFieldState(SCOPE_LEVEL_BY_LOCAL_BODY[localBodyType])
    : { mode: "unrestricted" as const, options: [] };
  const wardScope = scopeFieldState("ward");

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    if (localBodyScope.mode === "locked" && !localBodyId) setLocalBodyId(localBodyScope.options[0].value);
    if (wardScope.mode === "locked" && wardId !== wardScope.options[0]?.value) setWardId(wardScope.options[0]?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, localBodyScope.mode, stateId, districtId, areaTypeId, localBodyId, wardScope.mode, wardId]);

  // Guards autofill so it only fires on user-initiated selections, not on record load.
  const userChangedCustomerRef = useRef(false);

  const geoParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (stateId) params.state_id = stateId;
    if (districtId) params.district_id = districtId;
    if (areaTypeId) params.area_type_id = areaTypeId;
    if (localBodyType && localBodyId) params[localBodyType] = localBodyId;
    return params;
  }, [stateId, districtId, areaTypeId, localBodyType, localBodyId]);

  const tripAssignmentParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (localBodyType && localBodyId) params[localBodyType] = localBodyId;
    if (collectionDate) params.date = collectionDate;
    if (wardId) params.ward_id = wardId;
    return params;
  }, [localBodyType, localBodyId, collectionDate, wardId]);

  const wardOptions = useMemo(() => ensureOption(
    wards.filter((ward) => (!districtId || normId(ward.district_id) === districtId)
      && (!localBodyType || !localBodyId || (
        String(ward.local_body_type ?? "") === localBodyType.replace("_id", "") &&
        normId(ward.local_body_id) === localBodyId
      )))
      .map((ward) => ({ value: idOf(ward), label: String(ward.ward_name ?? ward.name ?? idOf(ward)) })),
    wardId,
  ), [wards, districtId, localBodyType, localBodyId, wardId]);

  useEffect(() => {
    let cancelled = false;
    setFetchingCustomers(true);
    customerCreationApi.readAll({ params: geoParams })
      .then((res: any) => {
        if (cancelled) return;
        setCustomers(toList(res));
      })
      .catch(() => {
        if (cancelled) return;
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      })
      .finally(() => {
        if (cancelled) return;
        setFetchingCustomers(false);
      });
    return () => { cancelled = true; };
  }, [geoParams, t]);

  useEffect(() => {
  let cancelled = false;
  dailyTripAssignmentApi.readAll({ params: tripAssignmentParams })
    .then((res: any) => {
      if (cancelled) return;
      const mapped = toList(res).map((a) => ({
        value: String(a.unique_id),
        label: String(a.unique_id),
        localBodyByLevel: {
          corporation_id: normId(a.corporation?.unique_id ?? a.corporation),
          municipality_id: normId(a.municipality?.unique_id ?? a.municipality),
          town_panchayat_id: normId(a.town_panchayat?.unique_id ?? a.town_panchayat),
          panchayat_union_id: normId(a.panchayat_union?.unique_id ?? a.panchayat_union),
          panchayat_id: normId(a.panchayat?.unique_id ?? a.panchayat),
        },
        hasHousehold: Boolean(a.collection_types?.has_household),
      }));
      setTripAssignments(mapped);
    })
    .catch((err: any) => {
      console.error("trip assignment fetch FAILED:", err?.response?.status, err?.response?.data ?? err);
    });
  return () => { cancelled = true; };
}, [tripAssignmentParams]);

  /* ── area type kind (urban/rural) drives which local-body levels apply.
     `useState` + effect (not a cold useMemo) so the resolved kind sticks
     across renders where `areaTypeId` is already set but `areaTypes` hasn't
     finished loading yet — otherwise a transient miss briefly widens
     `localBodyLevels` back to the full urban+rural union and lets an
     out-of-scope level slip into the Local Body Type dropdown. ── */
  const [areaTypeKind, setAreaTypeKind] = useState<"urban" | "rural" | "">(() => {
    const at = areaTypes.find((a) => idOf(a) === areaTypeId);
    const name = String(at?.area_type_name ?? at?.name ?? "").toLowerCase();
    if (name.includes("urban")) return "urban";
    if (name.includes("rural")) return "rural";
    return "";
  });
  useEffect(() => {
    if (!areaTypeId) {
      setAreaTypeKind("");
      return;
    }
    const at = areaTypes.find((a) => idOf(a) === areaTypeId);
    if (!at) return;
    const name = String(at.area_type_name ?? at.name ?? "").toLowerCase();
    if (name.includes("urban")) setAreaTypeKind("urban");
    else if (name.includes("rural")) setAreaTypeKind("rural");
    else setAreaTypeKind("");
  }, [areaTypes, areaTypeId]);

  const localBodyLevels = useMemo<LocalBodyLevel[]>(() => {
    if (areaTypeKind === "urban") return URBAN_LEVELS;
    if (areaTypeKind === "rural") return RURAL_LEVELS;
    return [...URBAN_LEVELS, ...RURAL_LEVELS];
  }, [areaTypeKind]);
  const scopedLocalBodyLevels = filterLocalBodyLevelsByScope(
    localBodyLevels.map((lvl) => ({ value: lvl })),
  ).map((lvl) => lvl.value);
  useEffect(() => {
    if (scopedLocalBodyLevels.length === 1 && localBodyType !== scopedLocalBodyLevels[0]) {
      setLocalBodyType(scopedLocalBodyLevels[0]);
      setLocalBodyId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedLocalBodyLevels.map((level) => level).join("|")]);

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
    const mapped = rows
      .filter((row) => {
        if (areaTypeId && normId(row.area_type_id) === areaTypeId) return true;
        if (districtId) return normId(row.district_id) === districtId;
        return true;
      })
      .map((row) => ({ value: idOf(row), label: String(row[nameKey] ?? row.name ?? idOf(row)) }));
    const label = localBodyId === initial.localBodyId ? initial.localBodyLabel : undefined;
    const scoped = mergeWithScopeOptionExtra(
      mapped,
      SCOPE_LEVEL_BY_LOCAL_BODY[localBodyType],
      {},
    );
    return ensureOption(scoped, localBodyId, label);
  }, [localBodyType, localBodyRowsByLevel, areaTypeId, districtId, localBodyId, initial.localBodyId, initial.localBodyLabel]);

  const stateOptions = useMemo(() => mergeWithScopeOptionExtra(
    states.map((s) => ({ value: idOf(s), label: String(s.name ?? s.state_name ?? idOf(s)) })),
    "state",
    {},
  ), [states]);
  const districtOptions = useMemo(() => mergeWithScopeOptionExtra(
    filteredDistricts.map((d) => ({ value: idOf(d), label: String(d.district_name ?? d.name ?? idOf(d)) })),
    "district",
    {},
  ), [filteredDistricts]);
  const areaTypeOptions = useMemo(() => mergeWithScopeOptionExtra(
    filteredAreaTypes.map((a) => ({ value: idOf(a), label: String(a.area_type_name ?? a.name ?? idOf(a)) })),
    "area_type",
    {},
  ), [filteredAreaTypes]);

  /* ── trip assignments scoped to household-collection trips, filtered by the
     chosen local body (selected one always kept) ── */
  const filteredTripAssignments = useMemo(() => {
    const householdOnly = tripAssignments.filter((a) => a.hasHousehold);
    const matches = localBodyType && localBodyId
      ? householdOnly.filter((a) => a.localBodyByLevel?.[localBodyType] === localBodyId)
      : householdOnly;
    const selected = tripAssignments.find((a) => a.value === tripAssignmentId);
    if (selected && !matches.some((a) => a.value === tripAssignmentId)) {
      return [selected, ...matches];
    }
    const label = tripAssignmentId === initial.tripAssignmentId ? initial.tripAssignmentLabel : undefined;
    return ensureOption(matches, tripAssignmentId, label);
  }, [tripAssignments, localBodyType, localBodyId, tripAssignmentId, initial.tripAssignmentId, initial.tripAssignmentLabel]);

  /* ── households filtered by the chosen geography (selected one always kept) ── */
  const filteredCustomers = useMemo(() => {
    const matches = customers.filter((c) => {
      if (districtId && normId(c.district_id) !== districtId) return false;
      if (areaTypeId && normId(c.area_type_id) !== areaTypeId) return false;
      if (localBodyType && localBodyId && normId(c[localBodyType]) !== localBodyId) return false;
      if (wardId && normId((c as any).ward_id ?? (c as any).ward) !== wardId) return false;
      return true;
    });
    const selected = customers.find((c) => resolveCustomerId(c) === customerId);
    if (selected && !matches.some((c) => resolveCustomerId(c) === customerId)) {
      return [selected, ...matches];
    }
    return matches;
  }, [customers, districtId, areaTypeId, localBodyType, localBodyId, wardId, customerId]);

  const selectedCustomer = customers.find((c) => resolveCustomerId(c) === customerId);

  const customerOptions = useMemo(() => {
    const mapped: Option[] = filteredCustomers.map((c) => ({
      value: resolveCustomerId(c),
      label: c.customer_name,
    }));
    const label = customerId === initial.customerId ? initial.customerLabel : undefined;
    return ensureOption(mapped, customerId, label);
  }, [filteredCustomers, customerId, initial.customerId, initial.customerLabel]);

  const customerAddress = useMemo(() => {
    if (selectedCustomer) {
      return [selectedCustomer.building_no, selectedCustomer.street, selectedCustomer.area]
        .filter(Boolean)
        .join(", ");
    }
    return "";
  }, [selectedCustomer]);

  /* ── autofill geography from the selected household (user-initiated only) ── */
  useEffect(() => {
    if (!userChangedCustomerRef.current) return;
    userChangedCustomerRef.current = false;
    if (!selectedCustomer) return;

    setStateId(normId(selectedCustomer.state_id));
    setDistrictId(normId(selectedCustomer.district_id));
    setAreaTypeId(normId(selectedCustomer.area_type_id));

    const level = LOCAL_BODY_LEVELS.find((lvl) => normId((selectedCustomer as any)[lvl]));
    setLocalBodyType(level ?? "");
    setLocalBodyId(level ? normId((selectedCustomer as any)[level]) : "");
    setWardId(normId((selectedCustomer as any).ward_id ?? (selectedCustomer as any).ward));
  }, [customerId, selectedCustomer]);

  /* ── handlers: changing an upper level resets the levels below it,
     including the Trip Assignment (it's scoped to the Local Body). ── */
  const onStateChange = (v: string) => {
    setStateId(v);
    setDistrictId("");
    setAreaTypeId("");
    setLocalBodyType("");
    setLocalBodyId("");
    setTripAssignmentId("");
  };
  const onDistrictChange = (v: string) => {
    setDistrictId(v);
    setAreaTypeId("");
    setLocalBodyType("");
    setLocalBodyId("");
    setTripAssignmentId("");
  };
  const onAreaTypeChange = (v: string) => {
    setAreaTypeId(v);
    setLocalBodyType("");
    setLocalBodyId("");
    setTripAssignmentId("");
  };
  const onLocalBodyTypeChange = (v: string) => {
    setLocalBodyType((v as LocalBodyLevel) || "");
    setLocalBodyId("");
    setTripAssignmentId("");
  };
  const onLocalBodyChange = (v: string) => {
    setLocalBodyId(v);
    setTripAssignmentId("");
  };
  const onCustomerChange = (v: string) => {
    userChangedCustomerRef.current = true;
    setCustomerId(v);
  };

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = wasteCollectedDataSchema.safeParse({
      customerId,
      collectionDate,
      wetWaste,
      dryWaste,
      mixedWaste,
      sanitaryWaste,
    });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const payload: Record<string, unknown> = {
      customer: customerId,
      wet_waste: Number(wetWaste) || 0,
      dry_waste: Number(dryWaste) || 0,
      mixed_waste: Number(mixedWaste) || 0,
      sanitary_waste: Number(sanitaryWaste) || 0,
      status,
      collection_date: collectionDate,
      trip_assignment_id: tripAssignmentId || null,
      state_id: stateId || null,
      district_id: districtId || null,
      area_type_id: areaTypeId || null,
      corporation_id: localBodyType === "corporation_id" ? localBodyId || null : null,
      municipality_id: localBodyType === "municipality_id" ? localBodyId || null : null,
      town_panchayat_id: localBodyType === "town_panchayat_id" ? localBodyId || null : null,
      panchayat_union_id: localBodyType === "panchayat_union_id" ? localBodyId || null : null,
      panchayat_id: localBodyType === "panchayat_id" ? localBodyId || null : null,
      ward_id: wardId || null,
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
      onDone();
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
                options={ensureOption(stateOptions, stateId, stateId === initial.stateId ? initial.stateLabel : undefined)}
                placeholder={t("common.state")}
                disabled={stateScope.mode === "locked"}
              />
            </div>

            {/* District */}
            <div>
              <Label>{t("common.district")}</Label>
              <Select
                value={districtId}
                onChange={onDistrictChange}
                options={ensureOption(districtOptions, districtId, districtId === initial.districtId ? initial.districtLabel : undefined)}
                placeholder={t("common.district")}
                disabled={!stateId || districtScope.mode === "locked"}
              />
            </div>

            {/* Area Type (ULB / RLB) */}
            <div>
              <Label>{t("common.area_type")}</Label>
              <Select
                value={areaTypeId}
                onChange={onAreaTypeChange}
                options={ensureOption(areaTypeOptions, areaTypeId, areaTypeId === initial.areaTypeId ? initial.areaTypeLabel : undefined)}
                placeholder={t("common.area_type")}
                disabled={!districtId || areaTypeScope.mode === "locked"}
              />
            </div>

            {/* Local Body Type */}
            <div>
              <Label>{t("admin.household_collection_event.local_body_type")}</Label>
              <Select
                value={localBodyType}
                onChange={onLocalBodyTypeChange}
                options={scopedLocalBodyLevels.map((lvl) => ({ value: lvl, label: LOCAL_BODY_META[lvl].label }))}
                placeholder={t("admin.household_collection_event.local_body_type")}
                disabled={!areaTypeId || scopedLocalBodyLevels.length === 1}
              />
            </div>

            {/* Local Body */}
            <div>
              <Label>{t("admin.household_collection_event.local_body")}</Label>
              <Select
                value={localBodyId}
                onChange={onLocalBodyChange}
                options={localBodyOptions}
                placeholder={t("admin.household_collection_event.local_body")}
                disabled={!localBodyType || localBodyScope.mode === "locked"}
              />
            </div>

            {/* Ward */}
            <div>
              <Label>Ward</Label>
              <Select
                value={wardId}
                onChange={(v) => { setWardId(String(v)); setTripAssignmentId(""); }}
                options={wardScope.mode === "unrestricted" ? wardOptions : wardScope.options}
                placeholder="Select Ward"
                disabled={!localBodyId || wardScope.mode === "locked"}
              />
            </div>

            {/* Collection Date */}
            <div>
              <Label>
                {t("admin.household_collection_event.collection_date")}
                <span className="text-red-500"> *</span>
              </Label>
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>

            {/* Trip Assignment (optional) */}
            <div>
              <Label>{t("admin.household_collection_event.trip_assignment")}</Label>
              <Select
                value={tripAssignmentId}
                onChange={(v) => setTripAssignmentId(v === "__none__" ? "" : v)}
                options={[{ value: "__none__", label: t("admin.household_collection_event.no_trip_assignment") }, ...filteredTripAssignments]}
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
                options={customerOptions}
                placeholder={fetchingCustomers ? t("common.loading") : t("admin.household_collection_event.customer")}
                disabled={fetchingCustomers}
              />
            </div>

            {/* Address (read-only) */}
            <div>
              <Label>{t("admin.household_collection_event.customer_address")}</Label>
              <Input disabled className="bg-gray-100" value={customerAddress} />
            </div>

            {/* Dry Waste */}
            <div>
              <Label>{t("admin.household_collection_event.dry_waste")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={dryWaste}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setDryWaste(e.target.value); }}
              />
            </div>

            {/* Wet Waste */}
            <div>
              <Label>{t("admin.household_collection_event.wet_waste")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={wetWaste}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setWetWaste(e.target.value); }}
              />
            </div>

            {/* Mixed Waste */}
            <div>
              <Label>{t("admin.household_collection_event.mixed_waste")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={mixedWaste}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setMixedWaste(e.target.value); }}
              />
            </div>

            {/* Sanitary Waste */}
            <div>
              <Label>{t("admin.household_collection_event.sanitary_waste")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={sanitaryWaste}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setSanitaryWaste(e.target.value); }}
              />
            </div>

            {/* Total (read-only, auto-calculated) */}
            <div>
              <Label>{t("admin.household_collection_event.total_quantity")}</Label>
              <Input disabled className="bg-gray-100" value={totalQuantity} />
            </div>

            {/* Status */}
            <div>
              <Label>{t("admin.household_collection_event.status")}</Label>
              <Select
                value={status}
                onChange={(v) => setStatus(String(v))}
                options={COLLECTION_STATUS_OPTIONS}
                placeholder={t("admin.household_collection_event.status")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={onDone}
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

/* ── outer wrapper: loads the small/cheap geo master lists eagerly, and (in
   edit mode) fetches the single record being edited — a fast one-row fetch,
   independent of the heavy customer/trip-assignment lists — so the editor
   can mount pre-filled with the record's own values immediately. ── */
export default function WasteCollectedForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { encScheduleOperations, encWasteCollectedData } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleOperations, encWasteCollectedData);

  const [masters, setMasters] = useState<MasterData>(EMPTY_MASTERS);
  const [record, setRecord] = useState<WasteCollection | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  /* ── load small/cheap geo master lists (not customers/trip-assignments —
     those are large and fetched by the editor itself, scoped by geo) ── */
  useEffect(() => {
    stateApi.readAll().then((r: any) => setMasters((m) => ({ ...m, states: toList(r) }))).catch(() => {});
    districtApi.readAll().then((r: any) => setMasters((m) => ({ ...m, districts: toList(r) }))).catch(() => {});
    areaTypeApi.readAll().then((r: any) => setMasters((m) => ({ ...m, areaTypes: toList(r) }))).catch(() => {});
    corporationApi.readAll().then((r: any) => setMasters((m) => ({ ...m, corporations: toList(r) }))).catch(() => {});
    municipalityApi.readAll().then((r: any) => setMasters((m) => ({ ...m, municipalities: toList(r) }))).catch(() => {});
    townPanchayatApi.readAll().then((r: any) => setMasters((m) => ({ ...m, townPanchayats: toList(r) }))).catch(() => {});
    panchayatUnionApi.readAll().then((r: any) => setMasters((m) => ({ ...m, panchayatUnions: toList(r) }))).catch(() => {});
    panchayatApi.readAll().then((r: any) => setMasters((m) => ({ ...m, panchayats: toList(r) }))).catch(() => {});
    wardApi.readAll().then((r: any) => setMasters((m) => ({ ...m, wards: toList(r) }))).catch(() => {});
  }, []);

  /* ── edit mode: load the single record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    wasteCollectionApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecord(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? t("common.load_failed") });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  if (isEdit && (loadingRecord || !record)) {
    return (
      <div className="p-3">
        <ComponentCard title={t("admin.household_collection_event.title_edit")}>
          <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
        </ComponentCard>
      </div>
    );
  }

  const initial = isEdit && record ? initialFromRecord(record) : EMPTY_INITIAL;
  const editorKey = isEdit ? String(record?.unique_id ?? id) : "new";

  return (
    <WasteCollectedEditor
      key={editorKey}
      initial={initial}
      isEdit={isEdit}
      id={id}
      listPath={LIST_PATH}
      onDone={() => navigate(LIST_PATH)}
      {...masters}
    />
  );
}
