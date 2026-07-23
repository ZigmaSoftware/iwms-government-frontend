import type { FamilyMember, FormDataType, Option } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { api } from "@/api";
import PasswordInput from "@/components/form/input/PasswordInput";
import { toSwalMessage } from "@/lib/zodErrors";
import { customerCreationSchema } from "@/schemas/masters/customerMasters/customerCreation.schema";

import {
  areaTypeApi,
  corporationApi,
  countryApi,
  customerCreationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  propertiesApi,
  stateApi,
  subPropertiesApi,
  townPanchayatApi,
  wasteTypeApi,
} from "@/helpers/admin";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import {
  mergeWithScopeOptionExtra,
  scopeOption,
} from "../../shared/dataScopeOptions";
import type { ScopeLevel } from "../../shared/dataScopeOptions";

/* ===============================
   MODULE-LEVEL HELPERS
================================ */

const normalizeEntityId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.unique_id ?? record.id ?? record.value ?? "").trim();
  }
  return String(value).trim();
};

const normalizeIdArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => normalizeEntityId(item)).filter(Boolean);
  return [normalizeEntityId(value)].filter(Boolean);
};

const resolveId = (o: any) => String(o?.unique_id ?? o?.id ?? "");

const normalizeActive = (arr: any[]) =>
  arr.filter((i) => i?.is_active !== false && i?.is_deleted !== true);

const resolveOptionValue = (
  items: any[],
  rawId: any,
  nameField: string,
  nameValue?: string,
): string => {
  const strId = String(rawId ?? "").trim();
  if (!strId && !nameValue) return "";
  if (strId) {
    const byUniqueId = items.find((item) => String(item.unique_id ?? "") === strId);
    if (byUniqueId) return String(byUniqueId.unique_id ?? byUniqueId.id ?? "");
    const byId = items.find((item) => String(item.id ?? "") === strId);
    if (byId) return String(byId.unique_id ?? byId.id ?? "");
  }
  if (nameValue) {
    const lower = nameValue.toLowerCase();
    const byName = items.find((item) => String(item[nameField] ?? "").toLowerCase() === lower);
    if (byName) return String(byName.unique_id ?? byName.id ?? "");
  }
  return strId;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    return (
      Object.entries(data as Record<string, unknown>)
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
        )
        .join("\n") || fallback
    );
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/* ===============================
   TYPES & CONSTANTS
================================ */

const CUSTOMER_CREATION_FIELDS: Record<string, string[]> = {
  customer_name: ["customer_name", "name"],
  contact_no: ["contact_no", "mobile"],
  username: ["username"],
  email: ["email"],
  password: ["password"],
  building_no: ["building_no"],
  street: ["street"],
  area: ["area"],
  pincode: ["pincode"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  sqft: ["sqft"],
  water_consumption_lpd: ["water_consumption_lpd"],
  waste_collection_kg_per_day: ["waste_collection_kg_per_day"],
  property_id: ["property_id", "property"],
  sub_property_id: ["sub_property_id", "sub_property"],
  waste_type_ids: ["waste_type_ids", "waste_types", "waste_type"],
  id_proof_type: ["id_proof_type"],
  id_no: ["id_no"],
  member_count: ["member_count"],
  family_members: ["family_members"],
  country_id: ["country_id", "country"],
  state_id: ["state_id", "state"],
  district_id: ["district_id", "district"],
  area_type_id: ["area_type_id", "area_type"],
  location_node_id: ["location_node_id", "location_node"],
  corporation_id: ["corporation_id", "corporation"],
  municipality_id: ["municipality_id", "municipality"],
  town_panchayat_id: ["town_panchayat_id", "town_panchayat"],
  panchayat_union_id: ["panchayat_union_id", "panchayat_union"],
  panchayat_id: ["panchayat_id", "panchayat"],
  is_active: ["is_active"],
  is_bulkwaste_generator: ["is_bulkwaste_generator"],
  apartment_name: ["apartment_name"],
  block_no: ["block_no"],
  flat_no: ["flat_no"],
  villa_no: ["villa_no"],
  industry_name: ["industry_name"],
  industry_type: ["industry_type"],
};

type HierarchyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string; optionLabel: string }> = [
  { value: "corporation_id", label: "Corporation", optionLabel: "corporation_name" },
  { value: "municipality_id", label: "Municipality", optionLabel: "municipality_name" },
  { value: "town_panchayat_id", label: "Town Panchayat", optionLabel: "town_panchayat_name" },
  { value: "panchayat_union_id", label: "Panchayat Union", optionLabel: "union_name" },
  { value: "panchayat_id", label: "Panchayat", optionLabel: "panchayat_name" },
];

// Bulk waste generator auto-detection thresholds (must mirror backend thresholds)
const BULK_WASTE_SQFT_THRESHOLD = 20000;
const BULK_WASTE_WATER_LPD_THRESHOLD = 40000;
const BULK_WASTE_COLLECTION_KG_THRESHOLD = 100;

// Waste types allowed for Residential properties
const RESIDENTIAL_WASTE_TYPE_KEYWORDS = ["dry", "wet", "mixed", "sanitary"];

// Password rule: 8-12 chars, at least one uppercase, one lowercase, one special character
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,12}$/;
const PASSWORD_RULE_MESSAGE =
  "Password must be 8-12 characters long and include at least one uppercase letter, one lowercase letter, and one special character.";

type AreaType = "urban" | "rural";
const areaTypeHierarchyMap: Record<AreaType, HierarchyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

type CustomerDropdowns = {
  districts: any[];
  areaTypes: any[];
  states: any[];
  countries: any[];
  properties: any[];
  subProperties: any[];
  corporations: any[];
  municipalities: any[];
  townPanchayats: any[];
  panchayatUnions: any[];
  panchayats: any[];
  wasteTypes: any[];
};

type CustomerInitialPayload = FormDataType & {
  selectedAreaType: AreaType | "";
  selectedHierarchyType: HierarchyLevel | "";
  hierarchyItemLabel: string;
  passwordCrtDate: string | null;
  customerCreatedAt: string | null;
};

type CustomerEditorProps = {
  initialPayload: CustomerInitialPayload;
  dropdowns: CustomerDropdowns;
  isEdit: boolean;
  isSubmitting: boolean;
  customerId?: string;
  onSubmit: (payload: any) => Promise<void>;
  onCancel: () => void;
};

/* ===============================
   PASSWORD SECURITY
================================ */
const PASSWORD_EXPIRY_DAYS = 90;
const PASSWORD_WARN_DAYS = 60;

function getPasswordAgeDays(passwordCrtDate: string | null): number | null {
  if (!passwordCrtDate) return null;
  const diff = Date.now() - new Date(passwordCrtDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function PasswordPriorityBadge({ ageDays }: { ageDays: number | null }) {
  if (ageDays === null) return null;
  if (ageDays >= PASSWORD_EXPIRY_DAYS) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
        Password Expired — Change Required
      </span>
    );
  }
  if (ageDays >= PASSWORD_WARN_DAYS) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
        <span className="material-symbols-outlined text-[14px] leading-none">schedule</span>
        Password Expiring Soon ({PASSWORD_EXPIRY_DAYS - ageDays} days left)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
      Password OK ({PASSWORD_EXPIRY_DAYS - ageDays} days remaining)
    </span>
  );
}

