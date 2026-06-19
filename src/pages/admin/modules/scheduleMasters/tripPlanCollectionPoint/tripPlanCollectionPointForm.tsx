import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  collectionPointApi,
  customerCreationApi,
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
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";
type TripPlanOption = Option & { hierarchyField?: HierarchyLevel; hierarchyId?: string };

const collectionTypes = [
  { value: "bin_collection", label: "Bin Collection" },
  { value: "household_collection", label: "Household Collection" },
];

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.display_code ?? item?.customer_name ?? item?.unique_id ?? ""),
      corporation_id: String(item?.corporation_id ?? item?.hierarchy?.corporation_id ?? ""),
      municipality_id: String(item?.municipality_id ?? item?.hierarchy?.municipality_id ?? ""),
      town_panchayat_id: String(item?.town_panchayat_id ?? item?.hierarchy?.town_panchayat_id ?? ""),
      panchayat_union_id: String(item?.panchayat_union_id ?? item?.hierarchy?.panchayat_union_id ?? ""),
      panchayat_id: String(item?.panchayat_id ?? item?.hierarchy?.panchayat_id ?? item?.panchayat?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

const hierarchyFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];
const toTripPlanOptions = (items: any[]): TripPlanOption[] =>
  items.map((item) => {
    const field = hierarchyFields.find((key) => String(item?.[key] ?? item?.hierarchy?.[key] ?? ""));
    return {
      value: String(item?.unique_id ?? ""),
      label: String(item?.display_code ?? item?.unique_id ?? ""),
      hierarchyField: field,
      hierarchyId: field ? String(item?.[field] ?? item?.hierarchy?.[field] ?? "") : "",
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
  const [customerId, setCustomerId] = useState("");
  const [sequence, setSequence] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [tripPlans, setTripPlans] = useState<TripPlanOption[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [bins, setBins] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      tripPlanApi.readAll(),
      collectionPointApi.readAll(),
      adminApi.bins.readAll(),
      customerCreationApi.readAll(),
    ]).then(([planRes, cpRes, binRes, customerRes]) => {
      setTripPlans(toTripPlanOptions(normalizeList(planRes)));
      setCollectionPoints(toOptions(normalizeList(cpRes), "cp_name"));
      setBins(toOptions(normalizeList(binRes), "bin_name"));
      setCustomers(toOptions(normalizeList(customerRes), "customer_name"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    tripPlanCollectionPointApi.read(id).then((record: ApiRecord) => {
      setTripPlanId(String(record.trip_plan_id ?? ""));
      setCollectionType(String(record.collection_type ?? "bin_collection"));
      setCollectionPointId(String(record.collection_point_id ?? ""));
      setBinId(String(record.bin_id ?? ""));
      setCustomerId(String(record.customer_id ?? ""));
      setSequence(String(record.sequence ?? "1"));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const selectedTripPlan = tripPlans.find((item) => item.value === tripPlanId);
  const filterByTripHierarchy = (items: Option[]) => {
    if (!selectedTripPlan?.hierarchyField || !selectedTripPlan.hierarchyId) return items;
    return items.filter((item) => item[selectedTripPlan.hierarchyField!] === selectedTripPlan.hierarchyId);
  };
  const filteredCollectionPoints = filterByTripHierarchy(collectionPoints);
  const filteredCustomers = filterByTripHierarchy(customers);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripPlanId || !collectionType) {
      Swal.fire("Missing details", "Trip Plan and Collection Type are required.", "warning");
      return;
    }
    if (collectionType === "bin_collection" && !collectionPointId) {
      Swal.fire("Missing details", "Collection Point is required for bin collection.", "warning");
      return;
    }
    if (collectionType === "household_collection" && !customerId) {
      Swal.fire("Missing details", "Customer is required for household collection.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_plan_id: tripPlanId,
      collection_type: collectionType,
      collection_point_id: collectionType === "bin_collection" ? collectionPointId : null,
      bin_id: collectionType === "bin_collection" ? binId || null : null,
      customer_id: collectionType === "household_collection" ? customerId : null,
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
        <div><Label>Trip Plan *</Label><Select value={tripPlanId} onChange={(v) => { setTripPlanId(String(v)); setCollectionPointId(""); setCustomerId(""); }} options={tripPlans} placeholder="Select Trip Plan" /></div>
        <div><Label>Collection Type *</Label><Select value={collectionType} onChange={(v) => setCollectionType(String(v))} options={collectionTypes} placeholder="Select Type" /></div>
        {collectionType === "bin_collection" && (
          <>
            <div><Label>Collection Point *</Label><Select value={collectionPointId} onChange={(v) => setCollectionPointId(String(v))} options={filteredCollectionPoints} placeholder="Select Collection Point" /></div>
            <div><Label>Bin</Label><Select value={binId} onChange={(v) => setBinId(String(v))} options={bins} placeholder="Select Bin" /></div>
          </>
        )}
        {collectionType === "household_collection" && (
          <div><Label>Customer *</Label><Select value={customerId} onChange={(v) => setCustomerId(String(v))} options={filteredCustomers} placeholder="Select Customer" /></div>
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
