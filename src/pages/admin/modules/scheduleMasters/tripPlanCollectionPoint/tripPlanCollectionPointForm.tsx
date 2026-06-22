import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  collectionPointApi,
  tripPlanApi,
  tripPlanCollectionPointApi,
} from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Option = {
  value: string;
  label: string;
  collectionPointId?: string;
  wasteTypeId?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";
type TripPlanOption = Option & { collectionType?: string; wasteTypeId?: string; hierarchyField?: HierarchyLevel; hierarchyId?: string; hierarchyLabel?: string };

const collectionTypes = [
  { value: "bin_collection", label: "Secondary Collection Point" },
  { value: "household_collection", label: "Household Collection" },
  { value: "bulk_waste_collection", label: "Bulk Waste Collection" },
];

const hierarchyLabels: Record<HierarchyLevel, string> = {
  corporation_id: "Corporation",
  municipality_id: "Municipality",
  town_panchayat_id: "Town Panchayat",
  panchayat_union_id: "Panchayat Union",
  panchayat_id: "Panchayat / PLB",
};

const idOf = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String(value.unique_id ?? value.id ?? value.value ?? "");
  }
  return String(value);
};

const textOf = (...values: any[]): string => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "";
};

const ensureOption = <T extends Option>(items: T[], value: string, label?: string): T[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value } as T, ...items];
};

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: idOf(item?.unique_id ?? item?.id),
      label: textOf(item?.[labelKey], item?.display_code, item?.customer_name, item?.unique_id),
      collectionPointId: idOf(item?.collection_point_id ?? item?.collection_point),
      wasteTypeId: idOf(item?.wastetype_id ?? item?.waste_type_id ?? item?.waste_type),
      corporation_id: idOf(item?.corporation_id ?? item?.hierarchy?.corporation_id),
      municipality_id: idOf(item?.municipality_id ?? item?.hierarchy?.municipality_id),
      town_panchayat_id: idOf(item?.town_panchayat_id ?? item?.hierarchy?.town_panchayat_id),
      panchayat_union_id: idOf(item?.panchayat_union_id ?? item?.hierarchy?.panchayat_union_id),
      panchayat_id: idOf(item?.panchayat_id ?? item?.hierarchy?.panchayat_id ?? item?.panchayat),
    }))
    .filter((item) => item.value);

const hierarchyFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];
const toTripPlanOptions = (items: any[]): TripPlanOption[] =>
  items.map((item) => {
    const field = hierarchyFields.find((key) => idOf(item?.[key] ?? item?.hierarchy?.[key]));
    const hierarchy = field
      ? item?.[field.replace("_id", "")] ?? item?.[field.replace("_id", "") as keyof typeof item]
      : null;
    const hierarchyName =
      hierarchy?.corporation_name ??
      hierarchy?.municipality_name ??
      hierarchy?.town_panchayat_name ??
      hierarchy?.union_name ??
      hierarchy?.panchayat_name ??
      "";
    return {
      value: idOf(item?.unique_id),
      label: textOf(item?.display_code, item?.unique_id),
      collectionType: String(item?.collection_type ?? "bin_collection"),
      wasteTypeId: idOf(item?.waste_type_id ?? item?.waste_type),
      hierarchyField: field,
      hierarchyId: field ? idOf(item?.[field] ?? item?.hierarchy?.[field]) : "",
      hierarchyLabel: field ? `${hierarchyLabels[field]}${hierarchyName ? ` - ${hierarchyName}` : ""}` : "",
    };
  }).filter((item) => item.value);

