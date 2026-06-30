import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, ChevronRight, Trash2, Network, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ComponentCard from "@/components/common/ComponentCard";
import SearchableSelect, { type SearchableOption } from "@/components/common/SearchableSelect";
import NodeMiniMap, { type MapPin as NodePin } from "@/components/common/NodeMiniMap";

import { hierarchyAssignmentApi, hierarchyNodeApi } from "@/helpers/admin";
import Swal from "@/lib/notify";

import {
  extractHierarchyError,
  type HierarchyTreeNode,
} from "./types";

type Coordinates = { lat: number; lng: number } | null;
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
  coordinates?: Coordinates;
  path?: AssignmentPathNode[];
};

/** Flatten the nested tree, keeping depth, level, ancestry path + coordinates. */
type FlatNode = {
  id: string;
  name: string;
  levelName: string | null;
  depth: number;
  ancestry: string[];
  coordinates: Coordinates;
};
const flattenTree = (
  nodes: (HierarchyTreeNode & { coordinates?: Coordinates })[],
  depth = 0,
  trail: string[] = [],
  out: FlatNode[] = [],
): FlatNode[] => {
  for (const n of nodes) {
    const ancestry = [...trail, n.name];
    out.push({
      id: n.unique_id,
      name: n.name,
      levelName: n.level_name,
      depth,
      ancestry,
      coordinates: (n as { coordinates?: Coordinates }).coordinates ?? null,
    });
    if (n.children?.length)
      flattenTree(n.children as (HierarchyTreeNode & { coordinates?: Coordinates })[], depth + 1, ancestry, out);
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

  // -- options for the searchable selects ---------------------------------
  const typeOptions: SearchableOption[] = useMemo(
    () => entityTypes.map((et) => ({ value: et.key, label: et.label })),
    [entityTypes],
  );
  const recordOptions: SearchableOption[] = useMemo(
    () => records.map((r) => ({ value: r.id, label: r.label, keywords: r.id })),
    [records],
  );
  const nodeOptions: SearchableOption[] = useMemo(
    () =>
      flatNodes.map((n) => ({
        value: n.id,
        label: `${n.name}${n.levelName ? ` · ${n.levelName}` : ""}`,
        keywords: n.ancestry.join(" "),
        depth: n.depth,
      })),
    [flatNodes],
  );

  const selectedNode = useMemo(
    () => flatNodes.find((n) => n.id === nodeId) ?? null,
    [flatNodes, nodeId],
  );

  // The map pin: prefer the node being picked; else the most recent assignment.
  const mapPin: NodePin | null = useMemo(() => {
    if (selectedNode?.coordinates) {
      return { ...selectedNode.coordinates, label: selectedNode.ancestry.join(" › ") };
    }
    const firstWithCoords = assignments.find((a) => a.coordinates);
    if (firstWithCoords?.coordinates) {
      return { ...firstWithCoords.coordinates, label: firstWithCoords.node_name ?? "" };
    }
    return null;
  }, [selectedNode, assignments]);

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
              <SearchableSelect
                options={typeOptions}
                value={entityType}
                onChange={setEntityType}
                placeholder="Select a master"
                searchPlaceholder="Search master types…"
                emptyText="No master types."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Record *</Label>
              <SearchableSelect
                options={recordOptions}
                value={entityId}
                onChange={setEntityId}
                disabled={!entityType}
                loading={loadingRecords}
                placeholder={entityType ? "Select a record" : "Select a master type first"}
                searchPlaceholder="Search records…"
                emptyText="No records."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Hierarchy node *</Label>
              <SearchableSelect
                options={nodeOptions}
                value={nodeId}
                onChange={setNodeId}
                disabled={!entityId}
                placeholder="Select a node"
                searchPlaceholder="Search any level (e.g. Chennai, Tamil Nadu)…"
                emptyText="No nodes."
              />
              {/* Ancestry breadcrumb for the node being picked */}
              {selectedNode && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                  <Network size={12} className="text-indigo-400" />
                  {selectedNode.ancestry.map((name, i) => (
                    <span key={`${name}-${i}`} className="flex items-center gap-1">
                      <span className={i === selectedNode.ancestry.length - 1 ? "font-medium text-gray-700 dark:text-gray-200" : ""}>
                        {name}
                      </span>
                      {i < selectedNode.ancestry.length - 1 && (
                        <ChevronRight size={11} className="text-gray-300" />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Mini-map of the selected node (or latest assignment) */}
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1 text-gray-500">
                <MapPin size={13} /> Location
              </Label>
              <NodeMiniMap pin={mapPin} height={200} />
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
                      {a.coordinates && (
                        <MapPin size={13} className="text-rose-400" />
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
