import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { extractErrorMessage } from "../../shared/recordHelpers";
import { useStatusFilter } from "@/components/filters/useOptionFilter";

import {
  deleteDesignation,
  loadDesignationRows,
  loadDesignationsForExport,
  resolveOrdering,
  updateDesignationStatus,
} from "./designation.list.functionality";
import type {
  DataTablePageEvent,
  DataTableSortEvent,
  DesignationListRecord,
  SortOrder,
} from "./designation.list.types";

/** All state + handlers backing the Designation list page. */
export function useDesignationList() {
  const navigate = useNavigate();
  const { encMasters, encDesignations } = getEncryptedRoute();
  const { newPath: NEW_PATH, editPath } = createCrudRoutePaths(encMasters, encDesignations);

  const [rows, setRows] = useState<DesignationListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const status = useStatusFilter(() => setFirst(0));

  const ordering = resolveOrdering(sortField, sortOrder);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const { rows: nextRows, totalRecords: nextTotal } = await loadDesignationRows(
        first / rowsPerPage + 1,
        rowsPerPage,
        searchTerm,
        ordering,
        status.applied,
      );
      setRows(nextRows);
      setTotalRecords(nextTotal);
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to load designations"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, status.value]);

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

  const onExportRequest = async () => loadDesignationsForExport(status.applied);

  const onToggleStatus = async (row: DesignationListRecord, value: boolean) => {
    await updateDesignationStatus(row, value);
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
      await deleteDesignation(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to delete designation"), "error");
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
    status,
    onToggleStatus,
    onDelete,
    navigateToNew: () => navigate(NEW_PATH),
    navigateToEdit: (id: string) => navigate(editPath(id)),
  };
}
