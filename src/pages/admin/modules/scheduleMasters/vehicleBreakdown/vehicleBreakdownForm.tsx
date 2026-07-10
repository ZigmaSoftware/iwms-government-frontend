import type { VehicleBreakdownRecord } from "./types";
import { BREAKDOWN_REASON_LABELS } from "./types";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";
import { vehicleBreakdownApi, dailyTripAssignmentApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import { api } from "@/api";

type SelectOption = { value: string; label: string };

const extractError = (error: any): string => {
  const data = error?.response?.data;
  if (!data) return "An unexpected error occurred.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "An unexpected error occurred.";
};

const REASON_OPTIONS: SelectOption[] = Object.entries(BREAKDOWN_REASON_LABELS).map(
  ([v, l]) => ({ value: v, label: l }),
);

interface FormState {
  trip_assignment_id: string;
  breakdown_vehicle_id: string;
  replacement_vehicle_id: string;
  replacement_driver_id: string;
  replacement_operator_id: string;
  breakdown_reason: string;
  breakdown_time: string;
  breakdown_lat: string;
  breakdown_lng: string;
  breakdown_location: string;
  collected_weight_before_breakdown_kg: string;
  breakdown_remarks: string;
}

const EMPTY_FORM: FormState = {
  trip_assignment_id: "",
  breakdown_vehicle_id: "",
  replacement_vehicle_id: "",
  replacement_driver_id: "",
  replacement_operator_id: "",
  breakdown_reason: "",
  breakdown_time: "",
  breakdown_lat: "",
  breakdown_lng: "",
  breakdown_location: "",
  collected_weight_before_breakdown_kg: "",
  breakdown_remarks: "",
};

/* Info row for auto-filled read-only fields */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[38px]">
        {value || <span className="text-gray-400 italic">—</span>}
      </div>
    </div>
  );
}

