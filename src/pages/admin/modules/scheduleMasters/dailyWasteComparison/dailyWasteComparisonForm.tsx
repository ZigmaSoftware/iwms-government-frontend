import type { TripLogData } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { RefreshCw, Info, Scale, Truck, MapPin } from "lucide-react";

import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminApi } from "@/helpers/admin/registry";
import { panchayatApi, wasteTypeApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { api } from "@/api";
import type { SelectOption } from "@/types";

/* ────────────────────────────────────────────
   Local sub-components
──────────────────────────────────────────── */

const ShadcnSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  isRequired = true,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  isRequired?: boolean;
  disabled?: boolean;
}) => {
  if (/^(company|project)$/i.test(label.trim())) return null;
  return (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-gray-700">
      {label}
      {isRequired && <span className="text-red-500 ml-1">*</span>}
    </Label>
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500">
        <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {options.length > 0 ? (
          options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))
        ) : (
          <div className="p-2 text-sm text-gray-500">No options available</div>
        )}
      </SelectContent>
    </Select>
  </div>
);
};

const FormSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mb-8 bg-white rounded-lg">
    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b-2 border-blue-500">
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{children}</div>
  </div>
);

/* ────────────────────────────────────────────
   Helpers
──────────────────────────────────────────── */

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter((x) => x && typeof x === "object");
  if (value && typeof value === "object") {
    const r = (value as { results?: unknown }).results;
    if (Array.isArray(r)) return r.filter((x) => x && typeof x === "object");
  }
  return [];
};

const normalizeId = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.unique_id ?? obj.id ?? obj.value ?? "").trim();
  }
  const raw = String(value).trim();
  const m = raw.match(/\(([A-Za-z0-9_-]+)\)\s*$/);
  return m?.[1] ?? raw;
};

const toText = (value: unknown): string =>
  value == null ? "" : String(value).trim();

const ensureSelectedOption = (
  options: SelectOption[],
  selectedId: string,
  selectedLabel?: string,
) => {
  if (!selectedId || options.some((option) => option.value === selectedId)) {
    return options;
  }
  return [...options, { value: selectedId, label: selectedLabel || selectedId }];
};

