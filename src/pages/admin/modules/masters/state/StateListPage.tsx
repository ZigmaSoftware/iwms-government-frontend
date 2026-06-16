import type { ErrorWithResponse, StateRecord } from "./types";
import type { TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
// import { useEffect, useState, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// import Swal from "@/lib/notify";

// import { DataTable } from "@/components/common/SafeDataTable";
// import { Column } from "primereact/column";
// import { Button } from "primereact/button";
// // import { FilterMatchMode } from "primereact/api";
// import { useTranslation } from "react-i18next";

// import "primereact/resources/themes/lara-light-blue/theme.css";
// import "primereact/resources/primereact.min.css";
// import "primeicons/primeicons.css";

// import { PencilIcon, TrashBinIcon } from "@/icons";
// import { getEncryptedRoute } from "@/utils/routeCache";
// import { Switch } from "@/components/ui/switch";
// import { stateApi } from "@/helpers/admin";

// type StateRecord = {
//   unique_id: string;
//   name: string;
//   country_name: string;
//   label: string;
//   is_active: boolean;
// };

// type ErrorWithResponse = {
//   response?: {
//     data?: unknown;
//   };
// };

// export default function StateList() {
//   const { t } = useTranslation();
//   const [states, setStates] = useState<StateRecord[]>([]);
//   const [loading, setLoading] = useState(true);

//   const [globalFilterValue, setGlobalFilterValue] = useState("");
//   const [filters, setFilters] = useState<any>({
//     global: { value: null, matchMode: FilterMatchMode.CONTAINS },
//   });

//   const navigate = useNavigate();

//   const { encMasters, encStates } = getEncryptedRoute();

//   const ENC_NEW_PATH = `/${encMasters}/${encStates}/new`;
//   const ENC_EDIT_PATH = (unique_id: string) =>
//     `/${encMasters}/${encStates}/${unique_id}/edit`;

//   const extractErrorMessage = (error: unknown) => {
//     if (!error) return t("common.request_failed");
//     if (typeof error === "string") return error;

//     const data = (error as ErrorWithResponse)?.response?.data;

//     if (typeof data === "string") return data;
//     if (Array.isArray(data)) return data.join(", ");

//     if (data && typeof data === "object") {
//       return Object.entries(data as Record<string, unknown>)
//         .map(([k, v]) =>
//           Array.isArray(v) ? `${k}: ${v.join(", ")}` : `${k}: ${String(v)}`
//         )
//         .join("\n");
//     }

//     if (error instanceof Error && error.message) return error.message;

//     return t("common.request_failed");
//   };

//   const fetchStates = useCallback(async () => {
//     // setLoading(true);
//     try {
//       const data = (await stateApi.readAll()) as StateRecord[];
//       setStates(data);
//     } catch (error) {
//       Swal.fire({
//         icon: "error",
//         title: t("common.error"),
//         text: extractErrorMessage(error),
//       });
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void fetchStates();
//   }, [fetchStates]);

//   const handleDelete = async (unique_id: string) => {
//     const confirm = await Swal.fire({
//       title: t("common.confirm_title"),
//       text: t("common.confirm_delete_text"),
//       icon: "warning",
//       showCancelButton: true,
//       confirmButtonColor: "#d33",
//       confirmButtonText: t("common.confirm_delete_button"),
//     });

//     if (!confirm.isConfirmed) return;

//     try {
//       await stateApi.delete(unique_id);
//       Swal.fire({
//         icon: "success",
//         title: t("common.deleted_success"),
//         timer: 1500,
//         showConfirmButton: false,
//       });
//       void fetchStates();
//     } catch (error) {
//       Swal.fire({
//         icon: "error",
//         title: t("common.delete_failed"),
//         text: extractErrorMessage(error),
//       });
//     }
//   };

//   const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     setFilters({
//       ...filters,
//       global: { ...filters.global, value },
//     });
//     setGlobalFilterValue(value);
//   };

//   const renderHeader = () => (
//     <div className="flex justify-end items-center">
//       <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
//         <i className="pi pi-search text-gray-500" />
//         <InputText
//           value={globalFilterValue}
//           onChange={onGlobalFilterChange}
//           placeholder={t("common.search_placeholder", {
//             item: t("admin.nav.state"),
//           })}
//           className="p-inputtext-sm !border-0 !shadow-none"
//         />
//       </div>
//     </div>
//   );

//   const cap = (str?: string) =>
//     str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

//   const statusTemplate = (row: StateRecord) => {
//     const updateStatus = async (value: boolean) => {
//       try {
//         await stateApi.update(row.unique_id, { is_active: value });
//         void fetchStates();
//       } catch (error) {
//         Swal.fire({
//           icon: "error",
//           title: t("common.update_status_failed"),
//           text: extractErrorMessage(error),
//         });
//       }
//     };

//     return <Switch checked={row.is_active} onCheckedChange={updateStatus} />;
//   };

//   const actionTemplate = (row: StateRecord) => (
//     <div className="flex gap-3 justify-center">
//       <button
//         onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
//         className="text-blue-600 hover:text-blue-800"
//       >
//         <PencilIcon className="size-5" />
//       </button>

//       {/* <button
//         onClick={() => handleDelete(row.unique_id)}
//         className="text-red-600 hover:text-red-800"
//       >
//         <TrashBinIcon className="size-5" />
//       </button> */}
//     </div>
//   );

//   const indexTemplate = (_: StateRecord, { rowIndex }: any) => rowIndex + 1;

//   return (
//     <div className="p-3">

//         <div className="flex justify-between items-center mb-6">
//           <div>
//             <h1 className="text-3xl font-bold text-gray-800 mb-1">
//               {t("admin.nav.state")}
//             </h1>
//             <p className="text-gray-500 text-sm">
//               {t("common.manage_item_records", { item: t("admin.nav.state") })}
//             </p>
//           </div>

//           <Button
//             label={t("common.add_item", { item: t("admin.nav.state") })}
//             icon="pi pi-plus"
//             className="p-button-success"
//             onClick={() => navigate(ENC_NEW_PATH)}
//           />
//         </div>

//         <DataTable
//           value={states}
//           dataKey="unique_id"
//           paginator
//           rows={10}
//           rowsPerPageOptions={[5, 10, 25, 50]}
//           loading={loading}
//           filters={filters}
//           header={renderHeader()}
//           stripedRows
//           showGridlines
//           emptyMessage={t("common.no_items_found", {
//             item: t("admin.nav.state"),
//           })}
//           globalFilterFields={["name", "country_name", "label"]}
//           className="p-datatable-sm"
//         >
//           <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "70px" }} />
//           <Column
//             field="country_name"
//             header={t("admin.nav.country")}
//             body={(r) => cap(r.country_name)}
//             sortable
//           />
//           <Column
//             field="name"
//             header={t("admin.nav.state")}
//             body={(r) => cap(r.name)}
//             sortable
//           />
//           <Column
//             field="label"
//             header={t("common.label")}
//             body={(r) => r.label.toUpperCase()}
//             sortable
//           />
//           <Column header={t("common.status")} body={statusTemplate} />
//           <Column header={t("common.actions")} body={actionTemplate} />
//         </DataTable>
     
//     </div>
//   );
// }


import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { stateApi } from "@/helpers/admin";


const STATE_COLUMN_FIELDS: Record<string, string[]> = {
  country_name: ["country_id"],
  name: ["name"],
  label: ["label"],
  is_active: ["is_active"],
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as ErrorWithResponse).response?.data;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};

