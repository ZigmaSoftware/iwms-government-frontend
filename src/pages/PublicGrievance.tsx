import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Camera, CheckCircle2, LocateFixed, Loader2, Send } from "lucide-react";
import axios from "axios";

import { publicGrievanceApi } from "@/features/complaintTicketing/api";
import type { PublicGrievanceCategory, PublicGrievanceResponse } from "@/features/complaintTicketing/types";

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

export default function PublicGrievance() {
  const [categories, setCategories] = useState<PublicGrievanceCategory[]>([]);
  const [category, setCategory] = useState("");
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

  const photoName = useMemo(() => photo?.name ?? "Take or upload photo", [photo]);

  useEffect(() => {
    const controller = new AbortController();
    publicGrievanceApi
      .meta(controller.signal)
      .then((data) => {
        setCategories(data.categories);
        setCategory(data.categories[0]?.unique_id ?? "");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError("Unable to load grievance categories.");
      });
    return () => controller.abort();
  }, []);

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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!personName.trim() || !description.trim() || !latitude || !longitude) {
      setError("Person name, description, latitude, and longitude are required.");
      return;
    }

    const payload = new FormData();
    payload.append("device_id", getDeviceId());
    payload.append("person_name", personName.trim());
    payload.append("description", description.trim());
    payload.append("location_text", locationText.trim());
    payload.append("latitude", latitude);
    payload.append("longitude", longitude);
    if (category) payload.append("category", category);
    if (photo) payload.append("photo", photo);

    setIsSubmitting(true);
    try {
      const response = await publicGrievanceApi.create(payload);
      setResult(response);
      setDescription("");
      setLocationText("");
      setPhoto(null);
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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col justify-center">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700">
            Public Grievance
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Submit Location Complaint</h1>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Person Name
              <input
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-emerald-600"
                placeholder="Enter name"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-emerald-600"
              >
                {categories.map((item) => (
                  <option key={item.unique_id} value={item.unique_id}>
                    {item.category_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
              placeholder="Describe the grievance"
            />
          </label>

          <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
            Location Details
            <textarea
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              rows={2}
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
              placeholder="Street, landmark, or address"
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Latitude
              <input
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-emerald-600"
                inputMode="decimal"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Longitude
              <input
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-emerald-600"
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              onClick={captureLocation}
              disabled={isLocating}
              className="mt-0 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:mt-7"
            >
              {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Locate
            </button>
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-medium">
            <span className="flex min-w-0 items-center gap-2">
              <Camera className="h-4 w-4 shrink-0" />
              <span className="truncate">{photoName}</span>
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {result.message} Ticket No: <strong>{result.ticket_no}</strong>
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Grievance
          </button>
        </form>
      </section>
    </main>
  );
}
