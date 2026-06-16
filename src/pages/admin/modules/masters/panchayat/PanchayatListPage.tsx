import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { panchayatApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { PanchayatListRecord } from "./types";

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const PANCHAYAT_COLUMN_FIELDS: Record<string, string[]> = {
  panchayat_name: ["panchayat_name", "name"],
  state_name: ["state_id", "state", "state_name"],
  district_name: ["district_id", "district", "district_name"],
  city_name: ["city_id", "city", "city_name"],
  agreed_weight_kg: ["agreed_weight_kg"],
  weight_unit: ["weight_unit"],
  effective_from: ["effective_from"],
  is_active: ["is_active"],
};

export default function PanchayatListPage() {
  const { t } = useTranslation();
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "panchayats",
    PANCHAYAT_COLUMN_FIELDS,
  );
  const [allPanchayats, setAllPanchayats] = useState<PanchayatListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    panchayat_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    state_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    district_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    city_name: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    agreed_weight_kg: {
      value: null as string | null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    weight_unit: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    effective_from: {
      value: null as string | null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
  });
  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    setProjectId,
    onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true, initialCompanyId: restoredState?.companyUniqueId, initialProjectId: restoredState?.projectId });
  const navigate = useNavigate();
  const { encMasters, encPanchayats } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encPanchayats,
  );

  useEffect(() => {
    let mounted = true;

    const loadPanchayats = async () => {
      setIsLoading(true);
      try {
        const data = await panchayatApi.readAll();
        if (mounted) setAllPanchayats(data as PanchayatListRecord[]);
      } catch (error) {
        if (mounted) {
          Swal.fire({ icon: "error", title: t("common.error"), text: String(error) });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadPanchayats();

    return () => {
      mounted = false;
    };
  }, [t]);

  const data = ((): PanchayatListRecord[] => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];

    const rows = Array.isArray(allPanchayats)
      ? (allPanchayats as PanchayatListRecord[])
      : [];
    const filtered = rows.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

      const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;

      return companyMatches && projectMatches;
    });

    return filtered as PanchayatListRecord[];
  })();

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as DataTableFilterMeta);
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
        item: t("admin.nav.panchayat"),
      }),
    });

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const displayValue = (value: unknown) =>
    value === null || value === undefined || value === "" ? "-" : String(value);

  const actionTemplate = (row: PanchayatListRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const statusTemplate = (row: PanchayatListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      setIsUpdating(true);

      try {
        await panchayatApi.update(
          row.unique_id,
          filterPayload({ is_active: value }) as { is_active: boolean }
        );
        setAllPanchayats((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error) {
        console.error("Failed to update panchayat status", error);
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === String(row.unique_id)}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const indexTemplate = (
    _: PanchayatListRecord,
    { rowIndex }: { rowIndex: number }
  ) => rowIndex + 1;

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.panchayat")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", {
              item: t("admin.nav.panchayat"),
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={companyUniqueId || ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!isSuperAdmin || companies.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.value} value={company.value}>
                {company.label}
              </option>
            ))}
          </select>

          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.value} value={project.value}>
                {project.label}
              </option>
            ))}
          </select>

          <Button
            label={t("common.add_item", { item: t("admin.nav.panchayat") })}
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={data}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && data.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.nav.panchayat"),
        })}
        globalFilterFields={[
          "panchayat_name",
          "name",
          "city_name",
          "district_name",
          "state_name",
          "country_name",
          "company_name",
          "project_name",
          "agreed_weight_kg",
          "weight_unit",
          "effective_from",
        ]}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        {showCol("panchayat_name") && (
          <Column
            field="panchayat_name"
            header={t("admin.nav.panchayat")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => cap(row.panchayat_name)}
          />
        )}
        {showCol("state_name") && (
          <Column
            field="state_name"
            header={t("common.state")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => cap(row.state_name)}
          />
        )}
        {showCol("district_name") && (
          <Column
            field="district_name"
            header={t("common.district")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => cap(row.district_name)}
          />
        )}
        {showCol("city_name") && (
          <Column
            field="city_name"
            header={t("common.city")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => cap(row.city_name)}
          />
        )}
        {showCol("agreed_weight_kg") && (
          <Column
            field="agreed_weight_kg"
            header="Agreed Weight"
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => displayValue(row.agreed_weight_kg)}
          />
        )}
        {showCol("weight_unit") && (
          <Column
            field="weight_unit"
            header="Weight Unit"
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => displayValue(row.weight_unit).toUpperCase()}
          />
        )}
        {showCol("effective_from") && (
          <Column
            field="effective_from"
            header="Effective From"
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: PanchayatListRecord) => displayValue(row.effective_from)}
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
