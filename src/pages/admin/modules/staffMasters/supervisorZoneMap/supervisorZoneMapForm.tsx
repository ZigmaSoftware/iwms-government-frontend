import type { RawCity, RawDistrict, RawZone, StaffRecord, SupervisorZoneMapPayload, ZoneMultiSelectProps } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
// import { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import Swal from "@/lib/notify";
// import { useTranslation } from "react-i18next";

// import ComponentCard from "@/components/common/ComponentCard";
// import Label from "@/components/form/Label";
// import Select, { type SelectOption } from "@/components/form/Select";

// // ✅ Added companyApi and projectApi — same as StaffTemplateForm
// import { staffCreationApi, companyApi, projectApi } from "@/helpers/admin";
// import {
//   useDistrictsList,
//   useCitiesList,
//   useZonesList,
//   useSupervisorZoneMapQuery,
//   useCreateSupervisorZoneMap,
//   useUpdateSupervisorZoneMap,
// } from "@/helpers/admin/localHooks";
// import { getEncryptedRoute } from "@/utils/routeCache";
// import { normalizeList } from "@/utils/forms";
// import { useFieldVisibility } from "@/hooks/useFieldVisibility";
// import { useFormCompanyProjectSync } from "@/hooks/useFormCompanyProjectSync";

// /* ─────────────────────────── types ──────────────────────────────────────── */

// type SupervisorZoneMapPayload = {
//   supervisor_id: string;
//   district_id: string;
//   city_id: string;
//   status: "ACTIVE" | "INACTIVE";
// };

// type RawZone = {
//   unique_id: string;
//   zone_name?: string;
//   district_id?: string | number | null;
//   district_unique_id?: string | number | null;
//   city_id?: string | number | null;
//   city_unique_id?: string | number | null;
// };

// type RawDistrict = {
//   unique_id: string;
//   name?: string;
//   company_id?: string | number | null;
//   company_unique_id?: string | number | null;
//   project_id?: string | number | null;
//   project_unique_id?: string | number | null;
// };

// type RawCity = {
//   unique_id: string;
//   name?: string;
//   district_id?: string | number | null;
//   district_unique_id?: string | number | null;
// };

// type StaffRecord = {
//   unique_id?: string;
//   company_id?: string;
//   project_id?: string;
//   staff_name?: string;
//   employee_name?: string;
//   username?: string;
//   user_type_name?: string;
//   staffusertype_name?: string;
//   designation?: string;
//   is_active?: boolean;
//   is_deleted?: boolean;
//   active_status?: boolean | number | string | null;
//   company_name?: string;
//   project_name?: string;
// };

// const SUPERVISOR_ZONE_MAP_FIELDS: Record<string, string[]> = {
//   company_id: ["company_id", "company"],
//   project_id: ["project_id", "project"],
//   supervisor_id: ["supervisor_id", "supervisor"],
//   district_id: ["district_id", "district"],
//   city_id: ["city_id", "city"],
//   zone_ids: ["zone_ids", "zones", "zone_id"],
//   status: ["status"],
//   remarks: ["remarks"],
// };

// /* ─────────────────────────── helpers ────────────────────────────────────── */

// const normalizeId = (v: unknown) =>
//   v !== undefined && v !== null ? String(v) : "";

// const normalizeRole = (v: unknown) => String(v ?? "").trim().toLowerCase();

// const normalizeActiveStatus = (v: StaffRecord["active_status"]): boolean => {
//   if (typeof v === "boolean") return v;
//   const s = String(v ?? "").trim().toLowerCase();
//   return s === "1" || s === "true" || s === "active";
// };

// const getStaffDisplayName = (s: StaffRecord) =>
//   String(s.employee_name ?? s.staff_name ?? s.username ?? s.unique_id ?? "").trim();

// const getStaffRole = (s: StaffRecord) =>
//   normalizeRole(s.staffusertype_name ?? s.designation);

// const isStaffRow = (s: StaffRecord) => {
//   const ut = normalizeRole(s.user_type_name);
//   return !ut || ut === "staff";
// };

// const isActiveStaff = (s: StaffRecord) => {
//   if (s.is_deleted === true) return false;
//   if (typeof s.is_active === "boolean") return s.is_active;
//   return normalizeActiveStatus(s.active_status);
// };

// const toSupervisorOption = (s: StaffRecord): SelectOption => ({
//   value: String(s.unique_id ?? ""),
//   label: getStaffDisplayName(s),
// });

// /* ═══════════════════════════════════════════════════════════════════════════
//    ZoneMultiSelect — inline checkbox dropdown, tags inside trigger
// ═══════════════════════════════════════════════════════════════════════════ */

// interface ZoneMultiSelectProps {
//   options: SelectOption[];
//   value: string[];
//   onChange: (next: string[]) => void;
//   placeholder?: string;
//   disabled?: boolean;
//   zoneLabels: Record<string, string>;
// }

// function ZoneMultiSelect({
//   options,
//   value,
//   onChange,
//   placeholder = "Select zones",
//   disabled = false,
//   zoneLabels,
// }: ZoneMultiSelectProps) {
//   const [open, setOpen] = useState(false);
//   const [search, setSearch] = useState("");
//   const containerRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
//         setOpen(false);
//         setSearch("");
//       }
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const toggle = (id: string) =>
//     onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

//   const removeTag = (e: React.MouseEvent, id: string) => {
//     e.stopPropagation();
//     onChange(value.filter((v) => v !== id));
//   };

//   const filtered = options.filter((o) =>
//     String(o.label ?? "").toLowerCase().includes(search.toLowerCase())
//   );

//   const allFilteredSelected =
//     filtered.length > 0 && filtered.every((o) => value.includes(String(o.value)));

//   const toggleAll = () => {
//     if (allFilteredSelected) {
//       const filteredIds = new Set(filtered.map((o) => String(o.value)));
//       onChange(value.filter((v) => !filteredIds.has(v)));
//     } else {
//       const toAdd = filtered.map((o) => String(o.value)).filter((id) => !value.includes(id));
//       onChange([...value, ...toAdd]);
//     }
//   };

