import type { DailyTripCollectionPointRecord } from "./types";
import type { ApiObject, SelectOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";
import { dailyTripAssignmentApi, dailyTripCollectionPointApi, binApi, staffCreationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCollectionPointLocationOptions } from "@/hooks/useCollectionPointLocationOptions";
import { dailyTripCollectionPointSchema } from "@/schemas/core_modules/dailyOperations/dailyTripCollectionPoint.schema";
import { toSwalMessage } from "@/lib/zodErrors";


const STATUS_OPTIONS: SelectOption[] = [
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Collected", label: "Collected" },
  { value: "Skipped", label: "Skipped" },
  { value: "Missed", label: "Missed" },
];

const BOOL_OPTIONS: SelectOption[] = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

const normalizeList = (value: unknown): ApiObject[] => {
  if (Array.isArray(value)) return value.filter((item): item is ApiObject => !!item && typeof item === "object");
  if (value && typeof value === "object") {
    const obj = value as { results?: unknown };
    if (Array.isArray(obj.results)) return obj.results.filter((item): item is ApiObject => !!item && typeof item === "object");
  }
  return [];
};

const idOf = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const obj = value as ApiObject;
    return String(obj.unique_id ?? obj.staff_unique_id ?? obj.id ?? "").trim();
  }
  return String(value).trim();
};

const optionLabel = (item: ApiObject, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return idOf(item);
};

const preferredId = (primary: unknown, fallback: unknown): string => idOf(primary ?? fallback);

const preferredLabel = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "object") {
      const obj = value as ApiObject;
      const label = obj.employee_name ?? obj.bin_name ?? obj.cp_name ?? obj.collection_point_name ?? obj.name ?? obj.display_code ?? obj.trip_plan_display_code;
      if (typeof label === "string" && label.trim() !== "") return label;
    }
    if (typeof value !== "object") return String(value);
  }
  return undefined;
};

const toOptions = (items: ApiObject[], keys: string[]): SelectOption[] =>
  items
    .map((item) => ({ value: idOf(item), label: optionLabel(item, keys) }))
    .filter((item) => item.value);

const ensureOption = (options: SelectOption[], value: string, label?: string): SelectOption[] => {
  if (!value || options.some((item) => item.value === value)) return options;
  return [...options, { value, label: label || value }];
};

const extractError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  return typeof first === "string" ? first : null;
};

