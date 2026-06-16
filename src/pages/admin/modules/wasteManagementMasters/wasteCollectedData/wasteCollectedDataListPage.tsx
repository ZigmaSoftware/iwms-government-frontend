import type { WasteCollection } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { adminApi } from "@/helpers/admin/registry";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const cap = (str?: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function WasteCollectedDataList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const restoredState = location.state as { companyUniqueId?: string; projectId?: string } | null;

  const { encWasteManagementMaster, encWasteCollectedData } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encWasteManagementMaster,
    encWasteCollectedData,
  );

  const {
    companyUniqueId, projectId, projects, companies,
    isSuperAdmin, setProjectId, onCompanyChange,
  } = useCompanyProjectSelection({
    isEdit: false,
    defaultToAll: true,
    initialCompanyId: restoredState?.companyUniqueId,
    initialProjectId: restoredState?.projectId,
  });

  const [wasteCollections, setWasteCollections] = useState<WasteCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    customer_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    zone_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    ward_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    panchayat_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    city_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    company_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    project_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  /* ── load data ── */
  useEffect(() => {
    if (!companyUniqueId && !isSuperAdmin) { setWasteCollections([]); return; }
    let mounted = true;
    setLoading(true);
    const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
    if (projectId) params.project_id = projectId;
    adminApi.wasteCollections.readAll({ params })
      .then((res: any) => {
        if (!mounted) return;
        const rows: WasteCollection[] = Array.isArray(res) ? res : res?.results ?? [];

        // Only filter client-side when the records actually carry company/project IDs.
        // If they don't (API already filtered server-side), show all rows as-is.
        const hasContextFields = rows.some((row) =>
          Boolean(normalizeId(row.company_id ?? row.company_unique_id) || normalizeId(row.project_id ?? row.project_unique_id))
        );

        if (!hasContextFields) {
          setWasteCollections(rows);
          return;
        }

        const filtered = rows.filter((row) => {
          const rc = normalizeId(row.company_id ?? row.company_unique_id);
          const rp = normalizeId(row.project_id ?? row.project_unique_id);
          return (!companyUniqueId || rc === companyUniqueId) && (!projectId || rp === projectId);
        });
        setWasteCollections(filtered);
      })
      .catch((err) => { if (mounted) Swal.fire({ icon: "error", title: t("common.error"), text: String(err) }); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [companyUniqueId, projectId, t]);

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  /* ── status toggle ── */
  const statusTemplate = (row: WasteCollection) => {
    const updateStatus = async (value: boolean) => {
      try {
        await adminApi.wasteCollections.update(row.unique_id, { is_active: value });
        setWasteCollections((prev) =>
          prev.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      }
    };
    return <Switch checked={!!row.is_active} onCheckedChange={updateStatus} />;
  };

  const actionTemplate = (row: WasteCollection) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        onClick={() =>
          navigate(ENC_EDIT_PATH(row.unique_id), {
            // Existing records may have null company/project (saved before this fix).
            // Always pass the currently selected company+project from the list dropdowns.
            state: { companyUniqueId, projectId },
          })
        }
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: WasteCollection, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.waste_collected_data.search_placeholder"),
    });

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.waste_collected_data.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.waste_collected_data.subtitle")}
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
            {companies.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={(!companyUniqueId && !isSuperAdmin) || projects.length === 0}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <Button
            label={t("admin.waste_collected_data.add_new")}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })}
          />
        </div>
      </div>

      <DataTable
        value={wasteCollections}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading && wasteCollections.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("admin.waste_collected_data.empty_message")}
        className="p-datatable-sm"
        globalFilterFields={["customer_name", "zone_name", "ward_name", "panchayat_name", "city_name", "company_name", "project_name"]}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "60px" }} />
        <Column
          field="customer_name"
          header={t("admin.waste_collected_data.customer_name")}
          body={(row: WasteCollection) => cap(row.customer_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="dry_waste"
          header={t("admin.waste_collected_data.dry_waste")}
          sortable
        />
        <Column
          field="wet_waste"
          header={t("admin.waste_collected_data.wet_waste")}
          sortable
        />
        <Column
          field="mixed_waste"
          header={t("admin.waste_collected_data.mixed_waste")}
          sortable
        />
        <Column
          field="total_quantity"
          header={t("admin.waste_collected_data.quantity")}
          sortable
        />
        <Column
          field="zone_name"
          header={t("common.zone")}
          body={(row: WasteCollection) => cap(row.zone_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="ward_name"
          header={t("common.ward")}
          body={(row: WasteCollection) => cap(row.ward_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="panchayat_name"
          header={t("admin.nav.panchayat")}
          body={(row: WasteCollection) => cap(row.panchayat_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="city_name"
          header={t("common.city")}
          body={(row: WasteCollection) => cap(row.city_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="is_active"
          header={t("common.status")}
          body={statusTemplate}
          style={{ width: "120px" }}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "120px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
