import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { binApi, collectionPointApi, districtApi, panchayatApi, wasteTypeApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";

type Option = { value: string; label: string; districtId?: string; panchayatId?: string };
type ApiRecord = Record<string, unknown>;

const { encMasters, encBins } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encBins);

const normalizeList = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ApiRecord[] }).results;
  }
  return [];
};

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const optionOf = (item: ApiRecord, labelKey: string): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(item[labelKey] ?? item.name ?? item.unique_id ?? item.id ?? ""),
  districtId: idOf(item.district_id ?? item.district),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
});

export default function BinForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [districtId, setDistrictId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [collectionPointId, setCollectionPointId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [binName, setBinName] = useState("");
  const [binCapacity, setBinCapacity] = useState("");
  const [binType, setBinType] = useState("");
  const [binQr, setBinQr] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [panchayats, setPanchayats] = useState<Option[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      districtApi.readAll(),
      panchayatApi.readAll(),
      collectionPointApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([districtRes, panchayatRes, cpRes, wasteTypeRes]) => {
      setDistricts(normalizeList(districtRes).map((item) => optionOf(item, "district_name")));
      setPanchayats(normalizeList(panchayatRes).map((item) => optionOf(item, "panchayat_name")));
      setCollectionPoints(normalizeList(cpRes).map((item) => optionOf(item, "cp_name")));
      setWasteTypes(normalizeList(wasteTypeRes).map((item) => optionOf(item, "waste_type_name")));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binApi.read(id).then((record: ApiRecord) => {
      setDistrictId(idOf(record.district_id ?? record.district));
      setPanchayatId(idOf(record.panchayat_id ?? record.panchayat));
      setCollectionPointId(idOf(record.collection_point_id ?? record.collection_point));
      setWasteTypeId(idOf(record.wastetype_id ?? record.waste_type_id ?? record.waste_type));
      setBinName(String(record.bin_name ?? ""));
      setBinCapacity(String(record.bin_capacity ?? ""));
      setBinType(String(record.bin_type ?? ""));
      setBinQr(String(record.bin_qr ?? ""));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const filteredPanchayats = useMemo(
    () => panchayats.filter((item) => !districtId || !item.districtId || item.districtId === districtId),
    [districtId, panchayats],
  );

  const filteredCollectionPoints = useMemo(
    () =>
      collectionPoints.filter((item) => {
        if (districtId && item.districtId && item.districtId !== districtId) return false;
        if (panchayatId && item.panchayatId && item.panchayatId !== panchayatId) return false;
        return true;
      }),
    [collectionPoints, districtId, panchayatId],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!districtId || !collectionPointId || !wasteTypeId || !binName.trim()) {
      Swal.fire("Missing details", "District, Collection Point, Waste Type and Bin Name are required.", "warning");
      return;
    }
    setSubmitting(true);
    const payload = {
      district_id: districtId,
      panchayat_id: panchayatId || null,
      collection_point_id: collectionPointId,
      wastetype_id: wasteTypeId,
      bin_name: binName.trim(),
      bin_capacity: binCapacity || null,
      bin_type: binType || null,
      bin_qr: binQr || null,
      is_active: isActive,
    };
    try {
      if (isEdit && id) await binApi.update(id, payload);
      else await binApi.create(payload);
      navigate(LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin" : "Create Bin"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>District *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">Select District</option>
            {districts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Panchayat</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={panchayatId} onChange={(e) => setPanchayatId(e.target.value)}>
            <option value="">Select Panchayat</option>
            {filteredPanchayats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Collection Point *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={collectionPointId} onChange={(e) => setCollectionPointId(e.target.value)}>
            <option value="">Select Collection Point</option>
            {filteredCollectionPoints.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Waste Type *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={wasteTypeId} onChange={(e) => setWasteTypeId(e.target.value)}>
            <option value="">Select Waste Type</option>
            {wasteTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Bin Name *</Label>
          <Input value={binName} onChange={(e) => setBinName(e.target.value)} />
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" value={binCapacity} onChange={(e) => setBinCapacity(e.target.value)} />
        </div>
        <div>
          <Label>Bin Type</Label>
          <Input value={binType} onChange={(e) => setBinType(e.target.value)} />
        </div>
        <div>
          <Label>QR Code</Label>
          <Input value={binQr} onChange={(e) => setBinQr(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
