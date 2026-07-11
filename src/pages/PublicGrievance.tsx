import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  FileText,
  ListFilter,
  Loader2,
  LocateFixed,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Ticket,
  User,
  X,
} from "lucide-react";
import axios from "axios";

import ZigmaLogo from "@/images/logo.png";
import { publicGrievanceApi } from "@/features/complaintTicketing/api";
import type {
  PublicGrievanceCategory,
  PublicGrievanceLocationOption,
  PublicGrievanceResponse,
  PublicGrievanceStatusResult,
  PublicGrievanceSubcategory,
} from "@/features/complaintTicketing/types";
import LocationPicker, { TRUSTED_ACCURACY_METERS } from "@/pages/publicGrievance/LocationPicker";

const DEVICE_STORAGE_KEY = "public_grievance_device_id";

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
}

/* ---------- design tokens: royal green x black x gold ---------- */

const ROYAL = "#0A5C36";
const ROYAL_DEEP = "#07452A";
const ORANGE = "#F97316";

const fieldClass =
  "h-12 w-full rounded-xl border-[1.5px] border-black/15 bg-white px-4 text-[15px] font-medium text-[#0A0A0A] outline-none transition placeholder:font-normal placeholder:text-black/35 focus:border-[#0A5C36] focus:ring-4 focus:ring-[#0A5C36]/15";
const textareaClass =
  "w-full rounded-xl border-[1.5px] border-black/15 bg-white px-4 py-3.5 text-[15px] font-medium text-[#0A0A0A] outline-none transition placeholder:font-normal placeholder:text-black/35 focus:border-[#0A5C36] focus:ring-4 focus:ring-[#0A5C36]/15 resize-none";
