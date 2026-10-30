import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { StackCell } from "@/components/common/TableCells";
import { locationColumn } from "@/components/common/LocationColumn";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { getEncryptedRoute } from "@/utils/routeCache";
import notify from "@/lib/notify";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { Switch } from "@/components/ui/switch";
import { wardApi } from "@/helpers/admin";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Can } from "@/contexts/ScreenPermissionContext";
import { confirmDeleteWithReason, withDeleteReason } from "@/utils/deleteReason";

type WardListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): WardListRecord[] => {
  if (Array.isArray(value)) return value as WardListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: WardListRecord[] }).results;
  }
  return [];
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const LOCAL_BODY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const SORTABLE_FIELDS = new Set(["ward_name", "is_active"]);

export default function WardListPage() {
  const navigate = useNavigate();
  const { encMasters, encWards } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encWards);

  const [rows, setRows] = useState<WardListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await wardApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: any) {
      notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load Ward"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onServerExport = (filename: string, sheetName: string) =>
    wardApi.exportToExcel(undefined, filename, sheetName);

  const statusTemplate = (row: WardListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      try {
        await wardApi.update(id, { is_active: value });
        setRows((current) => current.map((item) => item.unique_id === row.unique_id ? { ...item, is_active: value } : item));
      } catch (error: any) {
        notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to update status"), "error");
      } finally {
        setPendingStatusId(null);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={pendingStatusId === String(row.unique_id)}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const handleDelete = async (id: string) => {
    const reason = await confirmDeleteWithReason();
    if (reason === null) return;

    try {
      await wardApi.delete(id, withDeleteReason(reason));
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error: any) {
      notify.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to delete Ward"), "error");
    }
  };

  const actionTemplate = (row: WardListRecord) => (
    <RowActionsMenu
      onEdit={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      onDelete={() => void handleDelete(String(row.unique_id))}
      editLabel="Edit"
      deleteLabel="Delete"
    />
  );

  return (
    <div className="p-3">
      <ListPageHeader
        title="Ward"
        subtitle="Manage Ward records"
        actions={
          <Can action="add">
            <Button
              label="Add Ward"
              icon="pi pi-plus"
              className="p-button-success"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </Can>
        }
        className="mb-6"
      />

      <DataTable
        value={rows}
        dataKey="unique_id"
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder="Search Ward..."
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        fitWidth
        emptyMessage="No Ward records found."
        onServerExport={onServerExport}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "6%" }} />
        <Column
          field="ward_name"
          header="Ward Name"
          sortable={SORTABLE_FIELDS.has("ward_name")}
          style={{ width: "22%" }}
          body={(row: WardListRecord) => <span className="break-words">{displayValue(row.ward_name)}</span>}
        />
        <Column
          field="local_body_name"
          header="Local Body"
          style={{ width: "25%" }}
          body={(row: WardListRecord) => (
            <StackCell
              primary={displayValue(row.local_body_name)}
              lines={[
                {
                  label: "Type",
                  title: "Local Body Type",
                  value: displayValue(LOCAL_BODY_TYPE_LABELS[String(row.local_body_type ?? "")]),
                },
                { label: "Area", title: "Area Type", value: displayValue(row.area_type_name) },
              ]}
            />
          )}
        />
        {locationColumn<WardListRecord>({
          header: "Location",
          style: { width: "26%" },
          levels: [
            { label: "State", value: (row) => displayValue(row.state_name) },
            { label: "District", value: (row) => displayValue(row.district_name) },
          ],
        })}
        <Column header="Status" body={statusTemplate} style={{ width: "11%" }} />
        <Column header="Actions" body={actionTemplate} style={{ width: "10%", textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
