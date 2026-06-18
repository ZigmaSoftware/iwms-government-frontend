/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi, type AdminEntity } from "./registry";
import {
  complaintApi,
  customerCreationApi,
  mainCategoryApi,
  roleTypesApi,
  subCategoryApi,
  userScreenPermissionApi,
} from ".";

export type AdminRecord = {
  unique_id: string | number;
  id?: string | number;
  is_active: boolean;
  [key: string]: any;
};

export type ContinentRecord = AdminRecord;
export type CountryRecord = AdminRecord;
export type StateRecord = AdminRecord;
export type DistrictRecord = AdminRecord;
export type CityRecord = AdminRecord;
export type ZoneRecord = AdminRecord;
export type WardRecord = AdminRecord;
export type PanchayatRecord = AdminRecord;
export type PropertyRecord = AdminRecord & { property_name: string };
export type SubPropertyRecord = AdminRecord;
export type AreaTypeRecord = AdminRecord;
export type HierarchyRecord = AdminRecord;
export type BinRecord = AdminRecord;
export type CollectionPointRecord = AdminRecord;
export type WasteTypeRecord = AdminRecord;
export type VehicleTypeRecord = AdminRecord;
export type VehicleCreationRecord = AdminRecord;
export type TripPlanRecord = AdminRecord;
export type FuelRecord = AdminRecord;
export type CustomerCreationRecord = AdminRecord;
export type FeedbackRecord = AdminRecord;
export type CommonAuditRecord = AdminRecord;
export type MainCategoryRecord = AdminRecord;
export type SubCategoryRecord = AdminRecord;

export type CommonAuditJsonValue =
  | string
  | number
  | boolean
  | null
  | CommonAuditJsonValue[]
  | { [key: string]: CommonAuditJsonValue };

export type ContinentPayload = { name: string; is_active: boolean; [key: string]: any };
export type CountryPayload = Record<string, any>;
export type StatePayload = Record<string, any>;
export type DistrictPayload = Record<string, any>;
export type CityPayload = Record<string, any>;
export type ZonePayload = Record<string, any>;
export type WardPayload = Record<string, any>;
export type PanchayatPayload = Record<string, any>;
export type PropertyPayload = Record<string, any>;
export type SubPropertyPayload = Record<string, any>;
export type AreaTypePayload = Record<string, any>;
export type HierarchyPayload = Record<string, any>;
export type BinPayload = Record<string, any>;
export type CollectionPointPayload = Record<string, any>;
export type WasteTypePayload = Record<string, any>;
export type VehicleTypePayload = Record<string, any>;
export type VehicleCreationPayload = Record<string, any>;
export type TripPlanPayload = Record<string, any>;
export type FuelPayload = Record<string, any>;
export type CustomerCreationPayload = Record<string, any>;
export type FeedbackPayload = Record<string, any>;

type QueryResult<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<T | undefined>;
};

type MutationResult<TVariables, TResult> = {
  mutateAsync: (variables: TVariables) => Promise<TResult>;
  isPending: boolean;
  isLoading: boolean;
  error: unknown;
};

const compactFilters = (filters?: Record<string, unknown> | null) =>
  Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

const toList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
};

const keyVersions = new Map<string, number>();
const listeners = new Set<() => void>();

const bumpKey = (key: string) => {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
  listeners.forEach((listener) => listener());
};

const useKeyVersion = (key: string) => {
  const [version, setVersion] = useState(() => keyVersions.get(key) ?? 0);

  useEffect(() => {
    const listener = () => setVersion(keyVersions.get(key) ?? 0);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);

  return version;
};

function useDirectQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  enabled = true
): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [isPending, setIsPending] = useState(Boolean(enabled));
  const [isFetching, setIsFetching] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setIsPending(false);
      setIsFetching(false);
      return undefined;
    }

    setIsFetching(true);
    setIsPending((current) => current || data === undefined);
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
      setIsFetching(false);
    }
  }, [enabled, fetcher, data]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setIsPending(false);
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setIsPending(data === undefined);
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (cancelled) return;
        setIsPending(false);
        setIsFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    error,
    isError: Boolean(error),
    isPending,
    isLoading: isPending,
    isFetching,
    refetch,
  };
}

