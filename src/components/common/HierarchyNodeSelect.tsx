import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Network } from "lucide-react";

import { Label } from "@/components/ui/label";
import SearchableSelect, { type SearchableOption } from "@/components/common/SearchableSelect";
import NodeMiniMap, { type MapPin as NodePin } from "@/components/common/NodeMiniMap";
import { hierarchyNodeApi } from "@/helpers/admin";

type Coordinates = { lat: number; lng: number } | null;

type RawHierarchyNode = {
  unique_id: string;
  name: string;
  level_name: string | null;
  children?: RawHierarchyNode[];
  coordinates?: Coordinates;
  custom_properties?: Record<string, unknown> | null;
};

export type HierarchyLegacyValues = {
  country_id?: string;
  state_id?: string;
  district_id?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};

type FlatHierarchyNode = {
  id: string;
  name: string;
  levelName: string | null;
  depth: number;
  ancestryIds: string[];
  ancestry: string[];
  coordinates: Coordinates;
  legacyValues: HierarchyLegacyValues;
  sourceType: string;
  sourceId: string;
  children: RawHierarchyNode[];
};

type LegacyMatch = {
  field: keyof HierarchyLegacyValues;
  value: string;
} | null;

type Props = {
  value: string;
  onChange: (nodeId: string, legacyValues: HierarchyLegacyValues, node: FlatHierarchyNode | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  allowedSourceTypes?: string[];
  placeholder?: string;
  legacyMatch?: LegacyMatch;
  showMap?: boolean;
};

const SOURCE_TO_FIELD: Record<string, keyof HierarchyLegacyValues> = {
  country: "country_id",
  state: "state_id",
  district: "district_id",
  corporation: "corporation_id",
  municipality: "municipality_id",
  town_panchayat: "town_panchayat_id",
  panchayat_union: "panchayat_union_id",
  panchayat: "panchayat_id",
};
 
const FIELD_TO_SOURCE = Object.fromEntries(
  Object.entries(SOURCE_TO_FIELD).map(([source, field]) => [field, source]),
) as Record<keyof HierarchyLegacyValues, string>;

const flattenTreeWithIds = (
  nodes: RawHierarchyNode[],
  depth = 0,
  trail: string[] = [],
  trailIds: string[] = [],
  legacyTrail: HierarchyLegacyValues = {},
  out: FlatHierarchyNode[] = [],
): FlatHierarchyNode[] => {
  for (const node of nodes) {
    const props = node.custom_properties ?? {};
    const sourceType = String(props.source_type ?? "");
    const sourceId = String(props.source_id ?? "");
    const legacyValues: HierarchyLegacyValues = { ...legacyTrail };
    const legacyField = SOURCE_TO_FIELD[sourceType];
    if (legacyField && sourceId) {
      legacyValues[legacyField] = sourceId;
    }

    const ancestry = [...trail, node.name];
    const ancestryIds = [...trailIds, node.unique_id];
    out.push({
      id: node.unique_id,
      name: node.name,
      levelName: node.level_name,
      depth,
      ancestryIds,
      ancestry,
      coordinates: node.coordinates ?? null,
      legacyValues,
      sourceType,
      sourceId,
      children: node.children ?? [],
    });

    if (node.children?.length) {
      flattenTreeWithIds(node.children, depth + 1, ancestry, ancestryIds, legacyValues, out);
    }
  }
  return out;
};

export default function HierarchyNodeSelect({
  value,
  onChange,
  label = "Hierarchy",
  required = true,
  disabled = false,
  allowedSourceTypes,
  placeholder = "Select hierarchy node",
  legacyMatch = null,
  showMap = true,
}: Props) {
  const [tree, setTree] = useState<RawHierarchyNode[]>([]);
  const [nodes, setNodes] = useState<FlatHierarchyNode[]>([]);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    hierarchyNodeApi
      .action<RawHierarchyNode[]>("tree")
      .then((tree) => {
        if (!mounted) return;
        const safeTree = Array.isArray(tree) ? tree : [];
        setTree(safeTree);
        setNodes(flattenTreeWithIds(safeTree));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const allowedSet = useMemo(
    () => (allowedSourceTypes?.length ? new Set(allowedSourceTypes) : null),
    [allowedSourceTypes],
  );

  const isSelectable = (node: FlatHierarchyNode | null) =>
    Boolean(node && (!allowedSet || allowedSet.has(node.sourceType)));

  useEffect(() => {
    if (value || !legacyMatch?.value || nodes.length === 0) return;
    const expectedSource = FIELD_TO_SOURCE[legacyMatch.field];
    const match = nodes.find(
      (node) => node.sourceType === expectedSource && node.sourceId === legacyMatch.value,
    );
    if (match) onChange(match.id, match.legacyValues, match);
  }, [legacyMatch, nodes, onChange, value]);

  const selectedNode = useMemo(
    () => (value ? nodeById.get(value) ?? null : null),
    [nodeById, value],
  );
  const activePathIds = selectedNode?.ancestryIds ?? pathIds;

  const levels = useMemo(() => {
    const result: { depth: number; label: string; nodes: RawHierarchyNode[]; value: string }[] = [];
    let options = tree;
    let depth = 0;

    while (options.length) {
      const currentValue = activePathIds[depth] ?? "";
      const label =
        options.find((node) => node.unique_id === currentValue)?.level_name ??
        options[0]?.level_name ??
        `Level ${depth + 1}`;
      result.push({ depth, label, nodes: options, value: currentValue });

      if (!currentValue) break;
      const selected = options.find((node) => node.unique_id === currentValue);
      options = selected?.children ?? [];
      depth += 1;
    }

    return result;
  }, [activePathIds, tree]);

  const activeNodeForDisplay = activePathIds.length
  ? nodeById.get(activePathIds[activePathIds.length - 1])
  : undefined;

const selectedForDisplay = activeNodeForDisplay ?? selectedNode;
  const mapPin: NodePin | null = selectedForDisplay?.coordinates
    ? { ...selectedForDisplay.coordinates, label: selectedForDisplay.ancestry.join(" > ") }
    : null;

  return (
    <div className="grid gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {levels.map((level) => {
          const options: SearchableOption[] = level.nodes.map((node) => {
            const flat = nodeById.get(node.unique_id);
            return {
              value: node.unique_id,
              label: `${node.name}${node.level_name ? ` · ${node.level_name}` : ""}`,
              keywords: `${flat?.ancestry.join(" ") ?? node.name} ${flat?.sourceType ?? ""}`,
            };
          });

          return (
            <div key={level.depth} className="grid gap-1.5">
              <Label className="text-xs text-gray-600">{level.label}</Label>
              <SearchableSelect
                options={options}
                value={level.value}
                onChange={(nodeId) => {
                  const nextPath = nodeId
                    ? [...activePathIds.slice(0, level.depth), nodeId]
                    : activePathIds.slice(0, level.depth);
                  setPathIds(nextPath);

                  const node = nodeId ? nodeById.get(nodeId) ?? null : null;
                  if (!node) {
                    onChange("", {}, null);
                    return;
                  }

                  if (isSelectable(node)) {
                    onChange(node.id, node.legacyValues, node);
                  } else {
                    onChange("", {}, null);
                  }
                }}
                placeholder={level.depth === 0 ? placeholder : `Select ${level.label}`}
                searchPlaceholder={`Search ${level.label.toLowerCase()}...`}
                emptyText={`No ${level.label.toLowerCase()} nodes.`}
                disabled={disabled}
                loading={loading}
              />
            </div>
          );
        })}
      </div>
      {selectedForDisplay && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
          <Network size={12} className="text-indigo-500" />
          {selectedForDisplay.ancestry.map((name, index) => (
            <span key={`${name}-${index}`} className="flex items-center gap-1">
              <span className={index === selectedForDisplay.ancestry.length - 1 ? "font-medium text-gray-800" : ""}>
                {name}
              </span>
              {index < selectedForDisplay.ancestry.length - 1 && <ChevronRight size={11} className="text-gray-300" />}
            </span>
          ))}
        </div>
      )}
      {showMap && <NodeMiniMap pin={mapPin} height={180} />}
    </div>
  );
}
