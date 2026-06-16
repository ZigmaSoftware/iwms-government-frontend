import type { HouseholdPickupEventRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import {
  createCrudHelpers,
  customerCreationApi,
  propertiesApi,
  subPropertiesApi,
  userCreationApi,
  vehicleCreationApi,
  zoneApi,
} from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";


const householdPickupEventApi = createCrudHelpers<HouseholdPickupEventRecord>(
  "customer-masters/household-pickup-events"
);

const buildLookup = (items: any[], key: string, label: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? lookupKey);
    }
    return acc;
  }, {});

const HOUSEHOLD_PICKUP_COLUMN_FIELDS: Record<string, string[]> = {
  customer_id: ["customer_id", "customer"],
  zone_id: ["zone_id", "zone"],
  property_id: ["property_id", "property"],
  sub_property_id: ["sub_property_id", "sub_property"],
  pickup_time: ["pickup_time"],
  weight_kg: ["weight_kg"],
  collector_staff_id: ["collector_staff_id", "collector"],
  vehicle_id: ["vehicle_id", "vehicle"],
  source: ["source"],
};

export default function HouseholdPickupEventList() {
  const { t } = useTranslation();
  const { showColumn: showCol } = useFieldVisibility(
    "customer-master",
    "household-pickup-event",
    HOUSEHOLD_PICKUP_COLUMN_FIELDS,
  );
  const navigate = useNavigate();

  const [records, setRecords] = useState<HouseholdPickupEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerLookup, setCustomerLookup] = useState<Record<string, string>>({});
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [propertyLookup, setPropertyLookup] = useState<Record<string, string>>({});
  const [subPropertyLookup, setSubPropertyLookup] = useState<Record<string, string>>({});
  const [collectorLookup, setCollectorLookup] = useState<Record<string, string>>({});
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, string>>({});

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const { encCustomerMaster, encHouseholdPickupEvent } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encCustomerMaster,
    encHouseholdPickupEvent,
  );

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [
        pickupRes,
        customerRes,
        zoneRes,
        propertyRes,
        subPropertyRes,
        userRes,
        vehicleRes,
      ] = await Promise.all([
        householdPickupEventApi.readAll(),
        customerCreationApi.readAll(),
        zoneApi.readAll(),
        propertiesApi.readAll(),
        subPropertiesApi.readAll(),
        userCreationApi.readAll(),
        vehicleCreationApi.readAll(),
      ]);

      const staffUsers = normalizeList(userRes).filter(
        (u: any) => String(u?.user_type_name ?? "").toLowerCase() === "staff"
      );

      setRecords(normalizeList(pickupRes));
      setCustomerLookup(buildLookup(normalizeList(customerRes), "unique_id", "customer_name"));
      setZoneLookup(buildLookup(normalizeList(zoneRes), "unique_id", "name"));
      setPropertyLookup(buildLookup(normalizeList(propertyRes), "unique_id", "property_name"));
      setSubPropertyLookup(buildLookup(normalizeList(subPropertyRes), "unique_id", "sub_property_name"));
      setCollectorLookup(buildLookup(staffUsers, "unique_id", "staff_name"));
      setVehicleLookup(buildLookup(normalizeList(vehicleRes), "unique_id", "vehicle_no"));
    } catch {
      Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : "-";

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.household_pickup_event.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.household_pickup_event.list_subtitle")}
          </p>
        </div>

        <Button
          label={t("admin.household_pickup_event.create_button")}
          icon="pi pi-plus"
          className="p-button-success p-button-sm"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.household_pickup_event.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  const actionTemplate = (row: HouseholdPickupEventRecord) => (
    <div className="flex justify-center">
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.id), { state: { record: row } })}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        value={records}
        dataKey="id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={[
          "customer_id",
          "zone_id",
          "property_id",
          "sub_property_id",
          "collector_staff_id",
          "vehicle_id",
          "source",
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.household_pickup_event.empty_message")}
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 70 }} />
        {showCol("customer_id") && (
          <Column
            header={t("admin.household_pickup_event.customer")}
            body={(row: HouseholdPickupEventRecord) =>
              customerLookup[row.customer_id] ?? row.customer_id
            }
          />
        )}
        {showCol("zone_id") && (
          <Column
            header={t("admin.household_pickup_event.zone")}
            body={(row: HouseholdPickupEventRecord) => zoneLookup[row.zone_id] ?? row.zone_id}
          />
        )}
        {showCol("property_id") && (
          <Column
            header={t("admin.household_pickup_event.property")}
            body={(row: HouseholdPickupEventRecord) =>
              propertyLookup[row.property_id] ?? row.property_id
            }
          />
        )}
        {showCol("sub_property_id") && (
          <Column
            header={t("admin.household_pickup_event.sub_property")}
            body={(row: HouseholdPickupEventRecord) =>
              subPropertyLookup[row.sub_property_id] ?? row.sub_property_id
            }
          />
        )}
        {showCol("collector_staff_id") && (
          <Column
            header={t("admin.household_pickup_event.collector")}
            body={(row: HouseholdPickupEventRecord) =>
              collectorLookup[row.collector_staff_id] ?? row.collector_staff_id
            }
          />
        )}
        {showCol("vehicle_id") && (
          <Column
            header={t("admin.household_pickup_event.vehicle")}
            body={(row: HouseholdPickupEventRecord) =>
              vehicleLookup[row.vehicle_id] ?? row.vehicle_id
            }
          />
        )}
        {showCol("pickup_time") && (
          <Column
            header={t("admin.household_pickup_event.pickup_time")}
            body={(row: HouseholdPickupEventRecord) => formatDate(row.pickup_time)}
          />
        )}
        {showCol("weight_kg") && (
          <Column field="weight_kg" header={t("admin.household_pickup_event.weight_kg")} />
        )}
        {showCol("source") && (
          <Column field="source" header={t("admin.household_pickup_event.source")} />
        )}
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 120 }} />
      </DataTable>
    </div>
  );
}