function useList<T = AdminRecord>(
  entity: AdminEntity,
  filters?: Record<string, unknown> | string | null,
  enabled = filters !== null
) {
  const version = useKeyVersion(entity);
  const params = useMemo(() => {
    if (!filters || typeof filters === "string") return {};
    return compactFilters(filters);
  }, [filters]);

  const paramsKey = JSON.stringify(params);
  return useDirectQuery<T[]>(
    () =>
      adminApi[entity].readAll(
        Object.keys(params).length ? { params } : undefined
      ) as Promise<T[]>,
    [entity, paramsKey, enabled, version],
    enabled
  );
}

function useDetail<T = AdminRecord>(
  entity: AdminEntity,
  id: string | number | null | undefined
) {
  return useDirectQuery<T>(
    () => adminApi[entity].read(id as string | number) as Promise<T>,
    [entity, id, Boolean(id)],
    Boolean(id)
  );
}

function useMutationAction<TVariables, TResult>(
  action: (variables: TVariables) => Promise<TResult>,
  invalidateKeys: string[] = []
): MutationResult<TVariables, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(
    async (variables: TVariables) => {
      setIsPending(true);
      try {
        const result = await action(variables);
        setError(null);
        invalidateKeys.forEach(bumpKey);
        return result;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [action, invalidateKeys]
  );

  return { mutateAsync, isPending, isLoading: isPending, error };
}

const useCreate = <TPayload = Record<string, any>, TResult = AdminRecord>(
  entity: AdminEntity
) =>
  useMutationAction<TPayload, TResult>(
    (payload) => adminApi[entity].create(payload) as Promise<TResult>,
    [entity]
  );

const useUpdate = <TPayload = Record<string, any>, TResult = AdminRecord>(
  entity: AdminEntity
) =>
  useMutationAction<{ id: string | number | undefined; payload: TPayload }, TResult>(
    ({ id, payload }) => adminApi[entity].update(id as string | number, payload) as Promise<TResult>,
    [entity]
  );

const useDelete = (entity: AdminEntity) =>
  useMutationAction<string | number | undefined, void>(
    (id) => adminApi[entity].delete(id as string | number),
    [entity]
  );

export const useContinentsQuery = () => useList<ContinentRecord>("continents");
export const useContinentQuery = (id: string | number | null | undefined) => useDetail<ContinentRecord>("continents", id);
export const useCreateContinentMutation = () => useCreate<ContinentPayload, ContinentRecord>("continents");
export const useUpdateContinentMutation = () => useUpdate<ContinentPayload, ContinentRecord>("continents");

export const useCountriesQuery = () => useList<CountryRecord>("countries");
export const useCountryQuery = (id: string | number | null | undefined) => useDetail<CountryRecord>("countries", id);
export const useCreateCountryMutation = () => useCreate<CountryPayload, CountryRecord>("countries");
export const useUpdateCountryMutation = () => useUpdate<CountryPayload, CountryRecord>("countries");

export const useStatesQuery = () => useList<StateRecord>("states");
export const useStateQuery = (id: string | number | null | undefined) => useDetail<StateRecord>("states", id);
export const useCreateStateMutation = () => useCreate<StatePayload, StateRecord>("states");
export const useUpdateStateMutation = () => useUpdate<StatePayload, StateRecord>("states");

export const useDistrictsQuery = (filters?: Record<string, unknown> | null) => useList<DistrictRecord>("districts", filters);
export const useDistrictsList = (filters?: Record<string, unknown> | null) => useDistrictsQuery(filters);
export const useDistrictQuery = (id: string | number | null | undefined) => useDetail<DistrictRecord>("districts", id);
export const useCreateDistrictMutation = () => useCreate<DistrictPayload, DistrictRecord>("districts");
export const useUpdateDistrictMutation = () => useUpdate<DistrictPayload, DistrictRecord>("districts");

export const useCitiesQuery = (filters?: Record<string, unknown> | null) => useList<CityRecord>("cities", filters);
export const useCitiesList = (filters?: Record<string, unknown> | null) => useCitiesQuery(filters);
export const useCityQuery = (id: string | number | null | undefined) => useDetail<CityRecord>("cities", id);
export const useCreateCityMutation = () => useCreate<CityPayload, CityRecord>("cities");
export const useUpdateCityMutation = () => useUpdate<CityPayload, CityRecord>("cities");

export const useZonesQuery = (filters?: Record<string, unknown> | string | null) => useList<ZoneRecord>("zones", typeof filters === "string" ? null : filters, filters !== null && filters !== "");
export const useZoneQuery = (id: string | number | null | undefined) => useDetail<ZoneRecord>("zones", id);
export const useCreateZoneMutation = () => useCreate<ZonePayload, ZoneRecord>("zones");
export const useUpdateZoneMutation = () => useUpdate<ZonePayload, ZoneRecord>("zones");

export const useWardsQuery = (filters?: Record<string, unknown> | string | null) => useList<WardRecord>("wards", typeof filters === "string" ? null : filters, filters !== null && filters !== "");
export const useWardQuery = (id: string | number | null | undefined) => useDetail<WardRecord>("wards", id);
export const useCreateWardMutation = () => useCreate<WardPayload, WardRecord>("wards");
export const useUpdateWardMutation = () => useUpdate<WardPayload, WardRecord>("wards");

export const usePanchayatsQuery = (filters?: Record<string, unknown> | null) => useList<PanchayatRecord>("panchayats", filters);
export const usePanchayatQuery = (id: string | number | null | undefined) => useDetail<PanchayatRecord>("panchayats", id);
export const useCreatePanchayatMutation = () => useCreate<PanchayatPayload, PanchayatRecord>("panchayats");
export const useUpdatePanchayatMutation = () => useUpdate<PanchayatPayload, PanchayatRecord>("panchayats");

export const usePropertiesQuery = () => useList<PropertyRecord>("properties");
export const usePropertyQuery = (id: string | number | null | undefined) => useDetail<PropertyRecord>("properties", id);
export const useCreatePropertyMutation = () => useCreate<PropertyPayload, PropertyRecord>("properties");
export const useUpdatePropertyMutation = () => useUpdate<PropertyPayload, PropertyRecord>("properties");

export const useSubPropertiesQuery = () => useList<SubPropertyRecord>("subProperties");
export const useSubPropertyQuery = (id: string | number | null | undefined) => useDetail<SubPropertyRecord>("subProperties", id);
export const useCreateSubPropertyMutation = () => useCreate<SubPropertyPayload, SubPropertyRecord>("subProperties");
export const useUpdateSubPropertyMutation = () => useUpdate<SubPropertyPayload, SubPropertyRecord>("subProperties");

export const useAreaTypesQuery = () => useList<AreaTypeRecord>("areatypes");
export const useAreaTypeQuery = (id: string | number | null | undefined) => useDetail<AreaTypeRecord>("areatypes", id);
export const useCreateAreaTypeMutation = () => useCreate<AreaTypePayload, AreaTypeRecord>("areatypes");
export const useUpdateAreaTypeMutation = () => useUpdate<AreaTypePayload, AreaTypeRecord>("areatypes");

export const useHierarchiesQuery = () => useList<HierarchyRecord>("hierarchies");
export const useHierarchyQuery = (id: string | number | null | undefined) => useDetail<HierarchyRecord>("hierarchies", id);
export const useCreateHierarchyMutation = () => useCreate<HierarchyPayload, HierarchyRecord>("hierarchies");
export const useUpdateHierarchyMutation = () => useUpdate<HierarchyPayload, HierarchyRecord>("hierarchies");

export const useBinsQuery = (filters?: Record<string, unknown> | null) => useList<BinRecord>("bins", filters);
export const useBinQuery = (id: string | number | null | undefined) => useDetail<BinRecord>("bins", id);
export const useCreateBinMutation = () => useCreate<BinPayload, BinRecord>("bins");
export const useUpdateBinMutation = () => useUpdate<BinPayload, BinRecord>("bins");

export const useCollectionPointsQuery = (filters?: Record<string, unknown> | null) => useList<CollectionPointRecord>("collectionPoints", filters);
export const useCollectionPointQuery = (id: string | number | null | undefined) => useDetail<CollectionPointRecord>("collectionPoints", id);
export const useCreateCollectionPointMutation = () => useCreate<CollectionPointPayload, CollectionPointRecord>("collectionPoints");
export const useUpdateCollectionPointMutation = () => useUpdate<CollectionPointPayload, CollectionPointRecord>("collectionPoints");

export const useWasteTypesQuery = (filters?: Record<string, unknown> | null) => useList<WasteTypeRecord>("wasteTypes", filters);
export const useWasteTypeQuery = (id: string | number | null | undefined) => useDetail<WasteTypeRecord>("wasteTypes", id);
export const useCreateWasteTypeMutation = () => useCreate<WasteTypePayload, WasteTypeRecord>("wasteTypes");
export const useUpdateWasteTypeMutation = () => useUpdate<WasteTypePayload, WasteTypeRecord>("wasteTypes");

export const useVehicleTypesQuery = (filters?: Record<string, unknown> | null) => useList<VehicleTypeRecord>("vehicleTypes", filters);
export const useVehicleTypeQuery = (id: string | number | null | undefined) => useDetail<VehicleTypeRecord>("vehicleTypes", id);
export const useCreateVehicleTypeMutation = () => useCreate<VehicleTypePayload, VehicleTypeRecord>("vehicleTypes");
export const useUpdateVehicleTypeMutation = () => useUpdate<VehicleTypePayload, VehicleTypeRecord>("vehicleTypes");

export const useVehicleCreationsQuery = (filters?: Record<string, unknown> | null) => useList<VehicleCreationRecord>("vehicleCreations", filters);
export const useVehicleCreationQuery = (id: string | number | null | undefined) => useDetail<VehicleCreationRecord>("vehicleCreations", id);
export const useCreateVehicleCreationMutation = () => useCreate<VehicleCreationPayload, VehicleCreationRecord>("vehicleCreations");
export const useUpdateVehicleCreationMutation = () => useUpdate<VehicleCreationPayload, VehicleCreationRecord>("vehicleCreations");
export const useDeleteVehicleCreationMutation = () => useDelete("vehicleCreations");
export const useVehicleTypeOptionsQuery = () => useVehicleTypesQuery();
export const useFuelTypeOptionsQuery = () => useFuelsQuery();

export const useTripPlansQuery = (filters?: Record<string, unknown> | null) => useList<any>("tripPlans", filters);
export const useTripPlanQuery = (id: string | number | null | undefined) => useDetail<TripPlanRecord>("tripPlans", id);
export const useCreateTripPlanMutation = () => useCreate<TripPlanPayload, TripPlanRecord>("tripPlans");
export const useUpdateTripPlanMutation = () => useUpdate<TripPlanPayload, TripPlanRecord>("tripPlans");

export const useFuelsQuery = (filters?: Record<string, unknown> | null) => useList<FuelRecord>("fuels", filters);
export const useFuelQuery = (id: string | number | null | undefined) => useDetail<FuelRecord>("fuels", id);
export const useCreateFuelMutation = () => useCreate<FuelPayload, FuelRecord>("fuels");
export const useUpdateFuelMutation = () => useUpdate<FuelPayload, FuelRecord>("fuels");

export const useMainCategoriesQuery = (_companyId?: string) => useList<AdminRecord>("mainCategory");
export const useMainCategoryQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("mainCategory", id);
export const useCreateMainCategoryMutation = (_companyId?: string) => useCreate("mainCategory");
export const useUpdateMainCategoryMutation = (_companyId?: string) => useUpdate("mainCategory");

export const useSubCategoriesQuery = (_companyId?: string) => useList<AdminRecord>("subCategory");
export const useSubCategoryQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("subCategory", id);
export const useCreateSubCategoryMutation = (_companyId?: string) => useCreate("subCategory");
export const useUpdateSubCategoryMutation = (_companyId?: string) => useUpdate("subCategory");

export const useUserTypesQuery = () => useList<AdminRecord>("userTypes");
export const useUserTypeQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("userTypes", id);
export const useCreateUserTypeMutation = () => useCreate("userTypes");
export const useUpdateUserTypeMutation = () => useUpdate("userTypes");

export const useStaffUserTypesQuery = () => useList<AdminRecord>("staffUserTypes");
export const useStaffUserTypeQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("staffUserTypes", id);
export const useCreateStaffUserTypeMutation = () => useCreate("staffUserTypes");
export const useUpdateStaffUserTypeMutation = () => useUpdate("staffUserTypes");

export const useContractorUserTypesQuery = () => useList<AdminRecord>("contractorUserTypes");
export const useContractorUserTypeQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("contractorUserTypes", id);
export const useCreateContractorUserTypeMutation = () => useCreate("contractorUserTypes");
export const useUpdateContractorUserTypeMutation = () => useUpdate("contractorUserTypes");

export const useRoleTypeChoicesQuery = () =>
  useDirectQuery<any[]>(
    async () => toList(await roleTypesApi.readAll()),
    [],
    true
  );

export const useMainScreenTypesQuery = () => useList<AdminRecord>("mainScreenTypes");
export const useMainScreenTypeQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("mainScreenTypes", id);
export const useCreateMainScreenTypeMutation = () => useCreate("mainScreenTypes");
export const useUpdateMainScreenTypeMutation = () => useUpdate("mainScreenTypes");
export const useDeleteMainScreenTypeMutation = () => useDelete("mainScreenTypes");

export const useMainScreensQuery = () => useList<AdminRecord>("mainScreens");
export const useMainScreenQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("mainScreens", id);
export const useCreateMainScreenMutation = () => useCreate("mainScreens");
export const useUpdateMainScreenMutation = () => useUpdate("mainScreens");
export const useDeleteMainScreenMutation = () => useDelete("mainScreens");

export const useUserScreensQuery = () => useList<AdminRecord>("userScreens");
export const useUserScreenQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("userScreens", id);
export const useCreateUserScreenMutation = () => useCreate("userScreens");
export const useUpdateUserScreenMutation = () => useUpdate("userScreens");
export const useDeleteUserScreenMutation = () => useDelete("userScreens");

export const useUserScreenActionsQuery = () => useList<AdminRecord>("userScreenActions");
export const useUserScreenActionQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("userScreenActions", id);
export const useCreateUserScreenActionMutation = () => useCreate("userScreenActions");
export const useUpdateUserScreenActionMutation = () => useUpdate("userScreenActions");
export const useDeleteUserScreenActionMutation = () => useDelete("userScreenActions");

export const useUserScreenPermissionsQuery = () =>
  useList<AdminRecord>(
    "userScreenPermissions",
    { limit: 6000, offset: 0 }
  );

export const useUserScreenPermissionsByCompanyQuery = () =>
  useUserScreenPermissionsQuery();

export const useUserScreenPermissionFormattedQuery = (
  staffTypeId?: string,
  mainScreenId?: string
) =>
  useDirectQuery<any>(
    () =>
      userScreenPermissionApi.read(
        `by-staff-format/?staffusertype_id=${encodeURIComponent(staffTypeId ?? "")}&mainscreen_id=${encodeURIComponent(mainScreenId ?? "")}`
      ),
    [staffTypeId, mainScreenId],
    Boolean(staffTypeId && mainScreenId)
  );

export const useSyncUserScreenPermissionMutation = () =>
  useMutationAction<
    { staffTypeId: string; payload: any; isEdit: boolean },
    any
  >(
    ({ staffTypeId, payload, isEdit }) =>
      userScreenPermissionApi.action(
        isEdit
          ? `update-by-staffusertype/${staffTypeId}`
          : `bulk-sync-multi/${staffTypeId}`,
        payload
      ),
    ["userScreenPermissions"]
  );

export const useDeleteUserScreenPermissionMutation = () =>
  useMutationAction<string, void>(
    (path) => userScreenPermissionApi.delete(path),
    ["userScreenPermissions"]
  );

export const useCustomerCreationsQuery = () => useList<CustomerCreationRecord>("customerCreations");
export const useCustomerCreationQuery = (id: string | number | null | undefined) => useDetail<CustomerCreationRecord>("customerCreations", id);
export const useCreateCustomerCreationMutation = () => useCreate<CustomerCreationPayload, CustomerCreationRecord>("customerCreations");
export const useUpdateCustomerCreationMutation = () => useUpdate<CustomerCreationPayload, CustomerCreationRecord>("customerCreations");
export const useUploadCustomerCreationsMutation = () =>
  useMutationAction<FormData, CustomerCreationRecord>(
    (payload) => adminApi.customerCreations.upload(payload) as Promise<CustomerCreationRecord>,
    ["customerCreations"]
  );

export const useFeedbacksQuery = () => useList<FeedbackRecord>("feedbacks");
export const useFeedbackQuery = (id: string | number | null | undefined) => useDetail<FeedbackRecord>("feedbacks", id);
export const useCreateFeedbackMutation = () => useCreate<FeedbackPayload, FeedbackRecord>("feedbacks");
export const useUpdateFeedbackMutation = () => useUpdate<FeedbackPayload, FeedbackRecord>("feedbacks");

export const useCommonAuditsQuery = () => useList<CommonAuditRecord>("commonAudits");

export const useComplaintsList = () => useList<any>("complaints");
export const useComplaintQuery = (id: string | number | null | undefined) => useDetail<AdminRecord>("complaints", id);
export const useUpdateComplaint = () => useUpdate("complaints");
export const useCreateComplaint = () =>
  useMutationAction<FormData, AdminRecord>(
    (payload) =>
      complaintApi.create(payload, {
        headers: { "Content-Type": "multipart/form-data" },
      }) as Promise<AdminRecord>,
    ["complaints"]
  );
export const useComplaintCustomers = () =>
  useDirectQuery<any[]>(
    async () => toList<AdminRecord>(await customerCreationApi.readAll()).filter((row) => row?.is_active !== false),
    [],
    true
  );
export const useComplaintMainCategories = (_companyId: string) =>
  useDirectQuery<any[]>(
    async () =>
      toList<AdminRecord>(await mainCategoryApi.readAll()).filter(
        (row) => row?.is_active !== false
      ),
    [],
    true
  );
export const useComplaintAllSubCategories = (_companyId: string) =>
  useDirectQuery<any[]>(
    async () =>
      toList<AdminRecord>(await subCategoryApi.readAll()).filter(
        (row) => row?.is_active !== false
      ),
    [],
    true
  );
export const useComplaintZones = (customerId: string) => useZonesQuery(customerId);
export const useComplaintWards = (zoneId: string) => useWardsQuery(zoneId);

export const useAlternativeStaffTemplateList = (params?: Record<string, any>) => useList("alternativeStaffTemplate", params);
export const useAlternativeStaffTemplateQuery = (id?: string | number | null) => useDetail("alternativeStaffTemplate", id);
export const useCreateAlternativeStaffTemplate = () => useCreate("alternativeStaffTemplate");
export const useUpdateAlternativeStaffTemplate = () => useUpdate("alternativeStaffTemplate");

export const useStaffCreationList = (params?: Record<string, any>) => useList("staffCreation", params);
export const useStaffCreationQuery = (id?: string | number | null) => useDetail("staffCreation", id);
export const useCreateStaff = () => useCreate("staffCreation");
export const useUpdateStaff = () => useUpdate("staffCreation");
export const useDeleteStaff = () => useDelete("staffCreation");

export const useStaffTemplateList = (params?: Record<string, any>) => useList("staffTemplateCreation", params);
export const useStaffTemplateQuery = (id?: string | number | null) => useDetail("staffTemplateCreation", id);
export const useCreateStaffTemplate = () => useCreate("staffTemplateCreation");
export const useUpdateStaffTemplate = () => useUpdate("staffTemplateCreation");
export const useDeleteStaffTemplate = () => useDelete("staffTemplateCreation");

export const useUnassignedStaffPoolList = (params?: Record<string, any>) => useList("unassignedStaffPool", params);
export const useUnassignedStaffPoolQuery = (id?: string | number | null) => useDetail("unassignedStaffPool", id);
export const useCreateUnassignedStaffPool = () => useCreate("unassignedStaffPool");
export const useUpdateUnassignedStaffPool = () => useUpdate("unassignedStaffPool");
export const useUsersList = (params?: Record<string, any>) => useList("usersCreation", params);
export const useZonesList = (params?: Record<string, any>) => useList("zones", params);
export const useWardsList = (params?: Record<string, any>) => useList("wards", params);
export const useZonePropertyLoadTrackerList = (filters?: Record<string, unknown> | null) => useList("zonePropertyLoadTrackers", filters);
export const useDeleteZonePropertyLoadTracker = () => useDelete("zonePropertyLoadTrackers");

export const useVehicleTripAuditsQuery = (filters?: Record<string, unknown> | null) => useList("vehicleTripAudits", filters);
export const useVehicleTripAuditQuery = (id?: string | number | null) => useDetail("vehicleTripAudits", id);
export const useUpdateVehicleTripAuditMutation = () => useUpdate("vehicleTripAudits");