export default function DailyTripCollectionPointForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { encScheduleOperations, encDailyTripCollectionPoint } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleOperations, encDailyTripCollectionPoint);

  const [tripAssignmentId, setTripAssignmentId] = useState("");
  const [collectionPointId, setCollectionPointId] = useState("");
  const [binId, setBinId] = useState("");
  const [sequence, setSequence] = useState("1");
  const [isCollected, setIsCollected] = useState(false);
  const [collectedAt, setCollectedAt] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [collectedWeight, setCollectedWeight] = useState("");
  const [status, setStatus] = useState("Pending");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [record, setRecord] = useState<DailyTripCollectionPointRecord | null>(null);
  // Pending IDs — flushed once their option list is ready (Radix re-sync pattern)
  const [pendingAssignmentId, setPendingAssignmentId] = useState("");
  const [pendingCollectionPointId, setPendingCollectionPointId] = useState("");
  const [pendingBinId, setPendingBinId] = useState("");
  const [pendingCollectedBy, setPendingCollectedBy] = useState("");
  const [assignments, setAssignments] = useState<SelectOption[]>([]);
  const locationOptions = useCollectionPointLocationOptions();
  const collectionPoints = locationOptions.collectionPoints;
  const [bins, setBins] = useState<(SelectOption & { collectionPointId?: string })[]>([]);
  const [staff, setStaff] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    dailyTripCollectionPointApi.read(id)
      .then((data: DailyTripCollectionPointRecord) => {
        const recordData = data as ApiObject;
        setRecord(data);
        // Set non-select fields immediately (no Radix timing issue)
        setSequence(String(data.sequence ?? 1));
        setIsCollected(Boolean(data.is_collected));
        setCollectedAt(data.collected_at ? String(data.collected_at).slice(0, 16) : "");
        setCollectedWeight(data.collected_weight_kg === null || data.collected_weight_kg === undefined ? "" : String(data.collected_weight_kg));
        setStatus(data.status ?? "Pending");
        // Store select IDs as pending — applied after option lists load
        const aId = preferredId((recordData.trip_assignment as ApiObject)?.unique_id, recordData.trip_assignment_id);
        const cpId = preferredId((recordData.collection_point as ApiObject)?.unique_id, recordData.collection_point_id);
        const bId = preferredId((recordData.bin as ApiObject)?.unique_id, recordData.bin_id);
        const cbId = preferredId((recordData.collected_by_staff as ApiObject)?.unique_id, recordData.collected_by);
        if (aId) setPendingAssignmentId(aId);
        if (cpId) setPendingCollectionPointId(cpId);
        if (bId) setPendingBinId(bId);
        if (cbId) setPendingCollectedBy(cbId);
      })
      .catch((error: unknown) => Swal.fire(t("common.error"), extractError(error) ?? t("common.load_failed"), "error"))
      .finally(() => setLoading(false));
  }, [id, isEdit, t]);

  // Flush trip assignment after assignments list loads
  useEffect(() => {
    if (!pendingAssignmentId || assignments.length === 0) return;
    if (assignments.some((o) => o.value === pendingAssignmentId)) {
      setTripAssignmentId(pendingAssignmentId);
      setPendingAssignmentId("");
    }
  }, [pendingAssignmentId, assignments]);

  // Flush collection point after list loads
  useEffect(() => {
    if (!pendingCollectionPointId || collectionPoints.length === 0) return;
    if (collectionPoints.some((o) => o.value === pendingCollectionPointId)) {
      setCollectionPointId(pendingCollectionPointId);
      setPendingCollectionPointId("");
    }
  }, [pendingCollectionPointId, collectionPoints]);

  useEffect(() => {
    if (locationOptions.loading || !collectionPointId) return;
    if (!collectionPoints.some((option) => option.value === collectionPointId)) {
      setCollectionPointId("");
      setBinId("");
    }
  }, [collectionPointId, collectionPoints, locationOptions.loading]);

  // Flush bin after bins list loads
  useEffect(() => {
    if (!pendingBinId || bins.length === 0) return;
    if (bins.some((o) => o.value === pendingBinId)) {
      setBinId(pendingBinId);
      setPendingBinId("");
    }
  }, [pendingBinId, bins]);

  // Flush collected-by after staff list loads
  useEffect(() => {
    if (!pendingCollectedBy || staff.length === 0) return;
    if (staff.some((o) => o.value === pendingCollectedBy)) {
      setCollectedBy(pendingCollectedBy);
      setPendingCollectedBy("");
    }
  }, [pendingCollectedBy, staff]);

  useEffect(() => {
    setFetching(true);
    Promise.all([
      dailyTripAssignmentApi.readAll().catch(() => []),
      binApi.readAll().catch(() => []),
      staffCreationApi.readAll().catch(() => []),
    ])
      .then(([assignmentRes, binRes, staffRes]) => {
        const assignmentOptions = normalizeList(assignmentRes)
          .filter((item) => item.status !== "Cancelled")
          .map((item) => ({
            value: idOf(item),
            label: `${idOf(item)}${item.trip_date ? ` | ${String(item.trip_date)}` : ""}`,
          }));
        setAssignments(assignmentOptions);
        setBins(
          normalizeList(binRes)
            .map((item) => ({
              value: idOf(item),
              label: optionLabel(item, ["bin_name", "name"]),
              collectionPointId: idOf(item.collection_point_id),
            }))
            .filter((item) => item.value),
        );
        setStaff(toOptions(normalizeList(staffRes), ["employee_name", "name"]));
      })
      .catch((error: unknown) => Swal.fire(t("common.error"), extractError(error) ?? t("common.load_failed"), "error"))
      .finally(() => setFetching(false));
  }, [t]);

  const binOptions = useMemo(() => {
    const filtered = collectionPointId
      ? bins.filter((bin) => !bin.collectionPointId || bin.collectionPointId === collectionPointId)
      : bins;
    const recBinObj = record as ApiObject;
    return ensureOption(
      filtered,
      binId,
      preferredLabel((recBinObj?.bin as ApiObject)?.bin_name, (recBinObj?.bin as ApiObject)?.name, record?.bin_id),
    );
  }, [binId, bins, collectionPointId, record]);

  const recObj = record as ApiObject;
  const assignmentOptions = ensureOption(
    assignments,
    tripAssignmentId,
    preferredLabel((recObj?.trip_assignment as ApiObject)?.trip_plan_display_code, (recObj?.trip_assignment as ApiObject)?.unique_id, record?.trip_assignment_id),
  );
  const collectionPointOptions = ensureOption(
    collectionPoints,
    collectionPointId,
    preferredLabel((recObj?.collection_point as ApiObject)?.cp_name, (recObj?.collection_point as ApiObject)?.collection_point_name, record?.collection_point_id),
  );
  const staffOptions = ensureOption(
    staff,
    collectedBy,
    preferredLabel((recObj?.collected_by_staff as ApiObject)?.employee_name, record?.collected_by),
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = dailyTripCollectionPointSchema.safeParse({ tripAssignmentId, collectionPointId, binId });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const payload = {
      trip_assignment_id: validation.data.tripAssignmentId,
      collection_point_id: validation.data.collectionPointId,
      bin_id: validation.data.binId,
      sequence: Number(sequence || 1),
      is_collected: isCollected,
      collected_at: collectedAt || null,
      collected_by: collectedBy || null,
      collected_weight_kg: collectedWeight || null,
      status,
    };

    setLoading(true);
    try {
      if (isEdit && id) {
        await dailyTripCollectionPointApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await dailyTripCollectionPointApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      navigate(LIST_PATH);
    } catch (error: unknown) {
      Swal.fire(t("common.save_failed"), extractError(error) ?? t("common.save_failed_desc"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={isEdit ? "Edit Daily Trip Collection Point" : "New Daily Trip Collection Point"}
        desc="Assign bins and collection points to a daily trip"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>Trip Assignment <span className="text-red-500">*</span></Label>
              <Select
                value={tripAssignmentId}
                onChange={setTripAssignmentId}
                options={assignmentOptions}
                placeholder="Select trip assignment"
                disabled={fetching}
              />
            </div>

            <div>
              <Label>Panchayat</Label>
              <Select value={locationOptions.panchayatId} onChange={locationOptions.setPanchayatId} options={locationOptions.panchayats} placeholder="Select panchayat (rural)" />
            </div>

            <div>
              <Label>Collection Point <span className="text-red-500">*</span></Label>
              <Select
                value={collectionPointId}
                onChange={(value) => {
                  setCollectionPointId(value);
                  setBinId("");
                }}
                options={collectionPointOptions}
                placeholder="Select collection point"
                disabled={fetching || locationOptions.loading}
              />
            </div>

            <div>
              <Label>Bin <span className="text-red-500">*</span></Label>
              <Select
                value={binId}
                onChange={setBinId}
                options={binOptions}
                placeholder="Select bin"
                disabled={fetching || !collectionPointId}
              />
            </div>

            <div>
              <Label>Sequence</Label>
              <Input type="number" min={1} value={sequence} onChange={(event) => setSequence(event.target.value)} />
            </div>

            <div>
              <Label>Collected</Label>
              <Select
                value={isCollected ? "true" : "false"}
                onChange={(value) => {
                  const next = value === "true";
                  setIsCollected(next);
                  if (next && status === "Pending") setStatus("Collected");
                }}
                options={BOOL_OPTIONS}
                placeholder="Collected?"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Select status" />
            </div>

            <div>
              <Label>Collected At</Label>
              <Input type="datetime-local" value={collectedAt} onChange={(event) => setCollectedAt(event.target.value)} />
            </div>

            <div>
              <Label>Collected By</Label>
              <Select
                value={collectedBy}
                onChange={setCollectedBy}
                options={staffOptions}
                placeholder="Select staff"
                disabled={fetching}
              />
            </div>

            <div>
              <Label>Collected Weight (kg)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={collectedWeight}
                onChange={(event) => setCollectedWeight(event.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-green-custom px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(LIST_PATH)}
              className="rounded bg-red-400 px-4 py-2 text-white"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
