import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";

import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import { dailyTripAssignmentApi, unassignedStaffPoolApi, userCreationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Row = Record<string, any>;

const lookup = (items: any[], labelKey: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const id = String(item?.unique_id ?? item?.id ?? "");
    if (id) acc[id] = String(item?.[labelKey] ?? id);
    return acc;
  }, {});

export default function UnassignedStaffPoolList() {
  const navigate = useNavigate();
  const { encStaffMasters, encUnassignedStaffPool } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encStaffMasters, encUnassignedStaffPool);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([unassignedStaffPoolApi.readAll(), userCreationApi.readAll(), dailyTripAssignmentApi.readAll()])
      .then(([poolRes, userRes, tripRes]) => {
        const userLookup = lookup(normalizeList(userRes), "staff_name");
        const tripLookup = lookup(normalizeList(tripRes), "trip_no");
        setRows(
          normalizeList(poolRes).map((row: Row) => ({
            ...row,
            operator_name: row.operator_id ? userLookup[row.operator_id] ?? row.operator_id : "",
            driver_name: row.driver_id ? userLookup[row.driver_id] ?? row.driver_id : "",
            daily_trip_assignment_name: row.daily_trip_assignment_id ? tripLookup[row.daily_trip_assignment_id] ?? row.daily_trip_assignment_id : "",
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => navigate(newPath)}>New</Button>
      </div>
      <DataTable value={rows} loading={loading} paginator rows={10}>
        <Column field="operator_name" header="Operator" />
        <Column field="driver_name" header="Driver" />
        <Column field="daily_trip_assignment_name" header="Daily Trip Assignment" />
        <Column field="status" header="Status" />
        <Column header="Action" body={(row: Row) => <Button variant="outline" onClick={() => navigate(editPath(row.unique_id))}>Edit</Button>} />
      </DataTable>
    </div>
  );
}