const labelClass = "flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-black/60";
const primaryBtnClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0A5C36] px-7 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(10,92,54,0.6)] transition-colors hover:bg-[#07452A] disabled:pointer-events-none disabled:opacity-60";
const accentBtnClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#F97316] px-6 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(249,115,22,0.6)] transition-colors hover:bg-[#E05F02] disabled:pointer-events-none disabled:opacity-60";
const ghostBtnClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-6 text-sm font-bold text-[#0A0A0A] transition hover:border-black/40 disabled:pointer-events-none disabled:opacity-40";
const noScrollbarClass =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const cardClass =
  "rounded-3xl border border-black/10 bg-white shadow-[0_16px_50px_-20px_rgba(10,92,54,0.25)]";

/* ---------- motion presets ---------- */

const stepMotion = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const riseIn = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

/* ---------- small building blocks ---------- */

function SectionHeading({ icon, title, hint }: { icon: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-6px_rgba(10,92,54,0.6)]"
        style={{ backgroundColor: ROYAL }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold text-[#0A0A0A]">{title}</h2>
        {hint && <div className="mt-0.5 text-[13px] font-medium text-black/55">{hint}</div>}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-xl bg-black/5 p-1 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <motion.button
            key={option.value}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-5 py-2 text-[13px] font-bold transition-colors ${
              active ? "bg-[#0A5C36] text-white shadow-md" : "text-black/50 hover:text-black"
            }`}
          >
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${fieldClass} appearance-none pr-9 disabled:bg-black/5 disabled:text-black/35`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
    </div>
  );
}

type View = "landing" | "wizard";
type StatusMode = "ticket" | "mobile";
type Gender = "male" | "female" | "transgender" | "";
type Step = 1 | 2 | 3 | 4;

const STEPS: { label: string; icon: typeof User }[] = [
  { label: "Your Details", icon: User },
  { label: "Location", icon: MapPin },
  { label: "Complaint", icon: FileText },
  { label: "Review", icon: ClipboardCheck },
];

// Each wizard step lives at /publicgrivence/regcomplaint/<slug> so steps are
// deep-linkable and the browser back button walks the wizard.
const BASE_PATH = "/publicgrivence";
const STEP_SLUGS = ["yourDetails", "location", "complaint", "review"] as const;

function Stepper({ step, onJump }: { step: Step; onJump: (target: Step) => void }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((item, index) => {
        const stepNo = (index + 1) as Step;
        const done = stepNo < step;
        const active = stepNo === step;
        const Icon = item.icon;
        return (
          <li key={item.label} className={`flex items-center ${index > 0 ? "flex-1" : ""}`}>
            {index > 0 && (
              <span className="relative mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-black/10 sm:mx-2">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: ROYAL }}
                  initial={false}
                  animate={{ width: done || active ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </span>
            )}
            <button
              type="button"
              onClick={() => done && onJump(stepNo)}
              className={`group flex flex-col items-center gap-1 ${done ? "cursor-pointer" : "cursor-default"}`}
            >
              <motion.span
                animate={active ? { scale: 1.12 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold sm:h-12 sm:w-12 ${
                  done
                    ? "bg-[#0A5C36] text-white group-hover:bg-[#07452A]"
                    : active
                      ? "bg-[#F97316] text-white ring-4 ring-[#F97316]/25 shadow-[0_8px_20px_-6px_rgba(249,115,22,0.7)]"
                      : "border-2 border-black/15 bg-white text-black/35"
                }`}
              >
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </motion.span>
              <span
                className={`hidden text-[11px] font-bold uppercase tracking-wide sm:block ${
                  active ? "text-[#F97316]" : done ? "text-[#0A5C36]" : "text-black/35"
                }`}
              >
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const TRACK_STAGES = ["Submitted", "Assigned", "In Progress", "Resolved"];
const TERMINATED_CODES = new Set(["REJECTED", "CANCELLED"]);

function trackStageIndex(code?: string | null): number {
  switch (code) {
    case "ASSIGNED":
      return 1;
    case "IN_PROGRESS":
    case "ESCALATED":
    case "REOPENED":
      return 2;
    case "RESOLVED":
    case "CLOSED":
      return 3;
    default:
      return 0;
  }
}

function StatusBadge({ status, code }: { status: string | null; code?: string | null }) {
  const terminated = TERMINATED_CODES.has(code || "");
  const resolved = code === "RESOLVED" || code === "CLOSED";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        backgroundColor: terminated ? "rgba(220,38,38,0.1)" : "rgba(10,92,54,0.1)",
        color: terminated ? "#B91C1C" : ROYAL_DEEP,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: terminated ? "#DC2626" : resolved ? ROYAL : ORANGE }}
      />
      {status || "Submitted"}
    </span>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-black/45">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-[#0A0A0A] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function TrackResultCard({ row }: { row: PublicGrievanceStatusResult }) {
  const terminated = TERMINATED_CODES.has(row.status_code || "");
  const stage = trackStageIndex(row.status_code);
  const timeline = row.timeline ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-[1.5px] border-black/10 bg-white p-5 text-left shadow-[0_12px_36px_-20px_rgba(10,92,54,0.35)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-base font-extrabold text-[#0A0A0A]">{row.ticket_no}</span>
        <StatusBadge status={row.status} code={row.status_code} />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <ReviewRow
          label="Complaint Type"
          value={[row.category, row.subcategory].filter(Boolean).join(" / ") || "-"}
        />
        <ReviewRow
          label="Submitted On"
          value={row.created ? new Date(row.created).toLocaleString() : "-"}
        />
        {row.location_text && (
          <div className="sm:col-span-2">
            <ReviewRow label="Location" value={row.location_text} />
          </div>
        )}
        {row.description && (
          <div className="sm:col-span-2">
            <ReviewRow label="Description" value={row.description} />
          </div>
        )}
      </dl>

      {terminated ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-300 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This complaint was {row.status?.toLowerCase() || "closed"} and is no longer in progress.</span>
        </div>
      ) : (
        <ol className="mt-6 flex items-start">
          {TRACK_STAGES.map((label, index) => {
            const reached = index <= stage;
            const isCurrent = index === stage && stage < TRACK_STAGES.length - 1;
            return (
              <li key={label} className={`flex items-start ${index > 0 ? "flex-1" : ""}`}>
                {index > 0 && (
                  <span className="relative mx-1.5 mt-3.5 h-1 flex-1 overflow-hidden rounded-full bg-black/10 sm:mx-2">
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: ROYAL }}
                      initial={false}
                      animate={{ width: reached ? "100%" : "0%" }}
                      transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.12 }}
                    />
                  </span>
                )}
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                      reached
                        ? isCurrent
                          ? "bg-[#F97316] text-white ring-4 ring-[#F97316]/25"
                          : "bg-[#0A5C36] text-white"
                        : "border-2 border-black/15 bg-white text-black/35"
                    }`}
                  >
                    {reached ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span
                    className={`text-center text-[10px] font-bold uppercase tracking-wide ${
                      isCurrent ? "text-[#F97316]" : reached ? "text-[#0A5C36]" : "text-black/35"
                    }`}
                  >
                    {label}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {timeline.length > 0 && (
        <div className="mt-6 border-t-[1.5px] border-black/8 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">Progress Timeline</p>
          <ol className="mt-3 flex flex-col">
            {timeline.map((entry, index) => (
              <li key={`${entry.status_code}-${entry.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                {index < timeline.length - 1 && (
                  <span className="absolute bottom-0 left-[6px] top-4 w-0.5 bg-black/10" />
                )}
                <span
                  className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: index === timeline.length - 1 ? ORANGE : ROYAL }}
                />
                <div>
                  <p className="text-sm font-bold text-[#0A0A0A]">{entry.status || "-"}</p>
                  {entry.at && (
                    <p className="text-[11px] font-medium text-black/45">
                      {new Date(entry.at).toLocaleString()}
                    </p>
                  )}
                  {entry.remarks && <p className="mt-0.5 text-xs font-medium text-black/60">{entry.remarks}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </motion.div>
  );
}

/* ---------- page ---------- */

export default function PublicGrievance() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const segments = pathname.split("/").filter(Boolean);
  const inWizard = segments[1] === "regcomplaint";
  const stepSlug = inWizard ? segments[2] : undefined;
  const slugIndex = stepSlug ? STEP_SLUGS.indexOf(stepSlug as (typeof STEP_SLUGS)[number]) : -1;
  const view: View = inWizard ? "wizard" : "landing";
  const step: Step = slugIndex >= 0 ? ((slugIndex + 1) as Step) : 1;

  const [stepError, setStepError] = useState("");

  const [categories, setCategories] = useState<PublicGrievanceCategory[]>([]);
  const [subcategories, setSubcategories] = useState<PublicGrievanceSubcategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const [personName, setPersonName] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [shareMobile, setShareMobile] = useState(false);
  const [shareEmail, setShareEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublicGrievanceResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [states, setStates] = useState<PublicGrievanceLocationOption[]>([]);
  const [districts, setDistricts] = useState<PublicGrievanceLocationOption[]>([]);
  const [cities, setCities] = useState<PublicGrievanceLocationOption[]>([]);
  const [stateId, setStateId] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");

  const [statusMode, setStatusMode] = useState<StatusMode>("ticket");
  const [statusQuery, setStatusQuery] = useState("");
  const [statusResults, setStatusResults] = useState<PublicGrievanceStatusResult[] | null>(null);
  const [statusError, setStatusError] = useState("");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const photoPreviewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);

  useEffect(() => {
    const controller = new AbortController();
    publicGrievanceApi
      .meta(controller.signal)
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError("Unable to load complaint types.");
      });
    publicGrievanceApi
      .states(controller.signal)
      .then(setStates)
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    return () => controller.abort();
  }, []);

  // Normalise bad wizard URLs (/regcomplaint or an unknown slug -> step 1).
  useEffect(() => {
    if (inWizard && slugIndex === -1) {
      navigate(`${BASE_PATH}/regcomplaint/${STEP_SLUGS[0]}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWizard, slugIndex]);

  // A deep link straight into a later step has no form data - restart at step 1.
  const deepLinkCheckedRef = useRef(false);
  useEffect(() => {
    if (deepLinkCheckedRef.current) return;
    deepLinkCheckedRef.current = true;
    if (inWizard && slugIndex > 0 && !personName.trim()) {
      navigate(`${BASE_PATH}/regcomplaint/${STEP_SLUGS[0]}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subcategoriesForCategory = useMemo(
    () => subcategories.filter((item) => item.category === categoryId),
    [subcategories, categoryId],
  );

  const onCategoryChange = (value: string) => {
    setCategoryId(value);
    setSubcategoryId("");
  };

  const onStateChange = async (value: string) => {
    setStateId(value);
    setDistrict("");
    setCity("");
    setCities([]);
    if (!value) {
      setDistricts([]);
      return;
    }
    const districtRows = await publicGrievanceApi.districts(value).catch(() => []);
    setDistricts(districtRows);
  };

  const onDistrictChange = async (value: string) => {
    setDistrict(value);
    setCity("");
    if (!value) {
      setCities([]);
      return;
    }
    const cityRows = await publicGrievanceApi.cities(value).catch(() => []);
    setCities(cityRows);
  };

  const captureLocation = () => {
    setStepError("");
    setLocationDenied(false);
    if (!navigator.geolocation) {
      setStepError("Location is not supported on this device.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setGpsAccuracy(position.coords.accuracy ?? null);
        setIsLocating(false);
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setLocationDenied(true);
        } else {
          setStepError("Unable to read location. Please try again or tap the map to drop the pin.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  // Ask for the citizen's location (browser permission prompt included) the
  // first time they reach the location step.
  const autoLocateAttemptedRef = useRef(false);
  useEffect(() => {
    if (view !== "wizard" || step !== 2) return;
    if (autoLocateAttemptedRef.current || latitude || longitude) return;
    autoLocateAttemptedRef.current = true;
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, step]);

  const onMapPick = (lat: string, lng: string, address?: string) => {
    setLatitude(lat);
    setLongitude(lng);
    if (address) {
      setGpsAccuracy(null); // pin adjusted by hand - the device fix no longer applies
      if (!landmark.trim()) setLandmark(address);
    }
  };

  const resetForNewSubmission = () => {
    setResult(null);
    setError("");
    setStepError("");
    setPersonName("");
    setGender("");
    setShareMobile(false);
    setShareEmail(false);
    setPhone("");
    setEmail("");
    setDescription("");
    setStreet("");
    setLandmark("");
    setLatitude("");
    setLongitude("");
    setGpsAccuracy(null);
    setLocationDenied(false);
    setPhoto(null);
    setCategoryId("");
    setSubcategoryId("");
    setStateId("");
    setDistrict("");
    setCity("");
    setDistricts([]);
    setCities([]);
    autoLocateAttemptedRef.current = false;
  };

  const copyTicketNo = async () => {
    if (!result?.ticket_no) return;
    try {
      await navigator.clipboard.writeText(result.ticket_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - silently ignore */
    }
  };

  const validateStep = (current: Step): string => {
    if (current === 1) {
      if (!personName.trim()) return "Please enter your name.";
      if (!gender) return "Please select your gender.";
      if (shareMobile && !phone.trim()) return "Please enter your mobile number.";
      if (shareEmail && !email.trim()) return "Please enter your email address.";
      return "";
    }
    if (current === 2) {
      if (!latitude || !longitude) return "Please pin the complaint location on the map.";
      return "";
    }
    if (current === 3) {
      if (!categoryId) return "Please select a complaint type.";
      if (subcategoriesForCategory.length > 0 && !subcategoryId)
        return "Please select a complaint sub-type.";
      if (!description.trim()) return "Please describe the complaint.";
      return "";
    }
    return "";
  };

  const jumpToStep = (target: Step) => {
    setStepError("");
    navigate(`${BASE_PATH}/regcomplaint/${STEP_SLUGS[target - 1]}`);
  };

  const goHome = () => {
    setStepError("");
    navigate(BASE_PATH);
  };

  const goNext = () => {
    const message = validateStep(step);
    if (message) {
      setStepError(message);
      return;
    }
    jumpToStep(Math.min(4, step + 1) as Step);
  };

  const goPrevious = () => {
    jumpToStep(Math.max(1, step - 1) as Step);
  };

  const submitGrievance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 4) {
      goNext();
      return;
    }

    setError("");
    setResult(null);

    const payload = new FormData();
    payload.append("device_id", getDeviceId());
    payload.append("person_name", personName.trim());
    if (gender) payload.append("gender", gender);
    if (shareMobile && phone.trim()) payload.append("phone", phone.trim());
    if (shareEmail && email.trim()) payload.append("email", email.trim());
    payload.append("description", description.trim());
    payload.append("location_text", [street.trim(), landmark.trim()].filter(Boolean).join(", "));
    payload.append("latitude", latitude);
    payload.append("longitude", longitude);
    payload.append("category", categoryId);
    if (subcategoryId) payload.append("subcategory", subcategoryId);
    if (stateId) payload.append("state", stateId);
    if (district) payload.append("district", district);
    if (city) {
      payload.append("city", city);
      const cityType = cities.find((item) => item.unique_id === city)?.type;
      if (cityType) payload.append("city_type", cityType);
    }
    if (photo) payload.append("photo", photo);

    setIsSubmitting(true);
    try {
      const response = await publicGrievanceApi.create(payload);
      setResult(response);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as Partial<PublicGrievanceResponse> & { detail?: string };
        setError(data.detail || "A grievance was already submitted from this device.");
      } else if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as Record<string, unknown>;
        setError(
          String(
            data.detail ||
              data.email ||
              data.location ||
              data.person_name ||
              data.description ||
              data.waste_type ||
              "Unable to submit grievance.",
          ),
        );
      } else {
        setError("Unable to submit grievance.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusError("");
    setStatusResults(null);
    const query = statusQuery.trim();
    if (!query) {
      setStatusError(statusMode === "ticket" ? "Enter a complaint number." : "Enter a mobile number.");
      return;
    }

    setIsCheckingStatus(true);
    try {
      const params = statusMode === "ticket" ? { ticket_no: query } : { mobile: query };
      const rows = await publicGrievanceApi.status(params);
      setStatusResults(rows);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setStatusError("No grievance found for the details you entered.");
      } else {
        setStatusError("Unable to check status right now. Please try again.");
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const categoryName = categories.find((item) => item.unique_id === categoryId)?.category_name;
  const subcategoryName = subcategoriesForCategory.find(
    (item) => item.unique_id === subcategoryId,
  )?.subcategory_name;
  const stateName = states.find((item) => item.unique_id === stateId)?.name;
  const districtName = districts.find((item) => item.unique_id === district)?.name;
  const cityName = cities.find((item) => item.unique_id === city)?.name;

  const isCoarseFix = gpsAccuracy != null && gpsAccuracy > TRUSTED_ACCURACY_METERS;
  const isPreciseFix = gpsAccuracy != null && gpsAccuracy <= TRUSTED_ACCURACY_METERS;

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#F5F7F5] text-[#0A0A0A]">
      {/* hero band - royal green with orange accent line */}
      <header className="relative shrink-0 px-4 py-4 text-white sm:py-5" style={{ backgroundColor: ROYAL }}>
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md sm:h-12 sm:w-12">
            <img src={ZigmaLogo} alt="Zigma" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "#FDBA74" }}>
              Public Grievance &amp; Redressal
            </p>
            <h1 className="truncate text-lg font-extrabold sm:text-xl">
              {view === "landing" ? "We're here to help your city stay clean" : "Report a Waste Management Issue"}
            </h1>
          </div>
          <div
            className="hidden items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold sm:flex"
            style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: "#FDBA74" }} />
            No login required
          </div>
        </div>
        {/* premium accent line */}
        <div
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: `linear-gradient(90deg, ${ORANGE} 0%, #FDBA74 50%, #4ADE94 100%)` }}
        />
      </header>

      {/* scrollable content */}
      <div className={`relative z-10 w-full min-h-0 flex-1 overflow-y-auto ${noScrollbarClass}`}>
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-8">
          {view === "landing" ? (
            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="flex flex-1 flex-col justify-center gap-6"
            >
              <div className="grid items-stretch gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* hero panel - royal green with orange accents */}
                <motion.div
                  variants={riseIn}
                  className="relative flex flex-col justify-center overflow-hidden rounded-3xl p-8 text-white shadow-[0_24px_60px_-24px_rgba(10,92,54,0.6)] sm:p-12"
                  style={{ background: `linear-gradient(135deg, ${ROYAL_DEEP} 0%, ${ROYAL} 55%, #0E7A47 100%)` }}
                >
                  <div
                    aria-hidden
                    className="absolute -right-20 -top-20 h-72 w-72 rounded-full"
                    style={{ border: "2px solid rgba(255,255,255,0.16)" }}
                  />
                  <div
                    aria-hidden
                    className="absolute -right-10 -top-10 h-48 w-48 rounded-full"
                    style={{ border: "2px solid rgba(255,255,255,0.10)" }}
                  />
                  <div
                    aria-hidden
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ background: `linear-gradient(90deg, ${ORANGE} 0%, #FDBA74 55%, #4ADE94 100%)` }}
                  />

                  <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "#FDBA74" }}>
                    Register a Complaint
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                    Spotted a waste problem?{" "}
                    <span style={{ color: "#FDBA74" }}>Report it in 2 minutes.</span>
                  </h2>
                  <p className="mt-4 max-w-lg text-[15px] font-medium text-white/75">
                    No login, no paperwork. Tell us what's wrong and where - our team picks it up
                    and keeps you posted.
                  </p>

                  <ul className="mt-8 flex flex-col gap-4">
                    {[
                      { icon: LocateFixed, text: "Your location is detected automatically - just confirm the pin" },
                      { icon: Camera, text: "Attach a photo so our crew finds the spot faster" },
                      { icon: Ticket, text: "Get a complaint number instantly & track progress anytime" },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#FDBA74" }}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-sm font-semibold text-white/90">{text}</span>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ y: -2 }}
                    onClick={() => jumpToStep(1)}
                    className={`${accentBtnClass} mt-10 h-13 w-full px-10 text-base sm:w-auto sm:self-start`}
                  >
                    Register Your Complaint <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </motion.div>

                <motion.div variants={riseIn} className={`${cardClass} flex flex-col justify-center p-7 sm:p-9`}>
                <div className="flex flex-col items-center text-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_-8px_rgba(10,92,54,0.7)]"
                    style={{ backgroundColor: ROYAL }}
                  >
                    <Search className="h-6 w-6" />
                  </span>
                  <h2 className="mt-3 text-xl font-extrabold text-[#0A0A0A]">Track Your Complaint</h2>
                  <p className="mt-1 text-xs font-medium text-black/55">
                    Enter your complaint number or the mobile number you registered with.
                  </p>
                  <Segmented
                    className="mt-4"
                    value={statusMode}
                    onChange={(mode) => {
                      setStatusMode(mode);
                      setStatusResults(null);
                      setStatusError("");
                    }}
                    options={[
                      { value: "ticket", label: "By Complaint Number" },
                      { value: "mobile", label: "By Mobile Number" },
                    ]}
                  />
                </div>

                <form onSubmit={checkStatus} className="mx-auto mt-5 flex max-w-lg flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                    <input
                      value={statusQuery}
                      onChange={(event) => setStatusQuery(event.target.value)}
                      className={`${fieldClass} pl-10`}
                      inputMode={statusMode === "mobile" ? "tel" : "text"}
                      placeholder={
                        statusMode === "ticket" ? "e.g. GRV-2026-000123" : "10-digit mobile number"
                      }
                    />
                  </div>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={isCheckingStatus}
                    className={`${accentBtnClass} sm:w-40`}
                  >
                    {isCheckingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Check Now
                  </motion.button>
                </form>

                {statusError && (
                  <div className="mx-auto mt-4 flex max-w-lg items-start gap-2.5 rounded-xl border-[1.5px] border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{statusError}</span>
                  </div>
                )}

                {statusResults && statusResults.length > 0 && (
                  <div className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-3">
                    {statusResults.map((row) => (
                      <TrackResultCard key={row.ticket_no} row={row} />
                    ))}
                  </div>
                )}
                </motion.div>
              </div>

              {/* how it works strip */}
              <motion.div variants={riseIn} className={`${cardClass} px-5 py-4 sm:px-7`}>
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-black/45">
                    How it works
                  </p>
                  <ol className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
                    {STEPS.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.label} className="flex items-center gap-2.5">
                          <span className="flex items-center gap-2">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                              style={{ backgroundColor: index === STEPS.length - 1 ? ORANGE : ROYAL }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-xs font-bold text-[#0A0A0A]">{item.label}</span>
                          </span>
                          {index < STEPS.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 text-black/25" />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </motion.div>
            </motion.div>
          ) : result ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${cardClass} mx-auto my-auto flex w-full max-w-3xl flex-col items-center p-8 text-center sm:p-12`}
            >
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[0_16px_40px_-10px_rgba(10,92,54,0.7)]"
                style={{ backgroundColor: ROYAL }}
              >
                <CheckCircle2 className="h-10 w-10" />
              </motion.span>
              <h2 className="mt-5 text-2xl font-extrabold text-[#0A0A0A]">Grievance Submitted</h2>
              <p className="mt-1.5 max-w-md text-sm font-medium text-black/55">{result.message}</p>
              {shareEmail && email.trim() && (
                <p className="mt-1 text-xs text-black/45">
                  A confirmation with follow-up details has been sent to {email.trim()}.
                </p>
              )}

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="mt-7 flex items-center gap-3 rounded-2xl border-2 border-dashed py-3.5 pl-6 pr-3"
                style={{ borderColor: ORANGE, backgroundColor: "rgba(249,115,22,0.07)" }}
              >
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#B45309" }}>
                    Your Complaint Number
                  </p>
                  <p className="font-mono text-xl font-extrabold text-[#0A0A0A]">{result.ticket_no}</p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={copyTicketNo}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#0A0A0A] transition hover:bg-black/5"
                  title="Copy ticket number"
                >
                  {copied ? <CheckCircle2 className="h-5 w-5" style={{ color: ROYAL }} /> : <Copy className="h-5 w-5" />}
                </motion.button>
              </motion.div>

              <div className="mt-7 grid w-full max-w-md grid-cols-3 gap-2 text-center">
                {["Submitted", "Assigned", "Resolved"].map((phase, index) => (
                  <div key={phase} className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        index === 0 ? "text-white" : "border-2 border-black/15 bg-white text-black/35"
                      }`}
                      style={index === 0 ? { backgroundColor: ROYAL } : undefined}
                    >
                      {index === 0 ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: index === 0 ? ROYAL : "rgba(0,0,0,0.35)" }}
                    >
                      {phase}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-black/45">
                Keep this number handy - you can track progress anytime from the home page.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    resetForNewSubmission();
                    jumpToStep(1);
                  }}
                  className={ghostBtnClass}
                >
                  Submit Another Complaint
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    resetForNewSubmission();
                    goHome();
                  }}
                  className={primaryBtnClass}
                >
                  Back to Home
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={submitGrievance}
              className={`${cardClass} mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-10`}
            >
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={goHome}
                  className="inline-flex items-center gap-1 text-sm font-bold text-black/45 transition hover:text-[#0A5C36]"
                >
                  <ArrowLeft className="h-4 w-4" /> Home
                </button>
                <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
                  Step {step} of 4
                </span>
              </div>

              <Stepper step={step} onJump={jumpToStep} />

              <AnimatePresence mode="wait">
                <motion.div key={step} {...stepMotion} className="flex flex-col gap-5">
                  {step === 1 && (
                    <div className="flex flex-col gap-5">
                      <SectionHeading
                        icon={<User className="h-4.5 w-4.5" />}
                        title="Your Details"
                        hint="Sharing your mobile or email is optional - it helps us keep you updated."
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>
                          Full Name <span className="text-red-500">*</span>
                          <input
                            value={personName}
                            onChange={(event) => setPersonName(event.target.value)}
                            className={fieldClass}
                            placeholder="Enter your name"
                          />
                        </label>
                        <div className={labelClass}>
                          Gender <span className="text-red-500">*</span>
                          <Segmented
                            value={gender || ("" as Gender)}
                            onChange={(value) => setGender(value as Gender)}
                            options={[
                              { value: "male" as Gender, label: "Male" },
                              { value: "female" as Gender, label: "Female" },
                              { value: "transgender" as Gender, label: "Transgender" },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-black/10 bg-[#F8FAF8] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-[#0A0A0A]">Share your Mobile Number?</p>
                            <Segmented
                              value={shareMobile ? "yes" : "no"}
                              onChange={(value) => setShareMobile(value === "yes")}
                              options={[
                                { value: "yes", label: "Yes" },
                                { value: "no", label: "No" },
                              ]}
                            />
                          </div>
                          {shareMobile && (
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                              <input
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                className={`${fieldClass} pl-10`}
                                inputMode="tel"
                                placeholder="10-digit mobile number"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-black/10 bg-[#F8FAF8] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-[#0A0A0A]">Share your Email?</p>
                            <Segmented
                              value={shareEmail ? "yes" : "no"}
                              onChange={(value) => setShareEmail(value === "yes")}
                              options={[
                                { value: "yes", label: "Yes" },
                                { value: "no", label: "No" },
                              ]}
                            />
                          </div>
                          {shareEmail ? (
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                              <input
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                type="email"
                                className={`${fieldClass} pl-10`}
                                placeholder="you@example.com"
                              />
                            </div>
                          ) : (
                            <p className="text-[11px] font-medium text-black/45">
                              Share your email to receive the ticket number and follow-up updates.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <SectionHeading
                          icon={<MapPin className="h-4.5 w-4.5" />}
                          title="Complaint Location"
                          hint="Drag the pin or tap the map to mark the exact spot."
                        />
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={captureLocation}
                          disabled={isLocating}
                          className={`${accentBtnClass} h-10 px-4 text-xs`}
                        >
                          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                          {isLocating ? "Detecting..." : "Detect My Location"}
                        </motion.button>
                      </div>

                      {locationDenied && (
                        <div className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-amber-400 bg-amber-50 px-3.5 py-3 text-xs font-medium text-amber-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            <strong>Location access is blocked.</strong> Tap the location icon in your
                            browser's address bar and choose <em>Allow</em>, then press "Detect My
                            Location" again - or simply tap the map to drop the pin yourself.
                          </span>
                        </div>
                      )}

                      {isCoarseFix && (
                        <div className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-amber-400 bg-amber-50 px-3.5 py-3 text-xs font-medium text-amber-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            <strong>This location looks approximate</strong> (accurate only to about{" "}
                            {gpsAccuracy! >= 1000 ? `${Math.round(gpsAccuracy! / 1000)} km` : `${Math.round(gpsAccuracy!)} m`}
                            , detected via your internet connection). Please drag the pin to the exact
                            spot - on a mobile phone with GPS this is detected precisely.
                          </span>
                        </div>
                      )}

                      {isPreciseFix && (
                        <div
                          className="flex items-start gap-2.5 rounded-xl border-[1.5px] px-3.5 py-3 text-xs font-medium"
                          style={{ borderColor: "rgba(10,92,54,0.4)", backgroundColor: "rgba(10,92,54,0.06)", color: ROYAL_DEEP }}
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            Location detected to within ~{Math.max(5, Math.round(gpsAccuracy!))} m. Fine-tune
                            the pin if needed.
                          </span>
                        </div>
                      )}

                      <LocationPicker
                        latitude={latitude}
                        longitude={longitude}
                        accuracy={gpsAccuracy}
                        onPick={onMapPick}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>
                          State
                          <SelectField value={stateId} onChange={onStateChange}>
                            <option value="">Select state</option>
                            {states.map((item) => (
                              <option key={item.unique_id} value={item.unique_id}>
                                {item.name}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                        <label className={labelClass}>
                          District
                          <SelectField value={district} onChange={onDistrictChange} disabled={!stateId}>
                            <option value="">{stateId ? "Select district" : "Select a state first"}</option>
                            {districts.map((item) => (
                              <option key={item.unique_id} value={item.unique_id}>
                                {item.name}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                        <label className={labelClass}>
                          City / Local Body
                          <SelectField value={city} onChange={setCity} disabled={!district}>
                            <option value="">Select city</option>
                            {cities.map((item) => (
                              <option key={item.unique_id} value={item.unique_id}>
                                {item.name}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                        <label className={labelClass}>
                          Street <span className="font-medium normal-case text-black/40">(optional)</span>
                          <input
                            value={street}
                            onChange={(event) => setStreet(event.target.value)}
                            className={fieldClass}
                            placeholder="Street name"
                          />
                        </label>
                        <label className={labelClass}>
                          Landmark / Address <span className="font-medium normal-case text-black/40">(optional)</span>
                          <input
                            value={landmark}
                            onChange={(event) => setLandmark(event.target.value)}
                            className={fieldClass}
                            placeholder="Nearby landmark or address"
                          />
                        </label>
                        <label className={labelClass}>
                          Latitude
                          <input
                            value={latitude}
                            onChange={(event) => {
                              setLatitude(event.target.value);
                              setGpsAccuracy(null);
                            }}
                            className={`${fieldClass} font-mono`}
                            inputMode="decimal"
                            placeholder="0.0000000"
                          />
                        </label>
                        <label className={labelClass}>
                          Longitude
                          <input
                            value={longitude}
                            onChange={(event) => {
                              setLongitude(event.target.value);
                              setGpsAccuracy(null);
                            }}
                            className={`${fieldClass} font-mono`}
                            inputMode="decimal"
                            placeholder="0.0000000"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="flex flex-col gap-5">
                      <SectionHeading
                        icon={<ListFilter className="h-4.5 w-4.5" />}
                        title="Complaint Type &amp; Details"
                        hint="Choose the type that best matches the issue."
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>
                          Complaint Type <span className="text-red-500">*</span>
                          <SelectField value={categoryId} onChange={onCategoryChange}>
                            <option value="">-- Select Complaint Type --</option>
                            {categories.map((item) => (
                              <option key={item.unique_id} value={item.unique_id}>
                                {item.category_name}
                              </option>
                            ))}
                          </SelectField>
                          {categories.length === 0 && (
                            <span className="text-[11px] font-medium normal-case text-black/40">
                              Loading complaint types...
                            </span>
                          )}
                        </label>
                        <label className={labelClass}>
                          Complaint Sub-Type{" "}
                          {subcategoriesForCategory.length > 0 ? (
                            <span className="text-red-500">*</span>
                          ) : (
                            <span className="font-medium normal-case text-black/40">(none for this type)</span>
                          )}
                          <SelectField
                            value={subcategoryId}
                            onChange={setSubcategoryId}
                            disabled={!categoryId || subcategoriesForCategory.length === 0}
                          >
                            <option value="">-- Select Complaint Sub-Type --</option>
                            {subcategoriesForCategory.map((item) => (
                              <option key={item.unique_id} value={item.unique_id}>
                                {item.subcategory_name}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                      </div>

                      <label className={labelClass}>
                        Details of Complaint <span className="text-red-500">*</span>
                        <textarea
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          rows={5}
                          maxLength={1000}
                          className={textareaClass}
                          placeholder="Describe the issue - what's wrong, since when, and anything that helps our team find it."
                        />
                        <span className="self-end text-[10px] font-medium normal-case text-black/40">
                          {description.length}/1000
                        </span>
                      </label>

                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-black/60">
                          Upload Photo <span className="font-medium normal-case text-black/40">(optional, under 5 MB)</span>
                        </p>
                        {photo ? (
                          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-black/10 bg-[#F8FAF8] p-3">
                            {photoPreviewUrl && (
                              <img
                                src={photoPreviewUrl}
                                alt="Selected"
                                className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm"
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-black/70">{photo.name}</span>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setPhoto(null)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black/40 transition hover:bg-black/5 hover:text-black"
                              title="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </motion.button>
                          </div>
                        ) : (
                          <motion.label
                            whileHover={{ scale: 1.01 }}
                            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/15 px-4 py-6 text-center transition-colors hover:border-[#0A5C36] hover:bg-[#0A5C36]/4"
                          >
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                              style={{ backgroundColor: ROYAL }}
                            >
                              <Camera className="h-5 w-5" />
                            </span>
                            <span className="text-sm font-bold text-[#0A0A0A]">Take or upload a photo</span>
                            <span className="text-[11px] font-medium text-black/45">
                              A photo helps our team resolve it faster
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                              className="sr-only"
                            />
                          </motion.label>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="flex flex-col gap-4">
                      <SectionHeading
                        icon={<ClipboardCheck className="h-4.5 w-4.5" />}
                        title="Review &amp; Submit"
                        hint="Please confirm everything looks right before submitting."
                      />

                      <div className="flex flex-col gap-3">
                        {[
                          {
                            title: "Your Details",
                            target: 1 as Step,
                            rows: (
                              <>
                                <ReviewRow label="Name" value={personName || "-"} />
                                <ReviewRow label="Gender" value={<span className="capitalize">{gender || "-"}</span>} />
                                <ReviewRow label="Mobile" value={shareMobile ? phone || "-" : "Not shared"} />
                                <ReviewRow label="Email" value={shareEmail ? email || "-" : "Not shared"} />
                              </>
                            ),
                          },
                          {
                            title: "Location",
                            target: 2 as Step,
                            rows: (
                              <>
                                <ReviewRow
                                  label="State / District / City"
                                  value={[stateName, districtName, cityName].filter(Boolean).join(" / ") || "-"}
                                />
                                <ReviewRow
                                  label="Street / Landmark"
                                  value={[street, landmark].filter(Boolean).join(", ") || "-"}
                                />
                                <ReviewRow label="Latitude" value={latitude || "-"} mono />
                                <ReviewRow label="Longitude" value={longitude || "-"} mono />
                              </>
                            ),
                          },
                          {
                            title: "Complaint",
                            target: 3 as Step,
                            rows: (
                              <>
                                <ReviewRow label="Type" value={categoryName || "-"} />
                                <ReviewRow label="Sub-Type" value={subcategoryName || "-"} />
                                <div className="sm:col-span-2">
                                  <ReviewRow label="Description" value={description || "-"} />
                                </div>
                                <ReviewRow label="Photo" value={photo ? photo.name : "Not attached"} />
                              </>
                            ),
                          },
                        ].map((section) => (
                          <div
                            key={section.title}
                            className="rounded-2xl border-[1.5px] border-black/10 bg-[#F8FAF8] p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#0A0A0A]">
                                {section.title}
                              </h3>
                              <button
                                type="button"
                                onClick={() => jumpToStep(section.target)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold transition hover:opacity-70"
                                style={{ color: ROYAL }}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            </div>
                            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{section.rows}</dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {(stepError || error) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{stepError || error}</span>
                </motion.div>
              )}

              <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-black/8 pt-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrevious}
                  disabled={step === 1}
                  className={ghostBtnClass}
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </motion.button>
                {step < 4 ? (
                  <motion.button type="submit" whileTap={{ scale: 0.97 }} className={primaryBtnClass}>
                    Next <ArrowRight className="h-4 w-4" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={isSubmitting}
                    className={primaryBtnClass}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Grievance
                  </motion.button>
                )}
              </div>
            </motion.form>
          )}

          <p className="shrink-0 pt-4 text-center text-[11px] font-bold uppercase tracking-wider text-black/35">
            Zigma - Alchemists of the MSW
          </p>
        </div>
      </div>
    </main>
  );
}