//   return (
//     <div ref={containerRef} className="relative w-full">
//       {/* Trigger */}
//       <div
//         onClick={() => !disabled && setOpen((o) => !o)}
//         className={[
//           "min-h-[42px] w-full cursor-pointer rounded-md border bg-white px-3 py-1.5",
//           "flex flex-wrap items-center gap-1.5 transition-colors",
//           disabled
//             ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
//             : open
//               ? "border-blue-500 ring-1 ring-blue-300"
//               : "border-gray-300 hover:border-gray-400",
//         ].join(" ")}
//       >
//         {value.length === 0 ? (
//           <span className="text-sm text-gray-400">{placeholder}</span>
//         ) : (
//           value.map((id) => (
//             <span
//               key={id}
//               className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
//             >
//               {zoneLabels[id] ?? id}
//               <button
//                 type="button"
//                 onClick={(e) => removeTag(e, id)}
//                 className="ml-0.5 rounded-full text-blue-400 hover:text-blue-700 focus:outline-none"
//               >
//                 ×
//               </button>
//             </span>
//           ))
//         )}
//         <span className="ml-auto pl-2 text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
//       </div>

//       {/* Dropdown panel */}
//       {open && !disabled && (
//         <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
//           <div className="border-b border-gray-100 px-3 py-2">
//             <input
//               type="text"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               placeholder="Search zones..."
//               className="w-full rounded-sm border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
//               onClick={(e) => e.stopPropagation()}
//               autoFocus
//             />
//           </div>

//           {filtered.length > 1 && (
//             <label className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
//               <input
//                 type="checkbox"
//                 checked={allFilteredSelected}
//                 onChange={toggleAll}
//                 className="h-3.5 w-3.5 rounded accent-blue-600"
//               />
//               {allFilteredSelected ? "Deselect all" : "Select all"}
//             </label>
//           )}

//           <ul className="max-h-52 overflow-y-auto py-1">
//             {filtered.length === 0 ? (
//               <li className="px-3 py-3 text-center text-xs text-gray-400">No zones found</li>
//             ) : (
//               filtered.map((opt) => {
//                 const id = String(opt.value);
//                 const checked = value.includes(id);
//                 return (
//                   <li key={id}>
//                     <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50">
//                       <input
//                         type="checkbox"
//                         checked={checked}
//                         onChange={() => toggle(id)}
//                         className="h-3.5 w-3.5 rounded accent-blue-600"
//                       />
//                       <span className={checked ? "font-medium text-blue-700" : "text-gray-700"}>
//                         {opt.label}
//                       </span>
//                     </label>
//                   </li>
//                 );
//               })
//             )}
//           </ul>

//           <div className="border-t border-gray-100 px-3 py-1.5 text-right text-xs text-gray-400">
//             {value.length} selected
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ═══════════════════════════ main form ══════════════════════════════════════ */

// export default function SupervisorZoneMapForm() {
//   const { t } = useTranslation();
//   const navigate = useNavigate();
//   const { id } = useParams<{ id?: string }>();
//   const isEdit = Boolean(id);
//   const { showField, filterPayload } = useFieldVisibility(
//     "staff-masters",
//     "supervisor-zone-map",
//     SUPERVISOR_ZONE_MAP_FIELDS
//   );

//   const [fetching, setFetching] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [formError, setFormError] = useState<string | null>(null);
//   const [remarks, setRemarks] = useState("");

//   /* raw master lists */
//   const [allStaff, setAllStaff] = useState<StaffRecord[]>([]);
//   const [allDistricts, setAllDistricts] = useState<RawDistrict[]>([]);
//   const [allCities, setAllCities] = useState<RawCity[]>([]);
//   const [allZones, setAllZones] = useState<RawZone[]>([]);

//   // ✅ Now from real API — not derived from staff
//   const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
//   const [allProjects, setAllProjects] = useState<any[]>([]);
//   const [projectOptions, setProjectOptions] = useState<SelectOption[]>([]);

//   /* cascade selections */
//   const [selectedCompanyId, setSelectedCompanyId] = useState("");
//   const [selectedProjectId, setSelectedProjectId] = useState("");
//   const [zoneIds, setZoneIds] = useState<string[]>([]);

//   const {
//     handleCompanyChange: handleCompanyChangeSync,
//     handleProjectChange: handleProjectChangeSync,
//   } = useFormCompanyProjectSync({
//     selectedCompanyId,
//     setSelectedCompanyId,
//     selectedProjectId,
//     setSelectedProjectId,
//   });

//   const [form, setForm] = useState<SupervisorZoneMapPayload>({
//     supervisor_id: "",
//     district_id: "",
//     city_id: "",
//     status: "ACTIVE",
//   });

//   const { encStaffMasters, encSupervisorZoneMap } = getEncryptedRoute();
//   const ENC_LIST_PATH = `/${encStaffMasters}/${encSupervisorZoneMap}`;

//   const statusOptions: SelectOption[] = [
//     { value: "ACTIVE", label: t("common.active") },
//     { value: "INACTIVE", label: t("common.inactive") },
//   ];

//   /* ── error extractor ─────────────────────────────────────────────────────── */
//   const extractError = (error: any): string => {
//     const data = error?.response?.data;
//     if (!data) return error?.message ?? t("common.unexpected_error");
//     if (typeof data === "string") return data;
//     if (data?.detail) return String(data.detail);
//     if (typeof data === "object") {
//       const messages = Object.entries(data).flatMap(([key, value]) => {
//         if (Array.isArray(value)) return value.map((item) => `${key}: ${item}`);
//         if (value === null || value === undefined) return [];
//         if (typeof value === "string") return [`${key}: ${value}`];
//         return [`${key}: ${JSON.stringify(value)}`];
//       });
//       if (messages.length) return messages.join("\n");
//     }
//     return t("common.unexpected_error");
//   };

//   /* ── tanstack queries ────────────────────────────────────────────────────── */
//   const { data: districtRes } = useDistrictsList();
//   const { data: cityRes } = useCitiesList();
//   const { data: zoneRes } = useZonesList();
//   const recordQuery = useSupervisorZoneMapQuery(id);
//   const createMutation = useCreateSupervisorZoneMap();
//   const updateMutation = useUpdateSupervisorZoneMap();

