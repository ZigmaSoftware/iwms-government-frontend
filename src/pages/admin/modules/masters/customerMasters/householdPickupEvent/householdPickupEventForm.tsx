import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { createCrudHelpers, customerCreationApi, propertiesApi, subPropertiesApi, userCreationApi, vehicleCreationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Option = { value: string; label: string };
type RecordRow = Record<string, any>;

const householdPickupEventApi = createCrudHelpers<RecordRow>("customer-masters/household-pickup-events");

const toOptions = (items: any[], labelKey: string): Option[] =>
  items.map((item) => ({ value: String(item?.unique_id ?? item?.id ?? ""), label: String(item?.[labelKey] ?? item?.unique_id ?? "") })).filter((item) => item.value);

export default function HouseholdPickupEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encCustomerMaster, encHouseholdPickupEvent } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encCustomerMaster, encHouseholdPickupEvent);
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [subPropertyId, setSubPropertyId] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [collectorStaffId, setCollectorStaffId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [source, setSource] = useState("");
  const [customers, setCustomers] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [subProperties, setSubProperties] = useState<Option[]>([]);
  const [collectors, setCollectors] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([customerCreationApi.readAll(), propertiesApi.readAll(), subPropertiesApi.readAll(), userCreationApi.readAll(), vehicleCreationApi.readAll()])
      .then(([customerRes, propertyRes, subPropertyRes, userRes, vehicleRes]) => {
        setCustomers(toOptions(normalizeList(customerRes), "customer_name"));
        setProperties(toOptions(normalizeList(propertyRes), "property_name"));
        setSubProperties(toOptions(normalizeList(subPropertyRes), "sub_property_name"));
        setCollectors(toOptions(normalizeList(userRes), "staff_name"));
        setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    householdPickupEventApi.read(id).then((record) => {
      setCustomerId(String(record.customer_id ?? ""));
      setPropertyId(String(record.property_id ?? ""));
      setSubPropertyId(String(record.sub_property_id ?? ""));
      setPickupTime(record.pickup_time ? String(record.pickup_time).slice(0, 16) : "");
      setWeightKg(String(record.weight_kg ?? ""));
      setCollectorStaffId(String(record.collector_staff_id ?? ""));
      setVehicleId(String(record.vehicle_id ?? ""));
      setSource(String(record.source ?? ""));
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = { customer_id: customerId, property_id: propertyId, sub_property_id: subPropertyId, pickup_time: pickupTime, weight_kg: weightKg, collector_staff_id: collectorStaffId, vehicle_id: vehicleId, source };
    try {
      if (isEdit && id) await householdPickupEventApi.update(id, payload);
      else await householdPickupEventApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Household Pickup Event" : "Create Household Pickup Event"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><Label>Customer</Label><Select value={customerId} onChange={(v) => setCustomerId(String(v))} options={customers} placeholder="Select Customer" /></div>
        <div><Label>Property</Label><Select value={propertyId} onChange={(v) => setPropertyId(String(v))} options={properties} placeholder="Select Property" /></div>
        <div><Label>Sub Property</Label><Select value={subPropertyId} onChange={(v) => setSubPropertyId(String(v))} options={subProperties} placeholder="Select Sub Property" /></div>
        <div><Label>Pickup Time</Label><Input type="datetime-local" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} /></div>
        <div><Label>Weight Kg</Label><Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></div>
        <div><Label>Collector</Label><Select value={collectorStaffId} onChange={(v) => setCollectorStaffId(String(v))} options={collectors} placeholder="Select Collector" /></div>
        <div><Label>Vehicle</Label><Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" /></div>
        <div><Label>Source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} /></div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
