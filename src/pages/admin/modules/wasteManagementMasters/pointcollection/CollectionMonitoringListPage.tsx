import type { BinCollectionEventRecord } from "./types";
import type { NestedRef } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { binCollectionEventApi } from "@/helpers/admin";


const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const text = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === ""
    ? "-"
    : String(value);

const nestedText = (obj: NestedRef, keys: string[]): string => {
  if (!obj || typeof obj !== "object") return "-";
  for (const key of keys) {
    const value = obj[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "-";
};

const normalizeList = (value: unknown): BinCollectionEventRecord[] => {
  if (Array.isArray(value)) return value as BinCollectionEventRecord[];
  if (value && typeof value === "object") {
    const obj = value as { results?: unknown; collections?: unknown };
    if (Array.isArray(obj.results)) return obj.results as BinCollectionEventRecord[];
    if (Array.isArray(obj.collections)) return obj.collections as BinCollectionEventRecord[];
  }
  return [];
};

export default function CollectionMonitoringListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    defaultToAll: true,
    initialCompanyId: restoredState?.companyUniqueId,
    initialProjectId: restoredState?.projectId,
  });

  const { encWasteManagementMaster, encCollectionMonitoring } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encWasteManagementMaster,
    encCollectionMonitoring,
  );

  const [records, setRecords] = useState<BinCollectionEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _bin_name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _waste_type: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _collection_point: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _vehicle: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    _route: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  const fetchRows = useCallback(async () => {
    if (isSuperAdmin && companies.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }
    if (!companyUniqueId && !isSuperAdmin) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
      if (projectId) params.project_id = projectId;
      const response = await binCollectionEventApi.readAll({ params });
      const data = normalizeList(response);
      setRecords(
        data.filter((row) => {
          const rowCompany = normalizeId(row.company_id ?? row.company_unique_id);
          const rowProject = normalizeId(row.project_id ?? row.project_unique_id);
          return (!rowCompany || rowCompany === companyUniqueId) && (!projectId || !rowProject || rowProject === projectId);
        }),
      );
    } catch (error) {
      console.error("Failed to fetch bin collection events", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [companies.length, companyUniqueId, isSuperAdmin, projectId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const rows = useMemo(
    () =>
      records.map((row) => ({
        ...row,
        _bin_name: nestedText(row.bin, ["bin_name", "name"]) === "-" ? text(row.bin_id) : nestedText(row.bin, ["bin_name", "name"]),
        _waste_type: nestedText(row.waste_type, ["waste_type_name", "name"]),
        _collection_point: nestedText(row.bin, ["collection_point_name"]) !== "-"
          ? nestedText(row.bin, ["collection_point_name"])
          : text(row.collection_point_id),
        _vehicle: nestedText(row.vehicle, ["vehicle_no", "name"]),
        _route: nestedText(row.trip_plan, ["display_code", "unique_id"]),
      })),
    [records],
  );

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  const statusTemplate = (row: BinCollectionEventRecord) => {
    const updateStatus = async (value: boolean) => {
      try {
        await binCollectionEventApi.update(row.unique_id, { is_active: value });
        fetchRows();
      } catch (error) {
        console.error("Status update failed:", error);
      }
    };
    return <Switch checked={row.is_active} onCheckedChange={updateStatus} />;
  };

  const actionTemplate = (row: BinCollectionEventRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() =>
          navigate(ENC_EDIT_PATH(row.unique_id), {
            state: { companyUniqueId: row.company_id ?? companyUniqueId, projectId: row.project_id ?? projectId },
          })
        }
        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  if (loading) return <div className="p-6">{t("common.loading")}</div>;

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.collection_monitoring")}
          </h1>
          <p className="text-gray-500 text-sm">Bin collection event records</p>
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
              <option key={company.value} value={company.value}>{company.label}</option>
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
              <option key={project.value} value={project.value}>{project.label}</option>
            ))}
          </select>
          <Button
            label={t("common.add_item", { item: t("admin.nav.collection_monitoring") })}
            icon="pi pi-plus"
            className="p-button-success"
            disabled={!companyUniqueId || !projectId}
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={rows}
        paginator
        rows={10}
        filters={filters}
        globalFilterFields={[
          "unique_id",
          "_bin_name",
          "_waste_type",
          "_collection_point",
          "_vehicle",
          "_route",
          "company_name",
          "project_name",
        ]}
        rowsPerPageOptions={[5, 10, 25, 50]}
        header={
          <div className="flex justify-end items-center">
            <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
              <i className="pi pi-search text-gray-500" />
              <InputText
                value={globalFilterValue}
                onChange={onGlobalFilterChange}
                placeholder={t("common.search_placeholder", { item: t("admin.nav.collection_monitoring") })}
                className="p-inputtext-sm !border-0 !shadow-none"
              />
            </div>
          </div>
        }
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", { item: t("admin.nav.collection_monitoring") })}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: "80px" }} />
        <Column field="_bin_name" header={t("common.item_name", { item: t("admin.nav.bin_master") })} sortable filter showFilterMatchModes={false} />
        <Column field="_waste_type" header={t("common.waste_type")} sortable filter showFilterMatchModes={false} />
        <Column field="_collection_point" header={t("admin.nav.collection_point")} sortable filter showFilterMatchModes={false} />
        <Column field="_route" header="Route" sortable filter showFilterMatchModes={false} />
        <Column field="_vehicle" header="Vehicle" sortable filter showFilterMatchModes={false} />
        <Column field="collected_weight_kg" header="Weight (kg)" sortable body={(row: BinCollectionEventRecord) => text(row.collected_weight_kg)} />
        <Column field="created_at" header={t("common.date")} sortable body={(row: BinCollectionEventRecord) => text(row.created_at).slice(0, 10)} />
        <Column field="company_name" header={t("admin.nav.company")} sortable filter showFilterMatchModes={false} />
        <Column field="project_name" header={t("admin.nav.project")} sortable filter showFilterMatchModes={false} />
        <Column field="is_active" header={t("common.status")} body={statusTemplate} style={{ width: "130px" }} />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: "120px" }} />
      </DataTable>
    </div>
  );
}
