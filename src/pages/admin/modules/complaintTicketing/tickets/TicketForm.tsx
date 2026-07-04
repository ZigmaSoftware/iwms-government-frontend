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
} from "@/features/complaintTicketing/api";
import { asArray, errorText } from "../utils";

export default function TicketForm() {
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
  const [saving, setSaving] = useState(false);
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
  }, []);

  const setValue = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const filteredSubcategories = form.category ? subcategories.filter((item) => String(item.category) === form.category) : subcategories;

  const onCustomer = (id: string) => {
    const customer = customers.find((item) => String(item.unique_id ?? item.id) === id);
    setForm((prev) => ({
      ...prev,
      customer: id,
      wa_phone: customer?.contact_no ?? customer?.phone ?? customer?.mobile ?? prev.wa_phone,
      profile_name: customer?.customer_name ?? prev.profile_name,
      location_text: [customer?.building_no, customer?.street, customer?.area, customer?.pincode].filter(Boolean).join(", "),
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.category || !form.priority || !form.status || !form.title.trim()) {
      Swal.fire("Missing fields", "Title, category, priority, and status are required.", "warning");
      return;
    }
    setSaving(true);
    try {
      await complaintTicketApi.create({
        ...form,
        customer: form.customer || null,
        subcategory: form.subcategory || null,
        source: form.source || null,
        language: form.language || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      });
      Swal.fire("Saved", "Ticket created successfully.", "success");
      navigate(listPath);
    } catch (err) {
      Swal.fire("Error", errorText(err, "Unable to create ticket"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title="Add Complaint Ticket">
      <form onSubmit={save} className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
        <div className="md:col-span-3"><Label>Title</Label><Input value={form.title} onChange={(e) => setValue("title", e.target.value)} required /></div>
        <div className="md:col-span-3"><Label>Description</Label><textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={4} value={form.description} onChange={(e) => setValue("description", e.target.value)} /></div>
        <div className="md:col-span-3"><Label>Location</Label><Input value={form.location_text} onChange={(e) => setValue("location_text", e.target.value)} /></div>
        <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setValue("latitude", e.target.value)} /></div>
        <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setValue("longitude", e.target.value)} /></div>
        <div className="md:col-span-3 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(listPath)}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ComponentCard>
  );
}