function CustomerChangePasswordModal({
  customerId,
  onClose,
  onSuccess,
}: {
  customerId: string;
  onClose: () => void;
  onSuccess: (newDate: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/admin-change-password/", {
        target_type: "customer",
        target_id: customerId,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      Swal.fire({ icon: "success", title: "Password Changed", text: "Password updated successfully." });
      onSuccess(new Date().toISOString());
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Change Password</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cp_new">New Password</Label>
            <PasswordInput
              id="cp_new"
              label=""
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 chars, upper + lower + number"
            />
          </div>
          <div>
            <Label htmlFor="cp_confirm">Confirm New Password</Label>
            <PasswordInput
              id="cp_confirm"
              label=""
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">
            Password must be at least 6 characters with uppercase, lowercase, and a number.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ===============================
   REUSABLE UI COMPONENTS
================================ */

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
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
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
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length > 0 ? (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
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

const FormSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
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
  placeholder,
  type = "text",
  maxLength,
  inputMode,
  step,
  isRequired = true,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "decimal";
  step?: string;
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
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode}
      step={step}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      autoComplete="off"
    />
  </div>
);

const MultiSelectCheckboxes = ({
  label,
  values,
  onChange,
  options,
  isRequired = true,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Option[];
  isRequired?: boolean;
}) => {
  const selected = new Set(values);
  const toggle = (value: string) => {
    if (selected.has(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };
  return (
    <div className="space-y-2 md:col-span-2">
      <Label className="text-sm font-medium text-gray-700">
        {label}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-gray-300 bg-white p-3 md:grid-cols-2">
        {options.length > 0 ? (
          options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-gray-500">No options available</p>
        )}
      </div>
    </div>
  );
};

const FamilyMembersRepeater = ({
  members,
  onChange,
  idProofTypeOptions,
  label,
  maxCount,
}: {
  members: FamilyMember[];
  onChange: (members: FamilyMember[]) => void;
  idProofTypeOptions: Option[];
  label: string;
  maxCount: number | null;
}) => {
  const atLimit = maxCount !== null && members.length >= maxCount;

  const updateMember = (index: number, patch: Partial<FamilyMember>) => {
    onChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };
  const removeMember = (index: number) => {
    onChange(members.filter((_, i) => i !== index));
  };
  const addMember = () => {
    if (atLimit) return;
    onChange([...members, { member_name: "", id_proof_type: "", id_no: "" }]);
  };

  return (
    <div className="space-y-3 md:col-span-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">{label}</Label>
        <button
          type="button"
          onClick={addMember}
          disabled={atLimit}
          title={atLimit ? "Reached the Member Count limit" : undefined}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          + Add Member
        </button>
      </div>
      {maxCount !== null && (
        <p className="text-xs text-gray-500">
          {members.length}/{maxCount} member(s) added — set Member Count above to add more rows.
        </p>
      )}
      {members.length === 0 ? (
        <p className="text-sm text-gray-500">No family members added.</p>
      ) : (
        <div className="space-y-3">
          {members.map((member, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Input
                value={member.member_name}
                onChange={(e) => updateMember(index, { member_name: e.target.value })}
                placeholder="Member name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              <Select
                value={member.id_proof_type || undefined}
                onValueChange={(v) => updateMember(index, { id_proof_type: v })}
              >
                <SelectTrigger className="w-full border border-gray-300 rounded-md bg-white">
                  <SelectValue placeholder="ID proof type" />
                </SelectTrigger>
                <SelectContent>
                  {idProofTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={member.id_no}
                onChange={(e) => updateMember(index, { id_no: e.target.value })}
                placeholder="ID number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => removeMember(index)}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PropertySelectionStep = ({
  properties,
  subProperties,
  selectedProperty,
  selectedSubProperty,
  onPropertyChange,
  onSubPropertyChange,
  onNext,
  showField,
  t,
}: {
  properties: any[];
  subProperties: any[];
  selectedProperty: string;
  selectedSubProperty: string;
  onPropertyChange: (v: string) => void;
  onSubPropertyChange: (v: string) => void;
  onNext: () => void;
  showField: (fieldKey: string) => boolean;
  t: any;
}) => {
  const filteredSubProps = subProperties.filter(
    (sp: any) =>
      !selectedProperty ||
      normalizeEntityId(sp.property_id ?? sp.property) === selectedProperty
  );
  const isStepComplete =
    (!showField("property_id") || selectedProperty) &&
    (!showField("sub_property_id") || selectedSubProperty);

  return (
    <ComponentCard
      title={
        t("admin.customer_creation.select_property_subproperty") ||
        "Select Property & Sub-Property"
      }
    >
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            📌{" "}
            {t("admin.customer_creation.step_1_info") ||
              "Step 1 of 2: Please select a Property and Sub-Property to proceed"}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {showField("property_id") && (
            <ShadcnSelect
              label={t("admin.customer_creation.property") || "Property"}
              value={selectedProperty}
              onChange={onPropertyChange}
              options={properties.map((p: any) => ({
                value: String(p?.unique_id ?? p?.id ?? ""),
                label: p.property_name,
              }))}
              placeholder={
                t("admin.customer_creation.property_placeholder") ||
                "Select property"
              }
            />
          )}
          {showField("sub_property_id") && (
            <ShadcnSelect
              label={t("admin.customer_creation.sub_property") || "Sub Property"}
              value={selectedSubProperty}
              onChange={onSubPropertyChange}
              options={filteredSubProps.map((sp: any) => ({
                value: String(sp?.unique_id ?? sp?.id ?? ""),
                label: sp.sub_property_name,
              }))}
              placeholder={
                t("admin.customer_creation.sub_property_placeholder") ||
                "Select sub property"
              }
            />
          )}
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
          >
            {t("common.cancel") || "Cancel"}
          </button>
          <button
            type="button"
            disabled={!isStepComplete}
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
          >
            {t("common.next") || "Next"}
          </button>
        </div>
      </div>
    </ComponentCard>
  );
};

/* ===============================
   INNER EDITOR
================================ */
function CustomerEditor({
  initialPayload,
  dropdowns,
  isEdit,
  isSubmitting,
  customerId,
  onSubmit,
  onCancel,
}: CustomerEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } = useFieldVisibility(
    "customer-master",
    "customer-creation",
    CUSTOMER_CREATION_FIELDS,
  );

  const tOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [step, setStep] = useState(isEdit ? 1 : 0);

  const [formData, setFormData] = useState<FormDataType>({
    customer_name: initialPayload.customer_name,
    contact_no: initialPayload.contact_no,
    username: initialPayload.username,
    email: initialPayload.email,
    password: initialPayload.password,
    building_no: initialPayload.building_no,
    street: initialPayload.street,
    area: initialPayload.area,
    pincode: initialPayload.pincode,
    latitude: initialPayload.latitude,
    longitude: initialPayload.longitude,
    sqft: initialPayload.sqft,
    water_consumption_lpd: initialPayload.water_consumption_lpd,
    waste_collection_kg_per_day: initialPayload.waste_collection_kg_per_day,
    property_id: initialPayload.property_id,
    sub_property_id: initialPayload.sub_property_id,
    id_proof_type: initialPayload.id_proof_type,
    id_no: initialPayload.id_no,
    member_count: initialPayload.member_count,
    family_members: initialPayload.family_members,
    country_id: initialPayload.country_id,
    state_id: initialPayload.state_id,
    district_id: initialPayload.district_id,
    area_type_id: initialPayload.area_type_id,
    location_node_id: initialPayload.location_node_id,
    corporation_id: initialPayload.corporation_id,
    municipality_id: initialPayload.municipality_id,
    town_panchayat_id: initialPayload.town_panchayat_id,
    panchayat_union_id: initialPayload.panchayat_union_id,
    panchayat_id: initialPayload.panchayat_id,
    waste_type_ids: initialPayload.waste_type_ids,
    is_active: initialPayload.is_active,
    is_bulkwaste_generator: initialPayload.is_bulkwaste_generator,
    apartment_name: initialPayload.apartment_name,
    block_no: initialPayload.block_no,
    flat_no: initialPayload.flat_no,
    villa_no: initialPayload.villa_no,
    industry_name: initialPayload.industry_name,
    industry_type: initialPayload.industry_type,
  });

  const [selectedAreaType, setSelectedAreaType] = useState<AreaType | "">(
    initialPayload.selectedAreaType,
  );
  const [selectedHierarchyType, setSelectedHierarchyType] = useState<HierarchyLevel | "">(
    initialPayload.selectedHierarchyType,
  );
  const [hierarchyItemLabel, setHierarchyItemLabel] = useState(
    initialPayload.hierarchyItemLabel,
  );
  const [passwordCrtDate, setPasswordCrtDate] = useState<string | null>(
    initialPayload.passwordCrtDate,
  );
  const [customerCreatedAt] = useState<string | null>(initialPayload.customerCreatedAt);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const update = (key: keyof FormDataType, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  /* ===============================
     COMPUTED OPTIONS
  ================================ */
  const filteredStates = useMemo(
    () =>
      dropdowns.states.filter(
        (s: any) =>
          !formData.country_id ||
          normalizeEntityId(s.country_id ?? s.country) === formData.country_id,
      ),
    [dropdowns.states, formData.country_id],
  );

  const filteredDistricts = useMemo(
    () =>
      dropdowns.districts.filter(
        (d: any) =>
          !formData.state_id ||
          normalizeEntityId(d.state_id ?? d.state) === formData.state_id,
      ),
    [dropdowns.districts, formData.state_id],
  );

  const hierarchyDropdownMap = useMemo<Record<HierarchyLevel, any[]>>(
    () => ({
      corporation_id: dropdowns.corporations,
      municipality_id: dropdowns.municipalities,
      town_panchayat_id: dropdowns.townPanchayats,
      panchayat_union_id: dropdowns.panchayatUnions,
      panchayat_id: dropdowns.panchayats,
    }),
    [dropdowns],
  );

  const filteredAreaTypes = useMemo(
    () =>
      dropdowns.areaTypes.filter(
        (areaType: any) =>
          !formData.district_id ||
          normalizeEntityId(areaType.district_id ?? areaType.district) === formData.district_id,
      ),
    [dropdowns.areaTypes, formData.district_id],
  );

  const availableHierarchyLevels = useMemo(() => {
    if (!formData.district_id || !selectedAreaType) return [];
    const levelsForAreaType = areaTypeHierarchyMap[selectedAreaType];
    const filtered = hierarchyLevels.filter(
      (level) =>
        levelsForAreaType.includes(level.value) &&
        hierarchyDropdownMap[level.value].some((item: any) =>
          normalizeEntityId(item.district_id ?? item.district) === formData.district_id,
        ),
    );
    const currentLevel = hierarchyLevels.find((l) => l.value === selectedHierarchyType);
    if (
      currentLevel &&
      levelsForAreaType.includes(selectedHierarchyType as HierarchyLevel) &&
      !filtered.find((l) => l.value === selectedHierarchyType)
    ) {
      return [...filtered, currentLevel];
    }
    return filtered.length > 0
      ? filtered
      : hierarchyLevels.filter((l) => levelsForAreaType.includes(l.value));
  }, [formData.district_id, selectedAreaType, hierarchyDropdownMap, selectedHierarchyType]);

  const selectedHierarchyId =
    (selectedHierarchyType && formData[selectedHierarchyType]) || "";

  const resolvedAreaTypeId = useMemo(() => {
    const selectedById = filteredAreaTypes.find(
      (areaType: any) => resolveId(areaType) === formData.area_type_id,
    );
    if (selectedById) return resolveId(selectedById);

    const areaTypeValue = String(formData.area_type_id || selectedAreaType || "").toLowerCase();
    if (!areaTypeValue) return "";

    const matchingAreaType = filteredAreaTypes.find((areaType: any) => {
      const areaName = String(areaType.name ?? areaType.area_type_name ?? "").toLowerCase();
      return areaName === areaTypeValue || areaName.includes(areaTypeValue) || areaTypeValue.includes(areaName);
    });
    return matchingAreaType ? resolveId(matchingAreaType) : "";
  }, [filteredAreaTypes, formData.area_type_id, selectedAreaType]);

  const destinationOptions = useMemo((): Option[] => {
    if (!selectedHierarchyType) return [];
    const all: any[] = hierarchyDropdownMap[selectedHierarchyType as HierarchyLevel];
    const filtered = formData.district_id
      ? all.filter(
          (item: any) =>
            normalizeEntityId(item.district_id ?? item.district) === formData.district_id,
        )
      : all;
    const base = (filtered.length > 0 ? filtered : all).reduce(
      (acc: Option[], item: any) => {
        const id = resolveId(item);
        if (!id || acc.some((o) => o.value === id)) return acc;
        const optKey =
          hierarchyLevels.find((l) => l.value === selectedHierarchyType)?.optionLabel ||
          "name";
        acc.push({ value: id, label: item[optKey] || item.name || id });
        return acc;
      },
      [],
    );
    if (selectedHierarchyId && !base.find((o) => o.value === selectedHierarchyId)) {
      base.push({ value: selectedHierarchyId, label: hierarchyItemLabel || selectedHierarchyId });
    }
    return base;
  }, [
    hierarchyDropdownMap,
    formData.district_id,
    selectedHierarchyType,
    selectedHierarchyId,
    hierarchyItemLabel,
  ]);

  /* ===============================
     HANDLERS
  ================================ */
  const setHierarchyValue = (level: HierarchyLevel, value: string) => {
    setSelectedHierarchyType(level);
    setFormData((prev) => ({
      ...prev,
      location_node_id: "",
      corporation_id: "",
      municipality_id: "",
      town_panchayat_id: "",
      panchayat_union_id: "",
      panchayat_id: "",
      [level]: value,
    }));
  };

  const resetHierarchy = () => {
    setSelectedAreaType("");
    setSelectedHierarchyType("");
    setFormData((prev) => ({
      ...prev,
      location_node_id: "",
      corporation_id: "",
      municipality_id: "",
      town_panchayat_id: "",
      panchayat_union_id: "",
      panchayat_id: "",
    }));
  };

  const resetHierarchyLevel = () => {
    setSelectedHierarchyType("");
    setFormData((prev) => ({
      ...prev,
      location_node_id: "",
      corporation_id: "",
      municipality_id: "",
      town_panchayat_id: "",
      panchayat_union_id: "",
      panchayat_id: "",
    }));
  };

  /* ===============================
     SUB-PROPERTY TYPE DETECTION
  ================================ */
  const selectedSubProperty = useMemo(
    () => dropdowns.subProperties.find((sp: any) => resolveId(sp) === formData.sub_property_id),
    [formData.sub_property_id, dropdowns.subProperties],
  );

  const subName = selectedSubProperty?.sub_property_name?.toLowerCase() || "";
  const isIndividual = subName.includes("individual") || subName.includes("house");
  const isApartment = subName.includes("apartment");
  const isVilla = subName.includes("villa");
  const isIndustry = subName.includes("industry");
  const isHierarchySelected = Boolean(selectedHierarchyId);

  /* ===============================
     RESIDENTIAL WASTE TYPE RESTRICTION
  ================================ */
  const selectedProperty = useMemo(
    () => dropdowns.properties.find((p: any) => resolveId(p) === formData.property_id),
    [formData.property_id, dropdowns.properties],
  );
  const isResidentialProperty = (selectedProperty?.property_name || "")
    .toLowerCase()
    .includes("residential");

  const wasteTypeOptions = useMemo(() => {
    const all = dropdowns.wasteTypes.map((wasteType: any) => ({
      value: resolveId(wasteType),
      label: wasteType.waste_type_name || wasteType.name || resolveId(wasteType),
    }));
    if (!isResidentialProperty) return all;
    return all.filter((option) =>
      RESIDENTIAL_WASTE_TYPE_KEYWORDS.some((keyword) =>
        option.label.toLowerCase().includes(keyword),
      ),
    );
  }, [dropdowns.wasteTypes, isResidentialProperty]);

  useEffect(() => {
    if (!isResidentialProperty) return;
    setFormData((prev) => {
      const allowedIds = new Set(wasteTypeOptions.map((o) => o.value));
      const pruned = prev.waste_type_ids.filter((id) => allowedIds.has(id));
      if (pruned.length === prev.waste_type_ids.length) return prev;
      return { ...prev, waste_type_ids: pruned };
    });
  }, [isResidentialProperty, wasteTypeOptions]);

  /* ===============================
     AUTOMATIC BULK WASTE GENERATOR DETECTION
  ================================ */
  const autoBulkWasteGenerator = useMemo(() => {
    const sqftValue = parseFloat(formData.sqft);
    const waterValue = parseFloat(formData.water_consumption_lpd);
    const wasteValue = parseFloat(formData.waste_collection_kg_per_day);
    return (
      (!isNaN(sqftValue) && sqftValue > BULK_WASTE_SQFT_THRESHOLD) ||
      (!isNaN(waterValue) && waterValue > BULK_WASTE_WATER_LPD_THRESHOLD) ||
      (!isNaN(wasteValue) && wasteValue > BULK_WASTE_COLLECTION_KG_THRESHOLD)
    );
  }, [formData.sqft, formData.water_consumption_lpd, formData.waste_collection_kg_per_day]);

  useEffect(() => {
    if (autoBulkWasteGenerator && !formData.is_bulkwaste_generator) {
      update("is_bulkwaste_generator", true);
    }
  }, [autoBulkWasteGenerator]);

  /* ===============================
     FAMILY MEMBERS (OPTIONAL)
  ================================ */
  const idProofTypeOptions: Option[] = useMemo(
    () => [
      { value: "AADHAAR", label: t("admin.customer_creation.id_proof_aadhaar") || "Aadhaar" },
      { value: "VOTER_ID", label: t("admin.customer_creation.id_proof_voter") || "Voter ID" },
      { value: "PAN_CARD", label: t("admin.customer_creation.id_proof_pan") || "PAN Card" },
      { value: "DL", label: t("admin.customer_creation.id_proof_dl") || "Driving License" },
      { value: "PASSPORT", label: t("admin.customer_creation.id_proof_passport") || "Passport" },
    ],
    [t],
  );

  useEffect(() => {
    const count = parseInt(formData.member_count, 10);
    if (isNaN(count) || count < 0) return;
    setFormData((prev) => {
      if (prev.family_members.length === count) return prev;
      if (prev.family_members.length > count) {
        return { ...prev, family_members: prev.family_members.slice(0, count) };
      }
      const additions = Array.from(
        { length: count - prev.family_members.length },
        () => ({ member_name: "", id_proof_type: "", id_no: "" }),
      );
      return { ...prev, family_members: [...prev.family_members, ...additions] };
    });
  }, [formData.member_count]);

  /* ===============================
     VALIDATION
  ================================ */
  const validateForm = (): boolean => {
    const requiredFields = [
      "customer_name",
      "contact_no",
      "email",
      "username",
      "pincode",
      "latitude",
      "longitude",
      "sqft",
      "id_proof_type",
      "id_no",
      "state_id",
      "district_id",
      "property_id",
      "sub_property_id",
      "waste_type_ids",
      ...(!isEdit ? ["password"] : []),
    ].flat();

    const missingFields = getMissingRequiredFields(
      requiredFields,
      (fieldKey) => formData[fieldKey as keyof FormDataType],
    );

    if (missingFields.length > 0) {
      for (const field of missingFields) {
        Swal.fire(
          t("common.warning") || "Warning",
          `${String(field).replace(/_/g, " ")} is required`,
          "warning",
        );
        return false;
      }
    }

    if (!resolvedAreaTypeId) {
      Swal.fire(
        t("common.warning") || "Warning",
        "Area Type is required",
        "warning",
      );
      return false;
    }

    if (!selectedHierarchyType || !selectedHierarchyId) {
      Swal.fire(
        t("common.warning") || "Warning",
        "Local body is required",
        "warning",
      );
      return false;
    }
    if (showField("waste_type_ids") && formData.waste_type_ids.length === 0) {
      Swal.fire(t("common.warning") || "Warning", "waste type is required", "warning");
      return false;
    }
    if (showField("contact_no") && !/^\d{10}$/.test(formData.contact_no)) {
      Swal.fire(
        t("admin.customer_creation.invalid_contact_title") || "Invalid Contact",
        t("admin.customer_creation.invalid_contact_desc") ||
          "Please enter a valid 10-digit contact number",
        "warning",
      );
      return false;
    }
    if (showField("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Swal.fire("Invalid Email", "Please enter a valid email address", "warning");
      return false;
    }
    if (
      showField("password") &&
      (!isEdit || formData.password) &&
      !PASSWORD_PATTERN.test(formData.password)
    ) {
      Swal.fire("Weak Password", PASSWORD_RULE_MESSAGE, "warning");
      return false;
    }
    if (showField("pincode") && !/^\d{6}$/.test(formData.pincode)) {
      Swal.fire(
        t("admin.customer_creation.invalid_pincode_title") || "Invalid Pincode",
        t("admin.customer_creation.invalid_pincode_desc") ||
          "Please enter a valid 6-digit pincode",
        "warning",
      );
      return false;
    }
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    if (
      (showField("latitude") || showField("longitude")) &&
      (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    ) {
      Swal.fire(
        t("admin.customer_creation.invalid_coordinates_title") || "Invalid Coordinates",
        t("admin.customer_creation.invalid_coordinates_desc") ||
          "Please enter valid latitude and longitude",
        "warning",
      );
      return false;
    }
    const sqftValue = parseFloat(formData.sqft);
    if (showField("sqft") && (isNaN(sqftValue) || sqftValue <= 0)) {
      Swal.fire("Invalid Square Feet", "Please enter a valid square feet value", "warning");
      return false;
    }
    if (formData.water_consumption_lpd && parseFloat(formData.water_consumption_lpd) < 0) {
      Swal.fire(
        "Invalid Water Consumption",
        "Please enter a valid water consumption value",
        "warning",
      );
      return false;
    }
    if (
      formData.waste_collection_kg_per_day &&
      parseFloat(formData.waste_collection_kg_per_day) < 0
    ) {
      Swal.fire(
        "Invalid Waste Collection",
        "Please enter a valid waste collection value",
        "warning",
      );
      return false;
    }
    const filledFamilyMemberCount = formData.family_members.filter(
      (m) => m.member_name.trim() || m.id_proof_type.trim() || m.id_no.trim(),
    ).length;
    if (filledFamilyMemberCount > 0) {
      const memberCount = parseInt(formData.member_count, 10);
      const allowedCount = isNaN(memberCount) ? 0 : memberCount;
      if (filledFamilyMemberCount > allowedCount) {
        Swal.fire(
          "Too Many Family Members",
          `Family member ID proof rows (${filledFamilyMemberCount}) cannot exceed the Member Count (${allowedCount}).`,
          "warning",
        );
        return false;
      }
    }
    return true;
  };

  /* ===============================
     SUBMIT
  ================================ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const validation = customerCreationSchema.safeParse(formData);
    if (!validation.success) {
      Swal.fire(t("common.warning") || "Warning", toSwalMessage(validation.error), "warning");
      return;
    }
    const rawPayload = {
      ...formData,
      area_type_id: resolvedAreaTypeId,
      latitude: showField("latitude") ? String(parseFloat(formData.latitude)) : formData.latitude,
      longitude: showField("longitude")
        ? String(parseFloat(formData.longitude))
        : formData.longitude,
      sqft: showField("sqft") ? String(parseFloat(formData.sqft)) : formData.sqft,
      water_consumption_lpd:
        showField("water_consumption_lpd") && formData.water_consumption_lpd
          ? String(parseFloat(formData.water_consumption_lpd))
          : formData.water_consumption_lpd,
      waste_collection_kg_per_day:
        showField("waste_collection_kg_per_day") && formData.waste_collection_kg_per_day
          ? String(parseFloat(formData.waste_collection_kg_per_day))
          : formData.waste_collection_kg_per_day,
      member_count: formData.member_count ? String(parseInt(formData.member_count, 10)) : "",
      family_members: formData.family_members.filter(
        (m) => m.member_name.trim() || m.id_proof_type.trim() || m.id_no.trim(),
      ),
      ...(isEdit && !formData.password ? { password: undefined } : {}),
    };
    await onSubmit(
      filterPayload(rawPayload, [
        "state_id",
        "district_id",
        "area_type_id",
        "corporation_id",
        "municipality_id",
        "town_panchayat_id",
        "panchayat_union_id",
        "panchayat_id",
      ]),
    );
  };

  /* ===============================
     RENDER — STEP 0
  ================================ */
  if (step === 0) {
    return (
      <PropertySelectionStep
        properties={dropdowns.properties}
        subProperties={dropdowns.subProperties}
        selectedProperty={formData.property_id}
        selectedSubProperty={formData.sub_property_id}
        onPropertyChange={(v: string) => {
          update("property_id", v);
          update("sub_property_id", "");
        }}
        onSubPropertyChange={(v: string) => update("sub_property_id", v)}
        onNext={() => setStep(1)}
        showField={showField}
        t={t}
      />
    );
  }

  /* ===============================
     RENDER — STEP 1 (FULL FORM)
  ================================ */
  return (
    <>
      {showChangePassword && customerId && (
        <CustomerChangePasswordModal
          customerId={customerId}
          onClose={() => setShowChangePassword(false)}
          onSuccess={(newDate) => setPasswordCrtDate(newDate)}
        />
      )}
      <ComponentCard
        title={
          isEdit
            ? t("admin.customer_creation.title_edit") || "Edit Customer"
            : t("admin.customer_creation.title_add") || "Add Customer"
        }
      >
        {!isEdit && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              📍{" "}
              {t("admin.customer_creation.step_2_info") ||
                "Step 2 of 2: Fill in the customer details"}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PERSONAL INFORMATION */}
          <FormSection
            title={t("admin.customer_creation.personal_info") || "Personal Information"}
          >
            {showField("customer_name") && (
              <FormInput
                label={t("admin.customer_creation.customer_name") || "Customer Name"}
                value={formData.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
                placeholder="Enter full name"
              />
            )}
            {showField("contact_no") && (
              <FormInput
                label={t("admin.customer_creation.contact_no") || "Contact Number"}
                value={formData.contact_no}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, "");
                  update("contact_no", numericValue);
                }}
                placeholder="10 digit mobile number"
                maxLength={10}
                inputMode="numeric"
              />
            )}
            {showField("username") && (
              <FormInput
                label={t("login.username") || "Username"}
                value={formData.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="Enter username"
              />
            )}
            {showField("email") && (
              <FormInput
                label={t("admin.customer_creation.email") || "Email Address"}
                value={formData.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="Enter email address"
                type="email"
              />
            )}
            {(showField("password") || isEdit) && (
              <div>
                <PasswordInput
                  id="customer_password"
                  label={t("login.password") || "Password"}
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder={
                    isEdit
                      ? t(
                          "admin.customer_creation.password_edit_placeholder",
                          "Leave blank to keep the current password",
                        )
                      : t(
                          "admin.customer_creation.password_placeholder",
                          "8-12 chars, upper+lower+special",
                        )
                  }
                />
                {isEdit && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "admin.customer_creation.password_edit_hint",
                      "Enter a new password only if you want to change it.",
                    )}
                  </p>
                )}
              </div>
            )}

            {isEdit && (
              <div className="md:col-span-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Password Security
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(true)}
                      className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <span className="material-symbols-outlined text-[14px] leading-none">
                        lock_reset
                      </span>
                      Change Password
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-gray-500">Account Created:</span>{" "}
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {customerCreatedAt
                          ? new Date(customerCreatedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Password Changed:</span>{" "}
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {passwordCrtDate
                          ? new Date(passwordCrtDate).toLocaleString()
                          : "Never changed"}
                      </span>
                    </div>
                  </div>
                  {passwordCrtDate && (
                    <div className="mt-2">
                      <PasswordPriorityBadge ageDays={getPasswordAgeDays(passwordCrtDate)} />
                    </div>
                  )}
                  {!passwordCrtDate && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          info
                        </span>
                        Password has never been changed — consider updating
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </FormSection>

          {/* ADDRESS INFORMATION */}
          <FormSection
            title={t("admin.customer_creation.address_info") || "Address Information"}
          >
            <ShadcnSelect
              label="State"
              value={formData.state_id}
              onChange={(v) => {
                setFormData((prev) => ({
                  ...prev,
                  state_id: v,
                  district_id: "",
                  area_type_id: "",
                  location_node_id: "",
                  corporation_id: "",
                  municipality_id: "",
                  town_panchayat_id: "",
                  panchayat_union_id: "",
                  panchayat_id: "",
                }));
                setSelectedAreaType("");
                setSelectedHierarchyType("");
              }}
              options={filteredStates.map((s: any) => ({
                value: resolveId(s),
                label: s.name || s.state_name || resolveId(s),
              }))}
              placeholder="Select state"
            />
            <ShadcnSelect
              label="District"
              value={formData.district_id}
              onChange={(v) => {
                setFormData((prev) => ({
                  ...prev,
                  district_id: v,
                  area_type_id: "",
                  location_node_id: "",
                  corporation_id: "",
                  municipality_id: "",
                  town_panchayat_id: "",
                  panchayat_union_id: "",
                  panchayat_id: "",
                }));
                setSelectedAreaType("");
                setSelectedHierarchyType("");
              }}
              options={filteredDistricts.map((d: any) => ({
                value: resolveId(d),
                label: d.name || d.district_name || resolveId(d),
              }))}
              placeholder={formData.state_id ? "Select district" : "Select a state first"}
              disabled={!formData.state_id}
            />
            <ShadcnSelect
              label="Area Type"
              value={formData.area_type_id}
              onChange={(v) => {
                update("area_type_id", v);
                const selected = filteredAreaTypes.find(
                  (areaType: any) => resolveId(areaType) === v,
                );
                const areaName = String(
                  selected?.name ?? selected?.area_type_name ?? "",
                ).toLowerCase();
                setSelectedAreaType(
                  areaName.includes("urban")
                    ? "urban"
                    : areaName.includes("rural")
                      ? "rural"
                      : "",
                );
                setSelectedHierarchyType("");
                setFormData((prev) => ({
                  ...prev,
                  area_type_id: v,
                  location_node_id: "",
                  corporation_id: "",
                  municipality_id: "",
                  town_panchayat_id: "",
                  panchayat_union_id: "",
                  panchayat_id: "",
                }));
              }}
              options={filteredAreaTypes.map((areaType: any) => ({
                value: resolveId(areaType),
                label: areaType.name || areaType.area_type_name || resolveId(areaType),
              }))}
              placeholder={formData.district_id ? "Select area type" : "Select a district first"}
              disabled={!formData.district_id}
            />
            <ShadcnSelect
              label="Local Body"
              value={selectedHierarchyType}
              onChange={(v) => setHierarchyValue(v as HierarchyLevel, "")}
              options={availableHierarchyLevels.map((level) => ({
                value: level.value,
                label: level.label,
              }))}
              placeholder={selectedAreaType ? "Select local body type" : "Select an area type first"}
              disabled={!selectedAreaType}
            />
            {selectedHierarchyType && (
              <div>
                <ShadcnSelect
                  label={
                    hierarchyLevels.find((l) => l.value === selectedHierarchyType)?.label ||
                    "Local Body"
                  }
                  value={selectedHierarchyId}
                  onChange={(v) => setHierarchyValue(selectedHierarchyType as HierarchyLevel, v)}
                  options={destinationOptions}
                  placeholder="Select"
                />
              </div>
            )}
            {isIndividual && (
              <>
                {showField("building_no") && (
                  <FormInput
                    label={t("common.building_no") || "Building No"}
                    value={formData.building_no}
                    onChange={(e) => update("building_no", e.target.value)}
                    placeholder="e.g., 13A"
                  />
                )}
                {showField("street") && (
                  <FormInput
                    label={t("common.street") || "Street"}
                    value={formData.street}
                    onChange={(e) => update("street", e.target.value)}
                    placeholder="e.g., Main Street"
                  />
                )}
                {showField("area") && (
                  <FormInput
                    label={t("common.area") || "Area"}
                    value={formData.area}
                    onChange={(e) => update("area", e.target.value)}
                    placeholder="e.g., Village Center"
                  />
                )}
              </>
            )}
            {isApartment && (
              <>
                {showField("apartment_name") && (
                  <FormInput
                    label="Apartment Name"
                    value={formData.apartment_name}
                    onChange={(e) => update("apartment_name", e.target.value)}
                    placeholder="Enter apartment name"
                    isRequired={false}
                  />
                )}
                {showField("block_no") && (
                  <FormInput
                    label="Block No"
                    value={formData.block_no}
                    onChange={(e) => update("block_no", e.target.value)}
                    placeholder="Enter block number"
                    isRequired={false}
                  />
                )}
                {showField("flat_no") && (
                  <FormInput
                    label="Flat No"
                    value={formData.flat_no}
                    onChange={(e) => update("flat_no", e.target.value)}
                    placeholder="Enter flat number"
                    isRequired={false}
                  />
                )}
              </>
            )}
            {isVilla && (
              <>
                {showField("street") && (
                  <FormInput
                    label={t("common.street") || "Street"}
                    value={formData.street}
                    onChange={(e) => update("street", e.target.value)}
                    placeholder="e.g., Main Street"
                  />
                )}
                {showField("area") && (
                  <FormInput
                    label={t("common.area") || "Area"}
                    value={formData.area}
                    onChange={(e) => update("area", e.target.value)}
                    placeholder="e.g., Village Center"
                  />
                )}
                {showField("villa_no") && (
                  <FormInput
                    label="Villa No"
                    value={formData.villa_no}
                    onChange={(e) => update("villa_no", e.target.value)}
                    placeholder="Enter villa number"
                    isRequired={false}
                  />
                )}
              </>
            )}
            {isIndustry && (
              <>
                {showField("industry_name") && (
                  <FormInput
                    label="Industry Name"
                    value={formData.industry_name}
                    onChange={(e) => update("industry_name", e.target.value)}
                    placeholder="Enter industry name"
                    isRequired={false}
                  />
                )}
                {showField("industry_type") && (
                  <FormInput
                    label="Industry Type"
                    value={formData.industry_type}
                    onChange={(e) => update("industry_type", e.target.value)}
                    placeholder="Enter industry type"
                    isRequired={false}
                  />
                )}
                {showField("area") && (
                  <FormInput
                    label={t("common.area") || "Area"}
                    value={formData.area}
                    onChange={(e) => update("area", e.target.value)}
                    placeholder="e.g., Industrial Area"
                  />
                )}
              </>
            )}
            {showField("pincode") && (
              <FormInput
                label={t("common.pincode") || "Pincode"}
                value={formData.pincode}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, "");
                  update("pincode", numericValue);
                }}
                placeholder="6 digit pincode"
                maxLength={6}
                inputMode="numeric"
              />
            )}
            {showField("latitude") && (
              <FormInput
                label={t("common.latitude") || "Latitude"}
                value={formData.latitude}
                onChange={(e) => update("latitude", e.target.value)}
                placeholder="e.g., 13.0827"
                type="number"
                step="0.0001"
              />
            )}
            {showField("longitude") && (
              <FormInput
                label={t("common.longitude") || "Longitude"}
                value={formData.longitude}
                onChange={(e) => update("longitude", e.target.value)}
                placeholder="e.g., 80.2707"
                type="number"
                step="0.0001"
              />
            )}
          </FormSection>

          {/* PROPERTY INFORMATION */}
          <FormSection
            title={t("admin.customer_creation.property_info") || "Property Information"}
          >
            {!isEdit && (showField("property_id") || showField("sub_property_id")) && (
              <div className="md:col-span-3 bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {showField("property_id") && (
                      <p className="text-sm text-gray-600">
                        {t("admin.customer_creation.selected_property") ||
                          "Selected Property"}
                        :{" "}
                        <span className="font-semibold text-gray-800">
                          {dropdowns.properties.find(
                            (p: any) => resolveId(p) === formData.property_id,
                          )?.property_name || "-"}
                        </span>
                      </p>
                    )}
                    {showField("sub_property_id") && (
                      <p className="text-sm text-gray-600">
                        {t("admin.customer_creation.selected_sub_property") ||
                          "Selected Sub-Property"}
                        :{" "}
                        <span className="font-semibold text-gray-800">
                          {dropdowns.subProperties.find(
                            (sp: any) => resolveId(sp) === formData.sub_property_id,
                          )?.sub_property_name || "-"}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition"
                  >
                    {t("common.change") || "Change"}
                  </button>
                </div>
              </div>
            )}
            {isEdit && showField("property_id") && (
              <ShadcnSelect
                label={t("admin.customer_creation.property") || "Property"}
                value={formData.property_id}
                onChange={(v: string) => {
                  update("property_id", v);
                  update("sub_property_id", "");
                }}
                options={dropdowns.properties.map((p: any) => ({
                  value: resolveId(p),
                  label: p.property_name,
                }))}
                placeholder={
                  t("admin.customer_creation.property_placeholder") || "Select property"
                }
              />
            )}
            {isEdit && showField("sub_property_id") && (
              <ShadcnSelect
                label={t("admin.customer_creation.sub_property") || "Sub Property"}
                value={formData.sub_property_id}
                onChange={(v: string) => update("sub_property_id", v)}
                options={dropdowns.subProperties
                  .filter(
                    (sp: any) =>
                      !formData.property_id ||
                      normalizeEntityId(sp.property_id ?? sp.property) ===
                        formData.property_id ||
                      resolveId(sp) === formData.sub_property_id,
                  )
                  .map((sp: any) => ({
                    value: resolveId(sp),
                    label: sp.sub_property_name,
                  }))}
                placeholder={
                  t("admin.customer_creation.sub_property_placeholder") ||
                  "Select sub property"
                }
              />
            )}
            {showField("sqft") && (
              <FormInput
                label={t("admin.customer_creation.sqft") || "Square Feet (Sqft)"}
                value={formData.sqft}
                onChange={(e) => update("sqft", e.target.value)}
                placeholder="e.g., 1200.50"
                type="number"
                step="0.01"
              />
            )}
            {showField("water_consumption_lpd") && (
              <FormInput
                label={
                  tOrFallback(
                    "admin.customer_creation.water_consumption",
                    "Water Consumption (Liters/day)",
                  )
                }
                value={formData.water_consumption_lpd}
                onChange={(e) => update("water_consumption_lpd", e.target.value)}
                placeholder="e.g., 500"
                type="number"
                step="0.01"
                isRequired={false}
              />
            )}
            {showField("waste_collection_kg_per_day") && (
              <FormInput
                label={
                  tOrFallback(
                    "admin.customer_creation.waste_collection",
                    "Waste Collection (kg/day)",
                  )
                }
                value={formData.waste_collection_kg_per_day}
                onChange={(e) => update("waste_collection_kg_per_day", e.target.value)}
                placeholder="e.g., 10"
                type="number"
                step="0.01"
                isRequired={false}
              />
            )}
            {showField("is_bulkwaste_generator") && (
              <div className="space-y-2">
                <ShadcnSelect
                  label={tOrFallback(
                    "admin.customer_creation.bulk_waste_generator",
                    "Bulk Waste Generator",
                  )}
                  value={formData.is_bulkwaste_generator ? "true" : "false"}
                  onChange={(v: string) => update("is_bulkwaste_generator", v === "true")}
                  options={[
                    { value: "true", label: tOrFallback("common.yes", "Yes") },
                    { value: "false", label: tOrFallback("common.no", "No") },
                  ]}
                  placeholder={tOrFallback(
                    "admin.customer_creation.bulk_waste_generator_placeholder",
                    "Select option",
                  )}
                  isRequired={false}
                  disabled={autoBulkWasteGenerator}
                />
                {autoBulkWasteGenerator && (
                  <p className="text-xs text-amber-600">
                    {tOrFallback(
                      "admin.customer_creation.bulk_waste_auto_detected",
                      "Auto-detected as Bulk Waste Generator (sqft > 20,000 sq ft, water consumption > 40,000 L/day, or waste collection > 100 kg/day).",
                    )}
                  </p>
                )}
              </div>
            )}
            {showField("waste_type_ids") && (
              <MultiSelectCheckboxes
                label={tOrFallback("common.waste_type", "Waste Type")}
                values={formData.waste_type_ids}
                onChange={(values) => update("waste_type_ids", values)}
                options={wasteTypeOptions}
              />
            )}
          </FormSection>

          {/* IDENTIFICATION */}
          <FormSection
            title={t("admin.customer_creation.identification") || "Identification"}
          >
            {showField("id_proof_type") && (
              <ShadcnSelect
                label={t("admin.customer_creation.id_proof_type") || "ID Proof Type"}
                value={formData.id_proof_type}
                onChange={(v: string) => update("id_proof_type", v)}
                options={idProofTypeOptions}
                placeholder={
                  t("admin.customer_creation.id_proof_placeholder") ||
                  "Select ID proof type"
                }
              />
            )}
            {showField("id_no") && (
              <div className="md:col-span-2">
                <FormInput
                  label={t("admin.customer_creation.id_no") || "ID Number"}
                  value={formData.id_no}
                  onChange={(e) => update("id_no", e.target.value)}
                  placeholder="Enter identification number"
                />
              </div>
            )}
            {showField("member_count") && (
              <FormInput
                label={tOrFallback("admin.customer_creation.member_count", "Member Count")}
                value={formData.member_count}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, "");
                  update("member_count", numericValue);
                }}
                placeholder="e.g., 4"
                type="number"
                inputMode="numeric"
                isRequired={false}
              />
            )}
            {showField("family_members") && (
              <FamilyMembersRepeater
                label={tOrFallback(
                  "admin.customer_creation.family_members",
                  "Family Members ID Proof (Optional)",
                )}
                members={formData.family_members}
                onChange={(members) => update("family_members", members)}
                idProofTypeOptions={idProofTypeOptions}
                maxCount={
                  formData.member_count && !isNaN(parseInt(formData.member_count, 10))
                    ? parseInt(formData.member_count, 10)
                    : null
                }
              />
            )}
          </FormSection>

          {/* STATUS */}
          {showField("is_active") && (
            <FormSection title={t("common.status") || "Status"}>
              <ShadcnSelect
                label={t("common.status") || "Status"}
                value={formData.is_active ? "true" : "false"}
                onChange={(v: string) => update("is_active", v === "true")}
                options={[
                  { value: "true", label: t("common.active") || "Active" },
                  { value: "false", label: t("common.inactive") || "Inactive" },
                ]}
                placeholder={t("common.select_status") || "Select status"}
              />
            </FormSection>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-gray-200">
            <div className="flex gap-3">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
                >
                  {t("common.back") || "Back"}
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
              >
                {t("common.cancel") || "Cancel"}
              </button>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-md font-medium transition duration-200 flex items-center justify-center min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t("common.saving") || "Saving..."}
                </>
              ) : isEdit ? (
                t("common.update") || "Update"
              ) : (
                t("common.save") || "Save"
              )}
            </button>
          </div>
        </form>
      </ComponentCard>
    </>
  );
}

/* ===============================
   OUTER SHELL — DEFAULT EXPORT
================================ */
export default function CustomerCreationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { encCustomerMaster, encCustomerCreation } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(
    encCustomerMaster,
    encCustomerCreation,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false);
  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  /* raw dropdown state */
  const [rawDistricts, setRawDistricts] = useState<any[]>([]);
  const [rawAreaTypes, setRawAreaTypes] = useState<any[]>([]);
  const [rawStates, setRawStates] = useState<any[]>([]);
  const [rawCountries, setRawCountries] = useState<any[]>([]);
  const [rawProperties, setRawProperties] = useState<any[]>([]);
  const [rawSubProperties, setRawSubProperties] = useState<any[]>([]);
  const [rawCorporations, setRawCorporations] = useState<any[]>([]);
  const [rawMunicipalities, setRawMunicipalities] = useState<any[]>([]);
  const [rawTownPanchayats, setRawTownPanchayats] = useState<any[]>([]);
  const [rawPanchayatUnions, setRawPanchayatUnions] = useState<any[]>([]);
  const [rawPanchayats, setRawPanchayats] = useState<any[]>([]);
  const [rawWasteTypes, setRawWasteTypes] = useState<any[]>([]);

  /* load all dropdowns once */
  useEffect(() => {
    let cancelled = false;
    const toArr = (res: any) =>
      Array.isArray(res) ? res : (res as any)?.results ?? [];

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates each level's own
    // menu/list, not these dropdowns) — their Data Scope from login always
    // supplies their own hierarchy values regardless.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    const scopeRecord = (
      level: ScopeLevel,
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> | null => {
      const scoped = scopeOption(level);
      if (!scoped) return null;
      return { unique_id: scoped.value, name: scoped.label, ...extra };
    };

    const mergeRecord = (
      records: any[],
      level: ScopeLevel,
      extra: Record<string, unknown> = {},
    ): any[] => {
      const record = scopeRecord(level, extra);
      if (!record) return records;
      if (records.some((item) => resolveId(item) === record.unique_id)) return records;
      return [record, ...records];
    };

    const applyScopeFallback = () => {
      setRawStates((prev) => mergeRecord(prev, "state"));
      setRawDistricts((prev) =>
        mergeRecord(prev, "district", scopedStateId ? { state_id: scopedStateId } : {}),
      );
      setRawAreaTypes((prev) =>
        mergeRecord(prev, "area_type", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setRawCorporations((prev) =>
        mergeRecord(prev, "corporation", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setRawMunicipalities((prev) =>
        mergeRecord(prev, "municipality", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setRawTownPanchayats((prev) =>
        mergeRecord(prev, "town_panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setRawPanchayatUnions((prev) =>
        mergeRecord(prev, "panchayat_union", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setRawPanchayats((prev) =>
        mergeRecord(prev, "panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
    };

    applyScopeFallback();

    Promise.all([
      districtApi.readAll(),
      areaTypeApi.readAll(),
      stateApi.readAll(),
      countryApi.readAll(),
      propertiesApi.readAll(),
      subPropertiesApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
      wasteTypeApi.readAll(),
    ])
      .then(
        ([
          districts,
          areaTypes,
          states,
          countries,
          properties,
          subProperties,
          corporations,
          municipalities,
          townPanchayats,
          panchayatUnions,
          panchayats,
          wasteTypes,
        ]) => {
          if (cancelled) return;
          setRawDistricts(
            mergeRecord(toArr(districts), "district", scopedStateId ? { state_id: scopedStateId } : {}),
          );
          setRawAreaTypes(
            mergeRecord(toArr(areaTypes), "area_type", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawStates(mergeRecord(toArr(states), "state"));
          setRawCountries(toArr(countries));
          setRawProperties(toArr(properties));
          setRawSubProperties(toArr(subProperties));
          setRawCorporations(
            mergeRecord(toArr(corporations), "corporation", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawMunicipalities(
            mergeRecord(toArr(municipalities), "municipality", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawTownPanchayats(
            mergeRecord(toArr(townPanchayats), "town_panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawPanchayatUnions(
            mergeRecord(toArr(panchayatUnions), "panchayat_union", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawPanchayats(
            mergeRecord(toArr(panchayats), "panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setRawWasteTypes(toArr(wasteTypes));
          setDropdownsLoaded(true);
        },
      )
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch customer dropdowns:", err);
        applyScopeFallback();
        if (
          !scopeOption("state") &&
          !scopeOption("district") &&
          !scopeOption("area_type") &&
          !scopeOption("corporation") &&
          !scopeOption("municipality") &&
          !scopeOption("town_panchayat") &&
          !scopeOption("panchayat_union") &&
          !scopeOption("panchayat")
        ) {
          Swal.fire("Error", "Failed to load customer form data", "error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* load record in edit mode */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    customerCreationApi
      .read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(
          t("common.error") || "Error",
          t("admin.customer_creation.save_failed") || "Failed to load customer",
          "error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  /* submit handler */
  const submitCustomer = async (payload: any) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await customerCreationApi.update(id, payload as any);
      } else {
        await customerCreationApi.create(payload as any);
      }
      Swal.fire(
        t("common.success") || "Success",
        t("admin.customer_creation.save_success") || "Saved successfully",
        "success",
      );
      navigate(ENC_LIST_PATH);
    } catch (err: any) {
      console.error("Submit error:", err);
      const data = err?.response?.data;
      let errorText = t("admin.customer_creation.save_failed") || "Failed to save";
      if (typeof data === "string") {
        errorText = data;
      } else if (data && typeof data === "object") {
        const errPayload = "errors" in data ? (data as any).errors : data;
        errorText =
          Object.entries(errPayload as Record<string, unknown>)
            .map(([key, value]) =>
              Array.isArray(value) ? `${key}: ${value.join(", ")}` : `${key}: ${String(value)}`
            )
            .join("\n") || errorText;
      }
      Swal.fire(t("common.error") || "Error", errorText, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* loading gate — in edit mode wait until both dropdowns and record are ready */
  const title = isEdit
    ? t("admin.customer_creation.title_edit") || "Edit Customer"
    : t("admin.customer_creation.title_add") || "Add Customer";

  if (isEdit && (!dropdownsLoaded || loadingRecord)) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading") || "Loading..."}</div>
      </ComponentCard>
    );
  }

  /* normalised dropdown collections */
  const dropdowns: CustomerDropdowns = {
    districts: normalizeActive(rawDistricts),
    areaTypes: normalizeActive(rawAreaTypes),
    states: normalizeActive(rawStates),
    countries: normalizeActive(rawCountries),
    properties: normalizeActive(rawProperties),
    subProperties: normalizeActive(rawSubProperties),
    corporations: normalizeActive(rawCorporations),
    municipalities: normalizeActive(rawMunicipalities),
    townPanchayats: normalizeActive(rawTownPanchayats),
    panchayatUnions: normalizeActive(rawPanchayatUnions),
    panchayats: normalizeActive(rawPanchayats),
    wasteTypes: normalizeActive(rawWasteTypes),
  };

  /* compute initialPayload */
  let initialPayload: CustomerInitialPayload;

  if (isEdit && recordData) {
    const d = recordData;

    const countryId = resolveOptionValue(rawCountries, d.country_id, "name", d.country_name);
    const stateId = resolveOptionValue(rawStates, d.state_id, "name", d.state_name);
    const districtId = resolveOptionValue(rawDistricts, d.district_id, "name", d.district_name);
    const areaTypeId = resolveOptionValue(rawAreaTypes, d.area_type_id, "name", d.area_type_name);
    const corporationId = resolveOptionValue(
      rawCorporations, d.corporation_id, "corporation_name", d.corporation_name,
    );
    const municipalityId = resolveOptionValue(
      rawMunicipalities, d.municipality_id, "municipality_name", d.municipality_name,
    );
    const townPanchayatId = resolveOptionValue(
      rawTownPanchayats, d.town_panchayat_id, "town_panchayat_name", d.town_panchayat_name,
    );
    const panchayatUnionId = resolveOptionValue(
      rawPanchayatUnions, d.panchayat_union_id, "union_name", d.panchayat_union_name,
    );
    const panchayatId = resolveOptionValue(
      rawPanchayats, d.panchayat_id, "panchayat_name", d.panchayat_name,
    );
    const propertyId = resolveOptionValue(
      rawProperties, d.property_id, "property_name", d.property_name,
    );
    const subPropertyId = resolveOptionValue(
      rawSubProperties, d.sub_property_id, "sub_property_name", d.sub_property_name,
    );
    const wasteTypeIds = normalizeIdArray(d.waste_type_ids ?? d.waste_types);

    const rawHierarchyMatch: { level: HierarchyLevel; isUrban: boolean } | null =
      d.corporation_id || d.corporation_name
        ? { level: "corporation_id", isUrban: true }
        : d.municipality_id || d.municipality_name
          ? { level: "municipality_id", isUrban: true }
          : d.town_panchayat_id || d.town_panchayat_name
            ? { level: "town_panchayat_id", isUrban: true }
            : d.panchayat_union_id || d.panchayat_union_name
              ? { level: "panchayat_union_id", isUrban: false }
              : d.panchayat_id || d.panchayat_name
                ? { level: "panchayat_id", isUrban: false }
                : null;

    const labelByLevel: Record<HierarchyLevel, string> = {
      corporation_id: String(d.corporation_name ?? ""),
      municipality_id: String(d.municipality_name ?? ""),
      town_panchayat_id: String(d.town_panchayat_name ?? ""),
      panchayat_union_id: String(d.panchayat_union_name ?? ""),
      panchayat_id: String(d.panchayat_name ?? ""),
    };
    const areaTypeName = String(d.area_type_name ?? "").toLowerCase();
    const selectedAreaTypeFromRecord: AreaType | "" = rawHierarchyMatch
      ? rawHierarchyMatch.isUrban
        ? "urban"
        : "rural"
      : areaTypeName.includes("urban")
        ? "urban"
        : areaTypeName.includes("rural")
          ? "rural"
          : "";

    initialPayload = {
      customer_name: String(d.customer_name ?? ""),
      contact_no: String(d.contact_no ?? ""),
      username: String(d.username ?? ""),
      email: String(d.email ?? ""),
      password: String(d.password ?? ""),
      building_no: String(d.building_no ?? ""),
      street: String(d.street ?? ""),
      area: String(d.area ?? ""),
      pincode: String(d.pincode ?? ""),
      latitude: String(d.latitude ?? ""),
      longitude: String(d.longitude ?? ""),
      sqft: String(d.sqft ?? ""),
      water_consumption_lpd: String(d.water_consumption_lpd ?? ""),
      waste_collection_kg_per_day: String(d.waste_collection_kg_per_day ?? ""),
      property_id: propertyId,
      sub_property_id: subPropertyId,
      id_proof_type: String(d.id_proof_type ?? ""),
      id_no: String(d.id_no ?? ""),
      member_count: String(d.member_count ?? ""),
      family_members: Array.isArray(d.family_members)
        ? d.family_members.map((m: any) => ({
            member_name: String(m?.member_name ?? ""),
            id_proof_type: String(m?.id_proof_type ?? ""),
            id_no: String(m?.id_no ?? ""),
          }))
        : [],
      country_id: countryId,
      state_id: stateId,
      district_id: districtId,
      area_type_id: areaTypeId,
      location_node_id: String(d.location_node_id ?? d.location_node?.unique_id ?? ""),
      corporation_id: corporationId,
      municipality_id: municipalityId,
      town_panchayat_id: townPanchayatId,
      panchayat_union_id: panchayatUnionId,
      panchayat_id: panchayatId,
      waste_type_ids: wasteTypeIds,
      is_active: Boolean(d.is_active),
      is_bulkwaste_generator: Boolean(d.is_bulkwaste_generator),
      apartment_name: String(d.apartment_name ?? ""),
      block_no: String(d.block_no ?? ""),
      flat_no: String(d.flat_no ?? ""),
      villa_no: String(d.villa_no ?? ""),
      industry_name: String(d.industry_name ?? ""),
      industry_type: String(d.industry_type ?? ""),
      selectedAreaType: selectedAreaTypeFromRecord,
      selectedHierarchyType: rawHierarchyMatch ? rawHierarchyMatch.level : "",
      hierarchyItemLabel: rawHierarchyMatch
        ? labelByLevel[rawHierarchyMatch.level] || ""
        : "",
      passwordCrtDate: d.password_crt_date ?? null,
      customerCreatedAt: d.created_at ?? null,
    };
  } else {
    initialPayload = {
      customer_name: "",
      contact_no: "",
      username: "",
      email: "",
      password: "",
      building_no: "",
      street: "",
      area: "",
      pincode: "",
      latitude: "",
      longitude: "",
      sqft: "",
      water_consumption_lpd: "",
      waste_collection_kg_per_day: "",
      property_id: "",
      sub_property_id: "",
      id_proof_type: "",
      id_no: "",
      member_count: "",
      family_members: [],
      country_id: "",
      state_id: "",
      district_id: "",
      area_type_id: "",
      location_node_id: "",
      corporation_id: "",
      municipality_id: "",
      town_panchayat_id: "",
      panchayat_union_id: "",
      panchayat_id: "",
      waste_type_ids: [],
      is_active: true,
      is_bulkwaste_generator: false,
      apartment_name: "",
      block_no: "",
      flat_no: "",
      villa_no: "",
      industry_name: "",
      industry_type: "",
      selectedAreaType: "",
      selectedHierarchyType: "",
      hierarchyItemLabel: "",
      passwordCrtDate: null,
      customerCreatedAt: null,
    };
  }

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-customer";

  return (
    <CustomerEditor
      key={formKey}
      initialPayload={initialPayload}
      dropdowns={dropdowns}
      isEdit={isEdit}
      isSubmitting={isSubmitting}
      customerId={id}
      onSubmit={submitCustomer}
      onCancel={() => navigate(ENC_LIST_PATH)}
    />
  );
}
