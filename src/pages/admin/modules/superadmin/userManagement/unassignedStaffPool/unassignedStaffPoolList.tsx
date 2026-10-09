import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";

import { DataTable } from "@/components/common/SafeDataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { dailyTripAssignmentApi, unassignedStaffPoolApi, userCreationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import notify from "@/lib/notify";
import { combineFilters, useOptionFilter } from "@/components/filters/useOptionFilter";

type Row = Record<string, any>;

const lookup = (items: any[], labelKey: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const id = String(item?.unique_id ?? item?.id ?? "");
    if (id) acc[id] = String(item?.[labelKey] ?? id);
    return acc;
  }, {});

export default function UnassignedStaffPoolList() {
  const navigate = useNavigate();
  const { encUserManagement, encUnassignedStaffPool } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encUserManagement, encUnassignedStaffPool);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalFilterChange = (value: string) => {
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
    setGlobalFilterValue(value);
  };
  // The pool API lists AVAILABLE staff unless `?status=` asks for another one.
  const status = useOptionFilter({
    param: "status",
    label: "Status",
    allLabel: "Available",
    options: [
      { label: "Assigned", value: "ASSIGNED" },
      { label: "Unavailable", value: "UNAVAILABLE" },
    ],
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      unassignedStaffPoolApi.readAll({ params: status.applied }),
      userCreationApi.readAll(),
      dailyTripAssignmentApi.readAll(),
    ])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.value]);

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
      await unassignedStaffPoolApi.delete(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      notify.fire("Error", "Failed to delete.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => navigate(newPath)}>New</Button>
      </div>
      <DataTable
        value={rows}
        loading={loading}
        paginator
        rows={10}
        filterPanel={combineFilters(status)}
        filters={filters}
        globalFilterFields={[
          "operator_name",
          "driver_name",
          "daily_trip_assignment_name",
          "status",
        ]}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={onGlobalFilterChange}
            searchPlaceholder="Search staff pool..."
            className="mb-4"
          />
        }
      >
        <Column field="operator_name" header="Operator" />
        <Column field="driver_name" header="Driver" />
        <Column field="daily_trip_assignment_name" header="Daily Trip Assignment" />
        <Column field="status" header="Status" />
        <Column
          header="Action"
          body={(row: Row) => (
            <RowActionsMenu
              onEdit={() => navigate(editPath(row.unique_id))}
              onDelete={() => void handleDelete(row.unique_id)}
            />
          )}
        />
      </DataTable>
    </div>
  );
}
