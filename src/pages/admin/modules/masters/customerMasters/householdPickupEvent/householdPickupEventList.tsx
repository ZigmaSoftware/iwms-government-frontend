import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";

import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { createCrudHelpers } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import notify from "@/lib/notify";

type Row = Record<string, any>;
const householdPickupEventApi = createCrudHelpers<Row>("customer-masters/household-pickup-events");

export default function HouseholdPickupEventList() {
  const navigate = useNavigate();
  const { encCustomerMaster, encHouseholdPickupEvent } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encCustomerMaster, encHouseholdPickupEvent);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    householdPickupEventApi.readAll().then((res) => setRows(normalizeList(res))).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    const confirmDelete = await notify.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      await householdPickupEventApi.delete(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({ icon: "success", title: "Deleted successfully", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to delete"), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => navigate(newPath)}>New</Button></div>
      <DataTable value={rows} loading={loading} paginator rows={10}>
        <Column field="customer_id" header="Customer" />
        <Column field="property_id" header="Property" />
        <Column field="sub_property_id" header="Sub Property" />
        <Column field="pickup_time" header="Pickup Time" />
        <Column field="weight_kg" header="Weight Kg" />
        <Column field="collector_staff_id" header="Collector" />
        <Column field="vehicle_id" header="Vehicle" />
        <Column
          header="Action"
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
