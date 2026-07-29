import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { PencilIcon } from "@/icons";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { asArray, errorText, yesNo } from "../utils";
import { MASTER_CONFIG, type MasterKind } from "./masterConfig";

type Props = {
  kind: MasterKind;
};

export default function MasterList({ kind }: Props) {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const config = MASTER_CONFIG[kind];
  const { newPath, editPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[config.routeKey]);
  const [records, setRecords] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const api = config.api();

  const load = async () => {
    const response = await api.readAll();
    setRecords(asArray(response));
  };

  useEffect(() => {
    load().catch((err) => Swal.fire("Error", errorText(err, "Unable to load records"), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const edit = (row: any) => navigate(editPath(row.unique_id));

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{config.titlePlural}</h1>
          <p className="text-sm text-gray-500">Complaint ticketing setup</p>
        </div>
        <Button label="Add New" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(newPath)} />
      </div>
      <DataTable
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={(event: any) => setFilters(event.filters)}
        globalFilterFields={config.searchFields}
        header={
          <div className="flex justify-end">
            <InputText
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFilters((prev: any) => ({ ...prev, global: { ...prev.global, value: event.target.value } }));
              }}
              placeholder="Search"
              className="p-inputtext-sm"
            />
          </div>
        }
        emptyMessage="No records found"
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        {config.columns.map((column) => (
          <Column
            key={column.field}
            field={column.field}
            header={column.header}
            sortable={column.sortable}
            body={column.render === "yesno" ? (row) => yesNo(row[column.field]) : undefined}
          />
        ))}
        <Column header="Active" body={(row) => yesNo(row.is_active !== false)} />
        <Column header="Actions" body={(row) => <button className="text-blue-600" onClick={() => edit(row)} title="Edit"><PencilIcon className="size-5" /></button>} style={{ width: "100px" }} />
      </DataTable>
    </div>
  );
}
