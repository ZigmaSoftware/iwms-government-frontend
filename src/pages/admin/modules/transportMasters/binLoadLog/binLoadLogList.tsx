import type { BinLoadLogApiRecord, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { normalizeList } from "@/utils/forms";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";


const buildLookup = (items: any[], key: string, label: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? lookupKey);
    }
    return acc;
  }, {});

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export default function BinLoadLogList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const binLoadLogApi = adminApi.binLoadLogs;
  const zoneApi = adminApi.zones;
  const vehicleApi = adminApi.vehicleCreations;
  const propertyApi = adminApi.properties;
  const subPropertyApi = adminApi.subProperties;

  const [records, setRecords] = useState<BinLoadLogApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, string>>(
    {},
  );
  const [propertyLookup, setPropertyLookup] = useState<Record<string, string>>(
    {},
  );
  const [subPropertyLookup, setSubPropertyLookup] = useState<
    Record<string, string>
  >({});
  const location = useLocation();
  const restoredState = location.state as {
    companyUniqueId?: string;
    projectId?: string;
  } | null;
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

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  // const [filters, setFilters] = useState<any>({
  //   global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  // });

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    zone_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    vehicle_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    property_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    sub_property_id: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    source_type: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    processed: { value: null, matchMode: FilterMatchMode.EQUALS },
  });

  const { encTransportMaster, encBinLoadLog } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encTransportMaster,
    encBinLoadLog,
  );

  const fetchRecords = async () => {
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

    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyUniqueId) params.company_id = companyUniqueId;
      if (projectId) {
        params.project_id = projectId;
      }

      const binLoadRes = await binLoadLogApi.readAll({ params });
      const rows = normalizeList(binLoadRes) as BinLoadLogApiRecord[];

      const hasContextFields = rows.some((row) => {
        const rowCompanyId = normalizeId(
          row.company_id || row.company_unique_id,
        );
        const rowProjectId = normalizeId(
          row.project_id || row.project_unique_id,
        );
        return Boolean(rowCompanyId || rowProjectId);
      });

      if (!hasContextFields) {
        setRecords(rows);
        return;
      }

      const filtered = rows.filter((row) => {
        const rowCompanyId = normalizeId(
          row.company_id || row.company_unique_id,
        );
        const rowProjectId = normalizeId(
          row.project_id || row.project_unique_id,
        );

        const companyMatches =
          !companyUniqueId || rowCompanyId === companyUniqueId;
        const projectMatches = !projectId || rowProjectId === projectId;

        return companyMatches && projectMatches;
      });

      setRecords(filtered);
    } catch {
      Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [companyUniqueId, companies.length, isSuperAdmin, projectId]);

  const filterBySelectedContext = (rows: BinLoadLogApiRecord[]) => {
    const hasContextFields = rows.some((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);
      return Boolean(rowCompanyId || rowProjectId);
    });

    if (!hasContextFields) return rows;

    return rows.filter((row) => {
      const rowCompanyId = normalizeId(row.company_id || row.company_unique_id);
      const rowProjectId = normalizeId(row.project_id || row.project_unique_id);

      const companyMatches =
        !companyUniqueId || rowCompanyId === companyUniqueId;
      const projectMatches = !projectId || rowProjectId === projectId;

      return companyMatches && projectMatches;
    });
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (companyUniqueId) params.company_id = companyUniqueId;
      if (projectId) params.project_id = projectId;

      const allRows = await binLoadLogApi.readAllForExport({ params });
      const filteredRows = filterBySelectedContext(
        normalizeList(allRows) as BinLoadLogApiRecord[],
      );

      exportRecordsToExcel(
        filteredRows.map((row) => ({
          Zone: row.zone_details?.name ?? "",
          Vehicle: row.vehicle_details?.vehicle_no ?? "",
          Property: row.property_details?.property_name ?? "",
          "Sub Property": row.sub_property_details?.sub_property_name ?? "",
          Bin: row.bin_details?.bin_code ?? "",
          "Weight (kg)": row.weight_kg,
          "Source Type": row.source_type,
          "Event Time": resolveEventTime(row.event_time),
          Processed: row.processed ? "Yes" : "No",
          Company:
            row.company_name ?? row.company_id ?? row.company_unique_id ?? "",
          Project:
            row.project_name ?? row.project_id ?? row.project_unique_id ?? "",
          "Created At": resolveEventTime(row.created_at),
        })),
        getAdminScreenExcelFilename("all"),
        "Bin Load Log",
      );
    } catch {
      Swal.fire(
        t("common.error"),
        "Failed to download bin load log data.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
  };

  const header = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.bin_load_log.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.bin_load_log.list_subtitle")}
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
            disabled={
              (!companyUniqueId && !isSuperAdmin) || projects.length === 0
            }
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
            label={exporting ? "Downloading..." : "Download All"}
            icon="pi pi-download"
            className="p-button-success p-button-sm"
            disabled={loading || exporting || records.length === 0}
            onClick={handleDownload}
          />

          <Button
            label={t("admin.bin_load_log.create_button")}
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            disabled={!companyUniqueId || !projectId}
            onClick={() =>
              navigate(ENC_NEW_PATH, { state: { companyUniqueId, projectId } })
            }
          />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.bin_load_log.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>
    </div>
  );

  const resolveEventTime = (value?: string) =>
    value ? new Date(value).toLocaleString() : "-";

  return (
    <div className="p-3">
      <DataTable
        value={records}
        exportable={false}
        dataKey="id"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={[
          "zone_id",
          "vehicle_id",
          "property_id",
          "sub_property_id",
          "source_type",
          "company_name",
          "project_name",
        ]}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("admin.bin_load_log.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column
          field="zone_id"
          header={t("admin.bin_load_log.zone")}
          body={(row: BinLoadLogApiRecord) =>
            zoneLookup[row.zone_details.name] ?? row.zone_details.name
          }
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="vehicle_id"
          header={t("admin.bin_load_log.vehicle")}
          body={(row: BinLoadLogApiRecord) =>
            vehicleLookup[row.vehicle_details.vehicle_no] ??
            row.vehicle_details.vehicle_no
          }
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="property_id"
          header={t("admin.bin_load_log.property")}
          body={(row: BinLoadLogApiRecord) =>
            propertyLookup[row.property_details.property_name] ??
            row.property_details.property_name
          }
          filter
          showFilterMatchModes={false}
        />
        <Column
          field="sub_property_id"
          header={t("admin.bin_load_log.sub_property")}
          body={(row: BinLoadLogApiRecord) =>
            subPropertyLookup[row.sub_property_details.sub_property_name] ??
            row.sub_property_details.sub_property_name
          }
          filter
          showFilterMatchModes={false}
        />
        <Column field="weight_kg" header={t("admin.bin_load_log.weight_kg")} />
        <Column
          field="source_type"
          header={t("admin.bin_load_log.source_type")}
          filter
          showFilterMatchModes={false}
        />
        <Column
          header={t("admin.bin_load_log.event_time")}
          body={(row: BinLoadLogApiRecord) => resolveEventTime(row.event_time)}
        />
        <Column
          field="processed"
          header={t("admin.bin_load_log.processed")}
          body={(row: BinLoadLogApiRecord) =>
            row.processed ? t("common.active") : t("common.inactive")
          }
          filter
          showFilterMatchModes={false}
        />
      </DataTable>
    </div>
  );
}