//   /* ── 1. Load staff + companies + projects via Promise.all ────────────────── */
//   useEffect(() => {
//     Promise.all([
//       staffCreationApi.readAll({ params: { active_status: 1 } }),
//       companyApi.readAll(),
//       projectApi.readAll(),
//     ])
//       .then(([staffRes, companiesRes, projectsRes]) => {
//         /* ── Staff ── */
//         const staffData: StaffRecord[] = Array.isArray(staffRes)
//           ? staffRes
//           : Array.isArray(staffRes?.results)
//             ? staffRes.results
//             : Array.isArray(staffRes?.data?.results)
//               ? staffRes.data.results
//               : Array.isArray(staffRes?.data)
//                 ? staffRes.data
//                 : [];

//         setAllStaff(
//           staffData.filter((u) => isStaffRow(u) && isActiveStaff(u) && u.unique_id)
//         );

//         /* ── Companies — same normalisation as StaffTemplateForm ── */
//         const companiesData = Array.isArray(companiesRes)
//           ? companiesRes
//           : Array.isArray(companiesRes?.data)
//             ? companiesRes.data
//             : [];

//         const normalizedCompanies: SelectOption[] = companiesData
//           .filter((c: any) => c?.is_active !== false && c?.is_deleted !== true)
//           .map((c: any) => ({
//             value: String(c?.unique_id ?? c?.id ?? ""),
//             label: String(c?.name ?? ""),
//           }))
//           .filter((o: SelectOption) => o.value && o.label);

//         setCompanyOptions(normalizedCompanies);

//         /* ── Projects — same normalisation as StaffTemplateForm ── */
//         const projectsData = Array.isArray(projectsRes)
//           ? projectsRes
//           : Array.isArray(projectsRes?.data)
//             ? projectsRes.data
//             : [];

//         const normalizedProjects = projectsData
//           .filter((p: any) => p?.is_active !== false && p?.is_deleted !== true)
//           .map((p: any) => ({
//             value: String(p?.unique_id ?? p?.id ?? ""),
//             label: String(p?.name ?? ""),
//             company_id: String(p?.company_unique_id ?? p?.company_id ?? ""),
//           }))
//           .filter((o: any) => o.value && o.label);

//         setAllProjects(normalizedProjects);
//         setProjectOptions(normalizedProjects); // show all until company is picked
//       })
//       .catch(() => Swal.fire(t("common.error"), t("common.load_failed"), "error"));
//   }, [t]);

//   /* ── 2. Filter projects whenever company changes ─────────────────────────── */
//   useEffect(() => {
//     const filtered = selectedCompanyId
//       ? allProjects.filter(
//           (p) => !p.company_id || p.company_id === selectedCompanyId
//         )
//       : allProjects;

//     setProjectOptions(filtered);

//     // Reset project if it no longer belongs to the new company
//     if (!isEdit) {
//     setSelectedProjectId((prev) =>
//       prev && filtered.some((p) => p.value === prev) ? prev : ""
//     );
//   }
//   }, [selectedCompanyId, allProjects]);

//   /* ── 3. Store raw districts, cities, zones ───────────────────────────────── */
//   useEffect(() => {
//     setFetching(!districtRes || !cityRes || !zoneRes);
//     try {
//       setAllDistricts(normalizeList(districtRes));
//       setAllCities(normalizeList(cityRes));
//       setAllZones(normalizeList(zoneRes));
//     } finally {
//       setFetching(false);
//     }
//   }, [districtRes, cityRes, zoneRes]);

//   /* ── 4. Populate form when editing ──────────────────────────────────────── */
//   useEffect(() => {
//     if (!id || !recordQuery.data) return;
//     const res: any = recordQuery.data;
//     setSelectedCompanyId(normalizeId(res?.company_id ?? res?.company_unique_id));
//     setSelectedProjectId(normalizeId(res?.project_id ?? res?.project_unique_id));
//     setForm({
//       supervisor_id: normalizeId(
//         res?.supervisor_id ?? res?.supervisor_unique_id
//       ),

//       district_id: normalizeId(
//         res?.district_unique_id ?? res?.district_id
//       ),

//       city_id: normalizeId(
//         res?.city_unique_id ?? res?.city_id
//       ),

//       status: res?.status ?? "ACTIVE",
//     });
//     setZoneIds(
//       Array.isArray(res?.zone_ids)
//         ? res.zone_ids.map((z: any) => String(z)).filter(Boolean)
//         : []
//     );
//     setRemarks(res?.remarks ?? "");
//   }, [id, recordQuery.data]);

//   /* ════════════════════════════════════════════════════════════════════════════
//      Derived filtered option lists
//   ════════════════════════════════════════════════════════════════════════════ */

//   /* Supervisors scoped to company + project */
//   const supervisorOptions = useMemo<SelectOption[]>(
//     () =>
//       allStaff
//         .filter((s) => {
//           const cMatch =
//             !selectedCompanyId ||
//             !s.company_id ||
//             normalizeId(s.company_id) === selectedCompanyId;
//           const pMatch =
//             !selectedProjectId ||
//             !s.project_id ||
//             normalizeId(s.project_id) === selectedProjectId;
//           return cMatch && pMatch && getStaffRole(s) === "company supervisor";
//         })
//         .map(toSupervisorOption),
//     [allStaff, selectedCompanyId, selectedProjectId]
//   );

//   /* Districts scoped to company + project */
//   const districtOptions = useMemo<SelectOption[]>(() => {
//     const list = allDistricts.filter((d) => {
//       const dC = normalizeId(d.company_unique_id ?? d.company_id);
//       const dP = normalizeId(d.project_unique_id ?? d.project_id);
//       return (
//         (!selectedCompanyId || !dC || dC === selectedCompanyId) &&
//         (!selectedProjectId || !dP || dP === selectedProjectId)
//       );
//     });
//     return list.map((d) => ({ value: d.unique_id, label: d.name ?? d.unique_id }));
//   }, [allDistricts, selectedCompanyId, selectedProjectId]);

