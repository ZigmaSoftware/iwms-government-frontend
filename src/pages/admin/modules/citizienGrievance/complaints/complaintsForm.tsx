import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";

import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { getEncryptedRoute } from "@/utils/routeCache";
import {
  filterActiveCustomers,
  filterActiveRecords,
  normalizeCustomerArray,
} from "@/utils/customerUtils";

import { adminApi } from "@/helpers/admin/registry";
import { useTranslation } from "react-i18next";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";

/* ================= CONSTANTS ================= */

const FILE_ICON =
  "https://cdn-icons-png.flaticon.com/512/337/337946.png";

/* ================= HELPERS ================= */

const listFromResponse = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const resolveValue = (o: any) =>
  String(o?.unique_id ?? o?.id ?? "");

const resolveMainCategoryLabel = (m: any) =>
  m?.main_categoryName ??
  m?.main_category ??
  m?.name ??
  "";

const resolveCustomerId = (c: any) =>
  String(c?.id ?? c?.unique_id ?? "");

/* ================= COMPONENT ================= */

export default function ComplaintAddForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encCitizenGrivence, encComplaint } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCitizenGrivence, encComplaint);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    loggedInCompanyUniqueId,
    isSuperAdmin,
  } = useCompanyProjectSelection({ isEdit: false, initialCompanyId: routeState?.companyUniqueId, initialProjectId: routeState?.projectId });

  /* ---------------- STATE ---------------- */
  const [customers, setCustomers] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);

  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");

  const [mainCategories, setMainCategories] = useState<any[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);

  const [mainCategoryId, setMainCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");

  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewImage, setIsPreviewImage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- INIT LOAD ---------------- */
  useEffect(() => {
    let cancelled = false;

    adminApi.customerCreations.readAll().then((res: any) => {
      if (cancelled) return;
      const normalized = normalizeCustomerArray(res);
      setCustomers(filterActiveCustomers(normalized));
    }).catch(() => {});

    adminApi.mainCategory.readAll({ params: { company_id: companyUniqueId } })
      .then((res: any) => {
        if (cancelled) return;
        const normalized = listFromResponse(res);
        setMainCategories(filterActiveRecords(normalized));
      }).catch(() => {});

    adminApi.subCategory.readAll({ params: { company_id: companyUniqueId } })
      .then((res: any) => {
        if (cancelled) return;
        const normalized = listFromResponse(res);
        setAllSubCategories(filterActiveRecords(normalized));
      }).catch(() => {});

    return () => { cancelled = true; };
  }, [companyUniqueId]);

  const onCustomerChange = (id: string) => {
    const c = customers.find((x) => resolveCustomerId(x) === id);
    setCustomer(c);

    // Try different field names for contact
    const contactNo = c?.contact_no || c?.contact || c?.phone || c?.mobile || c?.phone_number || "";
    setContact(contactNo);

    // Build address from available fields
    const addressParts = [];
    if (c?.building_no) addressParts.push(c.building_no);
    if (c?.street) addressParts.push(c.street);
    if (c?.area) addressParts.push(c.area);
    if (c?.city_name) addressParts.push(c.city_name);
    if (c?.district_name) addressParts.push(c.district_name);
    if (c?.state_name) addressParts.push(c.state_name);
    if (c?.pincode) addressParts.push(c.pincode);

    const fullAddress = addressParts.join(", ");
    setAddress(fullAddress);

  };

  /* ---------------- MAIN → SUB CATEGORY (FIXED) ---------------- */

  useEffect(() => {
    if (!mainCategoryId) {
      setSubCategories([]);
      setSubCategoryId("");
      return;
    }

    // Build accepted parent keys
    const parentKeys = new Set<string>();

    const selectedMain = mainCategories.find(
      (m) => resolveValue(m) === mainCategoryId
    );

    const add = (v: any) => {
      if (v !== undefined && v !== null) parentKeys.add(String(v));
    };

    add(mainCategoryId);
    if (selectedMain) {
      [
        selectedMain.id,
        selectedMain.pk,
        selectedMain.unique_id,
        selectedMain.uniqueId,
        selectedMain.value,
        selectedMain.code,
      ].forEach(add);
    }

    const filtered = allSubCategories.filter((sub) => {
      const refs = [
        sub.mainCategory,
        sub.main_category,
        sub.mainCategory_id,
        sub.main_category_id,
        sub.mainCategory_unique_id,
        sub.main_category_unique_id,
      ];

      return refs.some((r) => r !== undefined && parentKeys.has(String(r)));
    });

    setSubCategories(filtered);
    setSubCategoryId("");
  }, [mainCategoryId, allSubCategories, mainCategories]);

  /* ---------------- FILE ---------------- */

  const uploadFile = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);

    if (f.type.startsWith("image/")) {
      setIsPreviewImage(true);
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setIsPreviewImage(false);
      setPreviewUrl(FILE_ICON);
    }
  };

  const clearFile = () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setIsPreviewImage(false);
  };

  /* ---------------- SAVE ---------------- */

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyUniqueId) {
      Swal.fire(
        "Error",
        !loggedInCompanyUniqueId && !isSuperAdmin
          ? "Company is not mapped to this login. Only super admin can choose a company."
          : "Company is required",
        "error"
      );
      return;
    }

    const customerId = resolveCustomerId(customer);

    if (
      !customer ||
      !customerId ||
      !mainCategoryId ||
      !subCategoryId ||
      !details
    ) {
      Swal.fire(
        t("admin.citizen_grievance.complaints_form.missing_title"),
        t("admin.citizen_grievance.complaints_form.missing_message"),
        "warning"
      );
      return;
    }

    const mainLabel = resolveMainCategoryLabel(
      mainCategories.find((m) => resolveValue(m) === mainCategoryId)
    );

    const subLabel =
      subCategories.find((s) => resolveValue(s) === subCategoryId)?.name || "";

    const fd = new FormData();
    fd.append("customer", customerId);
    fd.append("company_id", companyUniqueId);
    fd.append("contact_no", contact);
    fd.append("address", address);
    fd.append("main_category", mainLabel);
    fd.append("sub_category", subLabel);
    fd.append("category", "OTHER");
    fd.append("details", details);
    fd.append("priority", priority);
    if (file) fd.append("image", file);

    setIsSubmitting(true);
    try {
      await adminApi.complaints.create(fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire(
        t("admin.citizen_grievance.complaints_form.saved_title"),
        t("admin.citizen_grievance.complaints_form.saved_message"),
        "success"
      );
      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch {
      Swal.fire(
        t("common.error"),
        t("admin.citizen_grievance.complaints_form.save_failed"),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- RENDER ---------------- */

  return (
    <ComponentCard title={t("admin.citizen_grievance.complaints_form.title_add")}>
      <form onSubmit={save}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div>
            <Label>{t("admin.citizen_grievance.complaints_form.customer")} *</Label>
            <Select value={customer ? resolveCustomerId(customer) : undefined}
              onValueChange={onCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.citizen_grievance.complaints_form.customer_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {customers
                  .filter((c) => resolveCustomerId(c))
                  .map((c) => (
                    <SelectItem key={resolveCustomerId(c)} value={resolveCustomerId(c)}>
                      {c.customer_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.citizen_grievance.complaints_form.contact")}</Label>
            <Input value={contact} disabled />
          </div>

          <div className="md:col-span-2">
            <Label>{t("common.address")}</Label>
            <Input value={address} disabled />
          </div>

          <div>
            <Label>{t("admin.citizen_grievance.complaints_form.main_category")} *</Label>
            <Select value={mainCategoryId || undefined}
              onValueChange={setMainCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.citizen_grievance.complaints_form.main_category_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {mainCategories.map((m) => (
                  <SelectItem key={resolveValue(m)} value={resolveValue(m)}>
                    {m.main_categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.citizen_grievance.complaints_form.sub_category")} *</Label>
            <Select value={subCategoryId || undefined}
              onValueChange={setSubCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.citizen_grievance.complaints_form.sub_category_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((s) => (
                  <SelectItem key={resolveValue(s)} value={resolveValue(s)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>{t("admin.citizen_grievance.complaints_form.details")} *</Label>
            <Input value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>

          <div>
            <Label>{t("common.priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.citizen_grievance.complaints_form.priority_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">{t("common.priority_high")}</SelectItem>
                <SelectItem value="MEDIUM">{t("common.priority_medium")}</SelectItem>
                <SelectItem value="LOW">{t("common.priority_low")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.citizen_grievance.complaints_form.complaint_file")}</Label>
            <input type="file" hidden id="uploadBox" onChange={uploadFile} />
            <div
              className="border rounded p-4 cursor-pointer bg-gray-50"
              onClick={() => document.getElementById("uploadBox")?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} className="w-full h-24 object-contain" />
              ) : (
                <img src={FILE_ICON} className="w-12 h-12 mx-auto opacity-60" />
              )}
            </div>
            {previewUrl && (
              <button type="button" onClick={clearFile}
                className="text-sm text-red-500 mt-2">
                {t("common.remove")}
              </button>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-custom text-white px-4 py-2 rounded"
          >
            {t("common.save")}
          </button>
          <button type="button"
            onClick={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
            className="bg-red-400 text-white px-4 py-2 rounded">
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
