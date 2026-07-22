import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";

import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import { createCrudHelpers } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

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
        <Column header="Action" body={(row: Row) => <Button variant="outline" onClick={() => navigate(editPath(row.unique_id))}>Edit</Button>} />
      </DataTable>
    </div>
  );
}