export default function StateList() {
  const { t } = useTranslation();

  const [states, setStates] = useState<StateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "states",
    STATE_COLUMN_FIELDS,
  );

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    country_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    label: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();

  const { encMasters, encStates } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encStates,
  );

  useEffect(() => {
    let mounted = true;

    const loadStates = async () => {
      setIsLoading(true);
      try {
        const data = await stateApi.readAll();
        if (mounted) setStates(data as StateRecord[]);
      } catch (error) {
        if (mounted) {
          Swal.fire(
            t("common.error"),
            extractErrorMessage(error, t("common.fetch_failed")),
            "error"
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadStates();

    return () => {
      mounted = false;
    };
  }, [t]);

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    const updated = { ...filters };
    updated.global.value = value;

    setFilters(updated);
    setGlobalFilterValue(value);
  };

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder", {
      item: t("admin.nav.state"),
    }),
  });

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const updateStatus = async (row: StateRecord, checked: boolean) => {
    const stateId = String(row.unique_id);
    setPendingStatusId(stateId);
    setIsUpdating(true);

    try {
      await stateApi.update(
        row.unique_id,
        filterPayload({ is_active: checked }) as {
          is_active: boolean;
        }
      );
      setStates((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id ? { ...item, is_active: checked } : item
        )
      );
    } catch {
      Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
    } finally {
      setPendingStatusId(null);
      setIsUpdating(false);
    }
  };

  const statusTemplate = (row: StateRecord) => {
    const stateId = String(row.unique_id);
    return (
      <Switch checked={row.is_active} disabled={isUpdating && pendingStatusId === stateId} onCheckedChange={(checked) => void updateStatus(row, checked)} />
    );
  };

  const actionTemplate = (row: StateRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: StateRecord, options: { rowIndex: number }) =>
    options.rowIndex + 1;

  return (
    <div className="p-3">

      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.state")}
          </h1>

          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", {
              item: t("admin.nav.state"),
            })}
          </p>
        </div>

        <Button
          label={t("common.add_item", { item: t("admin.nav.state") })}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />

      </div>

      <DataTable
        value={states}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && states.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={header}
        stripedRows
        showGridlines
        globalFilterFields={["name", "country_name", "label"]}
        className="p-datatable-sm"
      >

        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "70px" }}
        />

        {showCol("country_name") && (
          <Column
            field="country_name"
            header={t("admin.nav.country")}
            body={(r) => cap(r.country_name)}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("name") && (
          <Column
            field="name"
            header={t("admin.nav.state")}
            body={(r) => cap(r.name)}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("label") && (
          <Column
            field="label"
            header={t("common.label")}
            body={(r) => r.label.toUpperCase()}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusTemplate}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionTemplate}
        />

      </DataTable>

    </div>
  );
}
