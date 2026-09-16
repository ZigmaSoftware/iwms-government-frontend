import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { extractErrorMessage } from "../../shared/recordHelpers";

import {
  deleteDepartment,
  loadDepartmentRows,
  loadDepartmentsForExport,
  resolveOrdering,
  updateDepartmentStatus,
} from "./department.list.functionality";
import type {
  DataTablePageEvent,
  DataTableSortEvent,
  DepartmentListRecord,
  SortOrder,
} from "./department.list.types";

/** All state + handlers backing the Department list page. */
export function useDepartmentList() {
  const navigate = useNavigate();
  const { encMasters, encDepartments } = getEncryptedRoute();
  const { newPath: NEW_PATH, editPath } = createCrudRoutePaths(encMasters, encDepartments);

  const [rows, setRows] = useState<DepartmentListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const ordering = resolveOrdering(sortField, sortOrder);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const { rows: nextRows, totalRecords: nextTotal } = await loadDepartmentRows(
        first / rowsPerPage + 1,
        rowsPerPage,
        searchTerm,
        ordering,
      );
      setRows(nextRows);
      setTotalRecords(nextTotal);
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to load departments"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onExportRequest = async () => loadDepartmentsForExport();

  const onToggleStatus = async (row: DepartmentListRecord, value: boolean) => {
    await updateDepartmentStatus(row, value);
    await refresh();
  };

  const onDelete = async (id: string) => {
    const confirmDelete = await notify.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      await deleteDepartment(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to delete department"), "error");
    }
  };

  return {
    rows,
    totalRecords,
    first,
    rowsPerPage,
    isLoading,
    globalFilterValue,
    setGlobalFilterValue,
    sortField,
    sortOrder,
    onPage,
    onSort,
    onExportRequest,
    onToggleStatus,
    onDelete,
    navigateToNew: () => navigate(NEW_PATH),
    navigateToEdit: (id: string) => navigate(editPath(id)),
  };
}