//   /* Cities scoped to district */
//   const cityOptions = useMemo<SelectOption[]>(() => {
//     const list = allCities.filter((c) => {
//       const cD = normalizeId(c.district_unique_id ?? c.district_id);
//       return !form.district_id || !cD || cD === form.district_id;
//     });
//     return list.map((c) => ({ value: c.unique_id, label: c.name ?? c.unique_id }));
//   }, [allCities, form.district_id]);

//   /* Zones scoped to district + city */
//   const zoneOptions = useMemo<SelectOption[]>(() => {
//     const list = allZones.filter((z) => {
//       const zD = normalizeId(z.district_unique_id ?? z.district_id);
//       const zC = normalizeId(z.city_unique_id ?? z.city_id);
//       return (
//         (!form.district_id || !zD || zD === form.district_id) &&
//         (!form.city_id || !zC || zC === form.city_id)
//       );
//     });
//     return list.map((z) => ({ value: z.unique_id, label: z.zone_name ?? z.unique_id }));
//   }, [allZones, form.district_id, form.city_id]);

//   /* Zone label lookup for chips */
//   const zoneLabels = useMemo(
//     () =>
//       allZones.reduce<Record<string, string>>((acc, z) => {
//         acc[String(z.unique_id)] = z.zone_name ?? z.unique_id;
//         return acc;
//       }, {}),
//     [allZones]
//   );

//   /* ── cascade resets ──────────────────────────────────────────────────────── */
//   const handleCompanyChange = (value: string) => {
//     handleCompanyChangeSync(value);
//     setForm((p) => ({ ...p, supervisor_id: "", district_id: "", city_id: "" }));
//     setZoneIds([]);
//   };

//   const handleProjectChange = (value: string) => {
//     handleProjectChangeSync(value);
//     setForm((p) => ({ ...p, supervisor_id: "", district_id: "", city_id: "" }));
//     setZoneIds([]);
//   };

//   const handleDistrictChange = (value: string) => {
//     setForm((p) => ({ ...p, district_id: value, city_id: "" }));
//     setZoneIds([]);
//   };

//   const handleCityChange = (value: string) => {
//     setForm((p) => ({ ...p, city_id: value }));
//     setZoneIds([]);
//   };

//   /* ── save ────────────────────────────────────────────────────────────────── */
//   const handleSave = async () => {
//     if (
//       (showField("company_id") && !selectedCompanyId) ||
//       (showField("project_id") && !selectedProjectId) ||
//       (showField("supervisor_id") && !form.supervisor_id) ||
//       (showField("district_id") && !form.district_id) ||
//       (showField("city_id") && !form.city_id) ||
//       (showField("zone_ids") && zoneIds.length === 0)
//     ) {
//       Swal.fire(t("common.error"), t("common.missing_fields"), "warning");
//       return;
//     }
//     setFormError(null);

//     const rawPayload = {
//       company_id: selectedCompanyId,
//       project_id: selectedProjectId,
//       supervisor_id: form.supervisor_id,
//       district_id: form.district_id,
//       city_id: form.city_id,
//       zone_ids: zoneIds,
//       status: form.status,
//       remarks: remarks.trim(),
//     };
//     const payload = filterPayload(rawPayload, ["company_id", "project_id"]);

//     setSubmitting(true);
//     try {
//       if (isEdit && id) {
//         await updateMutation.mutateAsync({ id, payload });
//       } else {
//         await createMutation.mutateAsync(payload);
//       }
//       Swal.fire(
//         t("common.success"),
//         isEdit ? t("common.updated_success") : t("common.added_success"),
//         "success"
//       );

//       const listQuery = new URLSearchParams();
//       if (selectedCompanyId) {
//         listQuery.set("company_unique_id", selectedCompanyId);
//       }
//       if (selectedProjectId) {
//         listQuery.set("project_id", selectedProjectId);
//       }

//       navigate(
//         `${ENC_LIST_PATH}${listQuery.toString() ? `?${listQuery.toString()}` : ""}`
//       );
//     } catch (error) {
//       const msg = extractError(error);
//       setFormError(msg);
//       Swal.fire(t("common.error"), msg, "error");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleCancel = () => {
//     const listQuery = new URLSearchParams();
//     if (selectedCompanyId) {
//       listQuery.set("company_unique_id", selectedCompanyId);
//     }
//     if (selectedProjectId) {
//       listQuery.set("project_id", selectedProjectId);
//     }

//     navigate(
//       `${ENC_LIST_PATH}${listQuery.toString() ? `?${listQuery.toString()}` : ""}`
//     );
//   };

//   /* ── render ──────────────────────────────────────────────────────────────── */
//   return (
//     <div className="p-3">
//       <ComponentCard
//         title={t("admin.supervisor_zone_map.title")}
//         desc={t("admin.supervisor_zone_map.subtitle")}
//       >
//         {formError && (
//           <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
//             <p className="font-semibold">{t("common.error")}</p>
//             <ul className="mt-2 list-disc space-y-1 pl-5">
//               {formError.split("\n").map((line) => (
//                 <li key={line}>{line}</li>
//               ))}
//             </ul>
//           </div>
//         )}

//         <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
//           {/* COMPANY */}
//           {showField("company_id") && (
//           <div>
//             <Label>
//               {t("admin.nav.company")}
//               <span className="ml-1 text-red-500">*</span>
//             </Label>
//             <Select
//               value={selectedCompanyId}
//               onChange={handleCompanyChange}
//               options={companyOptions}
//               placeholder={t("common.select_option")}
//               disabled={fetching}
//               required
//             />
//           </div>
//           )}

//           {/* PROJECT */}
//           {showField("project_id") && (
//           <div>
//             <Label>
//               {t("admin.nav.project")}
//               <span className="ml-1 text-red-500">*</span>
//             </Label>
//             <Select
//               value={selectedProjectId}
//               onChange={handleProjectChange}
//               options={projectOptions}
//               placeholder={
//                 !selectedCompanyId
//                   ? t("common.select_option") ?? "Select a company first"
//                   : t("common.select_option")
//               }
//               disabled={fetching || !selectedCompanyId}
//               required
//             />
//           </div>
//           )}

