import type { HierarchyRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { capitalize } from "@/utils/capitalize";


const HIERARCHY_COLUMN_FIELDS: Record<string, string[]> = {
  level_name: ["level_name", "name"],
  is_active: ["is_active"],
};

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

export default function HierarchyListPage() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [hierarchies, setHierarchies] = useState<HierarchyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    level_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
  });
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "hierarchies",
    HIERARCHY_COLUMN_FIELDS,
  );
  const navigate = useNavigate();
  const { encMasters, encHierarchies } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encHierarchies,
  );

  const records = hierarchies;

  const loadHierarchies = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.hierarchies.readAll();
      setHierarchies(Array.isArray(response) ? response : []);
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.fetch_failed")),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadHierarchies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.hierarchy"),
      }),
    });

  const statusTemplate = (row: HierarchyRecord) => {
    const updateStatus = async (value: boolean) => {
      const hierarchyId = String(row.unique_id);
      setPendingStatusId(hierarchyId);

      try {
        await adminApi.hierarchies.update(
          row.unique_id as string | number,
          filterPayload({ is_active: value })
        );
        setHierarchies((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id
              ? { ...item, is_active: value }
              : item
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
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={
          pendingStatusId === String(row.unique_id)
        }
        onCheckedChange={updateStatus}
      />
    );
  };

  const actionTemplate = (row: HierarchyRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(String(row.unique_id)))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (
    _: HierarchyRecord,
    { rowIndex }: { rowIndex: number }
  ) => rowIndex + 1;


  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.hierarchy")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", {
              item: t("admin.nav.hierarchy"),
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("admin.nav.hierarchy") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && records.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.nav.hierarchy"),
        })}
        globalFilterFields={["level_name"]}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        {showCol("level_name") && (
          <Column
            field="level_name"
            header={t("common.item_name", { item: t("admin.nav.hierarchy") })}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: HierarchyRecord) => capitalize(row.level_name)}
          />
        )}
        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "140px" }}
          />
        )}
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