export default function VehicleBreakdownForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { encScheduleMasters, encVehicleBreakdown } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encVehicleBreakdown);

  /* ── record (edit mode) ── */
  const [record, setRecord] = useState<VehicleBreakdownRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  /* ── form ── */
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* ── dropdown data ── */
  const [assignmentOptions, setAssignmentOptions] = useState<SelectOption[]>([]);
  const [availableVehicleOptions, setAvailableVehicleOptions] = useState<SelectOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<SelectOption[]>([]);
  const [operatorOptions, setOperatorOptions] = useState<SelectOption[]>([]);
  const [fetchingDropdowns, setFetchingDropdowns] = useState(false);
  const [fetchingVehicles, setFetchingVehicles] = useState(false);
  const [fetchingStaff, setFetchingStaff] = useState(false);

  /* ── auto-filled info from selected trip assignment ── */
  const [selectedTripDate, setSelectedTripDate] = useState("");
  const [autoVehicleNo, setAutoVehicleNo] = useState("");
  const [autoDriver, setAutoDriver] = useState("");
  const [autoOperator, setAutoOperator] = useState("");

  /* ── pending IDs for edit pre-fill ── */
  const [pendingAssignmentId, setPendingAssignmentId] = useState("");
  const [pendingReplacementVehicleId, setPendingReplacementVehicleId] = useState("");
  const [pendingDriverId, setPendingDriverId] = useState("");
  const [pendingOperatorId, setPendingOperatorId] = useState("");

  /* ────────────────────────────────────────────────────────────
     Load record in edit mode
  ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isEdit || !id) return;
    setLoadingRecord(true);
    (vehicleBreakdownApi.read(id) as Promise<any>)
      .then((data: any) => setRecord(data))
      .catch(() => Swal.fire(t("common.error"), t("common.fetch_failed"), "error"))
      .finally(() => setLoadingRecord(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── pre-fill form from record ── */
  useEffect(() => {
    if (!isEdit || !record) return;
    setForm({
      trip_assignment_id: String(record.trip_assignment_id ?? ""),
      breakdown_vehicle_id: String(record.breakdown_vehicle_id ?? ""),
      replacement_vehicle_id: String(record.replacement_vehicle_id ?? ""),
      replacement_driver_id: String(record.replacement_driver_id ?? ""),
      replacement_operator_id: String(record.replacement_operator_id ?? ""),
      breakdown_reason: String(record.breakdown_reason ?? ""),
      breakdown_time: String(record.breakdown_time ?? ""),
      breakdown_lat: String(record.breakdown_lat ?? ""),
      breakdown_lng: String(record.breakdown_lng ?? ""),
      breakdown_location: String(record.breakdown_location ?? ""),
      collected_weight_before_breakdown_kg: String(record.collected_weight_before_breakdown_kg ?? ""),
      breakdown_remarks: String(record.breakdown_remarks ?? ""),
    });
    if (record.trip_assignment_id) setPendingAssignmentId(String(record.trip_assignment_id));
    if (record.replacement_vehicle_id) setPendingReplacementVehicleId(String(record.replacement_vehicle_id));
    if (record.replacement_driver_id) setPendingDriverId(String(record.replacement_driver_id));
    if (record.replacement_operator_id) setPendingOperatorId(String(record.replacement_operator_id));

    /* restore auto-filled display strings */
    if (record.trip_assignment_detail?.trip_date) setSelectedTripDate(record.trip_assignment_detail.trip_date);
    if (record.breakdown_vehicle_detail?.vehicle_no) setAutoVehicleNo(record.breakdown_vehicle_detail.vehicle_no);
    if (record.original_driver_detail?.name) setAutoDriver(record.original_driver_detail.name);
    if (record.original_operator_detail?.name) setAutoOperator(record.original_operator_detail.name);
  }, [isEdit, record]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ────────────────────────────────────────────────────────────
     Load trip assignment dropdown
  ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    setFetchingDropdowns(true);
    (dailyTripAssignmentApi.readAll() as Promise<any>)
      .then((res: any) => {
        const assignments = normalizeList(res);
        setAssignmentOptions(
          assignments.map((a: any) => ({
            value: String(a.unique_id ?? ""),
            label: `${a.unique_id ?? ""}${a.trip_plan?.display_code ? " — " + a.trip_plan.display_code : ""}${a.trip_date ? " (" + a.trip_date + ")" : ""}`,
          })).filter((o: SelectOption) => o.value),
        );
      })
      .catch(() => {})
      .finally(() => setFetchingDropdowns(false));
  }, []);

  /* ── flush pending IDs once dropdowns load ── */
  useEffect(() => {
    if (!pendingAssignmentId || !assignmentOptions.length) return;
    const match = assignmentOptions.find((o) => o.value === pendingAssignmentId);
    if (match) {
      setForm((prev) => ({ ...prev, trip_assignment_id: pendingAssignmentId }));
      setPendingAssignmentId("");
    }
  }, [pendingAssignmentId, assignmentOptions]);

  useEffect(() => {
    if (!pendingDriverId || !driverOptions.length) return;
    const match = driverOptions.find((o) => o.value === pendingDriverId);
    if (match) {
      setForm((prev) => ({ ...prev, replacement_driver_id: pendingDriverId }));
      setPendingDriverId("");
    }
  }, [pendingDriverId, driverOptions]);

  useEffect(() => {
    if (!pendingOperatorId || !operatorOptions.length) return;
    const match = operatorOptions.find((o) => o.value === pendingOperatorId);
    if (match) {
      setForm((prev) => ({ ...prev, replacement_operator_id: pendingOperatorId }));
      setPendingOperatorId("");
    }
  }, [pendingOperatorId, operatorOptions]);

  useEffect(() => {
    if (!pendingReplacementVehicleId || !availableVehicleOptions.length) return;
    const match = availableVehicleOptions.find((o) => o.value === pendingReplacementVehicleId);
    if (match) {
      setForm((prev) => ({ ...prev, replacement_vehicle_id: pendingReplacementVehicleId }));
      setPendingReplacementVehicleId("");
    }
  }, [pendingReplacementVehicleId, availableVehicleOptions]);

  /* ────────────────────────────────────────────────────────────
     When a trip assignment is selected, fetch its details to
     auto-fill the broken vehicle, original driver, operator.
     Also fetch available vehicles for that trip date.
  ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const assignId = form.trip_assignment_id;
    if (!assignId) {
      setSelectedTripDate("");
      setAutoVehicleNo("");
      setAutoDriver("");
      setAutoOperator("");
      setAvailableVehicleOptions([]);
      setDriverOptions([]);
      setOperatorOptions([]);
      if (!isEdit) {
        setForm((prev) => ({ ...prev, breakdown_vehicle_id: "", replacement_vehicle_id: "", replacement_driver_id: "", replacement_operator_id: "" }));
      }
      return;
    }

    (dailyTripAssignmentApi.read(assignId) as Promise<any>)
      .then((data: any) => {
        const tripDate: string = data.trip_date ?? "";
        setSelectedTripDate(tripDate);

        /* broken vehicle — serializer returns data.vehicle */
        const vehicleNo: string =
          data.vehicle?.vehicle_no ??
          data.trip_plan?.vehicle_no ??
          "";
        const vehicleId: string =
          data.vehicle?.unique_id ??
          "";
        setAutoVehicleNo(vehicleNo);

        /* original driver / operator — use effective_staff which accounts for alt template */
        const driverName: string =
          data.effective_staff?.driver ??
          data.staff_template?.driver ??
          "";
        const operatorName: string =
          data.effective_staff?.operator ??
          data.staff_template?.operator ??
          "";
        setAutoDriver(driverName);
        setAutoOperator(operatorName);

        if (!isEdit) {
          setForm((prev) => ({ ...prev, breakdown_vehicle_id: vehicleId }));
        }

        /* fetch available vehicles + staff for the trip date */
        if (tripDate) {
          const params: Record<string, string> = { date: tripDate };

          setFetchingVehicles(true);
          // In edit mode pass exclude_id so this record's own replacement vehicle
          // is not filtered out by the pending-replacements exclusion logic.
          if (isEdit && id) params.exclude_id = id;
          api
            .get("/schedule-masters/vehicle-breakdowns/available-vehicles/", { params })
            .then((res) => {
              const list = Array.isArray(res.data) ? res.data : [];
              const opts: SelectOption[] = list.map((v: any) => ({
                value: String(v.unique_id ?? ""),
                label: `${v.vehicle_no ?? ""}${v.capacity ? " (" + v.capacity + ")" : ""}`,
              })).filter((o: SelectOption) => o.value);

              // Safety net: if edit mode and the current replacement vehicle is still
              // not in the list (e.g. already assigned to a trip), inject it manually
              // so the dropdown shows the saved value.
              if (isEdit && record?.replacement_vehicle_detail) {
                const existingId = String(record.replacement_vehicle_id ?? "");
                if (existingId && !opts.find((o) => o.value === existingId)) {
                  const vd = record.replacement_vehicle_detail;
                  opts.unshift({
                    value: existingId,
                    label: `${vd.vehicle_no ?? ""}${vd.capacity ? " (" + vd.capacity + ")" : ""}`,
                  });
                }
              }

              setAvailableVehicleOptions(opts);
            })
            .catch(() => setAvailableVehicleOptions([]))
            .finally(() => setFetchingVehicles(false));

          setFetchingStaff(true);
          Promise.all([
            api.get("/schedule-masters/vehicle-breakdowns/available-staff/", { params: { ...params, role: "Company Driver" } }),
            api.get("/schedule-masters/vehicle-breakdowns/available-staff/", { params: { ...params, role: "Company Operator" } }),
          ])
            .then(([driverRes, operatorRes]) => {
              const toOpts = (list: any[]): SelectOption[] =>
                (Array.isArray(list) ? list : [])
                  .map((s: any) => ({
                    value: String(s.staff_unique_id ?? ""),
                    label: `${s.employee_name ?? ""} (${s.staff_unique_id ?? ""})`,
                  }))
                  .filter((o) => o.value);

              const driverOpts = toOpts(driverRes.data);
              const operatorOpts = toOpts(operatorRes.data);

              // Safety net: if edit mode and the replacement driver/operator is not in
              // the available list (e.g. already on another trip), inject them so the
              // dropdown still shows the saved value.
              if (isEdit && record?.replacement_driver_detail) {
                const existingId = String(record.replacement_driver_id ?? "");
                if (existingId && !driverOpts.find((o) => o.value === existingId)) {
                  const dd = record.replacement_driver_detail;
                  driverOpts.unshift({ value: existingId, label: `${dd.name ?? ""} (${existingId})` });
                }
              }
              if (isEdit && record?.replacement_operator_detail) {
                const existingId = String(record.replacement_operator_id ?? "");
                if (existingId && !operatorOpts.find((o) => o.value === existingId)) {
                  const od = record.replacement_operator_detail;
                  operatorOpts.unshift({ value: existingId, label: `${od.name ?? ""} (${existingId})` });
                }
              }

              setDriverOptions(driverOpts);
              setOperatorOptions(operatorOpts);
            })
            .catch(() => { setDriverOptions([]); setOperatorOptions([]); })
            .finally(() => setFetchingStaff(false));
        }
      })
      .catch(() => {/* silent — assignment detail not critical */});
  }, [form.trip_assignment_id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ────────────────────────────────────────────────────────────
     Helpers
  ──────────────────────────────────────────────────────────── */
  const setField = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  /* ────────────────────────────────────────────────────────────
     Submit
  ──────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.trip_assignment_id) {
      Swal.fire(t("common.error"), "Please select a trip assignment.", "error"); return;
    }
    if (!form.breakdown_vehicle_id) {
      Swal.fire(t("common.error"), "Broken vehicle could not be determined. Select a valid trip.", "error"); return;
    }
    if (!form.breakdown_reason) {
      Swal.fire(t("common.error"), "Please select a breakdown reason.", "error"); return;
    }
    if (!form.replacement_vehicle_id) {
      Swal.fire(t("common.error"), "Please select a replacement vehicle.", "error"); return;
    }
    if (!form.replacement_driver_id) {
      Swal.fire(t("common.error"), "Please select a replacement driver.", "error"); return;
    }
    if (!form.replacement_operator_id) {
      Swal.fire(t("common.error"), "Please select a replacement operator.", "error"); return;
    }
    if (!form.breakdown_lat.trim()) {
      Swal.fire(t("common.error"), "Please enter the breakdown latitude.", "error"); return;
    }
    if (!form.breakdown_lng.trim()) {
      Swal.fire(t("common.error"), "Please enter the breakdown longitude.", "error"); return;
    }
    const lat = parseFloat(form.breakdown_lat);
    const lng = parseFloat(form.breakdown_lng);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Swal.fire(t("common.error"), "Latitude must be a number between -90 and 90.", "error"); return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Swal.fire(t("common.error"), "Longitude must be a number between -180 and 180.", "error"); return;
    }

    setSaving(true);
    try {
      const payload = {
        trip_assignment_id: form.trip_assignment_id,
        breakdown_vehicle_id: form.breakdown_vehicle_id,
        replacement_vehicle_id: form.replacement_vehicle_id,
        replacement_driver_id: form.replacement_driver_id,
        replacement_operator_id: form.replacement_operator_id,
        breakdown_reason: form.breakdown_reason,
        breakdown_time: form.breakdown_time || null,
        breakdown_lat: form.breakdown_lat,
        breakdown_lng: form.breakdown_lng,
        breakdown_location: form.breakdown_location || null,
        collected_weight_before_breakdown_kg: form.collected_weight_before_breakdown_kg || null,
        breakdown_remarks: form.breakdown_remarks || null,
      };

      if (isEdit && id) {
        await vehicleBreakdownApi.update(id, payload);
      } else {
        await vehicleBreakdownApi.create(payload);
      }

      await Swal.fire({
        title: t("common.success"),
        text: isEdit ? "Breakdown record updated." : "Breakdown reported successfully. Pending approval.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
      navigate(LIST_PATH);
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  if (loadingRecord) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-3">
        <span className="animate-spin h-5 w-5 border-2 border-gray-200 border-t-orange-500 rounded-full" />
        Loading…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {isEdit ? "Edit Breakdown Record" : "Report Vehicle Breakdown"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEdit
              ? "Update the replacement arrangement details."
              : "Report a vehicle breakdown and arrange a replacement for the trip."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(LIST_PATH)}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2"
        >
          ← Back to List
        </button>
      </div>

      {/* ── Section 1: Breakdown Details ── */}
      <ComponentCard title="Breakdown Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trip Assignment */}
          <div className="md:col-span-2">
            <Label>Trip Assignment <span className="text-red-500">*</span></Label>
            <Select
              options={assignmentOptions}
              value={form.trip_assignment_id}
              onChange={(val) => setField("trip_assignment_id", val)}
              placeholder={fetchingDropdowns ? "Loading trips…" : "Select trip assignment"}
              disabled={fetchingDropdowns || isEdit}
            />
            {selectedTripDate && (
              <p className="text-xs text-gray-400 mt-1">Trip date: <strong>{selectedTripDate}</strong></p>
            )}
          </div>

          {/* Auto-filled: Broken Vehicle */}
          <InfoRow
            label="Broken Vehicle (auto-filled)"
            value={autoVehicleNo || (form.breakdown_vehicle_id ? `ID: ${form.breakdown_vehicle_id}` : "")}
          />

          {/* Auto-filled: Original Driver */}
          <InfoRow label="Original Driver (auto-filled)" value={autoDriver} />

          {/* Auto-filled: Original Operator */}
          <InfoRow label="Original Operator (auto-filled)" value={autoOperator} />

          {/* Breakdown Reason */}
          <div>
            <Label>Breakdown Reason <span className="text-red-500">*</span></Label>
            <Select
              options={REASON_OPTIONS}
              value={form.breakdown_reason}
              onChange={(val) => setField("breakdown_reason", val)}
              placeholder="Select reason"
            />
          </div>

          {/* Breakdown Time */}
          <div>
            <Label>Breakdown Time (optional)</Label>
            <Input
              type="time"
              value={form.breakdown_time}
              onChange={(e) => setField("breakdown_time", e.target.value)}
            />
          </div>

          {/* Breakdown Latitude */}
          <div>
            <Label>Breakdown Latitude <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              step="any"
              value={form.breakdown_lat}
              onChange={(e) => setField("breakdown_lat", e.target.value)}
              placeholder="e.g. 28.6139"
            />
          </div>

          {/* Breakdown Longitude */}
          <div>
            <Label>Breakdown Longitude <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              step="any"
              value={form.breakdown_lng}
              onChange={(e) => setField("breakdown_lng", e.target.value)}
              placeholder="e.g. 77.2090"
            />
          </div>

          {/* Collected Weight Before Breakdown */}
          <div>
            <Label>Collected Weight Before Breakdown (kg) — optional</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={form.collected_weight_before_breakdown_kg}
              onChange={(e) => setField("collected_weight_before_breakdown_kg", e.target.value)}
              placeholder="e.g. 120.5"
            />
            <p className="text-xs text-gray-400 mt-1">
              Weight already collected by the broken vehicle before the breakdown occurred.
            </p>
          </div>

          {/* Breakdown Location */}
          <div className="md:col-span-2">
            <Label>Breakdown Location (optional)</Label>
            <Input
              type="text"
              value={form.breakdown_location}
              onChange={(e) => setField("breakdown_location", e.target.value)}
              placeholder="e.g. Near Main Road Junction, Ward 5"
            />
          </div>

          {/* Breakdown Remarks */}
          <div className="md:col-span-2">
            <Label>Breakdown Remarks (optional)</Label>
            <textarea
              rows={2}
              value={form.breakdown_remarks}
              onChange={(e) => setField("breakdown_remarks", e.target.value)}
              placeholder="Additional notes about the breakdown…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
        </div>
      </ComponentCard>

      {/* ── Section 2: Replacement Arrangement ── */}
      <ComponentCard title="Replacement Arrangement">
        {!form.trip_assignment_id && (
          <p className="text-sm text-gray-400 italic">Select a trip assignment above to see available replacement vehicles.</p>
        )}
        {form.trip_assignment_id && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Available Vehicle */}
            <div className="md:col-span-2">
              <Label>Replacement Vehicle <span className="text-red-500">*</span></Label>
              <Select
                options={availableVehicleOptions}
                value={form.replacement_vehicle_id}
                onChange={(val) => setField("replacement_vehicle_id", val)}
                placeholder={fetchingVehicles ? "Loading available vehicles…" : availableVehicleOptions.length === 0 ? "No vehicles available for this date" : "Select replacement vehicle"}
                disabled={fetchingVehicles || availableVehicleOptions.length === 0}
              />
              {availableVehicleOptions.length === 0 && !fetchingVehicles && (
                <p className="text-xs text-amber-600 mt-1">
                  All vehicles are assigned on {selectedTripDate}. Please check vehicle availability.
                </p>
              )}
            </div>

            {/* Replacement Driver */}
            <div>
              <Label>Replacement Driver <span className="text-red-500">*</span></Label>
              <Select
                options={driverOptions}
                value={form.replacement_driver_id}
                onChange={(val) => setField("replacement_driver_id", val)}
                placeholder={fetchingStaff ? "Loading available drivers…" : driverOptions.length === 0 ? "No available drivers for this date" : "Select replacement driver"}
                disabled={fetchingStaff}
              />
              {!fetchingStaff && driverOptions.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">All drivers are already assigned on {selectedTripDate}.</p>
              )}
            </div>

            {/* Replacement Operator */}
            <div>
              <Label>Replacement Operator <span className="text-red-500">*</span></Label>
              <Select
                options={operatorOptions}
                value={form.replacement_operator_id}
                onChange={(val) => setField("replacement_operator_id", val)}
                placeholder={fetchingStaff ? "Loading available operators…" : operatorOptions.length === 0 ? "No available operators for this date" : "Select replacement operator"}
                disabled={fetchingStaff}
              />
              {!fetchingStaff && operatorOptions.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">All operators are already assigned on {selectedTripDate}.</p>
              )}
            </div>

            <div className="md:col-span-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800">
              <strong>Note:</strong> The replacement will only be applied to the trip after a supervisor
              verifies this breakdown request. The original trip ID remains unchanged.
            </div>
          </div>
        )}
      </ComponentCard>

      {/* ── Submit ── */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={() => navigate(LIST_PATH)}
          className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving…
            </>
          ) : (
            isEdit ? "Update Record" : "Report Breakdown"
          )}
        </button>
      </div>
    </form>
  );
}