//           {/* SUPERVISOR — scoped to company + project */}
//           {showField("supervisor_id") && (
//           <div>
//             <Label>
//               {t("admin.supervisor_zone_map.supervisor")}
//               <span className="ml-1 text-red-500">*</span>
//             </Label>
//             <Select
//               value={form.supervisor_id}
//               onChange={(value) => setForm((p) => ({ ...p, supervisor_id: value }))}
//               options={supervisorOptions}
//               placeholder={
//                 !selectedProjectId
//                   ? t("common.select_option") ?? "Select a project first"
//                   : t("common.select_option")
//               }
//               disabled={fetching || !selectedProjectId}
//               required
//             />
//           </div>
//           )}

//           {/* DISTRICT — scoped to company + project */}
//           {showField("district_id") && (
//           <div>
//             <Label>
//               {t("admin.supervisor_zone_map.district")}
//               <span className="ml-1 text-red-500">*</span>
//             </Label>
//             <Select
//               value={form.district_id}
//               onChange={handleDistrictChange}
//               options={districtOptions}
//                 placeholder={
//                   !selectedProjectId
//                     ? t("common.select_option") ?? "Select a project first"
//                   : t("common.select_option")
//               }
//               disabled={fetching || !selectedProjectId}
//               required
//             />
//           </div>
//           )}

//           {/* CITY — scoped to district */}
//           {showField("city_id") && (
//           <div>
//             <Label>
//               {t("admin.supervisor_zone_map.city")}
//               <span className="ml-1 text-red-500">*</span>
//             </Label>
//             <Select
//               value={form.city_id}
//               onChange={handleCityChange}
//               options={cityOptions}
//               placeholder={
//                 !form.district_id
//                   ? t("common.select_option") ?? "Select a district first"
//                   : t("common.select_option")
//               }
//               disabled={fetching || !form.district_id}
//               required
//             />
//           </div>
//           )}

//           {/* STATUS */}
//           {showField("status") && (
//           <div>
//             <Label>{t("admin.supervisor_zone_map.status")}</Label>
//             <Select
//               value={form.status}
//               onChange={(value) =>
//                 setForm((p) => ({ ...p, status: value as SupervisorZoneMapPayload["status"] }))
//               }
//               options={statusOptions}
//               placeholder={t("common.select_status")}
//               disabled={fetching}
//               required
//             />
//           </div>
//           )}
//         </div>

//         {/* ZONES — full-width multi-select with inline checkboxes */}
//         {showField("zone_ids") && (
//         <div>
//           <Label>
//             {t("admin.supervisor_zone_map.zones")}
//             <span className="ml-1 text-red-500">*</span>
//           </Label>
//           <ZoneMultiSelect
//             options={zoneOptions}
//             value={zoneIds}
//             onChange={setZoneIds}
//             zoneLabels={zoneLabels}
//             placeholder={
//               !form.district_id
//                 ? "Select a district first"
//                 : !form.city_id
//                   ? "Select a city first"
//                   : "Select zones"
//             }
//             disabled={fetching || !form.district_id || !form.city_id}
//           />
//         </div>
//         )}

//         {/* REMARKS */}
//         {showField("remarks") && (
//         <div>
//           <Label>{t("admin.supervisor_zone_map.remarks")}</Label>
//           <textarea
//             value={remarks}
//             onChange={(e) => setRemarks(e.target.value)}
//             className="mt-2 w-full rounded-md border border-gray-300 p-2 text-sm"
//             rows={3}
//             placeholder={t("common.optional")}
//             disabled={fetching}
//           />
//         </div>
//         )}

//         {isEdit && (
//           <p className="text-xs text-gray-500">
//             {t("admin.supervisor_zone_map.update_hint")}
//           </p>
//         )}

//         {/* ACTIONS */}
//         <div className="flex justify-end gap-3">
//           <button
//             type="button"
//             disabled={submitting || fetching}
//             onClick={handleSave}
//             className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
//           >
//             {submitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
//           </button>
//           <button
//             type="button"
//             onClick={handleCancel}
//             className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
//           >
//             {t("common.cancel")}
//           </button>
//         </div>
//       </ComponentCard>
//     </div>
//   );
// }


import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select, { type SelectOption } from "@/components/form/Select";

import { staffCreationApi, companyApi, projectApi } from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useFormCompanyProjectSync } from "@/hooks/useFormCompanyProjectSync";

/* ─────────────────────────── types ──────────────────────────────────────── */


const SUPERVISOR_ZONE_MAP_FIELDS: Record<string, string[]> = {
  company_id: ["company_id", "company"],
  project_id: ["project_id", "project"],
  supervisor_id: ["supervisor_id", "supervisor"],
  district_id: ["district_id", "district"],
  city_id: ["city_id", "city"],
  zone_ids: ["zone_ids", "zones", "zone_id"],
  status: ["status"],
  remarks: ["remarks"],
};

/* ─────────────────────────── helpers ────────────────────────────────────── */

const normalizeId = (v: unknown) =>
  v !== undefined && v !== null ? String(v) : "";

const normalizeRole = (v: unknown) => String(v ?? "").trim().toLowerCase();

const normalizeActiveStatus = (v: StaffRecord["active_status"]): boolean => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "active";
};

const getStaffDisplayName = (s: StaffRecord) =>
  String(s.employee_name ?? s.staff_name ?? s.username ?? s.unique_id ?? "").trim();

const getStaffRole = (s: StaffRecord) =>
  normalizeRole(s.staffusertype_name ?? s.designation);

const isStaffRow = (s: StaffRecord) => {
  const ut = normalizeRole(s.user_type_name);
  return !ut || ut === "staff";
};

const isActiveStaff = (s: StaffRecord) => {
  if (s.is_deleted === true) return false;
  if (typeof s.is_active === "boolean") return s.is_active;
  return normalizeActiveStatus(s.active_status);
};

