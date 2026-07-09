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
  /** Only nodes at or below this source type's rank are selectable; ancestors stay visible but disabled. */
  minSourceType?: string;
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

// Mirrors GEO_LEVELS order in the backend seeder (geo_to_hierarchy.py).
const SOURCE_TYPE_RANK: Record<string, number> = {
  continent: 1,
  country: 2,
  state: 3,
  district: 4,
  areatype: 5,
  corporation: 6,
  municipality: 6,
  town_panchayat: 6,
  panchayat_union: 6,
  panchayat: 6,
};

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
  minSourceType,
  placeholder = "Select hierarchy node",
  legacyMatch = null,
  showMap = true,
}: Props) {
  const [nodes, setNodes] = useState<FlatHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    hierarchyNodeApi
      .action<RawHierarchyNode[]>("tree")
      .then((tree) => {
        if (!mounted) return;
        const safeTree = Array.isArray(tree) ? tree : [];
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

  const minRank = minSourceType ? SOURCE_TYPE_RANK[minSourceType] ?? null : null;

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

  const selectedForDisplay = selectedNode;
  const mapPin: NodePin | null = selectedForDisplay?.coordinates
    ? { ...selectedForDisplay.coordinates, label: selectedForDisplay.ancestry.join(" > ") }
    : null;

  const nodeOptions: SearchableOption[] = useMemo(
    () =>
      nodes
        .filter((node) => {
          if (minRank === null || !minSourceType) return true;
          const nodeRank = SOURCE_TYPE_RANK[node.sourceType];
          if (nodeRank === undefined) return true;
          if (nodeRank < minRank) return true; // ancestor tier: keep (shown disabled below)
          // Same tier: only the exact selected source type stays (siblings like
          // Corporation/Municipality/Town Panchayat share a rank but aren't each other's scope).
          // Deeper tiers: hidden entirely — the selected level is the leaf of the visible tree.
          return nodeRank === minRank && node.sourceType === minSourceType;
        })
        .map((node) => {
          const nodeRank = SOURCE_TYPE_RANK[node.sourceType];
          const aboveMinRank = minRank !== null && nodeRank !== undefined && nodeRank < minRank;
          const notAllowedType = Boolean(allowedSet) && !allowedSet!.has(node.sourceType);
          return {
            value: node.id,
            label: `${node.name}${node.levelName ? ` · ${node.levelName}` : ""}`,
            keywords: node.ancestry.join(" "),
            depth: node.depth,
            disabled: aboveMinRank || notAllowedType,
          };
        }),
    [nodes, allowedSet, minRank, minSourceType],
  );

  return (
    <div className="grid gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      <SearchableSelect
        options={nodeOptions}
        value={value}
        onChange={(nodeId) => {
          const node = nodeId ? nodeById.get(nodeId) ?? null : null;
          if (!node) {
            onChange("", {}, null);
            return;
          }
          onChange(node.id, node.legacyValues, node);
        }}
        placeholder={placeholder}
        searchPlaceholder="Search any level (e.g. Chennai, Tamil Nadu)…"
        emptyText="No nodes."
        disabled={disabled}
        loading={loading}
      />
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
