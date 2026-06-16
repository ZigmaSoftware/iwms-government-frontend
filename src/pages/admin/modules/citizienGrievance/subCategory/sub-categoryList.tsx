import type { SubCategoryRecord, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { getCurrentCompanyUniqueId } from "@/utils/projectContext";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { subCategoryApi } from "@/helpers/admin";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";


const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.join(", ");
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export default function SubComplaintCategoryList() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [records, setRecords] = useState<SubCategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    mainCategory_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const { encCitizenGrivence, encSubComplaintCategory } = getEncryptedRoute();
  const companyUniqueId = getCurrentCompanyUniqueId() ?? "";

  const { newPath: NEW_PATH, editPath: EDIT_PATH } = createCrudRoutePaths(
    encCitizenGrivence,
    encSubComplaintCategory,
  );

  useEffect(() => {
    let mounted = true;

    const loadSubCategories = async () => {
      setIsLoading(true);
      try {
        const data = await subCategoryApi.readAll(
          companyUniqueId ? { params: { company_id: companyUniqueId } } : undefined
        );
        if (mounted) setRecords(data as SubCategoryRecord[]);
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

    void loadSubCategories();

    return () => {
      mounted = false;
    };
  }, [companyUniqueId, t]);

  const updateStatus = async (row: SubCategoryRecord, value: boolean) => {
    const rowId = String(row.unique_id);
    setPendingStatusId(rowId);
    setIsUpdating(true);

    try {
      await subCategoryApi.update(
        row.unique_id,
        {
          name: row.name,
          mainCategory: row.mainCategory,
          is_active: value,
          company_id: companyUniqueId,
        }
      );
      setRecords((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id ? { ...item, is_active: value } : item
        )
      );
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.update_status_failed")),
        "error"
      );
    } finally {
      setPendingStatusId(null);
      setIsUpdating(false);
    }
  };

  const statusTemplate = (row: SubCategoryRecord) => {
    const rowId = String(row.unique_id);
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === rowId}
        onCheckedChange={(value) => {
          void updateStatus(row, value);
        }}
      />
    );
  };

  const actionTemplate = (row: SubCategoryRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(EDIT_PATH(String(row.unique_id)))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: SubCategoryRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({
      ...filters,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    });
  };

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("admin.citizen_grievance.sub_category.search_placeholder"),
  });

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {t("admin.citizen_grievance.sub_category.title")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t("admin.citizen_grievance.sub_category.subtitle")}
          </p>
        </div>

        <Button
          label={t("common.add_new")}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(NEW_PATH)}
        />
      </div>

      <DataTable
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        loading={isLoading && records.length === 0}
        filters={filters}
        onFilter={onFilter}
        globalFilterFields={["name", "mainCategory_name"]}
        header={header}
        rowsPerPageOptions={[5, 10, 25, 50]}
        stripedRows
        showGridlines
        emptyMessage={t("admin.citizen_grievance.sub_category.empty_message")}
        className="p-datatable-sm"
      >
        <Column
          header={t("admin.citizen_grievance.sub_category.columns.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        <Column
          field="name"
          header={t("admin.citizen_grievance.sub_category.columns.sub_category")}
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="mainCategory_name"
          header={t("admin.citizen_grievance.sub_category.columns.main_category")}
          sortable
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="is_active"
          header={t("common.status")}
          body={statusTemplate}
          style={{ width: "150px" }}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px" }}
        />
      </DataTable>
    </div>
  );
}
