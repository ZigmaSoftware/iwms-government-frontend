import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Switch } from "@/components/ui/switch";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

import { useDepartmentList } from "./useDepartment.list";
import { SORTABLE_FIELDS } from "./department.list.functionality";
import type { DepartmentListRecord } from "./department.list.types";

export default function DepartmentListPage() {
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
  } = useDepartmentList();

  return (
    <div className="p-3">
      <ListPageHeader
        title="Department Master"
        subtitle="Manage department records"
        actions={
          <Button label="Add Department" icon="pi pi-plus" className="p-button-success" onClick={navigateToNew} />
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
            searchPlaceholder="Search departments"
            className="mb-4"
          />
        }
      >
        <Column header="S.No" body={(_, opts) => opts.rowIndex + 1} />
        <Column field="department_name" header="Department Name" sortable={SORTABLE_FIELDS.has("department_name")} />
        <Column field="department_code" header="Code" sortable={SORTABLE_FIELDS.has("department_code")} />
        <Column field="description" header="Description" />
        <Column
          header="Status"
          body={(row: DepartmentListRecord) => (
            <Switch checked={Boolean(row.is_active)} onCheckedChange={(value) => void onToggleStatus(row, value)} />
          )}
        />
        <Column
          header="Action"
          body={(row: DepartmentListRecord) => (
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
