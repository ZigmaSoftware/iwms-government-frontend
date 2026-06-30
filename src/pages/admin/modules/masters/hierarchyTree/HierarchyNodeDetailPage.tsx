import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hierarchyNodeApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createRoutePath } from "@/utils/routePaths";
import Swal from "@/lib/notify";

import {
  extractHierarchyError,
  type HierarchyNode,
  type HierarchyPathNode,
} from "./types";

/**
 * Generic per-node screen.
 *
 * As requested, the body is a plain placeholder ("This screen shows data of
 * <node>") that can be replaced with real, node-specific content later. The
 * ancestor breadcrumb is derived from the closure table via the node's
 * /path/ endpoint so context is always available.
 */
export default function HierarchyNodeDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [node, setNode] = useState<HierarchyNode | null>(null);
  const [path, setPath] = useState<HierarchyPathNode[]>([]);
  const [loading, setLoading] = useState(true);

  const { encMasters, encHierarchyTree } = getEncryptedRoute();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [nodeRes, pathRes] = await Promise.all([
          hierarchyNodeApi.read(id),
          hierarchyNodeApi.read(`${id}/path`),
        ]);
        if (cancelled) return;
        setNode(nodeRes as HierarchyNode);
        // /path/ is ordered root -> ... -> self (depth desc), keep as-is.
        setPath(Array.isArray(pathRes) ? (pathRes as HierarchyPathNode[]) : []);
      } catch (error) {
        if (!cancelled) {
          Swal.fire(
            t("common.error"),
            extractHierarchyError(error, t("common.fetch_failed")),
            "error",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const backToTree = () =>
    navigate(createRoutePath(encMasters, encHierarchyTree));

  if (loading) {
    return (
      <div className="p-3 py-12 text-center text-gray-400">
        {t("common.loading")}…
      </div>
    );
  }

  if (!node) {
    return (
      <div className="p-3">
        <Button variant="outline" onClick={backToTree}>
          <ArrowLeft size={16} className="mr-1" /> {t("common.back")}
        </Button>
        <div className="mt-6 text-center text-gray-400">
          {t("common.no_items_found", { item: t("admin.nav.hierarchy_node") })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" onClick={backToTree}>
          <ArrowLeft size={16} className="mr-1" /> {t("common.back")}
        </Button>
      </div>

      {/* Breadcrumb derived from the closure path */}
      {path.length > 0 && (
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500">
          {path.map((ancestor, index) => (
            <span key={ancestor.unique_id} className="flex items-center gap-1">
              <span
                className={
                  ancestor.unique_id === node.unique_id
                    ? "font-semibold text-gray-800 dark:text-white/90"
                    : ""
                }
              >
                {ancestor.name}
                {ancestor.level_name ? (
                  <span className="ml-1 text-[11px] text-indigo-500">
                    ({ancestor.level_name})
                  </span>
                ) : null}
              </span>
              {index < path.length - 1 && (
                <ChevronRight size={14} className="text-gray-300" />
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            {node.name}
          </h1>
          {node.level_name && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              {node.level_name}
            </span>
          )}
        </div>

        {/* Plain placeholder text — replace with node-specific content. */}
        <p className="text-lg text-gray-600 dark:text-gray-300">
          This screen shows data of <strong>{node.name}</strong>
          {node.level_name ? ` (${node.level_name})` : ""}.
        </p>

        <p className="mt-2 text-sm text-gray-400">
          Node ID: <code>{node.unique_id}</code>
        </p>
      </div>
    </div>
  );
}
