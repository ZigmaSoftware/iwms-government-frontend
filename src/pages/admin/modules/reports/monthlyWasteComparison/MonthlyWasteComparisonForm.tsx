import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { RefreshCw, Info } from "lucide-react";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
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
   Local sub-components (identical pattern to
   CollectionMonitoringForm)
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

const FormInput = ({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
  isRequired = true,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  isRequired?: boolean;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-gray-700">
      {label}
      {isRequired && <span className="text-red-500 ml-1">*</span>}
    </Label>
    <Input
      type={type}
      value={value}
      onChange={onChange}
      step={step}
      min={min}
      max={max}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      autoComplete="off"
    />
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

const toMonthValue = (value: unknown): string => {
  const text = toText(value);
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : text;
};

const ensureSelectedOption = (
  options: SelectOption[],
  selectedId: string,
  selectedLabel?: string
) => {
  if (!selectedId || options.some((option) => option.value === selectedId)) {
    return options;
  }
  return [...options, { value: selectedId, label: selectedLabel || selectedId }];
};

const resolveOptionValue = (
  options: SelectOption[],
  id: string,
  label: string
) => {
  if (id && options.some((option) => option.value === id)) return id;

  const normalizedLabel = label.trim().toLowerCase();
  if (!normalizedLabel) return id;

  return (
    options.find((option) => option.label.trim().toLowerCase() === normalizedLabel)
      ?.value ?? id
  );
};

/* ────────────────────────────────────────────
   Component
──────────────────────────────────────────── */

export default function MonthlyWasteComparisonForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { encScheduleMasters, encMonthlyWasteComparison } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encMonthlyWasteComparison);

  /* field state */
  const [panchayatId, setPanchayatId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [month, setMonth] = useState("");
  const [agreedWeight, setAgreedWeight] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [totalTrips, setTotalTrips] = useState("");
  const [collectionPointsCovered, setCollectionPointsCovered] = useState("");

  /* ── Auto-fetch from trip logs (create mode only) ── */
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  /* dropdown data */
  const [panchayatOptions, setPanchayatOptions] = useState<SelectOption[]>([]);
  const [wasteTypeOptions, setWasteTypeOptions] = useState<SelectOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState<Record<string, unknown> | null>(null);

  /* default month */
  useEffect(() => {
    if (!month) {
      const today = new Date();
      setMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [month]);

  /* fetch dropdowns */
  useEffect(() => {
    panchayatApi
      .readAll()
      .then((panchayatRes) => {
        const panchayats = toRecordList(panchayatRes)
          .filter((x) => x.is_active !== false)
          .map((x) => ({
            value: normalizeId(x.unique_id ?? x.panchayat_id),
            label: toText(x.panchayat_name ?? x.name ?? x.unique_id),
          }))
          .filter((x) => x.value && x.label);

        setPanchayatOptions(panchayats);
      })
      .catch(() => {
        setPanchayatOptions([]);
      });
  }, []);

  useEffect(() => {
    wasteTypeApi
      .readAll()
      .then((wasteTypeRes) => {
        const wasteTypes = toRecordList(wasteTypeRes)
          .filter((x) => x.is_active !== false)
          .map((x) => ({
            value: normalizeId(x.unique_id ?? x.waste_type_id),
            label: toText(x.waste_type_name ?? x.wastetype_name ?? x.name ?? x.unique_id),
          }))
          .filter((x) => x.value && x.label);

        setWasteTypeOptions(wasteTypes);
      })
      .catch(() => {
        setWasteTypeOptions([]);
      });
  }, []);

  /* auto-fetch monthly aggregates from DailyTripLog when criteria are complete (create mode) */
  const canFetch =
    !isEdit &&
    Boolean(panchayatId) &&
    Boolean(wasteTypeId) &&
    Boolean(month);

  useEffect(() => {
    if (!canFetch) {
      setFetchError("");
      return;
    }
    let cancelled = false;
    setFetching(true);
    setFetchError("");
    api
      .get("/schedule-masters/monthly-waste-comparison/", {
        params: {
          panchayat_id: panchayatId,
          waste_type_id: wasteTypeId,
          month,
        },
      })
      .then((res) => {
        if (cancelled) return;
        const results: Record<string, unknown>[] = Array.isArray(res.data?.results)
          ? res.data.results
          : [];
        if (results.length > 0) {
          const row = results[0];
          setAgreedWeight(String(row.total_agreed_weight ?? ""));
          setActualWeight(String(row.total_actual_weight ?? ""));
          setTotalTrips(String(row.total_trips ?? ""));
          setCollectionPointsCovered(String(row.collection_points_covered ?? ""));
        } else {
          setAgreedWeight("");
          setActualWeight("");
          setTotalTrips("");
          setCollectionPointsCovered("");
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError("Could not load trip log data. You can enter values manually.");
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, panchayatId, wasteTypeId, month]);

  /* hydrate edit record immediately; resolve dropdown labels as options arrive */
  useEffect(() => {
    if (!recordData) return;

    const panchayatLabel = toText(
      recordData.panchayat_name ?? recordData.panchayat
    );
    const wasteTypeLabel = toText(
      recordData.waste_type_name ??
        recordData.wastetype_name ??
        recordData.waste_type ??
        recordData.waste_type_label
    );
    const resolvedPanchayatId = resolveOptionValue(
      panchayatOptions,
      normalizeId(recordData.panchayat_id ?? recordData.panchayat),
      panchayatLabel
    );
    const resolvedWasteTypeId = resolveOptionValue(
      wasteTypeOptions,
      normalizeId(recordData.waste_type_id ?? recordData.waste_type_unique_id),
      wasteTypeLabel
    );

    setPanchayatId(resolvedPanchayatId || panchayatLabel);
    setWasteTypeId(resolvedWasteTypeId || wasteTypeLabel);
    setMonth(toMonthValue(recordData.month));
    setAgreedWeight(
      toText(recordData.agreed_weight_kg ?? recordData.total_agreed_weight)
    );
    setActualWeight(
      toText(recordData.actual_weight_kg ?? recordData.total_actual_weight)
    );
    setTotalTrips(toText(recordData.total_trips));
    setCollectionPointsCovered(toText(recordData.collection_points_covered));
  }, [recordData, panchayatOptions, wasteTypeOptions]);

  /* load record for edit */
  useEffect(() => {
    if (!isEdit) return;
    adminApi.monthlyWasteComparison.read(id as string)
      .then((res: Record<string, unknown>) => {
        setRecordData(res);
      })
      .catch((err) => {
        Swal.fire(
          t("common.error"),
          String(
            (err as { response?: { data?: unknown }; message?: string })?.response?.data ??
              (err as { message?: string })?.message ??
              t("common.load_failed")
          ),
          "error"
        );
      });
  }, [id, isEdit, t]);

  const panchayatOptionsWithSelected = ensureSelectedOption(
    panchayatOptions,
    panchayatId,
    toText(recordData?.panchayat_name ?? recordData?.panchayat)
  );
  const wasteTypeOptionsWithSelected = ensureSelectedOption(
    wasteTypeOptions,
    wasteTypeId,
    toText(
      recordData?.waste_type_name ??
        recordData?.wastetype_name ??
        recordData?.waste_type ??
        recordData?.waste_type_label
    )
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const missing: string[] = [];
    if (!panchayatId) missing.push(t("admin.nav.panchayat"));
    if (!wasteTypeId) missing.push(t("common.waste_type"));
    if (!month) missing.push("Month");
    if (!agreedWeight.trim()) missing.push("Agreed Weight");

    if (missing.length > 0) {
      Swal.fire(t("common.warning"), `Missing: ${missing.join(", ")}`, "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        panchayat_id: panchayatId,
        waste_type_id: wasteTypeId,
        month,
        agreed_weight_kg: parseFloat(agreedWeight) || 0,
        actual_weight_kg: parseFloat(actualWeight) || 0,
        total_trips: parseInt(totalTrips) || 0,
        collection_points_covered: parseInt(collectionPointsCovered) || 0,
      };

      if (isEdit) {
        await adminApi.monthlyWasteComparison.update(id as string, payload);
      } else {
        await adminApi.monthlyWasteComparison.create(payload);
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

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: "Monthly Waste Comparison" })
          : t("common.add_item", { item: "Monthly Waste Comparison" })
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="Report Details">
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
          <FormInput
            label="Month"
            type="month"
            value={month}
            max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => setMonth(e.target.value)}
          />
        </FormSection>

        {!isEdit && canFetch && (
          <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 mb-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {fetching
                ? "Loading data from Daily Trip Logs…"
                : fetchError
                ? fetchError
                : "Values below are auto-filled from verified trip logs. You can edit them before saving."}
            </span>
            {fetching && <RefreshCw className="ml-auto h-4 w-4 animate-spin shrink-0" />}
          </div>
        )}

        <FormSection title="Weight & Collection Data">
          <FormInput
            label="Agreed Weight (kg)"
            type="number"
            step="0.01"
            min="0"
            value={agreedWeight}
            onChange={(e) => setAgreedWeight(e.target.value)}
          />
          <FormInput
            label="Actual Weight (kg)"
            type="number"
            step="0.01"
            min="0"
            value={actualWeight}
            onChange={(e) => setActualWeight(e.target.value)}
            isRequired={false}
          />
          <FormInput
            label="Total Trips"
            type="number"
            min="0"
            value={totalTrips}
            onChange={(e) => setTotalTrips(e.target.value)}
            isRequired={false}
          />
          <FormInput
            label="Collection Points Covered"
            type="number"
            min="0"
            value={collectionPointsCovered}
            onChange={(e) => setCollectionPointsCovered(e.target.value)}
            isRequired={false}
          />
        </FormSection>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(LIST_PATH)
            }
            className="bg-red-400 hover:bg-red-500 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
