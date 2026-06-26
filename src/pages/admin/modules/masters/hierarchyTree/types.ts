export type ApiError = {
  response?: {
    data?: {
      detail?: string;
      [key: string]: unknown;
    };
  };
  message?: string;
};

export type HierarchyLevel = {
  unique_id: string;
  name: string;
  code?: string | null;
  order: number;
  is_active?: boolean;
};

export type HierarchyNode = {
  unique_id: string;
  level: string;
  level_name?: string;
  level_order?: number;
  parent?: string | null;
  parent_name?: string | null;
  name: string;
  code?: string | null;
  custom_properties?: Record<string, unknown>;
  is_active?: boolean;
};

/** A node as returned by the /tree/ endpoint (nested children). */
export type HierarchyTreeNode = {
  unique_id: string;
  level_id: string;
  level_name: string | null;
  level_order: number | null;
  parent_id: string | null;
  name: string;
  code?: string | null;
  is_active?: boolean;
  children: HierarchyTreeNode[];
};

/** A node as returned by the /path/ and /descendants/ endpoints (flat + depth). */
export type HierarchyPathNode = {
  depth: number;
  unique_id: string;
  level_id: string;
  level_name: string | null;
  level_order: number | null;
  parent_id: string | null;
  name: string;
  code?: string | null;
  is_active?: boolean;
};

export const extractHierarchyError = (error: unknown, fallback: string): string => {
  const data = (error as ApiError).response?.data;

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    return Object.entries(data)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};
