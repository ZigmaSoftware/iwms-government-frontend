import type { ChangePasswordModalProps, ErrorWithResponse, Section } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { api } from "@/api";
import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import PasswordInput from "@/components/form/input/PasswordInput";
import { getEncryptedRoute } from "@/utils/routeCache";
import { staffCreationApi, governmentUserTypeApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useTranslation } from "react-i18next";
import {
  mergeWithScopeOptionExtra,
  scopeOption,
} from "../../masters/shared/dataScopeOptions";
import type { ScopeLevel } from "../../masters/shared/dataScopeOptions";

// ─── Password helpers ────────────────────────────────────────────────────────
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

// ─── Change Password Modal ───────────────────────────────────────────────────


function ChangePasswordModal({ targetType, targetId, onClose, onSuccess }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
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
        target_type: targetType,
        target_id: targetId,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      Swal.fire({ icon: "success", title: "Password Changed", text: "Password updated successfully." });
      onSuccess(new Date().toISOString());
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to change password.";
      setError(msg);
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
import {
  stateApi,
  districtApi,
  areaTypeApi,
  corporationApi,
  municipalityApi,
  townPanchayatApi,
  panchayatUnionApi,
  panchayatApi,
  staffUserTypeApi,
  contractorUserTypeApi,
  departmentApi,
  designationApi,
} from "@/helpers/admin/index";

type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

type AreaTypeCategory = "urban" | "rural";

type GeoOptionRecord = {
  unique_id?: string;
  id?: string;
  name?: string;
  corporation_name?: string;
  municipality_name?: string;
  town_panchayat_name?: string;
  union_name?: string;
  panchayat_name?: string;
  area_type_name?: string;
  state_id?: string | { unique_id?: string };
  district_id?: string | { unique_id?: string };
};

const LOCAL_BODY_LEVELS: Array<{ value: LocalBodyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

const AREA_TYPE_LEVELS: Record<AreaTypeCategory, LocalBodyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

// Maps the local-body cascade's field name to the GovernmentStaffUserType.level
// value it corresponds to, so the government-role dropdown is always derived
// from — never independent of — the State/District/Local Body actually chosen.
const LOCAL_BODY_LEVEL_TO_GOV_LEVEL: Record<LocalBodyLevel, string> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

const areaTypeCategoryFromName = (name: string): AreaTypeCategory | null => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return null;
};

const geoOptionId = (record: GeoOptionRecord): string =>
  normalizeId(record.unique_id ?? record.id ?? "");

const geoOptionName = (record: GeoOptionRecord): string | undefined =>
  record.name ??
  record.corporation_name ??
  record.municipality_name ??
  record.town_panchayat_name ??
  record.union_name ??
  record.panchayat_name ??
  record.area_type_name;

const toGeoOptions = (records: GeoOptionRecord[]) =>
  records
    .filter((record) => geoOptionName(record))
    .map((record) => ({ value: geoOptionId(record), label: geoOptionName(record) as string }));


const getYesNoOptions = (t: (key: string) => string) => [
  { value: "1", label: t("common.yes") },
  { value: "0", label: t("common.no") },
];

const getMaritalStatusOptions = (t: (key: string) => string) => [
  { value: "Single", label: t("admin.staff_creation.marital_single") },
  { value: "Married", label: t("admin.staff_creation.marital_married") },
  { value: "Widowed", label: t("admin.staff_creation.marital_widowed") },
  { value: "Divorced", label: t("admin.staff_creation.marital_divorced") },
];

const getGenderOptions = (t: (key: string) => string) => [
  { value: "Male", label: t("admin.staff_creation.gender_male") },
  { value: "Female", label: t("admin.staff_creation.gender_female") },
  { value: "Other", label: t("admin.staff_creation.gender_other") },
];

const getBloodGroupOptions = () => [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
];

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const normalizeEntityId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeId(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return normalizeId(value);
};

const formatErrorMessage = (t: (key: string) => string, error: unknown) => {
  if (!error) return t("common.review_fields");
  if (typeof error === "string") return error;

  const data = (error as ErrorWithResponse)?.response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");

  const payload =
    data && typeof data === "object" && "errors" in data
      ? (data as any).errors
      : data;

  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>)
      .map(([key, value]) =>
        Array.isArray(value)
          ? `${key}: ${value.join(", ")}`
          : `${key}: ${String(value)}`,
      )
      .join("\n");
  }

  return t("common.review_fields");
};

const initialFormData = {
  employee_name: "",
  // employee_id: "",
  doj: "",
  department: "",
  designation: "",
  department_id: "",
  designation_id: "",

  staff_head: "",
  staff_head_id: "",
  active_status: "1",
  staffusertype_id: "",
  contractorusertype_id: "",
  governmentusertype_id: "",
  state_id: "",
  district_id: "",
  area_type_id: "",
  local_body_level: "" as LocalBodyLevel | "",
  local_body_id: "",
  username: "", // ← username field
  password: "",
  login_enabled: "0",
  office_email: "",
  marital_status: "",
  dob: "",
  blood_group: "",
  gender: "",
  physically_challenged: "",
  present_country: "",
  present_state: "",
  present_district: "",
  present_city: "",
  present_building_no: "",
  present_street: "",
  present_area: "",
  present_pincode: "",
  permanent_country: "",
  permanent_state: "",
  permanent_district: "",
  permanent_city: "",
  permanent_building_no: "",
  permanent_street: "",
  permanent_area: "",
  permanent_pincode: "",
  contact_mobile: "",
  contact_email: "",
  driving_licence_no: "",
  driving_licence_expiry_date: "",
  // emergency_contact: "",
  // emergency_mobile: "",
};

const STAFF_CREATION_FIELDS: Record<string, string[]> = {
  employee_name: ["employee_name", "name"],
  doj: ["doj", "date_of_joining"],
  department: ["department"],
  designation: ["designation"],
  department_id: ["department_id"],
  designation_id: ["designation_id"],
  staff_head: ["staff_head"],
  staff_head_id: ["staff_head_id"],
  active_status: ["active_status", "is_active"],
  staffusertype_id: ["staffusertype_id", "staff_user_type", "staffusertype"],
  contractorusertype_id: ["contractorusertype_id", "contractor_user_type", "contractorusertype"],
  governmentusertype_id: ["governmentusertype_id", "government_user_type", "governmentusertype"],
  username: ["username"],
  password: ["password"],
  login_enabled: ["login_enabled"],
  photo: ["photo"],
  marital_status: ["marital_status"],
  dob: ["dob", "date_of_birth"],
  blood_group: ["blood_group"],
  gender: ["gender"],
  physically_challenged: ["physically_challenged"],
  present_country: ["present_country", "present_address.country"],
  present_state: ["present_state", "present_address.state"],
  present_district: ["present_district", "present_address.district"],
  present_city: ["present_city", "present_address.city"],
  present_building_no: ["present_building_no", "present_address.building_no"],
  present_street: ["present_street", "present_address.street"],
  present_area: ["present_area", "present_address.area"],
  present_pincode: ["present_pincode", "present_address.pincode"],
  permanent_country: ["permanent_country", "permanent_address.country"],
  permanent_state: ["permanent_state", "permanent_address.state"],
  permanent_district: ["permanent_district", "permanent_address.district"],
  permanent_city: ["permanent_city", "permanent_address.city"],
  permanent_building_no: [
    "permanent_building_no",
    "permanent_address.building_no",
  ],
  permanent_street: ["permanent_street", "permanent_address.street"],
  permanent_area: ["permanent_area", "permanent_address.area"],
  permanent_pincode: ["permanent_pincode", "permanent_address.pincode"],
  contact_mobile: ["contact_mobile", "mobile"],
  contact_email: ["contact_email", "email"],
  state_id: ["state_id"],
  district_id: ["district_id"],
  area_type_id: ["area_type_id"],
  corporation_id: ["corporation_id"],
  municipality_id: ["municipality_id"],
  town_panchayat_id: ["town_panchayat_id"],
  panchayat_union_id: ["panchayat_union_id"],
  panchayat_id: ["panchayat_id"],
  driving_licence_no: ["driving_licence_no", "driving_license_no"],
  driving_licence_expiry_date: ["driving_licence_expiry_date"],
  driving_licence_file: ["driving_licence_file", "driving_license_file"],
};

