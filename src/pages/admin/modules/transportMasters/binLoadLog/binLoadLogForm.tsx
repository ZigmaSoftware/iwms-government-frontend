import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Option = { value: string; label: string };

const toOptions = (items: any[], labelKey: string): Option[] =>
  items.map((item) => ({ value: String(item?.unique_id ?? item?.id ?? ""), label: String(item?.[labelKey] ?? item?.unique_id ?? "") })).filter((item) => item.value);

export default function BinLoadLogForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encTransportMaster, encBinLoadLog } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encTransportMaster, encBinLoadLog);
  const [vehicleId, setVehicleId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [subPropertyId, setSubPropertyId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [subProperties, setSubProperties] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([adminApi.vehicleCreations.readAll(), adminApi.properties.readAll(), adminApi.subProperties.readAll()])
      .then(([vehicleRes, propertyRes, subPropertyRes]) => {
        setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
        setProperties(toOptions(normalizeList(propertyRes), "property_name"));
        setSubProperties(toOptions(normalizeList(subPropertyRes), "sub_property_name"));
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    adminApi.binLoadLogs.read(id).then((record: any) => {
      setVehicleId(String(record.vehicle_id ?? record.vehicle_details?.unique_id ?? ""));
      setPropertyId(String(record.property_id ?? record.property_details?.unique_id ?? ""));
      setSubPropertyId(String(record.sub_property_id ?? record.sub_property_details?.unique_id ?? ""));
      setWeightKg(String(record.weight_kg ?? ""));
      setSourceType(String(record.source_type ?? ""));
      setEventTime(record.event_time ? String(record.event_time).slice(0, 16) : "");
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = { vehicle_id: vehicleId, property_id: propertyId, sub_property_id: subPropertyId, weight_kg: weightKg, source_type: sourceType, event_time: eventTime };
    try {
      if (isEdit && id) await adminApi.binLoadLogs.update(id, payload);
      else await adminApi.binLoadLogs.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin Load Log" : "Create Bin Load Log"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><Label>Vehicle</Label><Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" /></div>
        <div><Label>Property</Label><Select value={propertyId} onChange={(v) => setPropertyId(String(v))} options={properties} placeholder="Select Property" /></div>
        <div><Label>Sub Property</Label><Select value={subPropertyId} onChange={(v) => setSubPropertyId(String(v))} options={subProperties} placeholder="Select Sub Property" /></div>
        <div><Label>Weight Kg</Label><Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></div>
        <div><Label>Source Type</Label><Select value={sourceType} onChange={(v) => setSourceType(String(v))} options={[{ value: "WEIGHBRIDGE", label: "Weighbridge" }, { value: "SENSOR", label: "Sensor" }, { value: "MANUAL", label: "Manual" }]} placeholder="Select Source" /></div>
        <div><Label>Event Time</Label><Input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} /></div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
