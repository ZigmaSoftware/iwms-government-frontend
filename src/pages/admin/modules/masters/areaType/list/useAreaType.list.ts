import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { extractErrorMessage } from "../../shared/recordHelpers";

import {
  deleteAreaType,
  loadAreaTypeRows,
  loadAreaTypesForExport,
  resolveOrdering,
  updateAreaTypeStatus,
} from "./areaType.list.functionality";
import type {
  AreaTypeListRecord,
  DataTablePageEvent,
  DataTableSortEvent,
  SortOrder,
} from "./areaType.list.types";

/** All state + handlers backing the Area Type list page. */
export function useAreaTypeList() {
  const navigate = useNavigate();
  const { encMasters, encAreaTypes } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encAreaTypes,
  );

  const [rows, setRows] = useState<AreaTypeListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const ordering = resolveOrdering(sortField, sortOrder);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadAreaTypeRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering)
      .then(({ rows: nextRows, totalRecords: nextTotal }) => {
        if (cancelled) return;
        setRows(nextRows);
        setTotalRecords(nextTotal);
      })
      .catch((error) => {
        if (cancelled) return;
        notify.fire("Error", extractErrorMessage(error, "Failed to load Area Type"), "error");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  const onExportRequest = async () => loadAreaTypesForExport();

  const onToggleStatus = async (row: AreaTypeListRecord, value: boolean) => {
    const id = String(row.unique_id);
    setPendingStatusId(id);
    try {
      await updateAreaTypeStatus(id, value);
      setRows((current) =>
        current.map((item) => (item.unique_id === row.unique_id ? { ...item, is_active: value } : item)),
      );
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to update status"), "error");
    } finally {
      setPendingStatusId(null);
    }
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
      await deleteAreaType(id);
      setRows((current) => current.filter((row) => row.unique_id !== id));
      notify.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      notify.fire("Error", extractErrorMessage(error, "Failed to delete Area Type"), "error");
    }
  };

  return {
    rows,
    totalRecords,
    first,
    rowsPerPage,
    isLoading,
    pendingStatusId,
    globalFilterValue,
    setGlobalFilterValue,
    sortField,
    sortOrder,
    onPage,
    onSort,
    onExportRequest,
    onToggleStatus,
    onDelete,
    navigateToNew: () => navigate(ENC_NEW_PATH),
    navigateToEdit: (id: string) => navigate(ENC_EDIT_PATH(id)),
  };
}
