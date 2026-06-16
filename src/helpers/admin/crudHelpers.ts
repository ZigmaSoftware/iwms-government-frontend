import type { AxiosRequestConfig } from "axios";
import { api } from "@/api";
/* -----------------------------------------
   Normalize API path (idempotent)
----------------------------------------- */
const normalizePath = (path: string): string => {
  const cleaned = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${cleaned}/`;
};

/* -----------------------------------------
   Types
----------------------------------------- */
export type PaginatedResponse<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
  [key: string]: unknown;
};

export type CrudFieldMetadata = {
  type?: string;
  required?: boolean;
  read_only?: boolean;
  write_only?: boolean;
  label?: string;
  help_text?: string;
  choices?: Array<{ value: unknown; display_name?: string }>;
  [key: string]: unknown;
};

export type CrudMetadata = {
  actions?: {
    POST?: Record<string, CrudFieldMetadata>;
    [key: string]: Record<string, CrudFieldMetadata> | undefined;
  };
  [key: string]: unknown;
};

export type CrudHelpers<T = any> = {
  readAll: (config?: AxiosRequestConfig) => Promise<T[]>;

  readAllForExport: (config?: AxiosRequestConfig) => Promise<T[]>;

  readAllwithPaginated: (
    page?: number,
    limit?: number,
    config?: AxiosRequestConfig,
  ) => Promise<PaginatedResponse<T>>;

  read: (path: string | number, config?: AxiosRequestConfig) => Promise<T>;

  create: <P = unknown>(payload: P, config?: AxiosRequestConfig) => Promise<T>;

  update: <P = unknown>(
    id: string | number,
    payload: P,
    config?: AxiosRequestConfig,
  ) => Promise<T>;

  delete: (id: string | number, config?: AxiosRequestConfig) => Promise<void>;

  metadata: (config?: AxiosRequestConfig) => Promise<CrudMetadata>;

  action: <R = any, P = any>(
    action: string,
    payload?: P,
    config?: AxiosRequestConfig,
  ) => Promise<R>;

  upload: <R = any>(
    payload: FormData,
    config?: AxiosRequestConfig,
  ) => Promise<R>;

  uploadUpdate: <R = any>(
    id: string | number,
    payload: FormData,
    config?: AxiosRequestConfig,
  ) => Promise<R>;
};

/* -----------------------------------------
   Factory
----------------------------------------- */
export const createCrudHelpers = <T = any>(
  basePath: string,
): CrudHelpers<T> => {
  const resource = normalizePath(basePath);
  const exportPageSize = 1000;

  const readPaginatedResource = async (
    url: string,
    config?: AxiosRequestConfig,
  ) => {
    const { data } = await api.get<T[] | PaginatedResponse<T>>(url, config);
    return data;
  };

  const readAllPages = async (config?: AxiosRequestConfig) => {
    const firstPage = await readPaginatedResource(resource, {
      ...config,
      params: {
        ...config?.params,
        page: config?.params?.page ?? 1,
        limit: config?.params?.limit ?? exportPageSize,
        page_size: config?.params?.page_size ?? exportPageSize,
      },
    });

    if (Array.isArray(firstPage)) return firstPage;

    if (
      !firstPage ||
      typeof firstPage !== "object" ||
      !Array.isArray(firstPage.results)
    ) {
      return firstPage as unknown as T[];
    }

    const rows = [...firstPage.results];
    let nextUrl = typeof firstPage.next === "string" ? firstPage.next : null;
    const visited = new Set<string>();

    while (nextUrl && !visited.has(nextUrl)) {
      visited.add(nextUrl);
      const nextPage = await readPaginatedResource(nextUrl, {
        ...config,
        params: undefined,
      });

      if (Array.isArray(nextPage)) {
        rows.push(...nextPage);
        break;
      }

      if (
        !nextPage ||
        typeof nextPage !== "object" ||
        !Array.isArray(nextPage.results)
      ) {
        break;
      }

      rows.push(...nextPage.results);
      nextUrl = typeof nextPage.next === "string" ? nextPage.next : null;
    }

    return rows;
  };

  return {
    /* ---------- READ ---------- */

    readAll: readAllPages,

    readAllForExport: readAllPages,

    readAllwithPaginated: async (page = 1, limit = 5, config) => {
      const { data } = await api.get<PaginatedResponse<T>>(resource, {
        ...config,
        params: {
          page,
          limit,
          ...config?.params,
        },
      });

      return data;
    },

    /* ---------- READ ONE ---------- */

    read: async (path, config) => {
      const isRaw =
        typeof path === "string" && (path.includes("/") || path.includes("?"));

      const url = isRaw ? `${resource}${path}` : `${resource}${path}/`;

      const { data } = await api.get<T>(url, config);
      return data;
    },

    /* ---------- MUTATIONS ---------- */

    create: async (payload, config) => {
      const { data } = await api.post<T>(resource, payload, config);
      return data;
    },

    update: async (id, payload, config) => {
      const { data } = await api.patch<T>(`${resource}${id}/`, payload, config);
      return data;
    },

    delete: async (id, config) => {
      await api.delete(`${resource}${id}/`, config);
    },

    metadata: async (config) => {
      const { data } = await api.options<CrudMetadata>(resource, config);
      return data;
    },

    /* ---------- CUSTOM ACTION ---------- */

    action: async (action, payload, config) => {
      const cleanAction = action.replace(/^\/+/, "");
      const url = `${resource}${cleanAction}${
        cleanAction.endsWith("/") ? "" : "/"
      }`;

      const { data } = payload
        ? await api.post(url, payload, config)
        : await api.get(url, config);

      return data;
    },

    /* ---------- FILE UPLOADS ---------- */

    upload: async (payload, config) => {
      const { data } = await api.post(resource, payload, {
        ...config,
        headers: {
          "Content-Type": "multipart/form-data",
          ...config?.headers,
        },
      });
      return data;
    },

    uploadUpdate: async (id, payload, config) => {
      const { data } = await api.patch(`${resource}${id}/`, payload, {
        ...config,
        headers: {
          "Content-Type": "multipart/form-data",
          ...config?.headers,
        },
      });
      return data;
    },
  };
};