const fmtKg = (v?: number | string | null) => {
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

/* ────────────────────────────────────────────
   Types
──────────────────────────────────────────── */


/* ────────────────────────────────────────────
   Component
──────────────────────────────────────────── */

export default function DailyWasteComparisonForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const routeState = location.state as {
    record?: Record<string, unknown>;
  } | null;
  const isEdit = Boolean(id);

  const { encScheduleMasters, encDailyWasteComparison } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encDailyWasteComparison);

  /* ── Criteria fields ── */
  const [panchayatId, setPanchayatId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [collectionDate, setCollectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  /* ── Dropdown options ── */
  const [panchayatOptions, setPanchayatOptions] = useState<SelectOption[]>([]);
  const [panchayatDataMap, setPanchayatDataMap] = useState<
    Record<string, { agreed_weight_kg?: number }>
  >({});
  const [wasteTypeOptions, setWasteTypeOptions] = useState<SelectOption[]>([]);

  /* ── Auto-fetched trip log data ── */
  const [tripData, setTripData] = useState<TripLogData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  /* ── Form submission ── */
  const [loading, setLoading] = useState(false);
  const [recordData] = useState<Record<string, unknown> | null>(routeState?.record ?? null);

  /* fetch panchayat dropdown — store agreed_weight_kg per panchayat */
  useEffect(() => {
    panchayatApi
      .readAll()
      .then((res) => {
        const records = toRecordList(res).filter((x) => x.is_active !== false);
        const opts = records
          .map((x) => ({
            value: normalizeId(x.unique_id ?? x.panchayat_id),
            label: toText(x.panchayat_name ?? x.name ?? x.unique_id),
          }))
          .filter((x) => x.value && x.label);
        setPanchayatOptions(opts);

        const dataMap: Record<string, { agreed_weight_kg?: number }> = {};
        for (const x of records) {
          const uid = normalizeId(x.unique_id ?? x.panchayat_id);
          if (uid) {
            dataMap[uid] = {
              agreed_weight_kg: x.agreed_weight_kg != null ? Number(x.agreed_weight_kg) : undefined,
            };
          }
        }
        setPanchayatDataMap(dataMap);
      })
      .catch(() => {
        setPanchayatOptions([]);
        setPanchayatDataMap({});
      });
  }, []);

  /* fetch waste type dropdown */
  useEffect(() => {
    wasteTypeApi
      .readAll()
      .then((res) => {
        const opts = toRecordList(res)
          .filter((x) => x.is_active !== false)
          .map((x) => ({
            value: normalizeId(x.unique_id ?? x.waste_type_id),
            label: toText(x.waste_type_name ?? x.wastetype_name ?? x.name ?? x.unique_id),
          }))
          .filter((x) => x.value && x.label);
        setWasteTypeOptions(opts);
      })
      .catch(() => setWasteTypeOptions([]));
  }, []);

  /* hydrate edit record's criteria */
  useEffect(() => {
    if (!isEdit || !routeState?.record) return;
    setPanchayatId(normalizeId(routeState.record.panchayat_id ?? routeState.record.panchayat));
    setWasteTypeId(normalizeId(routeState.record.waste_type_id));
    const date = toText(routeState.record.collection_date);
    if (date) setCollectionDate(date.slice(0, 10));
  }, [isEdit, routeState?.record]);

  /* ── Auto-fetch from trip logs when all criteria are set ── */
  const canFetch =
    Boolean(panchayatId) &&
    Boolean(wasteTypeId) &&
    Boolean(collectionDate);

  const fetchFromTripLogs = async () => {
    if (!canFetch) return;
    setFetching(true);
    setFetchError("");
    setTripData(null);
    try {
      const { data } = await api.get("/schedule-masters/daily-waste-comparisons/", {
        params: {
          date: collectionDate,
          panchayat_id: panchayatId,
          waste_type_id: wasteTypeId,
        },
      });
      const results: TripLogData[] = Array.isArray(data?.results) ? data.results : [];
      if (results.length === 0) {
        setFetchError("No trip logs found for the selected date, panchayat, and waste type.");
        return;
      }
      setTripData(results[0]);
    } catch {
      setFetchError("Failed to fetch trip log data.");
    } finally {
      setFetching(false);
    }
  };

  /* auto-fetch whenever criteria change */
  useEffect(() => {
    if (canFetch) {
      void fetchFromTripLogs();
    } else {
      setTripData(null);
      setFetchError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panchayatId, wasteTypeId, collectionDate]);

  /* ── Agreed weight from panchayat master ── */
  const panchayatAgreedWeight = panchayatId
    ? panchayatDataMap[panchayatId]?.agreed_weight_kg
    : undefined;

  const statusBadgeCls = (s: string) =>
    s === "Surplus"
      ? "bg-green-100 text-green-800 border-green-200"
      : s === "Deficit"
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-blue-100 text-blue-800 border-blue-200";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tripData) {
      Swal.fire(t("common.warning"), "Please wait for trip log data to load before saving.", "warning");
      return;
    }

    const missing: string[] = [];
    if (!panchayatId) missing.push(t("admin.nav.panchayat"));
    if (!wasteTypeId) missing.push(t("common.waste_type"));
    if (!collectionDate) missing.push("Collection Date");

    if (missing.length > 0) {
      Swal.fire(t("common.warning"), `Missing: ${missing.join(", ")}`, "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        panchayat_id: panchayatId,
        waste_type_id: wasteTypeId,
        collection_date: collectionDate,
        agreed_weight_kg: tripData.agreed_weight_kg,
        actual_weight_kg: tripData.actual_weight_kg,
        total_trips: tripData.total_trips,
        collection_points_covered: tripData.collection_points_covered,
      };

      if (isEdit) {
        await adminApi.dailyWasteComparison.update(id as string, payload);
      } else {
        await adminApi.dailyWasteComparison.create(payload);
      }

      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success",
      );
      navigate(LIST_PATH);
    } catch {
      Swal.fire(t("common.save_failed"), t("common.save_failed_desc"), "error");
    } finally {
      setLoading(false);
    }
  };

  const panchayatOptionsWithSelected = ensureSelectedOption(
    panchayatOptions,
    panchayatId,
    toText(recordData?.panchayat_name ?? recordData?.panchayat),
  );
  const wasteTypeOptionsWithSelected = ensureSelectedOption(
    wasteTypeOptions,
    wasteTypeId,
    toText(recordData?.waste_type_name ?? recordData?.waste_type ?? recordData?.waste_type_label),
  );

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: "Daily Waste Comparison" })
          : t("common.add_item", { item: "Daily Waste Comparison" })
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Info banner ── */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Waste weights are <strong>automatically calculated</strong> from daily trip logs
            for the selected date, panchayat, and waste type.
            Only <strong>submitted</strong> and <strong>verified</strong> trip logs are included.
          </span>
        </div>

        {/* ── Report criteria ── */}
        <FormSection title="Report Criteria">
          <ShadcnSelect
            label={t("admin.nav.panchayat")}
            value={panchayatId}
            onChange={setPanchayatId}
            options={panchayatOptionsWithSelected}
            placeholder={t("common.select_item_placeholder", { item: t("admin.nav.panchayat") })}
            disabled={panchayatOptionsWithSelected.length === 0}
          />
          <ShadcnSelect
            label={t("common.waste_type")}
            value={wasteTypeId}
            onChange={setWasteTypeId}
            options={wasteTypeOptionsWithSelected}
            placeholder={t("common.select_item_placeholder", { item: t("common.waste_type") })}
            disabled={wasteTypeOptionsWithSelected.length === 0}
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Collection Date <span className="text-red-500 ml-1">*</span>
            </Label>
            <input
              type="date"
              value={collectionDate}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </FormSection>

        {/* ── Auto-calculated data panel ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-green-500">
            <h3 className="text-lg font-semibold text-gray-800">
              Weight & Collection Data
              <span className="ml-2 text-xs font-normal text-gray-500">(auto-calculated from trip logs)</span>
            </h3>
            <button
              type="button"
              onClick={fetchFromTripLogs}
              disabled={!canFetch || fetching}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* Agreed weight from panchayat master */}
          {panchayatAgreedWeight !== undefined && (
            <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <Scale className="h-4 w-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-xs font-medium text-indigo-600">Agreed Weight (Panchayat Contract)</span>
                <p className="text-sm font-bold text-indigo-800">{fmtKg(panchayatAgreedWeight)} kg / day</p>
              </div>
            </div>
          )}

          {!canFetch && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
              Select panchayat, waste type, and date to load trip log data.
            </div>
          )}

          {canFetch && fetching && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 flex items-center justify-center gap-2 text-sm text-gray-400">
              <span className="animate-spin h-4 w-4 border-2 border-gray-200 border-t-blue-500 rounded-full" />
              Calculating from trip logs…
            </div>
          )}

          {canFetch && !fetching && fetchError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              {fetchError}
            </div>
          )}

          {canFetch && !fetching && !fetchError && tripData && (
            <div className="space-y-4">
              {/* Agreed vs Actual comparison */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs text-blue-500 font-medium">Agreed Weight</p>
                  <p className="text-xl font-bold text-blue-800 mt-0.5">{fmtKg(tripData.agreed_weight_kg)} kg</p>
                  <p className="text-[10px] text-blue-400 mt-0.5">Daily contract target</p>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs text-green-500 font-medium">Actual Weight</p>
                  <p className="text-xl font-bold text-green-800 mt-0.5">{fmtKg(tripData.actual_weight_kg)} kg</p>
                  <p className="text-[10px] text-green-400 mt-0.5">From trip logs</p>
                </div>
                <div className={`rounded-xl border p-4 ${tripData.variance_kg >= 0 ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                  <p className={`text-xs font-medium ${tripData.variance_kg >= 0 ? "text-emerald-500" : "text-red-500"}`}>Variance</p>
                  <p className={`text-xl font-bold mt-0.5 ${tripData.variance_kg >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                    {tripData.variance_kg >= 0 ? "+" : ""}{fmtKg(tripData.variance_kg)} kg
                  </p>
                  <p className={`text-[10px] mt-0.5 ${tripData.variance_kg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtKg(tripData.variance_percent)}%
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col justify-between">
                  <p className="text-xs text-gray-500 font-medium">Status</p>
                  <span className={`inline-block text-xs font-bold px-2 py-1 rounded-lg border mt-1 ${statusBadgeCls(tripData.report_status)}`}>
                    {tripData.report_status}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1">Efficiency: {fmtKg(tripData.collection_efficiency_percent)}%</p>
                </div>
              </div>

              {/* Efficiency bar */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="font-medium">Collection Efficiency (Actual ÷ Agreed)</span>
                  <span className="font-bold text-gray-700">{fmtKg(Math.min(tripData.collection_efficiency_percent, 100))}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      tripData.collection_efficiency_percent >= 90
                        ? "bg-green-500"
                        : tripData.collection_efficiency_percent >= 70
                          ? "bg-amber-400"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(tripData.collection_efficiency_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0</span>
                  <span>{fmtKg(tripData.agreed_weight_kg)} kg (agreed)</span>
                </div>
              </div>

              {/* Trip & collection stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                  <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                    <Truck className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Total Trips</p>
                    <p className="text-sm font-bold text-gray-800">{tripData.total_trips}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                  <div className="h-8 w-8 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Collection Points Covered</p>
                    <p className="text-sm font-bold text-gray-800">{tripData.collection_points_covered}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={loading || !tripData}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => navigate(LIST_PATH)}
            className="bg-red-400 hover:bg-red-500 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
