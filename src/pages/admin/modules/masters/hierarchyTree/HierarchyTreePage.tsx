import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  CornerDownRight,
  Network,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { hierarchyLevelApi, hierarchyNodeApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createRoutePath } from "@/utils/routePaths";
import Swal from "@/lib/notify";

import {
  extractHierarchyError,
  type HierarchyLevel,
  type HierarchyTreeNode,
} from "./types";

type DialogMode = "create-root" | "create-child" | "edit";

type DialogState = {
  open: boolean;
  mode: DialogMode;
  /** For create-child: the parent node. For edit: the node being edited. */
  contextNode: HierarchyTreeNode | null;
  levelId: string;
  name: string;
  code: string;
  isActive: boolean;
  submitting: boolean;
};

const EMPTY_DIALOG: DialogState = {
  open: false,
  mode: "create-root",
  contextNode: null,
  levelId: "",
  name: "",
  code: "",
  isActive: true,
  submitting: false,
};

export default function HierarchyTreePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [tree, setTree] = useState<HierarchyTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(EMPTY_DIALOG);

  const { encMasters, encHierarchyNode } = getEncryptedRoute();

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.order - b.order),
    [levels],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [levelRes, treeRes] = await Promise.all([
        hierarchyLevelApi.readAll(),
        hierarchyNodeApi.action<HierarchyTreeNode[]>("tree"),
      ]);
      setLevels(Array.isArray(levelRes) ? (levelRes as HierarchyLevel[]) : []);
      const nextTree = Array.isArray(treeRes) ? treeRes : [];
      setTree(nextTree);
      // Expand roots by default on first load.
      setExpanded((prev) => {
        if (prev.size > 0) return prev;
        return new Set(nextTree.map((n) => n.unique_id));
      });
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.fetch_failed")),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // -- dialog openers -------------------------------------------------------

  const openCreateRoot = () =>
    setDialog({
      ...EMPTY_DIALOG,
      open: true,
      mode: "create-root",
      levelId: sortedLevels[0]?.unique_id ?? "",
    });

  const openCreateChild = (parent: HierarchyTreeNode) => {
    // Suggest the next deeper level, but allow any deeper level (skip support).
    const parentOrder = parent.level_order ?? 0;
    const suggested =
      sortedLevels.find((lvl) => lvl.order > parentOrder) ?? null;
    setDialog({
      ...EMPTY_DIALOG,
      open: true,
      mode: "create-child",
      contextNode: parent,
      levelId: suggested?.unique_id ?? "",
    });
  };

  const openEdit = (node: HierarchyTreeNode) =>
    setDialog({
      ...EMPTY_DIALOG,
      open: true,
      mode: "edit",
      contextNode: node,
      levelId: node.level_id,
      name: node.name,
      code: node.code ?? "",
      isActive: node.is_active ?? true,
    });

  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  // For a create-child dialog, only levels deeper than the parent are valid.
  const availableLevels = useMemo(() => {
    if (dialog.mode === "create-child" && dialog.contextNode) {
      const parentOrder = dialog.contextNode.level_order ?? 0;
      return sortedLevels.filter((lvl) => lvl.order > parentOrder);
    }
    return sortedLevels;
  }, [dialog.mode, dialog.contextNode, sortedLevels]);

  // -- submit ---------------------------------------------------------------

  const handleSubmit = async () => {
    if (!dialog.name.trim()) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }
    if (!dialog.levelId) {
      Swal.fire(t("common.warning"), "Please select a level.", "warning");
      return;
    }

    setDialog((d) => ({ ...d, submitting: true }));
    try {
      if (dialog.mode === "edit" && dialog.contextNode) {
        await hierarchyNodeApi.update(dialog.contextNode.unique_id, {
          level: dialog.levelId,
          name: dialog.name.trim(),
          code: dialog.code.trim(),
          is_active: dialog.isActive,
        });
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await hierarchyNodeApi.create({
          level: dialog.levelId,
          parent:
            dialog.mode === "create-child" && dialog.contextNode
              ? dialog.contextNode.unique_id
              : null,
          name: dialog.name.trim(),
          code: dialog.code.trim(),
          is_active: dialog.isActive,
        });
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      // Keep the parent expanded so the new child is visible.
      if (dialog.mode === "create-child" && dialog.contextNode) {
        const parentId = dialog.contextNode.unique_id;
        setExpanded((prev) => new Set(prev).add(parentId));
      }
      closeDialog();
      await loadAll();
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.save_failed")),
        "error",
      );
    } finally {
      setDialog((d) => ({ ...d, submitting: false }));
    }
  };

  const handleDelete = async (node: HierarchyTreeNode) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: t("common.confirm_title"),
      text: `Deleting "${node.name}" will also remove all nodes beneath it.`,
      showCancelButton: true,
      confirmButtonText: t("common.delete"),
      cancelButtonText: t("common.cancel"),
    });
    if (!confirm.isConfirmed) return;

    try {
      await hierarchyNodeApi.delete(node.unique_id);
      Swal.fire(t("common.success"), t("common.deleted_success"), "success");
      await loadAll();
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractHierarchyError(error, t("common.delete_failed")),
        "error",
      );
    }
  };

  const goToNode = (node: HierarchyTreeNode) =>
    navigate(createRoutePath(encMasters, encHierarchyNode, node.unique_id, "edit"));

  // -- render ---------------------------------------------------------------

  const renderNode = (node: HierarchyTreeNode, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isOpen = expanded.has(node.unique_id);

    return (
      <div key={node.unique_id}>
        <div
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
          style={{ paddingLeft: `${depth * 1.5 + 0.25}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.unique_id)}
              className="flex size-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"
              aria-label="toggle"
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="inline-flex size-5 items-center justify-center text-gray-300">
              <CornerDownRight size={14} />
            </span>
          )}

          <button
            type="button"
            onClick={() => goToNode(node)}
            className="flex flex-1 items-center gap-2 text-left"
            title={t("common.view")}
          >
            <span className="font-medium text-gray-800 dark:text-white/90">
              {node.name}
            </span>
            {node.level_name && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                {node.level_name}
              </span>
            )}
            {node.is_active === false && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                {t("common.inactive")}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => openCreateChild(node)}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              title="Add child"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => openEdit(node)}
              className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
              title={t("common.edit")}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(node)}
              className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              title={t("common.delete")}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {hasChildren && isOpen && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const dialogTitle =
    dialog.mode === "edit"
      ? t("common.edit")
      : dialog.mode === "create-child"
        ? `Add node under "${dialog.contextNode?.name ?? ""}"`
        : "Add root node";

  return (
    <div className="p-3">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="text-indigo-600" size={26} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white/90">
              {t("admin.nav.hierarchy_tree")}
            </h1>
            <p className="text-sm text-gray-500">
              Build and customise your hierarchy in real time. You may skip
              levels (e.g. create a Street directly under a Country).
            </p>
          </div>
        </div>
        <Button onClick={openCreateRoot} disabled={sortedLevels.length === 0}>
          <Plus size={16} className="mr-1" /> Add root node
        </Button>
      </div>

      {sortedLevels.length === 0 && !loading && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No hierarchy levels exist yet. Seed the demo data or create levels via
          the API (<code>masters/hierarchy-levels</code>) before adding nodes.
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <div className="py-12 text-center text-gray-400">
            {t("common.loading")}…
          </div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            {t("common.no_items_found", { item: t("admin.nav.hierarchy_tree") })}
          </div>
        ) : (
          <div>{tree.map((node) => renderNode(node, 0))}</div>
        )}
      </div>

      <Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialog.mode === "create-child" && dialog.contextNode
                ? `Choose any level deeper than "${dialog.contextNode.level_name}".`
                : "Levels define depth; a child must be deeper than its parent."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Level *</Label>
              <Select
                value={dialog.levelId}
                onValueChange={(v) => setDialog((d) => ({ ...d, levelId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {availableLevels.map((lvl) => (
                    <SelectItem key={lvl.unique_id} value={lvl.unique_id}>
                      {lvl.name} (order {lvl.order})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input
                value={dialog.name}
                onChange={(e) =>
                  setDialog((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g. Tamil Nadu"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Code</Label>
              <Input
                value={dialog.code}
                onChange={(e) =>
                  setDialog((d) => ({ ...d, code: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={dialog.isActive}
                onCheckedChange={(v) =>
                  setDialog((d) => ({ ...d, isActive: v }))
                }
              />
              <Label>{t("common.active")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={dialog.submitting}>
              {dialog.submitting ? `${t("common.saving")}…` : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
