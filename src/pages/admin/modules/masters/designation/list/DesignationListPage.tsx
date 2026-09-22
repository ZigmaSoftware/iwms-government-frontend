import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Switch } from "@/components/ui/switch";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

import { useDesignationList } from "./useDesignation.list";
import { SORTABLE_FIELDS } from "./designation.list.functionality";
import type { DesignationListRecord } from "./designation.list.types";

export default function DesignationListPage() {
  const {
    rows,
    totalRecords,
    first,
    rowsPerPage,
    isLoading,
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
  } = useDesignationList();

  return (
    <div className="p-3">
      <ListPageHeader
        title="Designation Master"
        subtitle="Manage designation records"
        actions={
          <Button label="Add Designation" icon="pi pi-plus" className="p-button-success" onClick={navigateToNew} />
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
        loading={isLoading}
        onExportRequest={onExportRequest}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder="Search designations"
            className="mb-4"
          />
        }
      >
        <Column header="S.No" body={(_, opts) => opts.rowIndex + 1} />
        <Column field="designation_name" header="Designation Name" sortable={SORTABLE_FIELDS.has("designation_name")} />
        <Column field="department_name" header="Department" />
        <Column field="description" header="Description" />
        <Column
          header="Status"
          body={(row: DesignationListRecord) => (
            <Switch checked={Boolean(row.is_active)} onCheckedChange={(value) => void onToggleStatus(row, value)} />
          )}
        />
        <Column
          header="Action"
          body={(row: DesignationListRecord) => (
            <RowActionsMenu
              onEdit={() => navigateToEdit(String(row.unique_id))}
              onDelete={() => void onDelete(String(row.unique_id))}
            />
          )}
        />
      </DataTable>
    </div>
  );
}
