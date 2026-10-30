import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";

import { DataTable } from "@/components/common/SafeDataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { StackCell } from "@/components/common/TableCells";
import { createCrudHelpers } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import notify from "@/lib/notify";
import { confirmDeleteWithReason, withDeleteReason } from "@/utils/deleteReason";

type Row = Record<string, any>;
const householdPickupEventApi = createCrudHelpers<Row>("customer-masters/household-pickup-events");

export default function HouseholdPickupEventList() {
  const navigate = useNavigate();
  const { encCustomerMaster, encHouseholdPickupEvent } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encCustomerMaster, encHouseholdPickupEvent);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    householdPickupEventApi.readAll().then((res) => setRows(normalizeList(res))).finally(() => setLoading(false));
  }, []);

  const onGlobalFilterChange = (value: string) => {
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
    setGlobalFilterValue(value);
  };

  const handleDelete = async (id: string) => {
    const reason = await confirmDeleteWithReason();
    if (reason === null) return;

    try {
      await householdPickupEventApi.delete(id, withDeleteReason(reason));
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({ icon: "success", title: "Deleted successfully", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to delete"), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => navigate(newPath)}>New</Button></div>
      <DataTable
        value={rows}
        loading={loading}
        paginator
        rows={10}
        filters={filters}
        fitWidth
        globalFilterFields={[
          "customer_id",
          "property_id",
          "sub_property_id",
          "collector_staff_id",
          "vehicle_id",
        ]}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={onGlobalFilterChange}
            searchPlaceholder="Search household pickup events..."
            className="mb-4"
          />
        }
      >
        <Column
          field="customer_id"
          header="Customer"
          style={{ width: "26%" }}
          body={(row: Row) => (
            <StackCell
              primary={row.customer_id}
              lines={[{ icon: "pi-clock", title: "Pickup Time", value: row.pickup_time }]}
            />
          )}
        />
        <Column
          field="property_id"
          header="Property"
          style={{ width: "24%" }}
          body={(row: Row) => (
            <StackCell
              primary={row.property_id}
              lines={[{ label: "Sub Property", value: row.sub_property_id }]}
            />
          )}
        />
        <Column field="weight_kg" header="Weight Kg" style={{ width: "10%" }} />
        <Column
          field="collector_staff_id"
          header="Collector"
          style={{ width: "30%" }}
          body={(row: Row) => (
            <StackCell
              primary={row.collector_staff_id}
              lines={[{ icon: "pi-truck", title: "Vehicle", value: row.vehicle_id }]}
            />
          )}
        />
        <Column
          header="Action"
          style={{ width: "10%" }}
          body={(row: Row) => (
            <RowActionsMenu
              onEdit={() => navigate(editPath(row.unique_id))}
              onDelete={() => void handleDelete(String(row.unique_id))}
              editLabel="Edit"
              deleteLabel="Delete"
            />
          )}
        />
      </DataTable>
    </div>
  );
}
