import type { AreaTypeCityMeta, AreaTypePayload, CityRecordWithRelations } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ComponentCard from "@/components/common/ComponentCard";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { SelectOption } from "@/types";
import type { AreaTypeRecord, DistrictMeta, StateMeta } from "./types";
import { adminApi } from "@/helpers/admin/registry";


const { encMasters, encAreaTypes } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encAreaTypes);

const AREA_TYPE_FIELDS: Record<string, string[]> = {
  state_id: ["state_id", "state"],
  district_id: ["district_id", "district"],
  city_id: ["city_id", "city"],
  name: ["name", "area_type_name"],
  is_active: ["is_active"],
};

const normalizeNullable = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") {
    const record = v as { unique_id?: unknown; id?: unknown };
    return normalizeNullable(record.unique_id ?? record.id);
  }
  return String(v);
};


export default function AreaTypeForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "area-types", AREA_TYPE_FIELDS);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");

  const [pendingState, setPendingState] = useState("");
  const [pendingDistrict, setPendingDistrict] = useState("");
  const [pendingCity, setPendingCity] = useState("");

  const [allStates, setAllStates] = useState<StateMeta[]>([]);
  const [filteredStates, setFilteredStates] = useState<SelectOption[]>([]);

  const [allDistricts, setAllDistricts] = useState<DistrictMeta[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<SelectOption[]>([]);

  const [allCities, setAllCities] = useState<AreaTypeCityMeta[]>([]);
  const [filteredCities, setFilteredCities] = useState<SelectOption[]>([]);

  const [recordData, setRecordData] = useState<AreaTypeRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    loggedInCompanyUniqueId,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({ isEdit, initialCompanyId: routeState?.companyUniqueId, initialProjectId: routeState?.projectId });

  const extractErr = (e: unknown): string => {
    const data = (e as { response?: { data?: unknown } })?.response?.data;

    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.join(", ");
    if (data && typeof data === "object") {
      return Object.entries(data as Record<string, unknown>)
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
        )
        .join("\n");
    }

    if (e instanceof Error && e.message) return e.message;
    return t("common.unexpected_error");
  };

  // Fetch states list
  useEffect(() => {
    let cancelled = false;
    adminApi.states.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: any[] = Array.isArray(res) ? res : [];
        setAllStates(
          data.map((s) => ({
            id: String(s.unique_id),
            name: s.name,
            isActive: Boolean(s.is_active),
          }))
        );
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [t]);

  // Fetch districts list
  useEffect(() => {
    let cancelled = false;
    adminApi.districts.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: any[] = Array.isArray(res) ? res : [];
        setAllDistricts(
          data.map((d) => ({
            id: String(d.unique_id),
            name: d.name,
            stateId: normalizeNullable(d.state_id),
            isActive: Boolean(d.is_active),
          }))
        );
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [t]);

  // Fetch cities list
  useEffect(() => {
    let cancelled = false;
    adminApi.cities.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: CityRecordWithRelations[] = Array.isArray(res) ? res : [];
        setAllCities(
          data.map((c) => ({
            id: String(c.unique_id),
            name: c.name,
            stateId: normalizeNullable(c.state_id ?? c.state_unique_id ?? c.state),
            districtId: normalizeNullable(c.district_id ?? c.district_unique_id ?? c.district),
            isActive: Boolean(c.is_active),
          }))
        );
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [t]);

  // Fetch area type record in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.areatypes.read(id)
      .then((res: any) => {
        if (cancelled) return;
        const record = res as AreaTypeRecord;
        setRecordData(record);
        setLoadingRecord(false);

        setName(record.name ?? record.area_type_name ?? "");
        setIsActive(Boolean(record.is_active));

        let ste = normalizeNullable(record.state_id);
        let dis = normalizeNullable(record.district_id);
        const cty = normalizeNullable(record.city_id);
        const selectedCity = cty ? allCities.find((city) => city.id === cty) : undefined;

        dis = dis || selectedCity?.districtId || null;
        ste = ste || selectedCity?.stateId || (dis ? allDistricts.find((district) => district.id === dis)?.stateId ?? null : null);

        if (ste) {
          setStateId(ste);
          setPendingState(ste);
        }
        if (dis) {
          setDistrictId(dis);
          setPendingDistrict(dis);
        }
        if (cty) {
          setCityId(cty);
          setPendingCity(cty);
        }

        applyCompanyProjectFromRecord(
          record as unknown as Record<string, unknown>
        );
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErr(err),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, allCities, allDistricts, applyCompanyProjectFromRecord]);

  useEffect(() => {
    const filt = allStates
      .filter((s) => s.isActive)
      .map((s) => ({ value: s.id, label: s.name }));

    if (pendingState && !filt.some((o) => o.value === pendingState)) {
      const found = allStates.find((s) => s.id === pendingState);
      if (found) filt.push({ value: found.id, label: found.name });
    }

    setFilteredStates(filt);
  }, [allStates, pendingState]);

  useEffect(() => {
    if (!stateId) {
      setFilteredDistricts([]);
      return;
    }

    const filt = allDistricts
      .filter((d) => d.isActive && d.stateId === stateId)
      .map((d) => ({ value: d.id, label: d.name }));

    if (pendingDistrict && !filt.some((o) => o.value === pendingDistrict)) {
      const found = allDistricts.find((d) => d.id === pendingDistrict);
      if (found) filt.push({ value: found.id, label: found.name });
    }

    setFilteredDistricts(filt);
  }, [stateId, allDistricts, pendingDistrict]);

  useEffect(() => {
    if (!districtId) {
      setFilteredCities([]);
      return;
    }

    const filt = allCities
      .filter((c) => c.isActive && c.districtId === districtId)
      .map((c) => ({ value: c.id, label: c.name }));

    if (pendingCity && !filt.some((o) => o.value === pendingCity)) {
      const found = allCities.find((c) => c.id === pendingCity);
      if (found) filt.push({ value: found.id, label: found.name });
    }

    setFilteredCities(filt);
  }, [districtId, allCities, pendingCity]);

  useEffect(() => {
    if (
      pendingState &&
      filteredStates.length > 0 &&
      filteredStates.some((o) => o.value === pendingState)
    ) {
      setStateId(pendingState);
      setPendingState("");
    }
  }, [pendingState, filteredStates]);

  useEffect(() => {
    if (
      pendingDistrict &&
      filteredDistricts.length > 0 &&
      filteredDistricts.some((o) => o.value === pendingDistrict)
    ) {
      setDistrictId(pendingDistrict);
      setPendingDistrict("");
    }
  }, [pendingDistrict, filteredDistricts]);

  useEffect(() => {
    if (
      pendingCity &&
      filteredCities.length > 0 &&
      filteredCities.some((o) => o.value === pendingCity)
    ) {
      setCityId(pendingCity);
      setPendingCity("");
    }
  }, [pendingCity, filteredCities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldValues: Record<string, unknown> = {
      name: name.trim(),
      state_id: stateId,
      district_id: districtId,
      city_id: cityId,
    };

    if (getMissingRequiredFields(["name"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
      });
      return;
    }

    if (
      getMissingRequiredFields(
        ["state_id", "district_id", "city_id"],
        (fieldKey) => fieldValues[fieldKey],
      ).length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: "State, District, and City are required",
      });
      return;
    }

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

    if (!projectId) {
      Swal.fire("Error", "Project is required", "error");
      return;
    }

    try {
      setLoading(true);
      setIsSubmitting(true);

      const rawPayload = {
        name: name.trim(),
        is_active: isActive,
        company_id: companyUniqueId,
        project_id: projectId,
        state_id: stateId,
        district_id: districtId,
        city_id: cityId,
      };
      const basePayload = filterPayload(rawPayload, [
        "company_id",
        "project_id",
      ]) as AreaTypePayload;

      if (isEdit) {
        await adminApi.areatypes.update(id as string, basePayload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.areatypes.create(basePayload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error: unknown) {
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: extractErr(error) || t("common.save_failed_desc"),
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !recordData) {
    return (
      <ComponentCard
        title={t("common.edit_item", { item: t("admin.nav.area_type") })}
      >
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.area_type") })
          : t("common.add_item", { item: t("admin.nav.area_type") })
      }
    >
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
        <div>
          <Label>Company *</Label>
          <Select
            value={companyUniqueId}
            onValueChange={onCompanyChange}
            disabled={
              Boolean(loggedInCompanyUniqueId) ||
              (!isSuperAdmin && !loggedInCompanyUniqueId) ||
              companies.length === 0
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loggedInCompanyUniqueId
                    ? "Company from logged-in profile"
                    : isSuperAdmin
                      ? "Select Company"
                      : "Only super admin can select company"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loggedInCompanyUniqueId && !isSuperAdmin && (
            <p className="mt-1 text-xs text-red-500">
              Company is not mapped to this login. Only super admin can view
              all companies.
            </p>
          )}
          {isSuperAdmin && !loggedInCompanyUniqueId && companies.length === 0 && (
            <p className="mt-1 text-xs text-red-500">No companies found.</p>
          )}
        </div>

        <div>
          <Label>Project *</Label>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            disabled={!companyUniqueId || projects.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.value} value={project.value}>
                  {project.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {companyUniqueId && projects.length === 0 && (
            <p className="mt-1 text-xs text-red-500">
              No projects found for this company.
            </p>
          )}
        </div>

        {showField("state_id") && (
          <div>
            <Label htmlFor="state">
              State <span className="text-red-500">*</span>
            </Label>
            <Select value={stateId} onValueChange={setStateId}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {filteredStates.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("district_id") && (
          <div>
            <Label htmlFor="district">
              District <span className="text-red-500">*</span>
            </Label>
            <Select
              value={districtId}
              onValueChange={setDistrictId}
              disabled={!stateId || filteredDistricts.length === 0}
            >
              <SelectTrigger id="district">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((district) => (
                  <SelectItem key={district.value} value={district.value}>
                    {district.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stateId && filteredDistricts.length === 0 && (
              <p className="mt-1 text-xs text-red-500">
                No districts found for this state.
              </p>
            )}
          </div>
        )}

        {showField("city_id") && (
          <div>
            <Label htmlFor="city">
              City <span className="text-red-500">*</span>
            </Label>
            <Select
              value={cityId}
              onValueChange={setCityId}
              disabled={!districtId || filteredCities.length === 0}
            >
              <SelectTrigger id="city">
                <SelectValue placeholder="Select City" />
              </SelectTrigger>
              <SelectContent>
                {filteredCities.map((city) => (
                  <SelectItem key={city.value} value={city.value}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {districtId && filteredCities.length === 0 && (
              <p className="mt-1 text-xs text-red-500">
                No cities found for this district.
              </p>
            )}
          </div>
        )}

        {showField("name") && (
          <div>
            <Label htmlFor="name">
              {t("common.item_name", { item: t("admin.nav.area_type") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.area_type"),
              })}
              required
            />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(value) => setIsActive(value === "true")}
            >
              <SelectTrigger id="isActive">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={loading || isSubmitting}>
            {loading
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
