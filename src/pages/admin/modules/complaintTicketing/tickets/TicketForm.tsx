/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { adminApi } from "@/helpers/admin/registry";
import {
  complaintCategoryApi,
  complaintLanguageApi,
  complaintPriorityApi,
  complaintSourceApi,
  complaintStatusApi,
  complaintSubcategoryApi,
  complaintTicketApi,
  geoApi,
} from "@/features/complaintTicketing/api";
import type { GeoOption, LocalBodyOption, LocalBodyType } from "@/features/complaintTicketing/types";
import { asArray, errorText } from "../utils";

const LOCAL_BODY_TYPES: LocalBodyType[] = [
  "corporation",
  "municipality",
  "town_panchayat",
  "panchayat_union",
  "panchayat",
];

const LOCAL_BODY_TYPE_LABELS: Record<LocalBodyType, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const AREA_TYPE_LEVELS: Record<"urban" | "rural", LocalBodyType[]> = {
  urban: ["corporation", "municipality", "town_panchayat"],
  rural: ["panchayat_union", "panchayat"],
};

const areaTypeCategoryFromName = (name: string): "urban" | "rural" | "" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const steps = ["Citizen", "Complaint", "Location"];

export default function TicketWizardForm() {
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  const [customers, setCustomers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [areaTypes, setAreaTypes] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<LocalBodyOption[]>([]);
  const [form, setForm] = useState({
    customer: "",
    wa_phone: "",
    profile_name: "",
    source: "",
    language: "",
    category: "",
    subcategory: "",
    priority: "",
    status: "",
    title: "",
    description: "",
    location_text: "",
    latitude: "",
    longitude: "",
    state: "",
    district: "",
    area_type: "",
    city: "",
    city_type: "" as LocalBodyType | "",
  });

  useEffect(() => {
    Promise.all([
      adminApi.customerCreations.readAll().catch(() => []),
      complaintCategoryApi.readAll().catch(() => []),
      complaintSubcategoryApi.readAll().catch(() => []),
      complaintPriorityApi.readAll().catch(() => []),
      complaintStatusApi.readAll().catch(() => []),
      complaintSourceApi.readAll().catch(() => []),
      complaintLanguageApi.readAll().catch(() => []),
    ]).then(([customerRows, categoryRows, subcategoryRows, priorityRows, statusRows, sourceRows, languageRows]) => {
      setCustomers(asArray(customerRows));
      setCategories(asArray(categoryRows));
      setSubcategories(asArray(subcategoryRows));
      setPriorities(asArray(priorityRows));
      setStatuses(asArray(statusRows));
      setSources(asArray(sourceRows));
      setLanguages(asArray(languageRows));
      setForm((prev) => ({
        ...prev,
        priority: asArray<any>(priorityRows)[0]?.unique_id ?? "",
        status: asArray<any>(statusRows).find((item) => item.status_code === "SUBMITTED")?.unique_id ?? asArray<any>(statusRows)[0]?.unique_id ?? "",
        source: asArray<any>(sourceRows).find((item) => item.source_code === "ADMIN")?.unique_id ?? asArray<any>(sourceRows)[0]?.unique_id ?? "",
      }));
    });
    geoApi.states().then(setStates).catch(() => setStates([]));
    geoApi.districts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  const setValue = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const filteredSubcategories = form.category ? subcategories.filter((item) => String(item.category) === form.category) : subcategories;
  const filteredDistricts = form.state ? districts.filter((item) => item.state_id === form.state) : districts;
  const filteredAreaTypes = form.district ? areaTypes.filter((item) => !item.district_id || item.district_id === form.district) : areaTypes;
  const selectedAreaType = areaTypes.find((item) => item.unique_id === form.area_type);
  const selectedAreaCategory = areaTypeCategoryFromName(selectedAreaType?.name ?? "");
  const availableLocalBodyTypes = selectedAreaCategory
    ? AREA_TYPE_LEVELS[selectedAreaCategory]
    : LOCAL_BODY_TYPES;

  const onStateChange = (value: string) => {
    setForm((prev) => ({ ...prev, state: value, district: "", area_type: "", city: "", city_type: "" }));
    setAreaTypes([]);
    setCities([]);
  };

  const onDistrictChange = async (value: string) => {
    setForm((prev) => ({ ...prev, district: value, area_type: "", city: "", city_type: "" }));
    setAreaTypes([]);
    setCities([]);
    if (value) {
      const areaRows = await geoApi.areaTypes(value).catch(() => []);
      setAreaTypes(areaRows);
    }
  };

  const onAreaTypeChange = (value: string) => {
    setForm((prev) => ({ ...prev, area_type: value, city: "", city_type: "" }));
    setCities([]);
  };

  const onLocalBodyTypeChange = async (value: string) => {
    const nextType = value as LocalBodyType | "";
    setForm((prev) => ({ ...prev, city_type: nextType, city: "" }));
    setCities([]);
    if (form.district && form.area_type && nextType) {
      const cityRows = await geoApi.localBodies(form.district, form.area_type, nextType).catch(() => []);
      setCities(cityRows);
    }
  };

  const onCityChange = (value: string) => {
    const selected = cities.find((item) => item.unique_id === value);
    setForm((prev) => ({ ...prev, city: value, city_type: selected?.type ?? "" }));
  };

  const entityId = (value: unknown): string => {
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return String(record.unique_id ?? record.id ?? "");
    }
    return value == null ? "" : String(value);
  };

  const onCustomer = (id: string) => {
    const customer = customers.find((item) => String(item.unique_id ?? item.id) === id);
    // Prefill the ticket's location from the customer's own flat geo fields.
    const customerState = entityId(customer?.state_id ?? customer?.state);
    const customerDistrict = entityId(customer?.district_id ?? customer?.district);
    const customerAreaType = entityId(customer?.area_type_id ?? customer?.area_type);
    let customerCity = "";
    let customerCityType: LocalBodyType | "" = "";
    for (const type of LOCAL_BODY_TYPES) {
      const value = entityId(customer?.[`${type}_id`] ?? customer?.[type]);
      if (value) {
        customerCity = value;
        customerCityType = type;
        break;
      }
    }
    setForm((prev) => ({
      ...prev,
      customer: id,
      wa_phone: customer?.contact_no ?? customer?.phone ?? customer?.mobile ?? prev.wa_phone,
      profile_name: customer?.customer_name ?? prev.profile_name,
      location_text: [customer?.building_no, customer?.street, customer?.area, customer?.pincode].filter(Boolean).join(", "),
      state: customerState || prev.state,
      district: customerDistrict || prev.district,
      area_type: customerAreaType || prev.area_type,
      city: customerCity,
      city_type: customerCityType,
    }));
    setAreaTypes([]);
    setCities([]);
    if (customerDistrict) {
      geoApi.areaTypes(customerDistrict).then(setAreaTypes).catch(() => setAreaTypes([]));
      geoApi.localBodies(customerDistrict, customerAreaType, customerCityType).then(setCities).catch(() => setCities([]));
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.category || !form.priority || !form.status || !form.title.trim()) {
      Swal.fire("Missing fields", "Title, category, priority, and status are required.", "warning");
      return;
    }
    setSaving(true);
    try {
      // The selected "city" maps onto exactly one of the five local-body FKs.
      const localBodyPayload: Record<string, string | null> = Object.fromEntries(
        LOCAL_BODY_TYPES.map((type) => [type, null]),
      );
      if (form.city && form.city_type) localBodyPayload[form.city_type] = form.city;
      await complaintTicketApi.create({
        wa_phone: form.wa_phone,
        profile_name: form.profile_name,
        source: form.source || null,
        language: form.language || null,
        category: form.category,
        subcategory: form.subcategory || null,
        priority: form.priority,
        status: form.status,
        title: form.title,
        description: form.description,
        location_text: form.location_text,
        customer: form.customer || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        state: form.state || null,
        district: form.district || null,
        area_type: form.area_type || null,
        ...localBodyPayload,
      });
      Swal.fire("Saved", "Ticket created successfully.", "success");
      navigate(listPath);
    } catch (err) {
      Swal.fire("Error", errorText(err, "Unable to create ticket"), "error");
    } finally {
      setSaving(false);
    }
  };

  const canContinue =
    step === 0
      ? Boolean(form.profile_name.trim() || form.customer || form.wa_phone.trim())
      : step === 1
        ? Boolean(form.category && form.priority && form.status && form.title.trim())
        : true;

  return (
    <ComponentCard title="Add Complaint Ticket">
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`min-h-10 rounded border px-2 py-2 text-sm font-medium ${index === step ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-600"}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <Label>Customer</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.customer} onChange={(e) => onCustomer(e.target.value)}>
                <option value="">Walk-in / unknown</option>
                {customers.map((item) => <option key={item.unique_id ?? item.id} value={item.unique_id ?? item.id}>{item.customer_name}</option>)}
              </select>
            </div>
            <div><Label>Phone</Label><Input value={form.wa_phone} onChange={(e) => setValue("wa_phone", e.target.value)} /></div>
            <div><Label>Profile Name</Label><Input value={form.profile_name} onChange={(e) => setValue("profile_name", e.target.value)} /></div>
            <div>
              <Label>Source</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.source} onChange={(e) => setValue("source", e.target.value)}>
                <option value="">None</option>
                {sources.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.source_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Language</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.language} onChange={(e) => setValue("language", e.target.value)}>
                <option value="">None</option>
                {languages.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.language_name}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <Label>Category</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))} required>
                <option value="">Select category</option>
                {categories.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.category_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Subcategory</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.subcategory} onChange={(e) => setValue("subcategory", e.target.value)}>
                <option value="">None</option>
                {filteredSubcategories.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.subcategory_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.priority} onChange={(e) => setValue("priority", e.target.value)} required>
                <option value="">Select priority</option>
                {priorities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.priority_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.status} onChange={(e) => setValue("status", e.target.value)} required>
                <option value="">Select status</option>
                {statuses.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.status_name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3"><Label>Title</Label><Input value={form.title} onChange={(e) => setValue("title", e.target.value)} required /></div>
            <div className="md:col-span-3"><Label>Description</Label><textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={4} value={form.description} onChange={(e) => setValue("description", e.target.value)} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <Label>State</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.state} onChange={(e) => onStateChange(e.target.value)}>
                <option value="">Select state</option>
                {states.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <Label>District</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.district} onChange={(e) => onDistrictChange(e.target.value)} disabled={!form.state}>
                <option value="">{form.state ? "Select district" : "Select a state first"}</option>
                {filteredDistricts.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Area Type</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.area_type} onChange={(e) => onAreaTypeChange(e.target.value)} disabled={!form.district}>
                <option value="">{form.district ? "Select area type" : "Select a district first"}</option>
                {filteredAreaTypes.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Local Body Type</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.city_type} onChange={(e) => onLocalBodyTypeChange(e.target.value)} disabled={!form.area_type}>
                <option value="">{form.area_type ? "Select local body type" : "Select area type first"}</option>
                {availableLocalBodyTypes.map((type) => <option key={type} value={type}>{LOCAL_BODY_TYPE_LABELS[type]}</option>)}
              </select>
            </div>
            <div>
              <Label>Local Body</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.city} onChange={(e) => onCityChange(e.target.value)} disabled={!form.district || !form.area_type || !form.city_type}>
                <option value="">{form.city_type ? "Select local body" : "Select local body type first"}</option>
                {cities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3"><Label>Location</Label><Input value={form.location_text} onChange={(e) => setValue("location_text", e.target.value)} /></div>
            <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setValue("latitude", e.target.value)} /></div>
            <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setValue("longitude", e.target.value)} /></div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(listPath)}>Cancel</button>
          {step > 0 && <button type="button" className="rounded border px-4 py-2" onClick={() => setStep((prev) => prev - 1)}>Back</button>}
          {step < steps.length - 1 ? (
            <button type="button" disabled={!canContinue} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60" onClick={() => setStep((prev) => prev + 1)}>Next</button>
          ) : (
            <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
          )}
        </div>
      </form>
    </ComponentCard>
  );
}
