/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { PencilIcon } from "@/icons";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintCategoryApi, complaintSubcategoryApi } from "@/features/complaintTicketing/api";
import { asArray, errorText, idOf, yesNo } from "../utils";
import { MASTER_CONFIG } from "../masters/masterConfig";

/**
 * "Categories & Subcategories" — merges what used to be two separate
 * sidebar screens into one master-detail page. A Subcategory has no
 * independent identity (it's always scoped to exactly one Category), so
 * browsing them on separate pages meant re-navigating and re-finding the
 * parent category every time. Here, selecting a category shows its
 * subcategories immediately below.
 *
 * The underlying `categories`/`subcategories` routes, list/edit forms, and
 * APIs are unchanged — this screen is the new `categories` `list` component
 * (see `CategoryList.tsx`); `subcategories` stays reachable directly for
 * back-compat and is exactly where "Add/Edit Subcategory" here still
 * navigates to.
 */
export default function CategoryManagementScreen() {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const [searchParams] = useSearchParams();

  const categoryRoutes = createCrudRoutePaths(routes.encComplaintTicket, routes[MASTER_CONFIG.category.routeKey]);
  const subcategoryRoutes = createCrudRoutePaths(routes.encComplaintTicket, routes[MASTER_CONFIG.subcategory.routeKey]);

  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    searchParams.get("selected"),
  );

  useEffect(() => {
    Promise.all([
      complaintCategoryApi.readAll(),
      complaintSubcategoryApi.readAll(),
    ])
      .then(([categoryRes, subcategoryRes]) => {
        setCategories(asArray(categoryRes));
        setSubcategories(asArray(subcategoryRes));
      })
      .catch((err) => Swal.fire("Error", errorText(err, "Unable to load categories"), "error"));
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.unique_id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const scopedSubcategories = useMemo(
    () =>
      selectedCategoryId
        ? subcategories.filter((item) => idOf(item.category) === selectedCategoryId)
        : [],
    [subcategories, selectedCategoryId],
  );

  const editCategory = (row: any) => navigate(categoryRoutes.editPath(row.unique_id));
  const editSubcategory = (row: any) => navigate(subcategoryRoutes.editPath(row.unique_id));
  const addSubcategory = () => {
    if (!selectedCategoryId) return;
    navigate(`${subcategoryRoutes.newPath}?category=${selectedCategoryId}`);
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Categories &amp; Subcategories</h1>
          <p className="text-sm text-gray-500">Complaint ticketing setup</p>
        </div>
        <Button label="Add Category" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(categoryRoutes.newPath)} />
      </div>

      <DataTable
        value={categories}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={(event: any) => setFilters(event.filters)}
        globalFilterFields={MASTER_CONFIG.category.searchFields}
        selectionMode="single"
        selection={selectedCategory}
        onSelectionChange={(event: any) => setSelectedCategoryId(event.value?.unique_id ?? null)}
        header={
          <div className="flex justify-end">
            <InputText
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFilters((prev: any) => ({ ...prev, global: { ...prev.global, value: event.target.value } }));
              }}
              placeholder="Search"
              className="p-inputtext-sm"
            />
          </div>
        }
        emptyMessage="No categories found"
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        {MASTER_CONFIG.category.columns.map((column) => (
          <Column key={column.field} field={column.field} header={column.header} sortable={column.sortable} />
        ))}
        <Column header="Active" body={(row) => yesNo(row.is_active !== false)} />
        <Column
          header="Actions"
          body={(row) => (
            <button className="text-blue-600" onClick={(e) => { e.stopPropagation(); editCategory(row); }} title="Edit">
              <PencilIcon className="size-5" />
            </button>
          )}
          style={{ width: "100px" }}
        />
      </DataTable>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {selectedCategory ? `Subcategories of "${selectedCategory.category_name}"` : "Subcategories"}
            </h2>
            <p className="text-sm text-gray-500">
              {selectedCategory ? "" : "Select a category above to manage its subcategories."}
            </p>
          </div>
          {selectedCategory && (
            <Button label="Add Subcategory" icon="pi pi-plus" className="p-button-success" onClick={addSubcategory} />
          )}
        </div>

        {selectedCategory && (
          <DataTable
            value={scopedSubcategories}
            dataKey="unique_id"
            paginator
            rows={10}
            emptyMessage="No subcategories found for this category"
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
            <Column field="subcategory_code" header="Code" sortable />
            <Column field="subcategory_name" header="Subcategory" sortable />
            <Column field="default_priority_code" header="Default Priority" />
            <Column header="Active" body={(row) => yesNo(row.is_active !== false)} />
            <Column
              header="Actions"
              body={(row) => (
                <button className="text-blue-600" onClick={() => editSubcategory(row)} title="Edit">
                  <PencilIcon className="size-5" />
                </button>
              )}
              style={{ width: "100px" }}
            />
          </DataTable>
        )}
      </div>
    </div>
  );
}
