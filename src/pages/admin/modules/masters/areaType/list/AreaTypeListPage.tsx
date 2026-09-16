import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { Switch } from "@/components/ui/switch";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

import { useAreaTypeList } from "./useAreaType.list";
import { LIST_COLUMNS, SORTABLE_FIELDS, areaTypeColumnBody } from "./areaType.list.functionality";
import type { AreaTypeListRecord } from "./areaType.list.types";

export default function AreaTypeListPage() {
  const {
    rows,
    totalRecords,
    first,
    rowsPerPage,
    isLoading,
    pendingStatusId,
    globalFilterValue,
    setGlobalFilterValue,
    sortField,
    sortOrder,
    onPage,
    onSort,
    onExportRequest,
    onToggleStatus,
    onDelete,
    navigateToNew,
    navigateToEdit,
  } = useAreaTypeList();

  const statusTemplate = (row: AreaTypeListRecord) => (
    <Switch
      checked={Boolean(row.is_active)}
      disabled={pendingStatusId === String(row.unique_id)}
      onCheckedChange={(checked) => void onToggleStatus(row, checked)}
    />
  );

  const actionTemplate = (row: AreaTypeListRecord) => (
    <RowActionsMenu
      onEdit={() => navigateToEdit(String(row.unique_id))}
      onDelete={() => void onDelete(String(row.unique_id))}
      editLabel="Edit"
      deleteLabel="Delete"
    />
  );

  return (
    <div className="p-3">
      <ListPageHeader
        title="Area Type"
        subtitle="Manage Area Type records"
        actions={
          <Button
            label="Add Area Type"
            icon="pi pi-plus"
            className="p-button-success"
            onClick={navigateToNew}
          />
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
            searchPlaceholder="Search Area Type..."
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        emptyMessage="No Area Type records found."
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: 80 }} />
        {LIST_COLUMNS.map((column) => (
          <Column
            key={column.field}
            field={column.field}
            header={column.header}
            sortable={SORTABLE_FIELDS.has(column.field)}
            body={(row: AreaTypeListRecord) => areaTypeColumnBody(row, column.field)}
          />
        ))}
        <Column header="Status" body={statusTemplate} style={{ width: 120 }} />
        <Column header="Actions" body={actionTemplate} style={{ width: 120, textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
