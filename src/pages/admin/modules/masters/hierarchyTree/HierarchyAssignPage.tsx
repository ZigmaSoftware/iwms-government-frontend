import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, ChevronRight, Trash2, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ComponentCard from "@/components/common/ComponentCard";

import { hierarchyAssignmentApi, hierarchyNodeApi } from "@/helpers/admin";
import Swal from "@/lib/notify";

import {
  extractHierarchyError,
  type HierarchyTreeNode,
} from "./types";

type EntityType = { key: string; label: string };
type EntityRecord = { id: string; label: string };
type AssignmentPathNode = { unique_id: string; name: string; level_name: string | null; depth: number };
type Assignment = {
  unique_id: string;
  node: string;
  node_name: string | null;
  node_level: string | null;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  is_primary: boolean;
  path?: AssignmentPathNode[];
};

/** Flatten the nested tree into indented options for a single Select. */
type FlatNode = { id: string; label: string; depth: number };
const flattenTree = (nodes: HierarchyTreeNode[], depth = 0, out: FlatNode[] = []): FlatNode[] => {
  for (const n of nodes) {
    out.push({
      id: n.unique_id,
      label: `${"  ".repeat(depth)}${n.name}${n.level_name ? ` · ${n.level_name}` : ""}`,
      depth,
    });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
};

export default function HierarchyAssignPage() {
  const { t } = useTranslation();

  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [records, setRecords] = useState<EntityRecord[]>([]);
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([]);

  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // -- initial load: entity types + the node tree -------------------------
  useEffect(() => {
    (async () => {
      try {
        const [types, tree] = await Promise.all([
          hierarchyAssignmentApi.action<EntityType[]>("entity-types"),
          hierarchyNodeApi.action<HierarchyTreeNode[]>("tree"),
        ]);
        setEntityTypes(Array.isArray(types) ? types : []);
        setFlatNodes(flattenTree(Array.isArray(tree) ? tree : []));
      } catch (error) {
        Swal.fire(
          t("common.error"),
          extractHierarchyError(error, t("common.fetch_failed")),
          "error",
        );
      }
    })();
  }, [t]);

  // -- when master type changes, load its records -------------------------
  useEffect(() => {
    setEntityId("");
    setRecords([]);
    setAssignments([]);
    if (!entityType) return;
    setLoadingRecords(true);
    hierarchyAssignmentApi
      .action<EntityRecord[]>("entity-records", undefined, {
        params: { entity_type: entityType },
      })
      .then((res) => setRecords(Array.isArray(res) ? res : []))
      .catch((error) =>
        Swal.fire(
          t("common.error"),
          extractHierarchyError(error, t("common.fetch_failed")),
          "error",
        ),
      )
      .finally(() => setLoadingRecords(false));
  }, [entityType, t]);

  const loadAssignments = useCallback(async () => {
    if (!entityType || !entityId) {
      setAssignments([]);
      return;
    }
    try {
      const res = await hierarchyAssignmentApi.action<Assignment[]>(
        "for-entity",
        undefined,
        { params: { entity_type: entityType, entity_id: entityId } },
      );
      setAssignments(Array.isArray(res) ? res : []);
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.fetch_failed")),
        "error",
      );
    }
  }, [entityType, entityId, t]);

  // -- when a specific record is picked, load its current assignments -----
  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const selectedRecordLabel = useMemo(
    () => records.find((r) => r.id === entityId)?.label ?? entityId,
    [records, entityId],
  );

  const handleAssign = async () => {
    if (!entityType || !entityId || !nodeId) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }
    setSubmitting(true);
    try {
      await hierarchyAssignmentApi.create({
        entity_type: entityType,
        entity_id: entityId,
        node: nodeId,
        is_primary: true,
      });
      Swal.fire(t("common.success"), t("common.saved_success"), "success");
      setNodeId("");
      await loadAssignments();
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.save_failed")),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (assignment: Assignment) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: t("common.confirm_title"),
      text: `Remove assignment to "${assignment.node_name}"?`,
      showCancelButton: true,
      confirmButtonText: t("common.remove"),
      cancelButtonText: t("common.cancel"),
    });
    if (!confirm.isConfirmed) return;
    try {
      await hierarchyAssignmentApi.delete(assignment.unique_id);
      Swal.fire(t("common.success"), t("common.record_removed"), "success");
      await loadAssignments();
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.delete_failed")),
        "error",
      );
    }
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center gap-2">
        <Link2 className="text-indigo-600" size={26} />
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white/90">
            {t("admin.nav.hierarchy_assign")}
          </h1>
          <p className="text-sm text-gray-500">
            Attach any master record to any node in the hierarchy. The node's
            full ancestry (and everything beneath it) is resolved automatically.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ComponentCard title="Assign to a hierarchy node">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Master type *</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a master" />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((et) => (
                    <SelectItem key={et.key} value={et.key}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Record *</Label>
              <Select
                value={entityId}
                onValueChange={setEntityId}
                disabled={!entityType || loadingRecords}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingRecords
                        ? `${t("common.loading")}…`
                        : !entityType
                          ? "Select a master type first"
                          : "Select a record"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {records.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Hierarchy node *</Label>
              <Select value={nodeId} onValueChange={setNodeId} disabled={!entityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a node" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {flatNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleAssign}
                disabled={submitting || !entityType || !entityId || !nodeId}
              >
                <Link2 size={16} className="mr-1" />
                {submitting ? `${t("common.saving")}…` : "Assign"}
              </Button>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard
          title={
            entityId
              ? `Current assignments — ${selectedRecordLabel}`
              : "Current assignments"
          }
        >
          {!entityId ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Pick a master record to see where it sits in the hierarchy.
            </p>
          ) : assignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No hierarchy assigned yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {assignments.map((a) => (
                <li
                  key={a.unique_id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network size={16} className="text-indigo-500" />
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {a.node_name}
                      </span>
                      {a.node_level && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                          {a.node_level}
                        </span>
                      )}
                      {a.is_primary && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">
                          Primary
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a)}
                      className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      title={t("common.remove")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {a.path && a.path.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                      {a.path.map((p, i) => (
                        <span key={p.unique_id} className="flex items-center gap-1">
                          {p.name}
                          {i < (a.path?.length ?? 0) - 1 && (
                            <ChevronRight size={12} className="text-gray-300" />
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ComponentCard>
      </div>
    </div>
  );
}
