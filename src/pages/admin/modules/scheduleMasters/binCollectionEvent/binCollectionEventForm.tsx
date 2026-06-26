import { useEffect, useMemo, useState, type FormEvent } from "react";
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

type Option = {
  value: string;
  label: string;
  assignmentId?: string;
  collectionPointId?: string;
  binId?: string;
  panchayatId?: string;
};
type ApiRecord = Record<string, any>;

const idOf = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String(value.unique_id ?? value.id ?? value.value ?? value.staff_unique_id ?? "");
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

const uniqueOptions = (items: Option[]): Option[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.value || seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
};

const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value }, ...items];
};

const assignmentOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.display_code, item.trip_plan?.display_code, item.trip_plan_id?.display_code, item.unique_id),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
});

const collectionPointOption = (item: ApiRecord): Option => {
  const collectionPoint = item.collection_point ?? item.collection_point_id;
  return {
    value: idOf(item.unique_id ?? item.id),
    label: textOf(
      item.collection_point_name,
      collectionPoint?.cp_name,
      collectionPoint?.name,
      collectionPoint?.unique_id,
      item.unique_id,
    ),
    assignmentId: idOf(item.trip_assignment_id ?? item.trip_assignment),
    collectionPointId: idOf(item.collection_point_id ?? item.collection_point),
    binId: idOf(item.bin_id ?? item.bin),
    panchayatId: idOf(item.panchayat_id ?? item.panchayat ?? collectionPoint?.panchayat_id),
  };
};

const binOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.bin_name, item.name, item.unique_id),
  collectionPointId: idOf(item.collection_point_id ?? item.collection_point),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
});

const panchayatOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.panchayat_name, item.name, item.unique_id),
});

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
      setAssignments(uniqueOptions(normalizeList(assignmentRes).map(assignmentOption)));
      setCollectionPoints(uniqueOptions(normalizeList(cpRes).map(collectionPointOption)));
      setBins(uniqueOptions(normalizeList(binRes).map(binOption)));
      setPanchayats(uniqueOptions(normalizeList(panchayatRes).map(panchayatOption)));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binCollectionEventApi.read(id).then((record: ApiRecord) => {
      const assignmentId = idOf(record.trip_assignment_id ?? record.trip_assignment);
      const tripCollectionPointId = idOf(record.trip_collection_point_id ?? record.trip_collection_point);
      const selectedBinId = idOf(record.bin_id ?? record.bin);
      const selectedPanchayatId = idOf(record.panchayat_id ?? record.panchayat ?? record.bin?.panchayat_id);

      setTripAssignmentId(assignmentId);
      setTripCollectionPointId(tripCollectionPointId);
      setBinId(selectedBinId);
      setPanchayatId(selectedPanchayatId);
      setCollectionDate(String(record.collection_date ?? ""));
      setCollectedWeightKg(String(record.collected_weight_kg ?? ""));
      setDriverLatitude(String(record.driver_latitude ?? ""));
      setDriverLongitude(String(record.driver_longitude ?? ""));
      setNotes(String(record.notes ?? ""));

      setAssignments((items) =>
        ensureOption(
          items,
          assignmentId,
          textOf(record.trip_assignment?.display_code, record.trip_plan?.display_code, assignmentId),
        ),
      );
      setCollectionPoints((items) =>
        ensureOption(
          items,
          tripCollectionPointId,
          textOf(record.collection_point?.cp_name, record.collection_point_name, tripCollectionPointId),
        ),
      );
      setBins((items) => ensureOption(items, selectedBinId, textOf(record.bin?.bin_name, selectedBinId)));
      setPanchayats((items) =>
        ensureOption(items, selectedPanchayatId, textOf(record.panchayat_name, record.panchayat?.panchayat_name, selectedPanchayatId)),
      );
    });
  }, [id]);

  const selectedCollectionPoint = useMemo(
    () => collectionPoints.find((item) => item.value === tripCollectionPointId),
    [collectionPoints, tripCollectionPointId],
  );

  const visibleCollectionPoints = useMemo(() => {
    const filtered = tripAssignmentId
      ? collectionPoints.filter((item) => !item.assignmentId || item.assignmentId === tripAssignmentId)
      : collectionPoints;
    return ensureOption(filtered, tripCollectionPointId, selectedCollectionPoint?.label);
  }, [collectionPoints, selectedCollectionPoint?.label, tripAssignmentId, tripCollectionPointId]);

  const visibleBins = useMemo(() => {
    const collectionPointId = selectedCollectionPoint?.collectionPointId;
    const filtered = collectionPointId
      ? bins.filter((item) => !item.collectionPointId || item.collectionPointId === collectionPointId)
      : bins;
    const selectedBin = bins.find((item) => item.value === binId);
    return ensureOption(filtered, binId, selectedBin?.label);
  }, [binId, bins, selectedCollectionPoint?.collectionPointId]);

  const visiblePanchayats = useMemo(() => {
    const selectedPanchayat = panchayats.find((item) => item.value === panchayatId);
    return ensureOption(panchayats, panchayatId, selectedPanchayat?.label);
  }, [panchayatId, panchayats]);

  const handleAssignmentChange = (value: string) => {
    setTripAssignmentId(value);
    const assignment = assignments.find((item) => item.value === value);
    if (assignment?.panchayatId) setPanchayatId(assignment.panchayatId);

    const selectedCp = collectionPoints.find((item) => item.value === tripCollectionPointId);
    if (selectedCp?.assignmentId && selectedCp.assignmentId !== value) {
      setTripCollectionPointId("");
      setBinId("");
    }
  };

  const handleCollectionPointChange = (value: string) => {
    setTripCollectionPointId(value);
    const collectionPoint = collectionPoints.find((item) => item.value === value);
    if (collectionPoint?.assignmentId) setTripAssignmentId(collectionPoint.assignmentId);
    if (collectionPoint?.binId) setBinId(collectionPoint.binId);
    if (collectionPoint?.panchayatId) setPanchayatId(collectionPoint.panchayatId);
  };

  const handleBinChange = (value: string) => {
    setBinId(value);
    const bin = bins.find((item) => item.value === value);
    if (bin?.panchayatId) setPanchayatId(bin.panchayatId);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripAssignmentId || !tripCollectionPointId || !binId || !collectionDate) {
      Swal.fire("Missing details", "Trip Assignment, Collection Point, Bin and Collection Date are required.", "warning");
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
          <Select value={tripAssignmentId} onChange={handleAssignmentChange} options={assignments} placeholder="Select Assignment" />
        </div>
        <div>
          <Label>Collection Point *</Label>
          <Select value={tripCollectionPointId} onChange={handleCollectionPointChange} options={visibleCollectionPoints} placeholder="Select Collection Point" />
        </div>
        <div>
          <Label>Bin *</Label>
          <Select value={binId} onChange={handleBinChange} options={visibleBins} placeholder="Select Bin" />
        </div>
        <div>
          <Label>Panchayat</Label>
          <Select value={panchayatId} onChange={(value) => setPanchayatId(String(value))} options={visiblePanchayats} placeholder="Derived from Trip Stop" disabled />
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
