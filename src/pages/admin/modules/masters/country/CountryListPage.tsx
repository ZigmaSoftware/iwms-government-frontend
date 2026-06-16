import type { CountryRecord, ErrorWithResponse } from "./types";
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
// import { countryApi } from "@/helpers/admin";

// type CountryRecord = {
//   unique_id: string;
//   name: string;
//   continent_name: string;
//   mob_code: string;
//   currency: string;
//   is_active: boolean;
// };

// type ErrorWithResponse = {
//   response?: {
//     data?: unknown;
//   };
// };

// export default function CountryList() {
//   const { t } = useTranslation();
//   const [countries, setCountries] = useState<CountryRecord[]>([]);
//   const [loading, setLoading] = useState(true);

//   const [globalFilterValue, setGlobalFilterValue] = useState("");
//   const [filters, setFilters] = useState<any>({
//     global: { value: null, matchMode: FilterMatchMode.CONTAINS },
//   });

//   const navigate = useNavigate();

//   const { encMasters, encCountries } = getEncryptedRoute();

//   const ENC_NEW_PATH = `/${encMasters}/${encCountries}/new`;
//   const ENC_EDIT_PATH = (unique_id: string) =>
//     `/${encMasters}/${encCountries}/${unique_id}/edit`;

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

//   const fetchCountries = useCallback(async () => {
//     // setLoading(true);
//     try {
//       const data = (await countryApi.readAll()) as CountryRecord[];
//       setCountries(data);
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
//     void fetchCountries();
//   }, [fetchCountries]);

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
//       await countryApi.delete(unique_id);
//       Swal.fire({
//         icon: "success",
//         title: t("common.deleted_success"),
//         timer: 1500,
//         showConfirmButton: false,
//       });
//       void fetchCountries();
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

//   const header = (
//     <div className="flex justify-end items-center">
//       <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
//         <i className="pi pi-search text-gray-500" />
//         <InputText
//           value={globalFilterValue}
//           onChange={onGlobalFilterChange}
//           placeholder={t("common.search_placeholder", {
//             item: t("admin.nav.country"),
//           })}
//           className="p-inputtext-sm !border-0 !shadow-none"
//         />
//       </div>
//     </div>
//   );

//   const cap = (str?: string) =>
//     str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

//   const statusTemplate = (row: CountryRecord) => {
//     const updateStatus = async (value: boolean) => {
//       try {
//         await countryApi.update(row.unique_id, { is_active: value });
//         void fetchCountries();
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

//   const actionTemplate = (c: CountryRecord) => (
//     <div className="flex gap-3 justify-center">
//       <button
//         onClick={() => navigate(ENC_EDIT_PATH(c.unique_id))}
//         className="text-blue-600 hover:text-blue-800"
//       >
//         <PencilIcon className="size-5" />
//       </button>

//       {/* <button
//         onClick={() => handleDelete(c.unique_id)}
//         className="text-red-600 hover:text-red-800"
//       >
//         <TrashBinIcon className="size-5" />
//       </button> */}
//     </div>
//   );

//   const indexTemplate = (_: CountryRecord, { rowIndex }: any) => rowIndex + 1;

//   return (
//     <div className="p-3">
      
//         <div className="flex justify-between items-center mb-6">
//           <div>
//             <h1 className="text-3xl font-bold text-gray-800 mb-1">
//               {t("admin.nav.country")}
//             </h1>
//             <p className="text-gray-500 text-sm">
//               {t("common.manage_item_records", { item: t("admin.nav.country") })}
//             </p>
//           </div>

//           <Button
//             label={t("common.add_item", { item: t("admin.nav.country") })}
//             icon="pi pi-plus"
//             className="p-button-success"
//             onClick={() => navigate(ENC_NEW_PATH)}
//           />
//         </div>

//         <DataTable
//           value={countries}
//           dataKey="unique_id"
//           paginator
//           rows={10}
//           rowsPerPageOptions={[5, 10, 25, 50]}
//           loading={loading}
//           filters={filters}
//           header={header}
//           globalFilterFields={[
//             "name",
//             "continent_name",
//             "currency",
//             "mob_code",
//           ]}
//           stripedRows
//           showGridlines
//           emptyMessage={t("common.no_items_found", {
//             item: t("admin.nav.country"),
//           })}
//           className="p-datatable-sm"
//         >
//           <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
//           <Column
//             field="continent_name"
//             header={t("admin.nav.continent")}
//             sortable
//             body={(r) => cap(r.continent_name)}
//           />
//           <Column
//             field="name"
//             header={t("admin.nav.country")}
//             sortable
//             body={(r) => cap(r.name)}
//           />
//           <Column field="currency" header={t("common.currency")} sortable />
//           <Column field="mob_code" header={t("common.mobile_code")} sortable />
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
import { countryApi } from "@/helpers/admin";


const COUNTRY_COLUMN_FIELDS: Record<string, string[]> = {
  continent_name: ["continent_id"],
  name: ["name"],
  currency: ["currency"],
  mob_code: ["mob_code"],
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

export default function CountryList() {
  const { t } = useTranslation();

  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "countries",
    COUNTRY_COLUMN_FIELDS,
  );

  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    continent_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    currency: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    mob_code: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();

  const { encMasters, encCountries } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encCountries,
  );

  useEffect(() => {
    let mounted = true;

    const loadCountries = async () => {
      setIsLoading(true);
      try {
        const data = await countryApi.readAll();
        if (mounted) setCountries(data as CountryRecord[]);
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

    void loadCountries();

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

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const updateStatus = async (row: CountryRecord, checked: boolean) => {
    const countryId = String(row.unique_id);
    setPendingStatusId(countryId);
    setIsUpdating(true);

    try {
      await countryApi.update(
        row.unique_id,
        filterPayload({ is_active: checked }) as {
          is_active: boolean;
        }
      );
      setCountries((current) =>
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

  const statusTemplate = (row: CountryRecord) => {
    const countryId = String(row.unique_id);
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === countryId}
        onCheckedChange={(checked) => void updateStatus(row, checked)}
      />
    );
  };

  const actionTemplate = (c: CountryRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(c.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: CountryRecord, options: { rowIndex: number }) =>
    options.rowIndex + 1;

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder", {
      item: t("admin.nav.country"),
    }),
  });

  return (
    <div className="p-3">

      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.country")}
          </h1>

          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", {
              item: t("admin.nav.country"),
            })}
          </p>
        </div>

        <Button
          label={t("common.add_item", { item: t("admin.nav.country") })}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />

      </div>

      <DataTable
        value={countries}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && countries.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={header}
        globalFilterFields={[
          "name",
          "continent_name",
          "currency",
          "mob_code",
        ]}
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >

        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />

        {showCol("continent_name") && (
          <Column
            field="continent_name"
            header={t("admin.nav.continent")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(r) => cap(r.continent_name)}
          />
        )}

        {showCol("name") && (
          <Column
            field="name"
            header={t("admin.nav.country")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(r) => cap(r.name)}
          />
        )}

        {showCol("currency") && (
          <Column
            field="currency"
            header={t("common.currency")}
            sortable
            filter
            showFilterMatchModes={false}
          />
        )}

        {showCol("mob_code") && (
          <Column
            field="mob_code"
            header={t("common.mobile_code")}
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
