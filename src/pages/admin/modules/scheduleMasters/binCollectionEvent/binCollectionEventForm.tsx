import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  binCollectionEventApi,
  dailyTripAssignmentApi,
  dailyTripCollectionPointApi,
  panchayatApi,
} from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Option = { value: string; label: string; panchayatId?: string };
type ApiRecord = Record<string, any>;

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.display_code ?? item?.unique_id ?? item?.id ?? ""),
      panchayatId: String(item?.panchayat_id ?? item?.panchayat?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

export default function BinCollectionEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleMasters, encBinCollectionEvent } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encBinCollectionEvent);

  const [tripAssignmentId, setTripAssignmentId] = useState("");
  const [tripCollectionPointId, setTripCollectionPointId] = useState("");
  const [binId, setBinId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [collectedWeightKg, setCollectedWeightKg] = useState("");
  const [driverLatitude, setDriverLatitude] = useState("");
  const [driverLongitude, setDriverLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [assignments, setAssignments] = useState<Option[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [bins, setBins] = useState<Option[]>([]);
  const [panchayats, setPanchayats] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      dailyTripAssignmentApi.readAll(),
      dailyTripCollectionPointApi.readAll(),
      adminApi.bins.readAll(),
      panchayatApi.readAll(),
    ]).then(([assignmentRes, cpRes, binRes, panchayatRes]) => {
      setAssignments(toOptions(normalizeList(assignmentRes), "display_code"));
      setCollectionPoints(toOptions(normalizeList(cpRes), "collection_point_name"));
      setBins(toOptions(normalizeList(binRes), "bin_name"));
      setPanchayats(toOptions(normalizeList(panchayatRes), "panchayat_name"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binCollectionEventApi.read(id).then((record: ApiRecord) => {
      setTripAssignmentId(String(record.trip_assignment_id ?? ""));
      setTripCollectionPointId(String(record.trip_collection_point_id ?? ""));
      setBinId(String(record.bin_id ?? ""));
      setPanchayatId(String(record.panchayat_id ?? ""));
      setCollectionDate(String(record.collection_date ?? ""));
      setCollectedWeightKg(String(record.collected_weight_kg ?? ""));
      setDriverLatitude(String(record.driver_latitude ?? ""));
      setDriverLongitude(String(record.driver_longitude ?? ""));
      setNotes(String(record.notes ?? ""));
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripAssignmentId || !binId || !collectionDate) {
      Swal.fire("Missing details", "Trip Assignment, Bin and Collection Date are required.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_assignment_id: tripAssignmentId,
      trip_collection_point_id: tripCollectionPointId || null,
      bin_id: binId,
      panchayat_id: panchayatId || null,
      collection_date: collectionDate,
      collected_weight_kg: collectedWeightKg || null,
      driver_latitude: driverLatitude || null,
      driver_longitude: driverLongitude || null,
      notes,
    };
    try {
      if (isEdit && id) await binCollectionEventApi.update(id, payload);
      else await binCollectionEventApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin Collection Event" : "Create Bin Collection Event"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Trip Assignment *</Label>
          <Select value={tripAssignmentId} onChange={(value) => setTripAssignmentId(String(value))} options={assignments} placeholder="Select Assignment" />
        </div>
        <div>
          <Label>Collection Point</Label>
          <Select value={tripCollectionPointId} onChange={(value) => setTripCollectionPointId(String(value))} options={collectionPoints} placeholder="Select Collection Point" />
        </div>
        <div>
          <Label>Bin *</Label>
          <Select value={binId} onChange={(value) => setBinId(String(value))} options={bins} placeholder="Select Bin" />
        </div>
        <div>
          <Label>Panchayat</Label>
          <Select value={panchayatId} onChange={(value) => setPanchayatId(String(value))} options={panchayats} placeholder="Select Panchayat" />
        </div>
        <div>
          <Label>Collection Date *</Label>
          <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
        </div>
        <div>
          <Label>Collected Weight Kg</Label>
          <Input type="number" value={collectedWeightKg} onChange={(e) => setCollectedWeightKg(e.target.value)} />
        </div>
        <div>
          <Label>Driver Latitude</Label>
          <Input value={driverLatitude} onChange={(e) => setDriverLatitude(e.target.value)} />
        </div>
        <div>
          <Label>Driver Longitude</Label>
          <Input value={driverLongitude} onChange={(e) => setDriverLongitude(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
