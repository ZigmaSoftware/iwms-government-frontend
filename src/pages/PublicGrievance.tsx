import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  LocateFixed,
  MapPin,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import axios from "axios";

import ZigmaLogo from "@/images/logo.png";
import { publicGrievanceApi } from "@/features/complaintTicketing/api";
import type {
  PublicGrievanceLocationNode,
  PublicGrievanceResponse,
  PublicGrievanceWasteType,
} from "@/features/complaintTicketing/types";

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

function SectionHeading({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const textareaClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none";
const labelClass = "flex flex-col gap-1 text-xs font-semibold text-slate-500";
const noScrollbarClass = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export default function PublicGrievance() {
  const [wasteTypes, setWasteTypes] = useState<PublicGrievanceWasteType[]>([]);
  const [wasteTypeIds, setWasteTypeIds] = useState<string[]>([]);
  const [personName, setPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublicGrievanceResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [districts, setDistricts] = useState<PublicGrievanceLocationNode[]>([]);
  const [cities, setCities] = useState<PublicGrievanceLocationNode[]>([]);
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");

  const photoPreviewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);

  useEffect(() => {
    const controller = new AbortController();
    publicGrievanceApi
      .meta(controller.signal)
      .then((data) => {
        setWasteTypes(data.waste_types);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError("Unable to load waste types.");
      });
    publicGrievanceApi
      .districts(controller.signal)
      .then(setDistricts)
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    return () => controller.abort();
  }, []);

  const toggleWasteType = (id: string) => {
    setWasteTypeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
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
    setError("");
    if (!navigator.geolocation) {
      setError("Location is not supported on this device.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setIsLocating(false);
      },
      () => {
        setError("Unable to read location. Please allow location access and try again.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const resetForNewSubmission = () => {
    setResult(null);
    setError("");
    setPersonName("");
    setDescription("");
    setLocationText("");
    setLatitude("");
    setLongitude("");
    setPhoto(null);
    setWasteTypeIds([]);
    setDistrict("");
    setCity("");
    setCities([]);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!personName.trim() || !description.trim() || !latitude || !longitude) {
      setError("Person name, description, latitude, and longitude are required.");
      return;
    }
    if (wasteTypeIds.length === 0) {
      setError("Select at least one waste type.");
      return;
    }

    const payload = new FormData();
    payload.append("device_id", getDeviceId());
    payload.append("person_name", personName.trim());
    payload.append("description", description.trim());
    payload.append("location_text", locationText.trim());
    payload.append("latitude", latitude);
    payload.append("longitude", longitude);
    wasteTypeIds.forEach((id) => payload.append("waste_type", id));
    if (city || district) payload.append("location_node", city || district);
    if (photo) payload.append("photo", photo);

    setIsSubmitting(true);
    try {
      const response = await publicGrievanceApi.create(payload);
      setResult(response);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as Partial<PublicGrievanceResponse> & { detail?: string };
        setError(data.detail || "A grievance was already submitted from this device or location.");
      } else if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as Record<string, unknown>;
        setError(
          String(data.detail || data.location || data.person_name || data.description || "Unable to submit grievance."),
        );
      } else {
        setError("Unable to submit grievance.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center overflow-hidden bg-linear-to-b from-emerald-50 via-slate-50 to-slate-100 p-3 text-slate-950 sm:p-5">
      <div className="flex w-full max-w-5xl shrink-0 flex-col items-center pb-3 text-center sm:pb-4">
        <img src={ZigmaLogo} alt="Zigma" className="h-9 w-auto object-contain sm:h-10" />
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
          Public Grievance
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
          Report a Waste Management Issue
        </h1>
        <p className="mt-1 hidden max-w-md text-xs text-slate-500 sm:block">
          Tell us what's wrong and where - our team will pick it up and keep you updated on the ticket below.
        </p>
      </div>

      <div className={`w-full min-h-0 max-w-5xl flex-1 overflow-y-auto rounded-3xl ${noScrollbarClass}`}>
        {result ? (
          <div className="flex min-h-full flex-col items-center justify-center rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-900/5 sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Grievance Submitted</h2>
            <p className="mt-1.5 text-sm text-slate-500">{result.message}</p>

            <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-3 pl-5 pr-3">
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ticket No</p>
                <p className="font-mono text-lg font-bold text-slate-900">{result.ticket_no}</p>
              </div>
              <button
                type="button"
                onClick={copyTicketNo}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                title="Copy ticket number"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400">Keep this ticket number handy to track your complaint.</p>

            <button
              type="button"
              onClick={resetForNewSubmission}
              className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Submit Another Complaint
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6"
          >
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-8">
              {/* Left column */}
              <div className="flex flex-col gap-5">
                {/* Your details */}
                <div className="space-y-2">
                  <SectionHeading icon={<User className="h-4 w-4" />} title="Your Details" />
                  <label className={labelClass}>
                    Full Name 
                    <input
                      value={personName}
                      onChange={(event) => setPersonName(event.target.value)}
                      className={fieldClass}
                      placeholder="Enter your name"
                    />
                  </label>
                </div>

                {/* Waste type */}
                <div className="space-y-2 border-t border-slate-100 pt-5">
                  <SectionHeading
                    icon={<Trash2 className="h-4 w-4" />}
                    title="Type of Waste"
                    hint="Select all that apply"
                  />
                  <div className="flex flex-wrap gap-2">
                    {wasteTypes.map((item) => {
                      const checked = wasteTypeIds.includes(item.unique_id);
                      return (
                        <label
                          key={item.unique_id}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            checked
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleWasteType(item.unique_id)}
                          />
                          {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {item.waste_type_name}
                        </label>
                      );
                    })}
                    {wasteTypes.length === 0 && (
                      <span className="text-xs text-slate-400">Loading waste types...</span>
                    )}
                  </div>
                </div>

                {/* Issue details */}
                <div className="space-y-2 border-t border-slate-100 pt-5">
                  <SectionHeading icon={<FileText className="h-4 w-4" />} title="Issue Details" />
                  <label className={labelClass}>
                    Description 
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                      className={textareaClass}
                      placeholder="Describe the grievance in detail"
                    />
                  </label>
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-5 border-t border-slate-100 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                {/* Location */}
                <div className="space-y-2">
                  <SectionHeading icon={<MapPin className="h-4 w-4" />} title="Location" />

                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelClass}>
                      District
                      <select
                        value={district}
                        onChange={(event) => onDistrictChange(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select district</option>
                        {districts.map((item) => (
                          <option key={item.unique_id} value={item.unique_id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      City
                      <select
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        disabled={!district}
                        className={`${fieldClass} disabled:bg-slate-50 disabled:text-slate-400`}
                      >
                        <option value="">Select city</option>
                        {cities.map((item) => (
                          <option key={item.unique_id} value={item.unique_id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className={labelClass}>
                    Landmark / Address
                    <textarea
                      value={locationText}
                      onChange={(event) => setLocationText(event.target.value)}
                      rows={2}
                      className={textareaClass}
                      placeholder="Street, landmark, or address"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelClass}>
                      Latitude 
                      <input
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                        className={fieldClass}
                        inputMode="decimal"
                        placeholder="0.0000000"
                      />
                    </label>
                    <label className={labelClass}>
                      Longitude 
                      <input
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                        className={fieldClass}
                        inputMode="decimal"
                        placeholder="0.0000000"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={isLocating}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                    Use My Current Location
                  </button>
                </div>

                {/* Photo */}
                <div className="space-y-2 border-t border-slate-100 pt-5">
                  <SectionHeading icon={<Camera className="h-4 w-4" />} title="Photo Evidence" hint="Optional" />
                  {photo ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      {photoPreviewUrl && (
                        <img src={photoPreviewUrl} alt="Selected" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{photo.name}</span>
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                        title="Remove photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-3 py-3 text-sm font-medium text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700">
                      <Camera className="h-4 w-4" />
                      Take or upload photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Grievance
            </button>
          </form>
        )}
      </div>

      <p className="shrink-0 pt-3 text-center text-[11px] text-slate-400">
        Zigma - Alchemists of the MSW
      </p>
    </main>
  );
}