export default function StaffCreationForm() {
  const [formData, setFormData] = useState(initialFormData);
  const [section, setSection] = useState<Section>("official");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sameAddress, setSameAddress] = useState(false);
  const [passwordCrtDate, setPasswordCrtDate] = useState<string | null>(null);
  const [staffCreatedAt, setStaffCreatedAt] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [staffUserTypeOptions, setStaffUserTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [contractorUserTypeOptions, setContractorUserTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [governmentUserTypeRecords, setGovernmentUserTypeRecords] = useState<
    { unique_id: string; name: string; name_display: string; level: string; level_display: string }[]
  >([]);
  // Derived — never independently selected — from whichever geo cascade field
  // is currently the most specific: Local Body > District > State. This keeps
  // the government role level always in sync with the actual selected scope.
  const governmentLevel = formData.local_body_level
    ? LOCAL_BODY_LEVEL_TO_GOV_LEVEL[formData.local_body_level as LocalBodyLevel]
    : formData.district_id
      ? "district"
      : formData.state_id
        ? "state"
        : "";
  const [userTypeCategory, setUserTypeCategory] = useState<
    "staff" | "contractor" | "government"
  >("government");

  // Government scope cascade: State → District → Area Type → Local Body
  const [scopeStateOptions, setScopeStateOptions] = useState<{ value: string; label: string }[]>([]);
  const [scopeDistrictRecords, setScopeDistrictRecords] = useState<GeoOptionRecord[]>([]);
  const [scopeAreaTypeRecords, setScopeAreaTypeRecords] = useState<GeoOptionRecord[]>([]);
  const [scopeLocalBodyRecords, setScopeLocalBodyRecords] = useState<Record<LocalBodyLevel, GeoOptionRecord[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });
  const [licenceFile, setLicenceFile] = useState<File | null>(null);
  const [licencePreview, setLicencePreview] = useState("");
  const licenceInputRef = useRef<HTMLInputElement>(null);
  const [departmentOptions, setDepartmentOptions] = useState<
    { value: string; label: string; name: string; code?: string }[]
  >([]);
  const [designationOptions, setDesignationOptions] = useState<
    { value: string; label: string; name: string; group?: string; departmentId?: string }[]
  >([]);
  const [staffHeadOptions, setStaffHeadOptions] = useState<
    { value: string; label: string; name: string }[]
  >([]);

  // Pending prefill values — set during edit load, applied once the option list arrives
  const [pendingStaffUserTypeId, setPendingStaffUserTypeId] = useState<string | null>(null);
  const [pendingContractorUserTypeId, setPendingContractorUserTypeId] = useState<string | null>(null);
  const [pendingGovernmentUserTypeId, setPendingGovernmentUserTypeId] = useState<string | null>(null);
  const [pendingDepartmentId, setPendingDepartmentId] = useState<string | null>(null);
  const [pendingDesignationId, setPendingDesignationId] = useState<string | null>(null);

  // Government geo cascade pending prefill — applied once each level's option
  // list arrives. Without these, the values set at edit-load can be lost to the
  // order in which the scope-option records finish loading.
  const [pendingStateId, setPendingStateId] = useState<string | null>(null);
  const [pendingDistrictId, setPendingDistrictId] = useState<string | null>(null);
  const [pendingAreaTypeId, setPendingAreaTypeId] = useState<string | null>(null);
  const [pendingLocalBodyLevel, setPendingLocalBodyLevel] = useState<LocalBodyLevel | null>(null);
  const [pendingLocalBodyId, setPendingLocalBodyId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "staff-masters",
    "staff-creation",
    STAFF_CREATION_FIELDS,
  );

  const { encStaffMasters, encStaffCreation } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encStaffMasters, encStaffCreation);
  const backendOrigin =
    api.defaults.baseURL?.replace(/\/api\/desktop\/?$/, "") || "";

  const yesNoOptions = getYesNoOptions(t);
  const maritalStatusOptions = getMaritalStatusOptions(t);
  const genderOptions = getGenderOptions(t);
  const bloodGroupOptions = getBloodGroupOptions();
  const activeStatusOptions = [
    { value: "1", label: t("common.active") },
    { value: "0", label: t("common.inactive") },
  ];

  const departmentOptionsWithCurrent = useMemo(() => {
    if (!formData.department_id) return departmentOptions;
    if (departmentOptions.some((option) => option.value === formData.department_id)) {
      return departmentOptions;
    }
    const label = formData.department || formData.department_id;
    return [
      {
        value: formData.department_id,
        label,
        name: formData.department || label,
      },
      ...departmentOptions,
    ];
  }, [departmentOptions, formData.department, formData.department_id]);

  const designationOptionsWithCurrent = useMemo(() => {
    if (!formData.designation_id) return designationOptions;
    if (designationOptions.some((option) => option.value === formData.designation_id)) {
      return designationOptions;
    }
    const label = formData.designation || formData.designation_id;
    return [
      {
        value: formData.designation_id,
        label,
        name: formData.designation || label,
        departmentId: formData.department_id || undefined,
      },
      ...designationOptions,
    ];
  }, [
    designationOptions,
    formData.department_id,
    formData.designation,
    formData.designation_id,
  ]);

  // Govt staff type options filtered by the level derived from the geo cascade
  const filteredGovtStaffTypeOptions = useMemo(() => {
    if (!governmentLevel) return [];
    return governmentUserTypeRecords
      .filter((r) => r.level === governmentLevel)
      .map((r) => ({ value: r.unique_id, label: r.name_display || r.name }));
  }, [governmentLevel, governmentUserTypeRecords]);

  const selectedUserType = staffUserTypeOptions.find(
    (opt) => opt.value === formData.staffusertype_id,
  );

  const isDriverSelected =
    !!formData.driving_licence_no ||
    !!selectedUserType?.label?.toLowerCase().includes("driver");

  // Government scope cascade: State → District → Area Type → Local Body
  const scopeDistrictOptions = useMemo(() => {
    if (!formData.state_id) return [];
    return toGeoOptions(
      scopeDistrictRecords.filter(
        (district) => normalizeEntityId(district.state_id) === formData.state_id,
      ),
    );
  }, [scopeDistrictRecords, formData.state_id]);

  const scopeAreaTypeOptions = useMemo(() => {
    if (!formData.district_id) return [];
    return toGeoOptions(
      scopeAreaTypeRecords.filter(
        (areaType) => normalizeEntityId(areaType.district_id) === formData.district_id,
      ),
    );
  }, [scopeAreaTypeRecords, formData.district_id]);

  const selectedScopeAreaTypeCategory = useMemo((): AreaTypeCategory | null => {
    const record = scopeAreaTypeRecords.find(
      (areaType) => geoOptionId(areaType) === formData.area_type_id,
    );
    return record ? areaTypeCategoryFromName(String(geoOptionName(record) ?? "")) : null;
  }, [scopeAreaTypeRecords, formData.area_type_id]);

  const availableScopeLocalBodyLevels = useMemo(() => {
    if (!selectedScopeAreaTypeCategory) return [];
    const levels = AREA_TYPE_LEVELS[selectedScopeAreaTypeCategory];
    return LOCAL_BODY_LEVELS.filter((level) => levels.includes(level.value));
  }, [selectedScopeAreaTypeCategory]);

  const scopeLocalBodyOptions = useMemo(() => {
    if (!formData.local_body_level || !formData.district_id) return [];
    const records = scopeLocalBodyRecords[formData.local_body_level as LocalBodyLevel] ?? [];
    return toGeoOptions(
      records.filter((record) => normalizeEntityId(record.district_id) === formData.district_id),
    );
  }, [scopeLocalBodyRecords, formData.district_id, formData.local_body_level]);


  const handleLicenceUpload = (file: File | null) => {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid File Type",
        text: "Only JPG, JPEG, PNG, or PDF files are allowed.",
      });
      return;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      Swal.fire({
        icon: "warning",
        title: "File Too Large",
        text: `File size must be under ${MAX_SIZE_MB} MB.`,
      });
      return;
    }

    setLicenceFile(file);
    setLicencePreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!isDriverSelected && !isEdit) {
      setLicenceFile(null);
      setLicencePreview("");
      setFormData((prev) => ({
        ...prev,
        driving_licence_no: "",
      }));
    }
  }, [isDriverSelected]);

  useEffect(() => {
    const loadUserTypeOptions = async () => {
      try {
        const toOptions = (res: any) => {
          const data = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : (res?.data?.results ?? []);
          return data.map((item: any) => ({
            value: item.unique_id,
            label: item.name,
          }));
        };
        const [staffRes, contractorRes, govtRes] = await Promise.all([
          staffUserTypeApi.readAll(),
          contractorUserTypeApi.readAll(),
          governmentUserTypeApi.readAll(),
        ]);

        setStaffUserTypeOptions(toOptions(staffRes));
        setContractorUserTypeOptions(toOptions(contractorRes));

        const govtList = Array.isArray(govtRes)
          ? govtRes
          : Array.isArray((govtRes as any)?.results)
            ? (govtRes as any).results
            : [];
        setGovernmentUserTypeRecords(govtList);
      } catch (err) {
        console.error("Failed to load user type options", err);
      }
    };

    loadUserTypeOptions();
  }, []);

  useEffect(() => {
    const loadLocationOptions = async () => {
      try {
        const [departments] = await Promise.all([
          departmentApi.readAll({ params: { status: "active" } }),
        ]);

        const normalize = (arr: any[]) =>
          arr.filter((i) => i?.is_active !== false && i?.is_deleted !== true);
        const normalizeResponse = (res: any) =>
          Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : res?.data?.results ?? [];

        setDepartmentOptions(
          normalize(normalizeResponse(departments)).map((d: any) => ({
            value: String(d?.unique_id ?? d?.id ?? ""),
            label: d.department_code
              ? `${d.department_name} (${d.department_code})`
              : d.department_name,
            name: d.department_name,
            code: d.department_code,
          })),
        );
      } catch (error) {
        console.error("Failed to load location masters", error);
      }
    };

    void loadLocationOptions();
  }, []);

  useEffect(() => {
    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates each level's own
    // menu/list, not these dropdowns) — their Data Scope from login always
    // supplies their own hierarchy values regardless.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    // Build a synthetic GeoOptionRecord for `level` so it merges correctly
    // into the raw record collections consumed by `toGeoOptions` and the
    // district/area-type/local-body filtering `useMemo`s below.
    const scopeRecord = (
      level: ScopeLevel,
      extra: Partial<GeoOptionRecord> = {},
    ): GeoOptionRecord | null => {
      const scoped = scopeOption(level);
      if (!scoped) return null;
      return { unique_id: scoped.value, name: scoped.label, ...extra };
    };

    const mergeRecord = (
      records: GeoOptionRecord[],
      level: ScopeLevel,
      extra: Partial<GeoOptionRecord> = {},
    ): GeoOptionRecord[] => {
      const record = scopeRecord(level, extra);
      if (!record) return records;
      if (records.some((item) => geoOptionId(item) === record.unique_id)) return records;
      return [record, ...records];
    };

    const applyScopeFallback = () => {
      setScopeStateOptions((prev) =>
        mergeWithScopeOptionExtra(prev, "state", {}),
      );
      setScopeDistrictRecords((prev) =>
        mergeRecord(prev, "district", scopedStateId ? { state_id: scopedStateId } : {}),
      );
      setScopeAreaTypeRecords((prev) =>
        mergeRecord(prev, "area_type", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      );
      setScopeLocalBodyRecords((prev) => ({
        corporation_id: mergeRecord(prev.corporation_id, "corporation", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        municipality_id: mergeRecord(prev.municipality_id, "municipality", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        town_panchayat_id: mergeRecord(prev.town_panchayat_id, "town_panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        panchayat_union_id: mergeRecord(prev.panchayat_union_id, "panchayat_union", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        panchayat_id: mergeRecord(prev.panchayat_id, "panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
      }));
    };

    applyScopeFallback();

    const loadScopeGeoOptions = async () => {
      try {
        const [states, districts, areaTypes, corporations, municipalities, townPanchayats, panchayatUnions, panchayats] =
          await Promise.all([
            stateApi.readAll(),
            districtApi.readAll(),
            areaTypeApi.readAll(),
            corporationApi.readAll(),
            municipalityApi.readAll(),
            townPanchayatApi.readAll(),
            panchayatUnionApi.readAll(),
            panchayatApi.readAll(),
          ]);

        const asArray = (res: any): GeoOptionRecord[] =>
          Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : res?.data?.results ?? [];

        setScopeStateOptions(mergeWithScopeOptionExtra(toGeoOptions(asArray(states)), "state", {}));
        setScopeDistrictRecords(
          mergeRecord(asArray(districts), "district", scopedStateId ? { state_id: scopedStateId } : {}),
        );
        setScopeAreaTypeRecords(
          mergeRecord(asArray(areaTypes), "area_type", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        );
        setScopeLocalBodyRecords({
          corporation_id: mergeRecord(asArray(corporations), "corporation", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          municipality_id: mergeRecord(asArray(municipalities), "municipality", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          town_panchayat_id: mergeRecord(asArray(townPanchayats), "town_panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          panchayat_union_id: mergeRecord(asArray(panchayatUnions), "panchayat_union", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          panchayat_id: mergeRecord(asArray(panchayats), "panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        });
      } catch (error) {
        console.error("Failed to load government scope options", error);
        applyScopeFallback();
      }
    };

    void loadScopeGeoOptions();
  }, []);

  useEffect(() => {
    if (!formData.department_id) {
      setDesignationOptions([]);
      return;
    }
    const normalizeResponse = (res: any) =>
      Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : res?.data?.results ?? [];

    designationApi
      .readAll({ params: { status: "active", department_id: formData.department_id } })
      .then((res: any) => {
        const list = normalizeResponse(res).filter(
          (d: any) => d?.is_active !== false && d?.is_deleted !== true,
        );
        setDesignationOptions(
          list.map((d: any) => ({
            value: String(d?.unique_id ?? d?.id ?? ""),
            label: d.designation_name,
            name: d.designation_name,
            group: d.designation_group,
            departmentId: normalizeEntityId(d.department_id),
          })),
        );
      })
      .catch(() => setDesignationOptions([]));
  }, [formData.department_id]);

  useEffect(() => {
    if (!isEdit || !id) return;
    setFetching(true);

    staffCreationApi.read(id)
      .then((staff) => {
        setFormData((prev) => ({
          ...prev,

          // Office details
          employee_name: staff.employee_name ?? "",
          doj: staff.doj ?? "",
          department: staff.department ?? "",
          designation: staff.designation ?? "",
          department_id: normalizeEntityId(staff.department_id ?? staff.department ?? staff.department_unique_id),
          designation_id: normalizeEntityId(staff.designation_id ?? staff.designation_obj ?? staff.designation_unique_id),
          staff_head: staff.staff_head ?? "",
          staff_head_id: staff.staff_head_id ?? "",
          active_status: staff.active_status ? "1" : "0",
          login_enabled: staff.login_enabled ? "1" : "0",

          // Auth
          username: staff.username ?? "",
          password: staff.password ?? "",

          // Personal details (FLAT — NOT nested)
          marital_status:
            staff.marital_status ??
            staff.personal_details?.marital_status ??
            "",
          dob: staff.dob ?? staff.personal_details?.dob ?? "",
          blood_group:
            staff.blood_group ?? staff.personal_details?.blood_group ?? "",
          gender: staff.gender ?? staff.personal_details?.gender ?? "",
          physically_challenged:
            staff.physically_challenged ??
            staff.personal_details?.physically_challenged ??
            "",

          present_country: staff.present_address?.country ?? "",
          present_state: staff.present_address?.state ?? "",
          present_district: staff.present_address?.district ?? "",
          present_city: staff.present_address?.city ?? "",
          present_building_no: staff.present_address?.building_no ?? "",
          present_street: staff.present_address?.street ?? "",
          present_area: staff.present_address?.area ?? "",
          present_pincode: staff.present_address?.pincode ?? "",

          // JSON Address — Permanent
          permanent_country: staff.permanent_address?.country ?? "",
          permanent_state: staff.permanent_address?.state ?? "",
          permanent_district: staff.permanent_address?.district ?? "",
          permanent_city: staff.permanent_address?.city ?? "",
          permanent_building_no: staff.permanent_address?.building_no ?? "",
          permanent_street: staff.permanent_address?.street ?? "",
          permanent_area: staff.permanent_address?.area ?? "",
          permanent_pincode: staff.permanent_address?.pincode ?? "",

          // DRIVER and USER TYPE details
          staffusertype_id: normalizeEntityId(staff.staffusertype_id),
          contractorusertype_id: normalizeEntityId(staff.contractorusertype_id),
          governmentusertype_id: normalizeEntityId(staff.governmentusertype_id),
          state_id: normalizeEntityId(staff.state_id),
          district_id: normalizeEntityId(staff.district_id),
          area_type_id: normalizeEntityId(staff.area_type_id),
          local_body_level: (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as const)
            .find((level) => normalizeEntityId((staff as any)[level])) ?? "",
          local_body_id: (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as const)
            .map((level) => normalizeEntityId((staff as any)[level]))
            .find(Boolean) ?? "",
          driving_licence_no: staff.driving_licence_no ?? "",
          driving_licence_expiry_date: staff.driving_licence_expiry_date ?? "",

          // Contact details (FLAT — NOT nested)
          contact_mobile: staff.contact_mobile ?? "",
          contact_email: staff.contact_email ?? "",
        }));

        // Set pending prefill values so dropdowns apply once their option lists load
        const staffTypeId = normalizeEntityId(staff.staffusertype_id);
        const contractorTypeId = normalizeEntityId(staff.contractorusertype_id);
        const departmentId = normalizeEntityId(staff.department_id ?? staff.department ?? staff.department_unique_id);
        const designationId = normalizeEntityId(staff.designation_id ?? staff.designation_obj ?? staff.designation_unique_id);

        const governmentTypeId = normalizeEntityId(staff.governmentusertype_id);
        if (staffTypeId) setPendingStaffUserTypeId(staffTypeId);
        if (contractorTypeId) setPendingContractorUserTypeId(contractorTypeId);
        // governmentLevel derives from state_id/district_id/local_body_level,
        // already set above in the same setFormData call — no separate prefill needed.
        if (governmentTypeId) setPendingGovernmentUserTypeId(governmentTypeId);

        // Government geo cascade — queue each level so it is re-applied once its
        // (parent-dependent) option list has finished loading, mirroring the
        // pending-prefill pattern used for the other dropdowns above.
        const geoStateId = normalizeEntityId(staff.state_id);
        const geoDistrictId = normalizeEntityId(staff.district_id);
        const geoAreaTypeId = normalizeEntityId(staff.area_type_id);
        const geoLocalBodyLevel = (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as const)
          .find((level) => normalizeEntityId((staff as any)[level])) ?? null;
        const geoLocalBodyId = (["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"] as const)
          .map((level) => normalizeEntityId((staff as any)[level]))
          .find(Boolean) ?? null;
        if (geoStateId) setPendingStateId(geoStateId);
        if (geoDistrictId) setPendingDistrictId(geoDistrictId);
        if (geoAreaTypeId) setPendingAreaTypeId(geoAreaTypeId);
        if (geoLocalBodyLevel) setPendingLocalBodyLevel(geoLocalBodyLevel);
        if (geoLocalBodyId) setPendingLocalBodyId(geoLocalBodyId);
        if (departmentId) setPendingDepartmentId(departmentId);
        if (designationId) setPendingDesignationId(designationId);

        if (staff.driving_licence_file) {
          setLicencePreview(
            staff.driving_licence_file.startsWith("http")
              ? staff.driving_licence_file
              : `${backendOrigin}${staff.driving_licence_file}`,
          );
        }

        // Government-only project: staff/contractor user types are retired, so
        // every record edits as a government user regardless of its stored type.
        // (Legacy staff/contractor records converge to government on save.)
        setUserTypeCategory("government");


        // Password audit fields
        setPasswordCrtDate(staff.password_crt_date ?? null);
        setStaffCreatedAt(staff.created_at ?? null);

        if (staff.photo) {
          setPhotoPreview(
            staff.photo.startsWith("http")
              ? staff.photo
              : `${backendOrigin}${staff.photo}`,
          );
        }

      })
      .catch((error) => {
        console.error("Failed to load staff", error);
        Swal.fire({
          icon: "error",
          title: t("admin.staff_creation.load_failed_title"),
          text:
            error.response?.data?.detail ||
            t("admin.staff_creation.load_failed_desc"),
        });
      })
      .finally(() => setFetching(false));
  }, [backendOrigin, id, isEdit]);

  useEffect(() => {
    // Staff head candidates are scoped to the same local body and to one
    // level up in the government role hierarchy (driver/operator ->
    // supervisor, supervisor -> admin, admin -> superadmin), so this must
    // refetch whenever the role or local body selection changes.
    if (userTypeCategory === "government" && !formData.governmentusertype_id) {
      setStaffHeadOptions([]);
      return;
    }

    const loadStaffHeads = async () => {
      try {
        const params: Record<string, string> = {};
        if (id) params.exclude = id;
        if (formData.governmentusertype_id) {
          params.governmentusertype_id = formData.governmentusertype_id;
        }
        if (formData.local_body_level && formData.local_body_id) {
          params[formData.local_body_level] = formData.local_body_id;
        }

        const response = await api.get(
          "/user-creations/staffcreation/staff-head-options/",
          { params },
        );
        const records = Array.isArray(response.data)
          ? response.data
          : response.data?.results ?? [];
        const options: { value: string; label: string; name: string }[] = records.map((staff: any) => ({
          value: String(staff.unique_id),
          label: `${staff.employee_name}${staff.department_name ? ` — ${staff.department_name}` : ""}`,
          name: staff.employee_name,
        }));

        setStaffHeadOptions(options);
      } catch (error) {
        console.error("Failed to load staff head options", error);
        setStaffHeadOptions([]);
      }
    };

    void loadStaffHeads();
  }, [
    id,
    userTypeCategory,
    formData.governmentusertype_id,
    formData.local_body_level,
    formData.local_body_id,
  ]);

  useEffect(() => {
    if (!photoFile) return;
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  useEffect(() => {
    if (!sameAddress) return;
    setFormData((prev) => ({
      ...prev,
      permanent_country: prev.present_country,
      permanent_state: prev.present_state,
      permanent_district: prev.present_district,
      permanent_city: prev.present_city,
      permanent_building_no: prev.present_building_no,
      permanent_street: prev.present_street,
      permanent_area: prev.present_area,
      permanent_pincode: prev.present_pincode,
    }));
  }, [
    sameAddress,
    formData.present_country,
    formData.present_state,
    formData.present_district,
    formData.present_city,
    formData.present_building_no,
    formData.present_street,
    formData.present_area,
    formData.present_pincode,
  ]);

  // ── Pending-prefill resolution effects ──────────────────────────────────────
  // Each effect watches [pendingXxx, xOptions]. Once the option list is non-empty
  // and contains the pending value, it applies the value and clears the pending.

  useEffect(() => {
    if (!pendingStaffUserTypeId || staffUserTypeOptions.length === 0) return;
    const match = staffUserTypeOptions.find((o) => o.value === pendingStaffUserTypeId);
    if (match) {
      setFormData((prev) => ({ ...prev, staffusertype_id: pendingStaffUserTypeId }));
      setPendingStaffUserTypeId(null);
    }
  }, [pendingStaffUserTypeId, staffUserTypeOptions]);

  useEffect(() => {
    if (!pendingContractorUserTypeId || contractorUserTypeOptions.length === 0) return;
    const match = contractorUserTypeOptions.find((o) => o.value === pendingContractorUserTypeId);
    if (match) {
      setFormData((prev) => ({ ...prev, contractorusertype_id: pendingContractorUserTypeId }));
      setPendingContractorUserTypeId(null);
    }
  }, [contractorUserTypeOptions, pendingContractorUserTypeId]);

  useEffect(() => {
    if (!pendingGovernmentUserTypeId || governmentUserTypeRecords.length === 0) return;
    const match = governmentUserTypeRecords.find((r) => r.unique_id === pendingGovernmentUserTypeId);
    if (match) {
      setFormData((prev) => ({ ...prev, governmentusertype_id: pendingGovernmentUserTypeId }));
      setPendingGovernmentUserTypeId(null);
    }
  }, [pendingGovernmentUserTypeId, governmentUserTypeRecords]);

  useEffect(() => {
    if (!pendingDepartmentId || departmentOptions.length === 0) return;
    const match = departmentOptions.find((o) => o.value === pendingDepartmentId);
    if (match) {
      setFormData((prev) => ({
        ...prev,
        department_id: pendingDepartmentId,
        department: match.name,
      }));
      setPendingDepartmentId(null);
    }
  }, [pendingDepartmentId, departmentOptions]);

  useEffect(() => {
    if (!pendingDesignationId || designationOptions.length === 0) return;
    const match = designationOptions.find((o) => o.value === pendingDesignationId);
    if (match) {
      setFormData((prev) => ({
        ...prev,
        designation_id: pendingDesignationId,
        designation: match.name,
      }));
      setPendingDesignationId(null);
    }
  }, [pendingDesignationId, designationOptions]);

  // ── Government geo cascade pending-prefill resolution ────────────────────────
  // Each level resolves only after its option list (which itself depends on the
  // parent level's value) is available, so State → District → Area Type →
  // Local Body Type → Local Body fill in sequence regardless of load order.
  useEffect(() => {
    if (!pendingStateId || scopeStateOptions.length === 0) return;
    if (scopeStateOptions.some((o) => o.value === pendingStateId)) {
      setFormData((prev) => ({ ...prev, state_id: pendingStateId }));
      setPendingStateId(null);
    }
  }, [pendingStateId, scopeStateOptions]);

  useEffect(() => {
    if (!pendingDistrictId || scopeDistrictOptions.length === 0) return;
    if (scopeDistrictOptions.some((o) => o.value === pendingDistrictId)) {
      setFormData((prev) => ({ ...prev, district_id: pendingDistrictId }));
      setPendingDistrictId(null);
    }
  }, [pendingDistrictId, scopeDistrictOptions]);

  useEffect(() => {
    if (!pendingAreaTypeId || scopeAreaTypeOptions.length === 0) return;
    if (scopeAreaTypeOptions.some((o) => o.value === pendingAreaTypeId)) {
      setFormData((prev) => ({ ...prev, area_type_id: pendingAreaTypeId }));
      setPendingAreaTypeId(null);
    }
  }, [pendingAreaTypeId, scopeAreaTypeOptions]);

  useEffect(() => {
    if (!pendingLocalBodyLevel || availableScopeLocalBodyLevels.length === 0) return;
    if (availableScopeLocalBodyLevels.some((l) => l.value === pendingLocalBodyLevel)) {
      setFormData((prev) => ({ ...prev, local_body_level: pendingLocalBodyLevel }));
      setPendingLocalBodyLevel(null);
    }
  }, [pendingLocalBodyLevel, availableScopeLocalBodyLevels]);

  useEffect(() => {
    if (!pendingLocalBodyId || scopeLocalBodyOptions.length === 0) return;
    if (scopeLocalBodyOptions.some((o) => o.value === pendingLocalBodyId)) {
      setFormData((prev) => ({ ...prev, local_body_id: pendingLocalBodyId }));
      setPendingLocalBodyId(null);
    }
  }, [pendingLocalBodyId, scopeLocalBodyOptions]);
  // ────────────────────────────────────────────────────────────────────────────

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (
    field: keyof typeof initialFormData,
    value: string,
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "department_id") {
        const department = departmentOptionsWithCurrent.find((item) => item.value === value);
        next.department = department?.name ?? "";
        next.designation_id = "";
        next.designation = "";
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "designation_id") {
        const designation = designationOptionsWithCurrent.find((item) => item.value === value);
        next.designation = designation?.name ?? "";
      }
      if (
        field === "staffusertype_id" ||
        field === "contractorusertype_id" ||
        field === "governmentusertype_id"
      ) {
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "staff_head_id") {
        const staffHead = staffHeadOptions.find((item) => item.value === value);
        next.staff_head = staffHead?.name ?? "";
      }
      if (field === "state_id") {
        next.district_id = "";
        next.area_type_id = "";
        next.local_body_level = "";
        next.local_body_id = "";
        next.governmentusertype_id = "";
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "district_id") {
        next.area_type_id = "";
        next.local_body_level = "";
        next.local_body_id = "";
        next.governmentusertype_id = "";
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "area_type_id") {
        next.local_body_level = "";
        next.local_body_id = "";
        next.governmentusertype_id = "";
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "local_body_level") {
        next.local_body_id = "";
        next.governmentusertype_id = "";
        next.staff_head = "";
        next.staff_head_id = "";
      }
      if (field === "local_body_id") {
        next.staff_head = "";
        next.staff_head_id = "";
      }

      return next;
    });
  };

  const resetGovernmentScope = () => {
    setFormData((prev) => ({
      ...prev,
      state_id: "",
      district_id: "",
      area_type_id: "",
      local_body_level: "",
      local_body_id: "",
    }));
  };

  const calculateAge = (dobValue: string) => {
    const birthDate = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age >= 0 ? age : 0;
  };

  const buildAddressPayload = (prefix: "present" | "permanent") => {
    const address = {
      ...(showField(`${prefix}_country`) && {
        country: formData[
          `${prefix}_country` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_state`) && {
        state: formData[
          `${prefix}_state` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_district`) && {
        district: formData[
          `${prefix}_district` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_city`) && {
        city: formData[
          `${prefix}_city` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_building_no`) && {
        building_no: formData[
          `${prefix}_building_no` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_street`) && {
        street: formData[
          `${prefix}_street` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_area`) && {
        area: formData[
          `${prefix}_area` as keyof typeof initialFormData
        ] as string,
      }),
      ...(showField(`${prefix}_pincode`) && {
        pincode: formData[
          `${prefix}_pincode` as keyof typeof initialFormData
        ] as string,
      }),
    };

    return Object.values(address).some((value) => Boolean(value))
      ? address
      : null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (
      showField("photo") &&
      photoFile &&
      !photoFile.type.startsWith("image/")
    ) {
      Swal.fire({
        icon: "warning",
        title: t("admin.staff_creation.invalid_photo_title"),
        text: t("admin.staff_creation.invalid_photo_desc"),
      });
      return;
    }

    // ✅ DRIVER VALIDATION — mandatory on create AND on edit when no existing file
    if (
      showField("driving_licence_file") &&
      isDriverSelected &&
      !licenceFile &&
      !licencePreview
    ) {
      Swal.fire({
        icon: "error",
        title: "Licence Required",
        text: "Please upload the driving licence file (JPG, JPEG, PNG or PDF).",
      });
      return;
    }

    setSubmitting(true);

    try {
      const rawPayload: Record<string, any> = {
        employee_name: formData.employee_name,
        doj: formData.doj || null,
        department: formData.department,
        // Designation is free text now (no FK); `designation_id` is not sent.
        designation: formData.designation,
        department_id: formData.department_id,
        staff_head: formData.staff_head,
        staff_head_id: formData.staff_head_id,
        active_status: formData.active_status === "1",
        staffusertype_id:
          userTypeCategory === "staff"
            ? formData.staffusertype_id || null
            : null,
        contractorusertype_id:
          userTypeCategory === "contractor"
            ? formData.contractorusertype_id || null
            : null,
        governmentusertype_id:
          userTypeCategory === "government"
            ? formData.governmentusertype_id || null
            : null,
        state_id: userTypeCategory === "government" ? formData.state_id || null : null,
        district_id: userTypeCategory === "government" ? formData.district_id || null : null,
        area_type_id: userTypeCategory === "government" ? formData.area_type_id || null : null,
        corporation_id:
          userTypeCategory === "government" && formData.local_body_level === "corporation_id"
            ? formData.local_body_id || null
            : null,
        municipality_id:
          userTypeCategory === "government" && formData.local_body_level === "municipality_id"
            ? formData.local_body_id || null
            : null,
        town_panchayat_id:
          userTypeCategory === "government" && formData.local_body_level === "town_panchayat_id"
            ? formData.local_body_id || null
            : null,
        panchayat_union_id:
          userTypeCategory === "government" && formData.local_body_level === "panchayat_union_id"
            ? formData.local_body_id || null
            : null,
        panchayat_id:
          userTypeCategory === "government" && formData.local_body_level === "panchayat_id"
            ? formData.local_body_id || null
            : null,
        username: formData.username || null, // ← username in payload
        login_enabled: formData.login_enabled === "1",

        // Personal
        marital_status: formData.marital_status,
        dob: formData.dob || null,
        blood_group: formData.blood_group,
        gender: formData.gender,
        physically_challenged: formData.physically_challenged,
        contact_mobile: formData.contact_mobile,
        contact_email: formData.contact_email,
      };

      // ✅ Add password if provided
      if (formData.password) {
        rawPayload.password = formData.password;
      }

      // ✅ ADD DRIVER FIELDS
      if (showField("driving_licence_no") && isDriverSelected) {
        rawPayload.driving_licence_no = formData.driving_licence_no || "";
      }
      if (showField("driving_licence_expiry_date") && isDriverSelected) {
        rawPayload.driving_licence_expiry_date = formData.driving_licence_expiry_date || null;
      }

      const presentPayload = buildAddressPayload("present");
      const permanentPayload = buildAddressPayload("permanent");

      if (presentPayload) rawPayload.present_address = presentPayload;
      if (permanentPayload) rawPayload.permanent_address = permanentPayload;

      const payload = filterPayload(rawPayload);

      const formBody = new FormData();

      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (typeof value === "object") {
          formBody.append(key, JSON.stringify(value));
        } else {
          formBody.append(key, value);
        }
      });

      // ✅ FILE APPENDS
      if (showField("photo") && photoFile) {
        formBody.append("photo", photoFile);
      }

      if (showField("driving_licence_file") && licenceFile) {
        formBody.append("driving_licence_file", licenceFile);
      }

      let response: any;

      if (isEdit) {
        if (!id) throw new Error("Missing staff id");
        response = await staffCreationApi.uploadUpdate(id, formBody);
      } else {
        response = await staffCreationApi.upload(formBody);
      }

      Swal.fire({
        icon: "success",
        title: isEdit
          ? t("admin.staff_creation.save_success_update")
          : t("admin.staff_creation.save_success_create"),
        text:
          response?.message ||
          response?.data?.message ||
          t("admin.staff_creation.save_success_desc"),
      });

      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      console.error("Failed to save staff", error);
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: formatErrorMessage(t, error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionButtons: { label: string; key: Section }[] = [
    { label: t("admin.staff_creation.section_official"), key: "official" },
    { label: t("admin.staff_creation.section_personal"), key: "personal" },
  ];

  const renderOfficialSection = () => (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {showField("employee_name") && (
        <div>
          <Label htmlFor="employee_name">
            {t("admin.staff_creation.employee_name")}
          </Label>
          <Input
            id="employee_name"
            value={formData.employee_name}
            onChange={handleInputChange}
            required
          />
        </div>
      )}
      {/* <div>
        <Label htmlFor="employee_id">Employee ID</Label>
        <Input
          id="employee_id"
          value={formData.employee_id}
          onChange={handleInputChange}
        />
      </div> */}
      {showField("doj") && (
        <div>
          <Label htmlFor="doj">{t("admin.staff_creation.doj")}</Label>
          <Input
            id="doj"
            type="date"
            value={formData.doj}
            onChange={handleInputChange}
          />
        </div>
      )}
      {showField("staffusertype_id") && (
        <>
          {/* Category selector */}
          <div>
            <Label htmlFor="userTypeCategory">User Type</Label>
            <Select
              id="userTypeCategory"
              value={userTypeCategory}
              onChange={(value) => {
                setUserTypeCategory(value as "staff" | "contractor" | "government");
                handleSelectChange("staffusertype_id", "");
                handleSelectChange("contractorusertype_id", "");
                handleSelectChange("governmentusertype_id", "");
                handleSelectChange("staff_head_id", "");
                resetGovernmentScope();
              }}
              options={[
                { value: "government", label: "Government" },
              ]}
              placeholder="Select User Type"
            />
          </div>

          {userTypeCategory === "staff" && (
            <div>
              <Label htmlFor="staffusertype_id">
                {t("admin.staff_creation.staff_user_type")}
              </Label>
              <Select
                id="staffusertype_id"
                value={formData.staffusertype_id}
                onChange={(value) => handleSelectChange("staffusertype_id", value)}
                options={staffUserTypeOptions}
                placeholder={t("admin.staff_creation.staff_user_type_placeholder")}
              />
            </div>
          )}

          {userTypeCategory === "contractor" && (
            <div>
              <Label htmlFor="contractorusertype_id">Contractor User Type</Label>
              <Select
                id="contractorusertype_id"
                value={formData.contractorusertype_id}
                onChange={(value) => handleSelectChange("contractorusertype_id", value)}
                options={contractorUserTypeOptions}
                placeholder="Select Contractor Type"
              />
            </div>
          )}

          {userTypeCategory === "government" && (
            <>
              <div>
                <Label htmlFor="state_id">State</Label>
                <Select
                  id="state_id"
                  value={formData.state_id}
                  onChange={(value) => handleSelectChange("state_id", value)}
                  options={scopeStateOptions}
                  placeholder="Select state"
                />
              </div>
              <div>
                <Label htmlFor="district_id">District</Label>
                <Select
                  id="district_id"
                  value={formData.district_id}
                  onChange={(value) => handleSelectChange("district_id", value)}
                  options={scopeDistrictOptions}
                  placeholder={formData.state_id ? "Select district" : "Select a state first"}
                  disabled={!formData.state_id}
                />
              </div>
              <div>
                <Label htmlFor="area_type_id">Area Type</Label>
                <Select
                  id="area_type_id"
                  value={formData.area_type_id}
                  onChange={(value) => handleSelectChange("area_type_id", value)}
                  options={scopeAreaTypeOptions}
                  placeholder={formData.district_id ? "Select area type" : "Select a district first"}
                  disabled={!formData.district_id}
                />
              </div>
              <div>
                <Label htmlFor="local_body_level">Local Body</Label>
                <Select
                  id="local_body_level"
                  value={formData.local_body_level}
                  onChange={(value) => handleSelectChange("local_body_level", value)}
                  options={availableScopeLocalBodyLevels.map((level) => ({ value: level.value, label: level.label }))}
                  placeholder={formData.area_type_id ? "Select local body type" : "Select an area type first"}
                  disabled={!formData.area_type_id}
                />
              </div>
              {formData.local_body_level && (
                <div>
                  <Label htmlFor="local_body_id">
                    {LOCAL_BODY_LEVELS.find((level) => level.value === formData.local_body_level)?.label}
                  </Label>
                  <Select
                    id="local_body_id"
                    value={formData.local_body_id}
                    onChange={(value) => handleSelectChange("local_body_id", value)}
                    options={scopeLocalBodyOptions}
                    placeholder="Select"
                  />
                </div>
              )}

              {/* Government Staff User Type — filtered by the level derived from State/District/Local Body above */}
              <div>
                <Label htmlFor="governmentusertype_id">Government Staff User Type</Label>
                <Select
                  id="governmentusertype_id"
                  value={formData.governmentusertype_id}
                  onChange={(value) => handleSelectChange("governmentusertype_id", value)}
                  options={filteredGovtStaffTypeOptions}
                  placeholder={
                    governmentLevel
                      ? "Select Staff User Type"
                      : "Select State/District or a Local Body first"
                  }
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Username ── */}
      {showField("username") && (
        <div>
          <Label htmlFor="username">{t("admin.staff_creation.username")}</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder={t("admin.staff_creation.username_placeholder")}
          />
        </div>
      )}

      {/* ── Password ── */}
      {showField("password") && (
        <div>
          <PasswordInput
            id="password"
            label={t("admin.staff_creation.password")}
            value={formData.password}
            onChange={handleInputChange}
            placeholder={
              isEdit
                ? t(
                    "admin.staff_creation.password_edit_placeholder",
                    "Leave blank to keep the current password",
                  )
                : t(
                    "admin.staff_creation.password_placeholder",
                    "Enter password",
                  )
            }
          />
          {isEdit && (
            <p className="text-xs text-gray-500 mt-1">
              {t(
                "admin.staff_creation.password_edit_hint",
                "Enter a new password only if you want to change it.",
              )}
            </p>
          )}
        </div>
      )}

      {showField("login_enabled") && (
        <div>
          <Label htmlFor="login_enabled">
            {t("admin.staff_creation.login_enabled")}
          </Label>
          <Select
            id="login_enabled"
            value={formData.login_enabled}
            onChange={(value) => handleSelectChange("login_enabled", value)}
            options={getYesNoOptions(t)}
            placeholder={t("admin.staff_creation.login_enabled_placeholder")}
          />
        </div>
      )}

      {/* ── Password Security Info (edit mode only) ── */}
      {isEdit && (
        <div className="md:col-span-2">
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
                <span className="material-symbols-outlined text-[14px] leading-none">lock_reset</span>
                Change Password
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-gray-500">Account Created:</span>{" "}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {staffCreatedAt
                    ? new Date(staffCreatedAt).toLocaleString()
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
                  <span className="material-symbols-outlined text-[14px] leading-none">info</span>
                  Password has never been changed — consider updating
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {isDriverSelected &&
        (showField("driving_licence_no") ||
          showField("driving_licence_file")) && (
          <>
            {showField("driving_licence_no") && (
              <div>
                <Label htmlFor="driving_licence_no">
                  {t("admin.staff_creation.driving_licence_no")}
                </Label>
                <Input
                  id="driving_licence_no"
                  value={formData.driving_licence_no}
                  onChange={handleInputChange}
                />
              </div>
            )}

            {showField("driving_licence_expiry_date") && (
              <div>
                <Label htmlFor="driving_licence_expiry_date">
                  Driving Licence Expiry Date
                </Label>
                <Input
                  id="driving_licence_expiry_date"
                  type="date"
                  value={formData.driving_licence_expiry_date}
                  onChange={handleInputChange}
                />
              </div>
            )}

            {showField("driving_licence_file") && (
              <div className="md:col-span-2">
                <Label htmlFor="driving_licence">
                  {t("admin.staff_creation.driving_licence_upload")}
                  <span className="text-red-500 ml-1">*</span>
                </Label>

                <div className="mt-1 flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-brand-400 dark:border-gray-700 dark:bg-gray-800/40">
                  <button
                    type="button"
                    onClick={() => licenceInputRef.current?.click()}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">upload_file</span>
                    {t("admin.staff_creation.driving_licence_choose")}
                  </button>

                  <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">
                    {licenceFile?.name || t("admin.staff_creation.driving_licence_no_file")}
                  </span>

                  {(licenceFile || licencePreview) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLicenceFile(null);
                        setLicencePreview("");
                        if (licenceInputRef.current) licenceInputRef.current.value = "";
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                      title="Remove file"
                    >
                      <span className="text-xs font-bold leading-none">✕</span>
                    </button>
                  )}
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Accepted: JPG, JPEG, PNG, PDF · Max 5 MB
                </p>

                <input
                  ref={licenceInputRef}
                  type="file"
                  id="driving_licence"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/jpg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleLicenceUpload(file);
                    e.target.value = "";
                  }}
                />

                {licencePreview && (
                  licencePreview.toLowerCase().endsWith(".pdf") || licenceFile?.type === "application/pdf" ? (
                    <a
                      href={licencePreview}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-blue-600 hover:underline dark:border-gray-700"
                    >
                      <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      View PDF
                    </a>
                  ) : (
                    <div className="mt-2 inline-block">
                      <a href={licencePreview} target="_blank" rel="noopener noreferrer">
                        <img
                          src={licencePreview}
                          alt="Licence preview"
                          className="h-24 w-24 rounded-lg border border-gray-200 object-cover shadow-sm dark:border-gray-700"
                        />
                      </a>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      {showField("staff_head_id") && (
        <div>
          <Label htmlFor="staff_head_id">
            {t("admin.staff_creation.staff_head")}
          </Label>
          <Select
            id="staff_head_id"
            value={formData.staff_head_id}
            onChange={(value) => handleSelectChange("staff_head_id", value)}
            options={staffHeadOptions}
            placeholder={
              userTypeCategory === "government" && !formData.governmentusertype_id
                ? "Select Government Staff User Type first"
                : t("common.select_item_placeholder", {
                    item: t("admin.staff_creation.staff_head"),
                  })
            }
            disabled={userTypeCategory === "government" && !formData.governmentusertype_id}
          />
        </div>
      )}
      {showField("active_status") && (
        <div>
          <Label htmlFor="active_status">
            {t("admin.staff_creation.active_status")}
          </Label>
          <Select
            id="active_status"
            value={formData.active_status}
            onChange={(value) => handleSelectChange("active_status", value)}
            options={activeStatusOptions}
            placeholder={t("common.select_status")}
          />
        </div>
      )}
      {showField("photo") && (
        <div className="md:col-span-2">
          <Label htmlFor="photo">{t("admin.staff_creation.photo_label")}</Label>

          <div className="mt-1 flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-brand-400 dark:border-gray-700 dark:bg-gray-800/40">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">add_photo_alternate</span>
              {t("admin.staff_creation.photo_choose")}
            </button>

            <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">
              {photoFile?.name || t("admin.staff_creation.photo_none")}
            </span>

            {(photoFile || photoPreview) && (
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview("");
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                title="Remove photo"
              >
                <span className="text-xs font-bold leading-none">✕</span>
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-400">
            Accepted: JPG, JPEG, PNG, WEBP · Max 5 MB
          </p>

          <input
            ref={photoInputRef}
            type="file"
            id="photo"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) {
                setPhotoFile(null);
                return;
              }
              if (!file.type.startsWith("image/")) {
                Swal.fire({
                  icon: "warning",
                  title: t("admin.staff_creation.invalid_photo_title"),
                  text: t("admin.staff_creation.invalid_photo_desc"),
                });
                event.target.value = "";
                setPhotoFile(null);
                setPhotoPreview("");
                return;
              }
              setPhotoFile(file);
            }}
          />

          {photoPreview && (
            <div className="mt-2 inline-block">
              <img
                src={photoPreview}
                alt={t("admin.staff_creation.photo_preview_alt")}
                className="h-24 w-24 rounded-lg border border-gray-200 object-cover shadow-sm dark:border-gray-700"
              />
            </div>
          )}
        </div>
      )}

    </div>
  );

  const renderPersonalSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {showField("marital_status") && (
          <div>
            <Label htmlFor="marital_status">
              {t("admin.staff_creation.marital_status")}
            </Label>
            <Select
              id="marital_status"
              value={formData.marital_status}
              onChange={(value) => handleSelectChange("marital_status", value)}
              options={maritalStatusOptions}
              placeholder={t("admin.staff_creation.marital_status_placeholder")}
            />
          </div>
        )}
        {showField("dob") && (
          <div>
            <Label htmlFor="dob">{t("admin.staff_creation.dob")}</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={handleInputChange}
            />
          </div>
        )}
        {showField("dob") && (
          <div>
            <Label htmlFor="age">{t("admin.staff_creation.age")}</Label>
            <Input
              id="age"
              value={formData.dob ? calculateAge(formData.dob) : ""}
              placeholder={t("admin.staff_creation.age_auto")}
            />
          </div>
        )}
        {showField("blood_group") && (
          <div>
            <Label htmlFor="blood_group">
              {t("admin.staff_creation.blood_group")}
            </Label>
            <Select
              id="blood_group"
              value={formData.blood_group}
              onChange={(value) => handleSelectChange("blood_group", value)}
              options={bloodGroupOptions}
              placeholder={t("admin.staff_creation.blood_group_placeholder")}
            />
          </div>
        )}
        {showField("gender") && (
          <div>
            <Label htmlFor="gender">{t("admin.staff_creation.gender")}</Label>
            <Select
              id="gender"
              value={formData.gender}
              onChange={(value) => handleSelectChange("gender", value)}
              options={genderOptions}
              placeholder={t("admin.staff_creation.gender_placeholder")}
            />
          </div>
        )}
        {showField("physically_challenged") && (
          <div>
            <Label htmlFor="physically_challenged">
              {t("admin.staff_creation.physically_challenged")}
            </Label>
            <Select
              id="physically_challenged"
              value={formData.physically_challenged}
              onChange={(value) =>
                handleSelectChange("physically_challenged", value)
              }
              options={yesNoOptions}
              placeholder={t("admin.staff_creation.select_option")}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(showField("present_country") ||
          showField("present_state") ||
          showField("present_district") ||
          showField("present_city") ||
          showField("present_building_no") ||
          showField("present_street") ||
          showField("present_area") ||
          showField("present_pincode")) && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-600">
              {t("admin.staff_creation.address_present_title")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {showField("present_country") && (
                <div>
                  <Label htmlFor="present_country">{t("common.country")}</Label>
                  <Input
                    id="present_country"
                    value={formData.present_country}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("present_state") && (
                <div>
                  <Label htmlFor="present_state">{t("common.state")}</Label>
                  <Input
                    id="present_state"
                    value={formData.present_state}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("present_district") && (
                <div>
                  <Label htmlFor="present_district">
                    {t("common.district")}
                  </Label>
                  <Input
                    id="present_district"
                    value={formData.present_district}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("present_city") && (
                <div>
                  <Label htmlFor="present_city">{t("common.city")}</Label>
                  <Input
                    id="present_city"
                    value={formData.present_city}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("present_building_no") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="present_building_no">
                    {t("common.building_no")}
                  </Label>
                  <Input
                    id="present_building_no"
                    value={formData.present_building_no}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("present_street") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="present_street">{t("common.street")}</Label>
                  <textarea
                    id="present_street"
                    value={formData.present_street}
                    onChange={handleInputChange}
                    rows={2}
                    className="input-validate h-auto w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm shadow-theme-xs focus:outline-none focus:ring-3 focus:ring-brand-500/20"
                  />
                </div>
              )}
              {showField("present_area") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="present_area">{t("common.area")}</Label>
                  <textarea
                    id="present_area"
                    value={formData.present_area}
                    onChange={handleInputChange}
                    rows={2}
                    className="input-validate h-auto w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm shadow-theme-xs focus:outline-none focus:ring-3 focus:ring-brand-500/20"
                  />
                </div>
              )}
              {showField("present_pincode") && (
                <div>
                  <Label htmlFor="present_pincode">{t("common.pincode")}</Label>
                  <Input
                    id="present_pincode"
                    value={formData.present_pincode}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {(showField("permanent_country") ||
          showField("permanent_state") ||
          showField("permanent_district") ||
          showField("permanent_city") ||
          showField("permanent_building_no") ||
          showField("permanent_street") ||
          showField("permanent_area") ||
          showField("permanent_pincode")) && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">
                {t("admin.staff_creation.address_permanent_title")}
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={sameAddress}
                  onChange={() => setSameAddress((prev) => !prev)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                />
                {t("admin.staff_creation.address_same")}
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {showField("permanent_country") && (
                <div>
                  <Label htmlFor="permanent_country">
                    {t("common.country")}
                  </Label>
                  <Input
                    id="permanent_country"
                    value={formData.permanent_country}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("permanent_state") && (
                <div>
                  <Label htmlFor="permanent_state">{t("common.state")}</Label>
                  <Input
                    id="permanent_state"
                    value={formData.permanent_state}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("permanent_district") && (
                <div>
                  <Label htmlFor="permanent_district">
                    {t("common.district")}
                  </Label>
                  <Input
                    id="permanent_district"
                    value={formData.permanent_district}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("permanent_city") && (
                <div>
                  <Label htmlFor="permanent_city">{t("common.city")}</Label>
                  <Input
                    id="permanent_city"
                    value={formData.permanent_city}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("permanent_building_no") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="permanent_building_no">
                    {t("common.building_no")}
                  </Label>
                  <Input
                    id="permanent_building_no"
                    value={formData.permanent_building_no}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              {showField("permanent_street") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="permanent_street">{t("common.street")}</Label>
                  <textarea
                    id="permanent_street"
                    value={formData.permanent_street}
                    onChange={handleInputChange}
                    rows={2}
                    className="input-validate h-auto w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm shadow-theme-xs focus:outline-none focus:ring-3 focus:ring-brand-500/20"
                  />
                </div>
              )}
              {showField("permanent_area") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="permanent_area">{t("common.area")}</Label>
                  <textarea
                    id="permanent_area"
                    value={formData.permanent_area}
                    onChange={handleInputChange}
                    rows={2}
                    className="input-validate h-auto w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm shadow-theme-xs focus:outline-none focus:ring-3 focus:ring-brand-500/20"
                  />
                </div>
              )}
              {showField("permanent_pincode") && (
                <div>
                  <Label htmlFor="permanent_pincode">
                    {t("common.pincode")}
                  </Label>
                  <Input
                    id="permanent_pincode"
                    value={formData.permanent_pincode}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(showField("contact_mobile") || showField("contact_email")) && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-600">
            {t("admin.staff_creation.contact_details")}
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {showField("contact_mobile") && (
              <div>
                <Label htmlFor="contact_mobile">
                  {t("admin.staff_creation.contact_mobile")}
                </Label>
                <Input
                  id="contact_mobile"
                  value={formData.contact_mobile}
                  onChange={handleInputChange}
                />
              </div>
            )}
            {showField("contact_email") && (
              <div>
                <Label htmlFor="contact_email">
                  {t("admin.staff_creation.contact_email")}
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={handleInputChange}
                />
              </div>
            )}
            {/* <div>
            <Label htmlFor="emergency_contact">Emergency Contact</Label>
            <Input
              id="emergency_contact"
              value={formData.emergency_contact}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="emergency_mobile">Emergency Mobile</Label>
            <Input
              id="emergency_mobile"
              value={formData.emergency_mobile}
              onChange={handleInputChange}
            />
          </div> */}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      {showChangePassword && id && (
        <ChangePasswordModal
          targetType="staff"
          targetId={id}
          onClose={() => setShowChangePassword(false)}
          onSuccess={(newDate) => setPasswordCrtDate(newDate)}
        />
      )}
      <ComponentCard
        title={
          isEdit
            ? t("admin.staff_creation.title_edit")
            : t("admin.staff_creation.title_add")
        }
        desc={t("admin.staff_creation.form_subtitle")}
      >
        <div className="flex flex-wrap gap-3 pb-4">
          {sectionButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setSection(btn.key)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                section === btn.key
                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {section === "official"
            ? renderOfficialSection()
            : renderPersonalSection()}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={submitting || fetching}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? isEdit
                  ? t("common.updating")
                  : t("common.saving")
                : isEdit
                  ? t("common.update")
                  : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(ENC_LIST_PATH)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
