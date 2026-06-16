import type { BaseCollectionScope, CollectionApiResponse, CollectionRecord, Props, SummaryRow, TableFilters, ViewLevel } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { adminApi } from "@/helpers/admin/registry";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

/* ================= TYPES ================= */


/* ================= HELPERS ================= */

const cap = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "-";

const today = new Date().toISOString().split("T")[0];

const normalizeText = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const getRecordWeight = (
  record: CollectionRecord,
  scope: BaseCollectionScope,
) =>
  Number(
    scope === "panchayat"
      ? record.panchayat_total_weight || 0
      : record.ward_total_weight || 0,
  );

const extractRows = (
  response: CollectionApiResponse | CollectionRecord[],
  scope: BaseCollectionScope,
) => {
  if (Array.isArray(response)) return response;
  return scope === "panchayat"
    ? (response.panchayat_collections ?? [])
    : (response.ward_collections ?? []);
};

/* ================= COMPONENT ================= */

export default function BaseCollectionListPage({ scope }: Props) {
  const { t } = useTranslation();
  const collectionApi =
    scope === "panchayat"
      ? adminApi.panchayatWiseCollections
      : adminApi.wardWiseCollections;
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

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<SummaryRow | null>(
    null,
  );
  const [viewLevel, setViewLevel] = useState<ViewLevel>("summary");
  const [loading, setLoading] = useState(true);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  /* ================= FETCH ================= */

  const fetchRows = useCallback(async () => {
    if (isSuperAdmin && companies.length === 0) {
      setSummaryRows([]);
      setLoading(false);
      return;
    }

    if (!companyUniqueId && !isSuperAdmin) {
      setSummaryRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
      if (projectId) {
        params.project_id = projectId;
      }

      const res = (await collectionApi.readAll({ params })) as
        | CollectionApiResponse
        | CollectionRecord[];
      const extractedRows = extractRows(res, scope);
      const hasContextFields = extractedRows.some((row) => {
        const rowCompanyId = normalizeId(
          row.company_id || row.company_unique_id,
        );
        const rowProjectId = normalizeId(
          row.project_id || row.project_unique_id,
        );
        return Boolean(rowCompanyId || rowProjectId);
      });
      const rows = hasContextFields
        ? extractedRows.filter((row) => {
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
          })
        : extractedRows;

      const grouped: Record<string, SummaryRow> = {};

      rows.forEach((row) => {
        const id = scope === "panchayat" ? row.panchayat_id : row.ward_id;
        const name = scope === "panchayat" ? row.panchayat_name : row.ward_name;
        const key = id || "unknown";

        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            name: name || "-",
            count: 0,
            total_weight: 0,
            records: [],
            zone_name: scope === "ward" ? (row.zone_name ?? "-") : undefined,
            company_names: [],
            project_names: [],
            collection_dates: [],
          };
        }

        grouped[key].count += 1;
        grouped[key].total_weight += getRecordWeight(row, scope);
        grouped[key].records.push(row);

        if (
          row.company_name &&
          !grouped[key].company_names.includes(row.company_name)
        )
          grouped[key].company_names.push(row.company_name);

        if (
          row.project_name &&
          !grouped[key].project_names.includes(row.project_name)
        )
          grouped[key].project_names.push(row.project_name);

        if (
          row.collection_date &&
          !grouped[key].collection_dates.includes(row.collection_date)
        )
          grouped[key].collection_dates.push(row.collection_date);
      });

      setSummaryRows(
        Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (error) {
      console.error(error);
      setSummaryRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    collectionApi,
    companies.length,
    companyUniqueId,
    isSuperAdmin,
    projectId,
    scope,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setSelectedLocation(null);
    setViewLevel("summary");
    resetFilter();
  }, [companyUniqueId, projectId, scope]);

  /* ================= FILTER ================= */

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  function resetFilter() {
    setGlobalFilterValue("");
    setFilters({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    });
  }

  const selectedRecords = useMemo(
    () =>
      selectedLocation
        ? [...selectedLocation.records].sort((a, b) =>
            normalizeText(b.collection_date).localeCompare(
              normalizeText(a.collection_date),
            ),
          )
        : [],
    [selectedLocation],
  );

  /* ================= TOTALS ================= */

  const { dailyWeight, overallWeight, totalRecords } = useMemo(() => {
    let daily = 0;
    let overall = 0;
    let records = 0;

    summaryRows.forEach((row) => {
      records += row.count;
      row.records.forEach((r) => {
        const weight = getRecordWeight(r, scope);

        overall += weight;
        if (r.collection_date === today) daily += weight;
      });
    });

    return {
      dailyWeight: daily.toFixed(2),
      overallWeight: overall.toFixed(2),
      totalRecords: records,
    };
  }, [summaryRows, scope]);

  /* ================= NAVIGATION ================= */

  const drillToRecords = (row: SummaryRow) => {
    setSelectedLocation(row);
    setViewLevel("records");
    resetFilter();
  };

  const goBack = () => {
    setSelectedLocation(null);
    setViewLevel("summary");
    resetFilter();
  };

  /* ================= UI ================= */

  const indexTemplate = (_: unknown, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const scopeLabel = scope === "panchayat" ? "PLB (Participating Local Bodies)" : "Ward";
  const isWard = scope === "ward";
  const locationField = scope === "panchayat" ? "panchayat_name" : "ward_name";
  const weightField =
    scope === "panchayat" ? "panchayat_total_weight" : "ward_total_weight";

  const tableHeader = (
    <div className="flex justify-end items-center">
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder="Search..."
          className="p-inputtext-sm !border-0 !shadow-none"
        />
      </div>
    </div>
  );

  const viewActionTemplate = (onClick: () => void) => (
    <div className="flex gap-3 justify-center">
      <Button
        icon="pi pi-eye"
        className="p-button-sm p-button-text p-button-info"
        tooltip="View"
        tooltipOptions={{ position: "top" }}
        onClick={onClick}
      />
    </div>
  );

  const backButton = (
    <div className="flex justify-end mt-3">
      <Button
        label="Back"
        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
        onClick={goBack}
      />
    </div>
  );

  const summaryTitle = `${scopeLabel} Base Collection`;
  const recordsTitle = selectedLocation
    ? `${scopeLabel} Records - ${selectedLocation.name}`
    : `${scopeLabel} Records`;

  const title = viewLevel === "summary" ? summaryTitle : recordsTitle;
  const subtitle =
    viewLevel === "summary"
      ? `Browse ${scopeLabel.toLowerCase()} collection totals and open any row to view all records.`
      : `${selectedLocation?.count ?? 0} records | Total weight ${
          selectedLocation?.total_weight.toFixed(2) ?? "0.00"
        }`;

  return (
    <div className="p-3">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
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
        </div>
      </div>

      {viewLevel === "records" && selectedLocation && (
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          <span className="hover:underline cursor-pointer" onClick={goBack}>
            {scopeLabel} Base Collection
          </span>
          <i className="pi pi-chevron-right text-xs" />
          <span className="font-semibold text-gray-800">
            {selectedLocation.name}
          </span>
        </div>
      )}

      <div className="mb-4 flex gap-3 text-sm">
        <span className="bg-slate-100 px-4 py-2 rounded-full">
          Daily: {dailyWeight}
        </span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">
          Overall: {overallWeight}
        </span>
        <span className="bg-slate-100 px-4 py-2 rounded-full">
          Records: {totalRecords}
        </span>
      </div>

      {viewLevel === "summary" && (
        <DataTable
          value={summaryRows}
          dataKey="id"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={loading}
          filters={filters}
          globalFilterFields={
            isWard
              ? [
                  "name",
                  "zone_name",
                  "company_names",
                  "project_names",
                  "collection_dates",
                ]
              : ["name", "company_names", "project_names", "collection_dates"]
          }
          header={tableHeader}
          emptyMessage={`No ${scopeLabel.toLowerCase()} collection records found.`}
          stripedRows
          showGridlines
          className="p-datatable-sm"
        >
          <Column
            header="S.No"
            body={indexTemplate}
            style={{ width: "80px" }}
          />

          <Column
            field="company_names"
            header="Company"
            sortable
            body={(row: SummaryRow) =>
              row.company_names.length ? row.company_names.join(", ") : "-"
            }
          />
          <Column
            field="project_names"
            header="Project"
            sortable
            body={(row: SummaryRow) =>
              row.project_names.length ? row.project_names.join(", ") : "-"
            }
          />
          <Column
            field="collection_dates"
            header="Date"
            sortable
            body={(row: SummaryRow) =>
              row.collection_dates.length
                ? [...row.collection_dates].sort().reverse().join(", ")
                : "-"
            }
          />

          <Column field="name" header={scopeLabel} sortable />
          {isWard && (
            <Column
              field="zone_name"
              header="Zone"
              sortable
              body={(row: SummaryRow) => cap(row.zone_name)}
            />
          )}
          <Column
            field="count"
            header="Records"
            sortable
            style={{ width: "120px" }}
          />
          <Column
            field="total_weight"
            header="Total Weight"
            sortable
            body={(row: SummaryRow) => row.total_weight.toFixed(2)}
            style={{ width: "150px" }}
          />
          <Column
            header="Actions"
            style={{ textAlign: "center", width: "100px" }}
            body={(row: SummaryRow) =>
              viewActionTemplate(() => drillToRecords(row))
            }
          />
        </DataTable>
      )}

      {viewLevel === "records" && (
        <div>
          <DataTable
            value={selectedRecords}
            dataKey="unique_id"
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            loading={loading}
            filters={filters}
            globalFilterFields={[
              locationField,
              "zone_name",
              "wastetype_name",
              "bin_name",
              "collection_point_name",
              "collection_date",
              "trip_id",
              "company_name",
              "project_name",
            ]}
            header={tableHeader}
            emptyMessage={`No records found for this ${scopeLabel.toLowerCase()}.`}
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column
              header="S.No"
              body={indexTemplate}
              style={{ width: "80px" }}
            />
            <Column
              field={locationField}
              header={scopeLabel}
              sortable
              body={(row: CollectionRecord) =>
                normalizeText(row[locationField])
              }
            />
            {isWard && (
              <Column
                field="zone_name"
                header="Zone"
                sortable
                body={(row: CollectionRecord) => cap(row.zone_name)}
              />
            )}
            <Column
              field="collection_date"
              header="Date"
              sortable
              body={(row: CollectionRecord) =>
                normalizeText(row.collection_date)
              }
            />
            <Column
              field="wastetype_name"
              header="Waste Type"
              sortable
              body={(row: CollectionRecord) =>
                normalizeText(row.wastetype_name)
              }
            />
            <Column
              field={weightField}
              header="Weight"
              sortable
              body={(row: CollectionRecord) =>
                getRecordWeight(row, scope).toFixed(2)
              }
            />
            <Column
              field="bin_name"
              header="Bin"
              sortable
              body={(row: CollectionRecord) => normalizeText(row.bin_name)}
            />
            <Column
              field="collection_point_name"
              header="Collection Point"
              sortable
              body={(row: CollectionRecord) =>
                normalizeText(row.collection_point_name)
              }
            />
            <Column
              field="trip_id"
              header="Trip"
              sortable
              body={(row: CollectionRecord) => normalizeText(row.trip_id)}
            />
            <Column
              field="company_name"
              header="Company"
              sortable
              body={(row: CollectionRecord) => normalizeText(row.company_name)}
            />
            <Column
              field="project_name"
              header="Project"
              sortable
              body={(row: CollectionRecord) => normalizeText(row.project_name)}
            />
            <Column
              field="latitude"
              header="Latitude"
              body={(row: CollectionRecord) => normalizeText(row.latitude)}
            />
            <Column
              field="longitude"
              header="Longitude"
              body={(row: CollectionRecord) => normalizeText(row.longitude)}
            />
          </DataTable>
          {backButton}
        </div>
      )}
    </div>
  );
}