const toSupervisorOption = (s: StaffRecord): SelectOption => ({
  value: String(s.unique_id ?? ""),
  label: getStaffDisplayName(s),
});

/* ═══════════════════════════════════════════════════════════════════════════
   ZoneMultiSelect — inline checkbox dropdown, tags inside trigger
═══════════════════════════════════════════════════════════════════════════ */


function ZoneMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select zones",
  disabled = false,
  zoneLabels,
}: ZoneMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const removeTag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== id));
  };

  const filtered = options.filter((o) =>
    String(o.label ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => value.includes(String(o.value)));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((o) => String(o.value)));
      onChange(value.filter((v) => !filteredIds.has(v)));
    } else {
      const toAdd = filtered.map((o) => String(o.value)).filter((id) => !value.includes(id));
      onChange([...value, ...toAdd]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <div
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "min-h-[42px] w-full cursor-pointer rounded-md border bg-white px-3 py-1.5",
          "flex flex-wrap items-center gap-1.5 transition-colors",
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : open
              ? "border-blue-500 ring-1 ring-blue-300"
              : "border-gray-300 hover:border-gray-400",
        ].join(" ")}
      >
        {value.length === 0 ? (
          <span className="text-sm text-gray-400">{placeholder}</span>
        ) : (
          value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {zoneLabels[id] ?? id}
              <button
                type="button"
                onClick={(e) => removeTag(e, id)}
                className="ml-0.5 rounded-full text-blue-400 hover:text-blue-700 focus:outline-none"
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="ml-auto pl-2 text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </div>

      {/* Dropdown panel */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search zones..."
              className="w-full rounded-sm border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {filtered.length > 1 && (
            <label className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </label>
          )}

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-gray-400">No zones found</li>
            ) : (
              filtered.map((opt) => {
                const id = String(opt.value);
                const checked = value.includes(id);
                return (
                  <li key={id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="h-3.5 w-3.5 rounded accent-blue-600"
                      />
                      <span className={checked ? "font-medium text-blue-700" : "text-gray-700"}>
                        {opt.label}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-gray-100 px-3 py-1.5 text-right text-xs text-gray-400">
            {value.length} selected
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ main form ══════════════════════════════════════ */

export default function SupervisorZoneMapForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "staff-masters",
    "supervisor-zone-map",
    SUPERVISOR_ZONE_MAP_FIELDS
  );

  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  /* raw master lists */
  const [allStaff, setAllStaff] = useState<StaffRecord[]>([]);
  const [allDistricts, setAllDistricts] = useState<RawDistrict[]>([]);
  const [allCities, setAllCities] = useState<RawCity[]>([]);
  const [allZones, setAllZones] = useState<RawZone[]>([]);

  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [projectOptions, setProjectOptions] = useState<SelectOption[]>([]);

  /* cascade selections */
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);

  const {
    handleCompanyChange: handleCompanyChangeSync,
    handleProjectChange: handleProjectChangeSync,
  } = useFormCompanyProjectSync({
    selectedCompanyId,
    setSelectedCompanyId,
    selectedProjectId,
    setSelectedProjectId,
  });

  const [form, setForm] = useState<SupervisorZoneMapPayload>({
    supervisor_id: "",
    district_id: "",
    city_id: "",
    status: "ACTIVE",
  });

  const { encStaffMasters, encSupervisorZoneMap } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encStaffMasters, encSupervisorZoneMap);

  const statusOptions: SelectOption[] = [
    { value: "ACTIVE", label: t("common.active") },
    { value: "INACTIVE", label: t("common.inactive") },
  ];

  /* ── error extractor ─────────────────────────────────────────────────────── */
  const extractError = (error: any): string => {
    const data = error?.response?.data;
    if (!data) return error?.message ?? t("common.unexpected_error");
    if (typeof data === "string") return data;
    if (data?.detail) return String(data.detail);
    if (typeof data === "object") {
      const messages = Object.entries(data).flatMap(([key, value]) => {
        if (Array.isArray(value)) return value.map((item) => `${key}: ${item}`);
        if (value === null || value === undefined) return [];
        if (typeof value === "string") return [`${key}: ${value}`];
        return [`${key}: ${JSON.stringify(value)}`];
      });
      if (messages.length) return messages.join("\n");
    }
    return t("common.unexpected_error");
  };

  /* ── reference data state ───────────────────────────────────────────────── */
  const [districtRes, setDistrictRes] = useState<any>(null);
  const [cityRes, setCityRes] = useState<any>(null);
  const [zoneRes, setZoneRes] = useState<any>(null);

  /* ── 1. Load staff + companies + projects ────────────────────────────────── */
  useEffect(() => {
    // ✅ Cast each call to Promise<any> to avoid TypeScript "never" inference
    (Promise.all([
      staffCreationApi.readAll({ params: { active_status: 1 } }) as Promise<any>,
      companyApi.readAll() as Promise<any>,
      projectApi.readAll() as Promise<any>,
    ]) as Promise<[any, any, any]>)
      .then(([staffRes, companiesRes, projectsRes]: [any, any, any]) => {
        /* ── Staff ── */
        const staffData: StaffRecord[] = Array.isArray(staffRes)
          ? staffRes
          : Array.isArray(staffRes?.results)
            ? staffRes.results
            : Array.isArray(staffRes?.data?.results)
              ? staffRes.data.results
              : Array.isArray(staffRes?.data)
                ? staffRes.data
                : [];

        setAllStaff(
          staffData.filter((u) => isStaffRow(u) && isActiveStaff(u) && u.unique_id)
        );

        /* ── Companies ── */
        const companiesData = Array.isArray(companiesRes)
          ? companiesRes
          : Array.isArray(companiesRes?.data)
            ? companiesRes.data
            : [];

        const normalizedCompanies: SelectOption[] = companiesData
          .filter((c: any) => c?.is_active !== false && c?.is_deleted !== true)
          .map((c: any) => ({
            value: String(c?.unique_id ?? c?.id ?? ""),
            label: String(c?.name ?? ""),
          }))
          .filter((o: SelectOption) => o.value && o.label);

        setCompanyOptions(normalizedCompanies);

        /* ── Projects ── */
        const projectsData = Array.isArray(projectsRes)
          ? projectsRes
          : Array.isArray(projectsRes?.data)
            ? projectsRes.data
            : [];

        const normalizedProjects = projectsData
          .filter((p: any) => p?.is_active !== false && p?.is_deleted !== true)
          .map((p: any) => ({
            value: String(p?.unique_id ?? p?.id ?? ""),
            label: String(p?.name ?? ""),
            company_id: String(p?.company_unique_id ?? p?.company_id ?? ""),
          }))
          .filter((o: any) => o.value && o.label);

        setAllProjects(normalizedProjects);
        setProjectOptions(normalizedProjects);
      })
      .catch(() => Swal.fire(t("common.error"), t("common.load_failed"), "error"));
  }, [t]);

  /* ── 2. Filter projects whenever company changes ─────────────────────────── */
  useEffect(() => {
    const filtered = selectedCompanyId
      ? allProjects.filter(
          (p) => !p.company_id || p.company_id === selectedCompanyId
        )
      : allProjects;

    setProjectOptions(filtered);

    if (!isEdit) {
      setSelectedProjectId((prev) =>
        prev && filtered.some((p) => p.value === prev) ? prev : ""
      );
    }
  }, [selectedCompanyId, allProjects]);

  /* ── 3. Load raw districts, cities, zones ───────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setFetching(true);

    Promise.all([
      adminApi.districts.readAll() as Promise<any>,
      adminApi.cities.readAll() as Promise<any>,
      adminApi.zones.readAll() as Promise<any>,
    ])
      .then(([dRes, cRes, zRes]: [any, any, any]) => {
        if (cancelled) return;
        setDistrictRes(dRes);
        setCityRes(cRes);
        setZoneRes(zRes);
        setAllDistricts(normalizeList(dRes));
        setAllCities(normalizeList(cRes));
        setAllZones(normalizeList(zRes));
        setFetching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetching(false);
      });

    return () => { cancelled = true; };
  }, []);

  /* ── 4. Populate form when editing ──────────────────────────────────────── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;

    adminApi.supervisorZoneMap.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setSelectedCompanyId(normalizeId(res?.company_id ?? res?.company_unique_id));
        setSelectedProjectId(normalizeId(res?.project_id ?? res?.project_unique_id));
        setForm({
          supervisor_id: normalizeId(res?.supervisor_id ?? res?.supervisor_unique_id),
          district_id: normalizeId(res?.district_unique_id ?? res?.district_id),
          city_id: normalizeId(res?.city_unique_id ?? res?.city_id),
          status: res?.status ?? "ACTIVE",
        });
        setZoneIds(
          Array.isArray(res?.zone_ids)
            ? res.zone_ids.map((z: any) => String(z)).filter(Boolean)
            : []
        );
        setRemarks(res?.remarks ?? "");
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), String(err?.response?.data ?? err?.message ?? t("common.load_failed")), "error");
      });

    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  /* ════════════════════════════════════════════════════════════════════════════
     Derived filtered option lists
  ════════════════════════════════════════════════════════════════════════════ */

  /* Supervisors scoped to company + project */
  const supervisorOptions = useMemo<SelectOption[]>(
    () =>
      allStaff
        .filter((s) => {
          const cMatch =
            !selectedCompanyId ||
            !s.company_id ||
            normalizeId(s.company_id) === selectedCompanyId;
          const pMatch =
            !selectedProjectId ||
            !s.project_id ||
            normalizeId(s.project_id) === selectedProjectId;
          return cMatch && pMatch && getStaffRole(s) === "company supervisor";
        })
        .map(toSupervisorOption),
    [allStaff, selectedCompanyId, selectedProjectId]
  );

  /* Districts scoped to company + project */
  const districtOptions = useMemo<SelectOption[]>(() => {
    const list = allDistricts.filter((d) => {
      const dC = normalizeId(d.company_unique_id ?? d.company_id);
      const dP = normalizeId(d.project_unique_id ?? d.project_id);
      return (
        (!selectedCompanyId || !dC || dC === selectedCompanyId) &&
        (!selectedProjectId || !dP || dP === selectedProjectId)
      );
    });
    return list.map((d) => ({ value: d.unique_id, label: d.name ?? d.unique_id }));
  }, [allDistricts, selectedCompanyId, selectedProjectId]);

  /* Cities scoped to district */
  const cityOptions = useMemo<SelectOption[]>(() => {
    const list = allCities.filter((c) => {
      const cD = normalizeId(c.district_unique_id ?? c.district_id);
      return !form.district_id || !cD || cD === form.district_id;
    });
    return list.map((c) => ({ value: c.unique_id, label: c.name ?? c.unique_id }));
  }, [allCities, form.district_id]);

  /* Zones scoped to district + city */
  const zoneOptions = useMemo<SelectOption[]>(() => {
    const list = allZones.filter((z) => {
      const zD = normalizeId(z.district_unique_id ?? z.district_id);
      const zC = normalizeId(z.city_unique_id ?? z.city_id);
      return (
        (!form.district_id || !zD || zD === form.district_id) &&
        (!form.city_id || !zC || zC === form.city_id)
      );
    });
    return list.map((z) => ({ value: z.unique_id, label: z.zone_name ?? z.unique_id }));
  }, [allZones, form.district_id, form.city_id]);

  /* Zone label lookup for chips */
  const zoneLabels = useMemo(
    () =>
      allZones.reduce<Record<string, string>>((acc, z) => {
        acc[String(z.unique_id)] = z.zone_name ?? z.unique_id;
        return acc;
      }, {}),
    [allZones]
  );

  /* ── cascade resets ──────────────────────────────────────────────────────── */
  const handleCompanyChange = (value: string) => {
    handleCompanyChangeSync(value);
    setForm((p) => ({ ...p, supervisor_id: "", district_id: "", city_id: "" }));
    setZoneIds([]);
  };

  const handleProjectChange = (value: string) => {
    handleProjectChangeSync(value);
    setForm((p) => ({ ...p, supervisor_id: "", district_id: "", city_id: "" }));
    setZoneIds([]);
  };

  const handleDistrictChange = (value: string) => {
    setForm((p) => ({ ...p, district_id: value, city_id: "" }));
    setZoneIds([]);
  };

  const handleCityChange = (value: string) => {
    setForm((p) => ({ ...p, city_id: value }));
    setZoneIds([]);
  };

  /* ── save ────────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (
      (showField("company_id") && !selectedCompanyId) ||
      (showField("project_id") && !selectedProjectId) ||
      (showField("supervisor_id") && !form.supervisor_id) ||
      (showField("district_id") && !form.district_id) ||
      (showField("city_id") && !form.city_id) ||
      (showField("zone_ids") && zoneIds.length === 0)
    ) {
      Swal.fire(t("common.error"), t("common.missing_fields"), "warning");
      return;
    }
    setFormError(null);

    const rawPayload = {
      company_id: selectedCompanyId,
      project_id: selectedProjectId,
      supervisor_id: form.supervisor_id,
      district_id: form.district_id,
      city_id: form.city_id,
      zone_ids: zoneIds,
      status: form.status,
      remarks: remarks.trim(),
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]);

    setSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.supervisorZoneMap.update(id, payload);
      } else {
        await adminApi.supervisorZoneMap.create(payload);
      }
      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success"
      );

      const listQuery = new URLSearchParams();
      if (selectedCompanyId) listQuery.set("company_unique_id", selectedCompanyId);
      if (selectedProjectId) listQuery.set("project_id", selectedProjectId);

      navigate(
        `${ENC_LIST_PATH}${listQuery.toString() ? `?${listQuery.toString()}` : ""}`
      );
    } catch (error) {
      const msg = extractError(error);
      setFormError(msg);
      Swal.fire(t("common.error"), msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    const listQuery = new URLSearchParams();
    if (selectedCompanyId) listQuery.set("company_unique_id", selectedCompanyId);
    if (selectedProjectId) listQuery.set("project_id", selectedProjectId);

    navigate(
      `${ENC_LIST_PATH}${listQuery.toString() ? `?${listQuery.toString()}` : ""}`
    );
  };

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="p-3">
      <ComponentCard
        title={t("admin.supervisor_zone_map.title")}
        desc={t("admin.supervisor_zone_map.subtitle")}
      >
        {formError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">{t("common.error")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {formError.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* COMPANY */}
          {showField("company_id") && (
            <div>
              <Label>
                {t("admin.nav.company")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Select
                value={selectedCompanyId}
                onChange={handleCompanyChange}
                options={companyOptions}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>
          )}

          {/* PROJECT */}
          {showField("project_id") && (
            <div>
              <Label>
                {t("admin.nav.project")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Select
                value={selectedProjectId}
                onChange={handleProjectChange}
                options={projectOptions}
                placeholder={
                  !selectedCompanyId
                    ? t("common.select_option") ?? "Select a company first"
                    : t("common.select_option")
                }
                disabled={fetching || !selectedCompanyId}
                required
              />
            </div>
          )}

          {/* SUPERVISOR — scoped to company + project */}
          {showField("supervisor_id") && (
            <div>
              <Label>
                {t("admin.supervisor_zone_map.supervisor")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Select
                value={form.supervisor_id}
                onChange={(value) =>
                  setForm((p) => ({ ...p, supervisor_id: value }))
                }
                options={supervisorOptions}
                placeholder={
                  !selectedProjectId
                    ? t("common.select_option") ?? "Select a project first"
                    : t("common.select_option")
                }
                disabled={fetching || !selectedProjectId}
                required
              />
            </div>
          )}

          {/* DISTRICT — scoped to company + project */}
          {showField("district_id") && (
            <div>
              <Label>
                {t("admin.supervisor_zone_map.district")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Select
                value={form.district_id}
                onChange={handleDistrictChange}
                options={districtOptions}
                placeholder={
                  !selectedProjectId
                    ? t("common.select_option") ?? "Select a project first"
                    : t("common.select_option")
                }
                disabled={fetching || !selectedProjectId}
                required
              />
            </div>
          )}

          {/* CITY — scoped to district */}
          {showField("city_id") && (
            <div>
              <Label>
                {t("admin.supervisor_zone_map.city")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Select
                value={form.city_id}
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={
                  !form.district_id
                    ? t("common.select_option") ?? "Select a district first"
                    : t("common.select_option")
                }
                disabled={fetching || !form.district_id}
                required
              />
            </div>
          )}

          {/* STATUS */}
          {showField("status") && (
            <div>
              <Label>{t("admin.supervisor_zone_map.status")}</Label>
              <Select
                value={form.status}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    status: value as SupervisorZoneMapPayload["status"],
                  }))
                }
                options={statusOptions}
                placeholder={t("common.select_status")}
                disabled={fetching}
                required
              />
            </div>
          )}
        </div>

        {/* ZONES — full-width multi-select with inline checkboxes */}
        {showField("zone_ids") && (
          <div>
            <Label>
              {t("admin.supervisor_zone_map.zones")}
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <ZoneMultiSelect
              options={zoneOptions}
              value={zoneIds}
              onChange={setZoneIds}
              zoneLabels={zoneLabels}
              placeholder={
                !form.district_id
                  ? "Select a district first"
                  : !form.city_id
                    ? "Select a city first"
                    : "Select zones"
              }
              disabled={fetching || !form.district_id || !form.city_id}
            />
          </div>
        )}

        {/* REMARKS */}
        {showField("remarks") && (
          <div>
            <Label>{t("admin.supervisor_zone_map.remarks")}</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              placeholder={t("common.optional")}
              disabled={fetching}
            />
          </div>
        )}

        {isEdit && (
          <p className="text-xs text-gray-500">
            {t("admin.supervisor_zone_map.update_hint")}
          </p>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={submitting || fetching}
            onClick={handleSave}
            className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
          >
            {t("common.cancel")}
          </button>
        </div>
      </ComponentCard>
    </div>
  );
}