import type { FormState, Option, StaffRecord, StaffTemplateRaw } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { MultiSelect } from "primereact/multiselect";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import InputField from "@/components/form/input/InputField";
import GeoHierarchyFields from "@/components/form/GeoHierarchyFields";

import { getEncryptedRoute } from "@/utils/routeCache";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useGeoHierarchy } from "@/hooks/useGeoHierarchy";
import { staffCreationApi, staffTemplateApi, alternativeStaffTemplateApi } from "@/helpers/admin";
import { staffTemplateLabel } from "@/utils/forms";

const GEO_PAYLOAD_KEYS = [
  "state_id",
  "district_id",
  "area_type_id",
  "corporation_id",
  "municipality_id",
  "town_panchayat_id",
  "panchayat_union_id",
  "panchayat_id",
];

/* ================= INITIAL STATE ================= */

const initialFormState: FormState = {
  staff_template: "",
  effective_date: "",
  from_date: "",
  to_date: "",
  driver: "",
  operator: "",
  extra_operator: [],
  change_reason: "",
  change_remarks: "",
};

const ALTERNATIVE_STAFF_TEMPLATE_FIELDS: Record<string, string[]> = {
  staff_template: ["staff_template", "staff_template_id"],
  effective_date: ["effective_date"],
  from_date: ["from_date"],
  to_date: ["to_date"],
  driver: ["driver", "driver_id"],
  operator: ["operator", "operator_id"],
  extra_operator: ["extra_operator", "extra_operator_id", "extra_staff"],
  change_reason: ["change_reason"],
  change_remarks: ["change_remarks", "remarks"],
  approval_status: ["approval_status"],
  display_code: ["display_code"],
};

/* ================= COMPONENT ================= */

export default function AlternativeStaffTemplateForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "staff-masters",
    "alternative-staff-template",
    ALTERNATIVE_STAFF_TEMPLATE_FIELDS
  );

  const geo = useGeoHierarchy();

  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);

  // All raw staff templates
  const [allStaffTemplates, setAllStaffTemplates] = useState<StaffTemplateRaw[]>([]);
  const [staffTemplateOptions, setStaffTemplateOptions] = useState<Option[]>([]);

  const [driverOptions, setDriverOptions] = useState<Option[]>([]);
  const [operatorOptions, setOperatorOptions] = useState<Option[]>([]);
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);

  const templateSelectedByUser = useRef(false);
  const editDataLoaded = useRef(false);

  const { encScheduleMasters, encAlternativeStaffTemplate } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encAlternativeStaffTemplate);

  const [allAlternativeTemplatesData, setAllAlternativeTemplatesData] = useState<any[]>([]);
  const [selectedStaffTemplateData, setSelectedStaffTemplateData] = useState<any>(null);

  /* ================= HELPERS ================= */

  const normalizeRole = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const normalizeActiveStatus = (value: StaffRecord["active_status"]): boolean => {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "active";
  };

  const getStaffRole = (staff: StaffRecord): string =>
    normalizeRole(
      staff.governmentusertype_name ||
        staff.staffusertype_name ||
        staff.contractorusertype_name ||
        staff.designation_name ||
        staff.designation ||
        staff.designation_group
    );

  const isDriverRole = (staff: StaffRecord): boolean => {
    const role = getStaffRole(staff);
    return role === "driver" || role.includes("driver");
  };

  const isOperatorRole = (staff: StaffRecord): boolean => {
    const role = getStaffRole(staff);
    return (
      role === "operator" ||
      role.includes("operator") ||
      role.includes("collector") ||
      role.includes("inspector")
    );
  };

  const isStaffRow = (staff: StaffRecord): boolean => {
    const userType = normalizeRole(staff.user_type_name);
    return !userType || userType === "staff" || userType === "contractor";
  };

  const isActiveStaff = (staff: StaffRecord): boolean => {
    if (staff.is_deleted === true) return false;
    if (typeof staff.is_active === "boolean") return staff.is_active;
    return normalizeActiveStatus(staff.active_status);
  };

  const getStaffDisplayName = (staff: StaffRecord): string =>
    String(
      staff.employee_name ?? staff.staff_name ?? staff.username ?? staff.staff_unique_id ?? staff.unique_id ?? ""
    ).trim();

  const toEntityId = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      return toEntityId(record.staff_unique_id ?? record.unique_id ?? record.id ?? record.value);
    }
    return String(value).trim();
  };

  const getStaffId = (staff: StaffRecord): string =>
    String(staff.staff_unique_id ?? staff.unique_id ?? "").trim();

  const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
    if (!value || items.some((item) => String(item.value) === value)) return items;
    return [{ value, label: label || value }, ...items];
  };

  const toStaffOption = (staff: StaffRecord): Option => {
    return {
      value: getStaffId(staff),
      label: getStaffDisplayName(staff),
    };
  };

  /* ============================
     LOAD RAW TEMPLATES + STAFF RECORDS
  ============================ */

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      staffTemplateApi.readAll() as Promise<any>,
      alternativeStaffTemplateApi.readAll() as Promise<any>,
    ])
      .then(([templatesRes, altRes]: [any, any]) => {
        if (cancelled) return;

        // Store all raw template records
        const templateRows: StaffTemplateRaw[] = Array.isArray(templatesRes)
          ? templatesRes
          : Array.isArray(templatesRes?.results)
            ? templatesRes.results
            : Array.isArray(templatesRes?.data)
              ? templatesRes.data
              : Array.isArray(templatesRes?.data?.results)
                ? templatesRes.data.results
                : [];
        setAllStaffTemplates(templateRows);

        // All alternative templates for overlap check
        const altRows: any[] = Array.isArray(altRes)
          ? altRes
          : Array.isArray(altRes?.data)
            ? altRes.data
            : Array.isArray(altRes?.results)
              ? altRes.results
              : [];
        setAllAlternativeTemplatesData(altRows);
      })
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      });

    return () => { cancelled = true; };
  }, [t]);

  /* ============================
     LOAD STAFF (SCOPED TO THE INHERITED/SELECTED LOCAL BODY)
     — geo is populated either by picking a Staff Template (create mode)
       or by geo.hydrate(rec) when an existing record loads (edit mode).
  ============================ */

  useEffect(() => {
    if (!geo.hierarchyId) {
      setStaffRecords([]);
      return;
    }

    const geoPayload = geo.buildPayload();
    const geoParams: Record<string, string> = {};
    GEO_PAYLOAD_KEYS.forEach((key) => {
      const value = (geoPayload as Record<string, any>)[key];
      if (value) geoParams[key] = String(value);
    });

    staffCreationApi.readAll({ params: { active_status: 1, ...geoParams } })
      .then((staffRes: any) => {
        const staffPayload: any = staffRes;
        const data = Array.isArray(staffPayload)
          ? staffPayload
          : Array.isArray(staffPayload?.results)
            ? staffPayload.results
            : Array.isArray(staffPayload?.data?.results)
              ? staffPayload.data.results
              : Array.isArray(staffPayload?.data)
                ? staffPayload.data
                : [];
        const staff = data.filter(
          (u: StaffRecord) => isStaffRow(u) && isActiveStaff(u) && getStaffId(u)
        );
        setStaffRecords(staff);
      })
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      });
  }, [geo.stateId, geo.districtId, geo.hierarchyLevel, geo.hierarchyId, t]);

  /* ============================
     POPULATE DROPDOWNS FROM STAFF RECORDS (scoped by role only)
  ============================ */

  useEffect(() => {
    setStaffTemplateOptions(
      allStaffTemplates.map((tpl) => ({
        value: String(tpl.unique_id),
        label: staffTemplateLabel(tpl),
      }))
    );

    setDriverOptions(
      staffRecords.filter(isDriverRole).map((staff) => toStaffOption(staff))
    );

    setOperatorOptions(
      staffRecords.filter(isOperatorRole).map((staff) => toStaffOption(staff))
    );
  }, [allStaffTemplates, staffRecords]);

  /* ============================
     EDIT MODE — load saved values
  ============================ */

  useEffect(() => {
    if (!isEdit || !id) return;

    let cancelled = false;
    setLoading(true);
    templateSelectedByUser.current = false;

    alternativeStaffTemplateApi.read(id)
      .then((rec: any) => {
        if (cancelled) return;
        const staffTemplateId = toEntityId(rec.staff_template ?? rec.staff_template_id);
        const driverId = toEntityId(rec.driver ?? rec.driver_id);
        const operatorId = toEntityId(rec.operator ?? rec.operator_id);
        const extraOperatorIds = Array.isArray(rec.extra_operator)
          ? rec.extra_operator.map(toEntityId).filter(Boolean)
          : Array.isArray(rec.extra_operator_id)
            ? rec.extra_operator_id.map(toEntityId).filter(Boolean)
          : [];

        setFormData({
          staff_template: staffTemplateId,
          effective_date: rec.effective_date ?? "",
          from_date: rec.from_date ?? "",
          to_date: rec.to_date ?? "",
          driver: driverId,
          operator: operatorId,
          extra_operator: extraOperatorIds,
          change_reason: rec.change_reason ?? "",
          change_remarks: rec.change_remarks ?? "",
          approval_status: rec.approval_status,
          display_code: rec.display_code,
        });
        setStaffTemplateOptions((items) =>
          ensureOption(items, staffTemplateId, rec.staff_template_display_code),
        );
        setDriverOptions((items) => ensureOption(items, driverId, rec.driver_name));
        setOperatorOptions((items) => ensureOption(items, operatorId, rec.operator_name));

        geo.hydrate(rec);

        editDataLoaded.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  /* ============================
     AUTO FILL FROM TEMPLATE (create mode only)
     Fetch the freshly selected parent template and hydrate driver/operator +
     the full geo hierarchy from that exact record — no intermediate state, so
     there is no window where a stale/partial template is hydrated.
  ============================ */

  useEffect(() => {
    if (!templateSelectedByUser.current || !formData.staff_template) {
      setSelectedStaffTemplateData(null);
      return;
    }
    let cancelled = false;
    staffTemplateApi.read(formData.staff_template)
      .then((tpl: any) => {
        if (cancelled) return;
        setSelectedStaffTemplateData(tpl);
        setFormData((p) => ({
          ...p,
          driver: tpl.driver_id ?? "",
          operator: tpl.operator_id ?? "",
          extra_operator: Array.isArray(tpl.extra_operator_id)
            ? tpl.extra_operator_id.map(toEntityId).filter(Boolean)
            : [],
        }));
        // Inherit the parent staff template's geo hierarchy (editable afterward).
        geo.hydrate(tpl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.staff_template]);

  /* ============================
     VALIDATE SELECTIONS WHEN OPTIONS CHANGE
     — skipped in edit mode until scoped options are populated
  ============================ */

  useEffect(() => {
    if (
      isEdit &&
      (!editDataLoaded.current ||
        (driverOptions.length === 0 && operatorOptions.length === 0))
    ) {
      return;
    }

    setFormData((prev) => {
      let hasChanges = false;
      const next = { ...prev };

      if (prev.driver && driverOptions.length > 0) {
        const valid = driverOptions.some(
          (opt) => String(opt.value) === prev.driver
        );
        if (!valid) { next.driver = ""; hasChanges = true; }
      }

      if (prev.operator && operatorOptions.length > 0) {
        const valid = operatorOptions.some(
          (opt) => String(opt.value) === prev.operator
        );
        if (!valid) { next.operator = ""; hasChanges = true; }
      }

      if (operatorOptions.length > 0) {
        const validIds = new Set([
          ...operatorOptions.map((opt) => String(opt.value)),
          ...staffRecords.map(getStaffId).filter(Boolean),
        ]);
        const filteredExtras = next.extra_operator.filter(
          (v) =>
            validIds.has(v) &&
            v !== next.driver &&
            v !== next.operator
        );
        if (filteredExtras.length !== next.extra_operator.length) {
          next.extra_operator = filteredExtras;
          hasChanges = true;
        }
      }

      return hasChanges ? next : prev;
    });
  }, [driverOptions, operatorOptions, isEdit]);

  /* ============================
     SUBMIT
  ============================ */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      showField("approval_status") &&
      isEdit &&
      formData.approval_status === "APPROVED"
    ) {
      Swal.fire("Warning", "Approved records cannot be modified.", "warning");
      return;
    }

    // from_date must be <= to_date
    if (formData.from_date && formData.to_date && formData.from_date > formData.to_date) {
      Swal.fire("Validation Error", "From date must be on or before the To date.", "error");
      return;
    }

    // Overlap check: same staff_template, overlapping [from_date, to_date]
    if (formData.from_date && formData.to_date && formData.staff_template) {
      const allRecords: any[] = allAlternativeTemplatesData;

      const overlapping = allRecords.filter((rec: any) => {
        if (String(rec.staff_template) !== String(formData.staff_template)) return false;
        if (isEdit && String(rec.unique_id ?? rec.id ?? "") === String(id)) return false;
        const recFrom: string = rec.from_date ?? "";
        const recTo: string = rec.to_date ?? "";
        if (!recFrom || !recTo) return false;
        return formData.from_date <= recTo && recFrom <= formData.to_date;
      });

      if (overlapping.length > 0) {
        const confirm = await Swal.fire({
          title: "Overlap Warning",
          text: `The selected date range overlaps with ${overlapping.length} existing record(s) for this staff template. Do you want to continue?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, continue",
          cancelButtonText: "Cancel",
        });
        if (!confirm.isConfirmed) return;
      }
    }

    const rawPayload = {
      staff_template: formData.staff_template,
      effective_date: formData.effective_date,
      from_date: formData.from_date || null,
      to_date: formData.to_date || null,
      driver: formData.driver,
      operator: formData.operator,
      extra_operator: formData.extra_operator,
      change_reason: formData.change_reason,
      change_remarks: formData.change_remarks || null,
      ...geo.buildPayload(),
    };
    const payload = filterPayload(rawPayload, GEO_PAYLOAD_KEYS);

    setLoading(true);

    try {
      if (isEdit && id) {
        await alternativeStaffTemplateApi.update(id, payload);
      } else {
        await alternativeStaffTemplateApi.create(payload);
      }

      Swal.fire("Success", "Saved successfully", "success");
        navigate(ENC_LIST_PATH);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.staff_template?.[0] ||
        err?.response?.data?.effective_date?.[0] ||
        "Error occurred";

      Swal.fire("Save failed", errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     COMPUTED OPTIONS FOR RENDER
     — "WithCurrent" variants guarantee the saved value
       is always present so the dropdown shows its label
       even before scoped data loads
  ============================ */

  // Staff template: inject saved option if not yet in scoped list
  const staffTemplateOptionsWithCurrent = (() => {
    if (!isEdit || !formData.staff_template) return staffTemplateOptions;
    const already = staffTemplateOptions.some(
      (o) => o.value === formData.staff_template
    );
    if (already) return staffTemplateOptions;
    const raw = allStaffTemplates.find(
      (t) => String(t.unique_id) === formData.staff_template
    );
    return [
      {
        value: formData.staff_template,
        label: raw ? staffTemplateLabel(raw) : formData.staff_template,
      },
      ...staffTemplateOptions,
    ];
  })();

  // Driver: inject saved option if not yet in scoped list
  const driverOptionsWithCurrent = (() => {
    if (!isEdit || !formData.driver) return driverOptions;
    const already = driverOptions.some((o) => o.value === formData.driver);
    if (already) return driverOptions;
    const rec = staffRecords.find((s) => getStaffId(s) === formData.driver);
    if (!rec) return driverOptions;
    return [toStaffOption(rec), ...driverOptions];
  })();

  // Operator: exclude selected driver + inject saved option if not yet in scoped list
  const operatorOptionsWithCurrent = (() => {
    const base = operatorOptions.filter((o) => o.value !== formData.driver);
    if (!isEdit || !formData.operator) return base;
    const already = base.some((o) => o.value === formData.operator);
    if (already) return base;
    const rec = staffRecords.find((s) => getStaffId(s) === formData.operator);
    if (!rec) return base;
    return [toStaffOption(rec), ...base];
  })();

  // Extra operator: exclude driver and operator
  const availableExtraOperatorOptions = operatorOptions.filter(
    (o) => o.value !== formData.driver && o.value !== formData.operator
  );
  formData.extra_operator.forEach((value) => {
    if (
      value &&
      value !== formData.driver &&
      value !== formData.operator &&
      !availableExtraOperatorOptions.some((option) => String(option.value) === value)
    ) {
      const staff = staffRecords.find((item) => getStaffId(item) === value);
      if (staff) availableExtraOperatorOptions.unshift(toStaffOption(staff));
    }
  });

  /* ============================
     RENDER
  ============================ */

  return (
    <div className="p-6">
      <ComponentCard
        title={isEdit ? "Edit Alternative Staff" : "Add Alternative Staff"}
        desc="Configure temporary or permanent staff substitution"
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {isEdit && formData.display_code && showField("display_code") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-lg font-semibold text-blue-900">
                {formData.display_code}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">

            {/* STAFF TEMPLATE */}
            {showField("staff_template") && (
              <div>
                <Label>Staff Template</Label>
                <Select
                  value={formData.staff_template}
                  options={staffTemplateOptionsWithCurrent}
                  disabled={isEdit}
                  placeholder={t("common.select_option")}
                  onChange={(v) => {
                    templateSelectedByUser.current = true;
                    setFormData((p) => ({ ...p, staff_template: v }));
                  }}
                />
              </div>
            )}

            {/* GEO HIERARCHY — inherited from the staff template, editable */}
            <GeoHierarchyFields geo={geo} disabled={loading} />

            {/* FROM DATE */}
            {showField("from_date") && (
              <div>
                <Label>
                  {t("admin.reports.trip_summary.filters.from_date") || "From Date"}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <InputField
                  type="date"
                  value={formData.from_date}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, from_date: e.target.value }))
                  }
                  required
                />
              </div>
            )}

            {/* TO DATE */}
            {showField("to_date") && (
              <div>
                <Label>
                  {t("admin.reports.trip_summary.filters.to_date") || "To Date"}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <InputField
                  type="date"
                  value={formData.to_date}
                  min={formData.from_date || undefined}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, to_date: e.target.value }))
                  }
                  required
                />
              </div>
            )}

            {/* EFFECTIVE DATE */}
            {/* {showField("effective_date") && (
              <div>
                <Label>
                  {t("admin.alternative_staff_template.effective_date")}
                </Label>
                <InputField
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      effective_date: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            )} */}

            {/* DRIVER */}
            {showField("driver") && (
              <div>
                <Label>
                  {t("admin.staff_template.primary_driver") || "Driver"}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={formData.driver}
                  options={driverOptionsWithCurrent}
                  placeholder={t("common.select_option")}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, driver: v }))
                  }
                  required
                />
              </div>
            )}

            {/* OPERATOR */}
            {showField("operator") && (
              <div>
                <Label>
                  {t("admin.staff_template.primary_operator") || "Operator"}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={formData.operator}
                  options={operatorOptionsWithCurrent}
                  placeholder={t("common.select_option")}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, operator: v }))
                  }
                  required
                />
              </div>
            )}

            {/* EXTRA OPERATOR */}
            {showField("extra_operator") && (
              <div>
                <Label>
                  {t("admin.staff_template.extra_staff") || "Extra Operator"}
                </Label>
                <MultiSelect
                  value={formData.extra_operator}
                  options={availableExtraOperatorOptions}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      extra_operator: Array.isArray(e.value)
                        ? e.value.map(String)
                        : [],
                    }))
                  }
                  optionLabel="label"
                  optionValue="value"
                  maxSelectedLabels={3}
                  placeholder={t("common.select_option")}
                  className="!flex !h-10 !w-full !items-center !justify-between !rounded-md !border !border-input !bg-background !px-3 !py-2 !text-sm !shadow-none !ring-offset-background focus:!outline-none focus:!ring-2 focus:!ring-ring focus:!ring-offset-2 disabled:!cursor-not-allowed disabled:!opacity-50"
                  pt={{
                    labelContainer: {
                      className: "!flex !flex-1 !items-center !overflow-hidden",
                    },
                    label: {
                      className:
                        "!m-0 !block !truncate !p-0 !text-sm !leading-5 !text-gray-900",
                    },
                    trigger: {
                      className:
                        "!ml-2 !flex !h-4 !w-4 !shrink-0 !items-center !justify-center !text-gray-500",
                    },
                    dropdownIcon: {
                      className: "!h-4 !w-4 !opacity-50",
                    },
                    panel: {
                      className: "!z-[80] !rounded-md !border !bg-white !shadow-md",
                    },
                  }}
                  filter
                />
              </div>
            )}

            {/* CHANGE REASON */}
            {showField("change_reason") && (
              <div>
                <Label>
                  {t("admin.alternative_staff_template.change_reason") ||
                    "Change Reason"}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <InputField
                  value={formData.change_reason}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      change_reason: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            )}

          </div>

          {/* REMARKS */}
          {showField("change_remarks") && (
            <div>
              <Label>
                {t("admin.alternative_staff_template.change_remarks") ||
                  "Remarks"}
              </Label>
              <InputField
                value={formData.change_remarks}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    change_remarks: e.target.value,
                  }))
                }
              />
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="bg-green-custom text-white px-5 py-2 rounded-lg disabled:opacity-50"
              disabled={loading}
            >
              {loading ? t("common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(ENC_LIST_PATH)}
              className="border border-gray-300 px-5 py-2 rounded-lg text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>

        </form>
      </ComponentCard>
    </div>
  );
}