export default function TripPlanCollectionPointForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleMasters, encTripPlanCollectionPoints } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encTripPlanCollectionPoints);

  const [tripPlanId, setTripPlanId] = useState("");
  const [collectionType, setCollectionType] = useState("bin_collection");
  const [collectionPointId, setCollectionPointId] = useState("");
  const [binId, setBinId] = useState("");
  const [sequence, setSequence] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [tripPlans, setTripPlans] = useState<TripPlanOption[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [bins, setBins] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  // Track whether the edit record has been loaded; prevents the trip plan effect
  // from clearing collection point / bin that were just pre-filled from the record.
  const [editLoaded, setEditLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      tripPlanApi.readAll(),
      collectionPointApi.readAll(),
      adminApi.bins.readAll(),
    ]).then(([planRes, cpRes, binRes]) => {
      setTripPlans(toTripPlanOptions(normalizeList(planRes)));
      setCollectionPoints(toOptions(normalizeList(cpRes), "cp_name"));
      setBins(toOptions(normalizeList(binRes), "bin_name"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    tripPlanCollectionPointApi.read(id).then((record: ApiRecord) => {
      const nextTripPlanId = idOf(record.trip_plan_id ?? record.trip_plan);
      const nextCollectionPointId = idOf(record.collection_point_id ?? record.collection_point);
      const nextBinId = idOf(record.bin_id ?? record.bin);
      setTripPlanId(nextTripPlanId);
      setCollectionType(String(record.collection_type ?? "bin_collection"));
      setCollectionPointId(nextCollectionPointId);
      setBinId(nextBinId);
      setSequence(String(record.sequence ?? "1"));
      setIsActive(record.is_active !== false);
      setTripPlans((items) => ensureOption(items, nextTripPlanId, record.trip_plan?.display_code));
      setCollectionPoints((items) => ensureOption(items, nextCollectionPointId, record.collection_point?.cp_name));
      setBins((items) => ensureOption(items, nextBinId, record.bin?.bin_name));
      setEditLoaded(true);
    });
  }, [id]);

  const selectedTripPlan = tripPlans.find((item) => item.value === tripPlanId);
  useEffect(() => {
    if (!selectedTripPlan?.collectionType) return;
    setCollectionType(selectedTripPlan.collectionType);
    // Only clear the collection point and bin when the user actively changes
    // the trip plan (not during initial edit pre-fill).
    if (!editLoaded) {
      setCollectionPointId("");
      setBinId("");
    }
  }, [selectedTripPlan?.collectionType]);

  const filterByTripHierarchy = (items: Option[]) => {
    if (!selectedTripPlan?.hierarchyField || !selectedTripPlan.hierarchyId) return items;
    return items.filter((item) => item[selectedTripPlan.hierarchyField!] === selectedTripPlan.hierarchyId);
  };
  const currentCollectionPoint = collectionPoints.find((item) => item.value === collectionPointId);
  const currentBin = bins.find((item) => item.value === binId);
  const filteredCollectionPoints = ensureOption(
    filterByTripHierarchy(collectionPoints),
    collectionPointId,
    currentCollectionPoint?.label,
  );
  const filteredBins = bins.filter((item) => {
    if (collectionPointId && item.collectionPointId && item.collectionPointId !== collectionPointId) return false;
    if (selectedTripPlan?.wasteTypeId && item.wasteTypeId && item.wasteTypeId !== selectedTripPlan.wasteTypeId) return false;
    return true;
  });
  const filteredBinsWithCurrent = ensureOption(filteredBins, binId, currentBin?.label);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripPlanId || !collectionType) {
      Swal.fire("Missing details", "Trip Plan and Collection Type are required.", "warning");
      return;
    }
    if (collectionType === "bin_collection" && (!collectionPointId || !binId)) {
      Swal.fire("Missing details", "Collection Point and Bin are required for bin collection.", "warning");
      return;
    }
    if (["household_collection", "bulk_waste_collection"].includes(collectionType) && !selectedTripPlan?.hierarchyField) {
      Swal.fire("Missing details", "Select a Trip Plan assigned to Municipality, Town Panchayat, Panchayat Union or Panchayat/PLB.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_plan_id: tripPlanId,
      collection_type: collectionType,
      collection_point_id: collectionType === "bin_collection" ? collectionPointId : null,
      bin_id: collectionType === "bin_collection" ? binId || null : null,
      customer_id: null,
      sequence,
      is_active: isActive,
    };
    try {
      if (isEdit && id) await tripPlanCollectionPointApi.update(id, payload);
      else await tripPlanCollectionPointApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Trip Plan Stop" : "Create Trip Plan Stop"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><Label>Trip Plan *</Label><Select value={tripPlanId} onChange={(v) => { setTripPlanId(String(v)); setCollectionPointId(""); setBinId(""); setEditLoaded(false); }} options={tripPlans} placeholder="Select Trip Plan" /></div>
        <div><Label>Collection Type *</Label><Select value={collectionType} onChange={() => undefined} options={collectionTypes} placeholder="Select Type" disabled /></div>
        {collectionType === "bin_collection" && (
          <>
            <div><Label>Collection Point *</Label><Select value={collectionPointId} onChange={(v) => { setCollectionPointId(String(v)); setBinId(""); }} options={filteredCollectionPoints} placeholder="Select Collection Point" /></div>
            <div><Label>Bin *</Label><Select value={binId} onChange={(v) => setBinId(String(v))} options={filteredBinsWithCurrent} placeholder="Select Bin" /></div>
          </>
        )}
        {["household_collection", "bulk_waste_collection"].includes(collectionType) && (
          <div className="rounded-md border bg-gray-50 p-4 md:col-span-2">
            <Label>{collectionType === "bulk_waste_collection" ? "Bulk Waste Assignment Local Body" : "Household Assignment Local Body"}</Label>
            <div className="mt-2 text-sm text-gray-700">
              {selectedTripPlan?.hierarchyLabel ||
                `Select a Trip Plan. ${collectionType === "bulk_waste_collection" ? "Bulk waste" : "Household"} daily records will be generated for customers under its local body.`}
            </div>
          </div>
        )}
        <div><Label>Sequence</Label><Input type="number" value={sequence} onChange={(e) => setSequence(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
