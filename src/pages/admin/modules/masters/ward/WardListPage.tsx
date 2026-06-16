import type { ErrorWithResponse } from "./types";
import { appendRouteQuery, createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { wardApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { WardListRecord } from "./types";

const WARD_COLUMN_FIELDS: Record<string, string[]> = {
  zone_name: ["zone_id"],
  city_name: ["city_id"],
  ward_name: ["ward_name"],
  is_active: ["is_active"],
};


const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const extractErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;

  const data = (error as ErrorWithResponse)?.response?.data;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) =>
        Array.isArray(v) ? `${k}: ${v.join(", ")}` : `${k}: ${String(v)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) return error.message;

  return fallbackMessage;
};

export default function WardList() {
  const { t } = useTranslation();
  const { showColumn: showCol } = useFieldVisibility(
    "masters",
    "wards",
    WARD_COLUMN_FIELDS,
  );

  const [allWards, setAllWards] = useState<WardListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    zone_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    city_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    ward_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
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

  const { encMasters, encWards } = getEncryptedRoute();

  const { newPath: wardNewPath, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encWards,
  );
  const ENC_NEW_PATH = (companyId?: string | null, selectedProjectId?: string | null) =>
    appendRouteQuery(wardNewPath, {
      company_unique_id: companyId,
      project_id: selectedProjectId,
    });

  useEffect(() => {
    if (typeof window === "undefined" || projects.length === 0) return;
    const storedProjectId = localStorage.getItem("selected_project_id");
    if (
      storedProjectId &&
      storedProjectId !== projectId &&
      projects.some((project) => project.value === storedProjectId)
    ) {
      setProjectId(storedProjectId);
    }
  }, [projectId, projects, setProjectId]);

  const onFilterCompanyChange = (value: string) => {
    localStorage.setItem("selected_company_unique_id", value);
    localStorage.removeItem("selected_project_id");
    onCompanyChange(value);
  };

  const onFilterProjectChange = (value: string) => {
    localStorage.setItem("selected_project_id", value);
    setProjectId(value);
  };

  useEffect(() => {
    let mounted = true;

    const loadWards = async () => {
      setIsLoading(true);
      try {
        const data = await wardApi.readAll();
        if (mounted) setAllWards(data as WardListRecord[]);
      } catch (error) {
        if (mounted) {
          const errorData = (error as ErrorWithResponse)?.response?.data;
          Swal.fire({ icon: "error", title: t("common.error"), text: String(errorData ?? error) });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadWards();

    return () => {
      mounted = false;
    };
  }, [t]);

  const wards = ((): WardListRecord[] => {
    if (isSuperAdmin && companies.length === 0) return [];
    if (!companyUniqueId && !isSuperAdmin) return [];

    const rows = Array.isArray(allWards)
      ? (allWards as unknown as WardListRecord[])
      : [];
    const filtered = rows.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

      const companyMatches = !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;

      return companyMatches && projectMatches;
    });

    return filtered as WardListRecord[];
  })();

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters);
  };

  // ===========================
  //   Delete
  // ===========================
  // ===========================
  //   Search
  // ===========================
  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.ward"),
      }),
    });

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  // ===========================
  //   Toggle Status
  // ===========================
  const updateStatus = async (row: WardListRecord, checked: boolean) => {
    const id = String(row.unique_id);

    setPendingStatusId(id);
    setIsUpdating(true);

    try {
      await wardApi.update(row.unique_id, { is_active: checked });
      setAllWards((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id ? { ...item, is_active: checked } : item
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

  const statusTemplate = (row: WardListRecord) => (
    <Switch
      checked={row.is_active}
      disabled={isUpdating && pendingStatusId === String(row.unique_id)}
      onCheckedChange={(checked) => {
        void updateStatus(row, checked);
      }}
    />
  );

  // ===========================
  //   Actions
  // ===========================
  const actionTemplate = (row: WardListRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>

      {/* <button
        onClick={() => handleDelete(row.unique_id)}
        className="text-red-600 hover:text-red-800"
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  const indexTemplate = (_: WardListRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  // ===========================
  //   UI
  // ===========================
  return (
    <div className="p-3">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.ward")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", { item: t("admin.nav.ward") })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={companyUniqueId || ""}
              onChange={(e) => onFilterCompanyChange(e.target.value)}
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
              onChange={(e) => onFilterProjectChange(e.target.value)}
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
              label={t("common.add_item", { item: t("admin.nav.ward") })}
              icon="pi pi-plus"
              className="p-button-success"
              disabled={!companyUniqueId || !projectId}
              onClick={() =>
                navigate(ENC_NEW_PATH(companyUniqueId, projectId), {
                  state: {
                    companyUniqueId,
                    projectId,
                  },
                })
              }
            />
          </div>
        </div>

        <DataTable
          value={wards}
          dataKey="unique_id"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={isLoading && wards.length === 0}
          filters={filters}
          onFilter={onFilter}
          header={renderHeader()}
          stripedRows
          showGridlines
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.ward"),
          })}
          globalFilterFields={[
            "ward_name",
            "zone_name",
            "city_name",
            "district_name",
            "state_name",
            "country_name",
            "company_name",
            "project_name",
          ]}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

          {showCol("zone_name") && (
            <Column
              field="zone_name"
              header={t("admin.nav.zone")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row) => cap(row.zone_name)}
            />
          )}

          {showCol("city_name") && (
            <Column
              field="city_name"
              header={t("admin.nav.city")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row) => cap(row.city_name)}
            />
          )}

          {showCol("ward_name") && (
            <Column
              field="ward_name"
              header={t("admin.nav.ward")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row) => cap(row.ward_name)}
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
