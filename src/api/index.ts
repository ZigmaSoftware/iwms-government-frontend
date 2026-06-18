import axios, { type AxiosInstance } from "axios";

/* --------------------------------------------------------
   ENV
-------------------------------------------------------- */
const IS_PROD = import.meta.env.VITE_PROD === "true";
const API_ROOT = IS_PROD
  ? import.meta.env.VITE_API_PROD
  : import.meta.env.VITE_API_LOCAL;

const isRemovedScopeKey = (key: string): boolean => {
  const normalized = key.replace(/[^a-z]/gi, "").toLowerCase();
  return (
    (normalized.startsWith("company") || normalized.startsWith("project")) &&
    (normalized.endsWith("id") || normalized.endsWith("uniqueid") || normalized.endsWith("idinput"))
  );
};

const stripTenancyKeys = <T>(value: T): T => {
  if (!value || typeof value !== "object") return value;

  if (value instanceof FormData) {
    Array.from(value.keys()).forEach((key) => {
      if (isRemovedScopeKey(key)) value.delete(key);
    });
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripTenancyKeys(item)) as T;
  }

  const cleaned: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (isRemovedScopeKey(key)) return;
    cleaned[key] = stripTenancyKeys(item);
  });
  return cleaned as T;
};

/* --------------------------------------------------------
   CREATE INSTANCE
-------------------------------------------------------- */
type CreateApiOptions = {
  tokenStorageKey: string;
  loginPathIncludes: string[];
};

const createApi = (opts: CreateApiOptions): AxiosInstance => {
  const api = axios.create({
    baseURL: API_ROOT, // no desktop/mobile
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem(opts.tokenStorageKey);

    const isLogin = opts.loginPathIncludes.some((p) =>
      config.url?.includes(p)
    );

    if (token && !isLogin) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.params = stripTenancyKeys(config.params);
    config.data = stripTenancyKeys(config.data);
    return config;
  });

  return api;
};

/* --------------------------------------------------------
   EXPORT SINGLE API
-------------------------------------------------------- */
export const api = createApi({
  tokenStorageKey: "access_token",
  loginPathIncludes: ["/login/"],
});

// Debug: expose base URL for troubleshooting (prints once on module load)
// eslint-disable-next-line no-console
console.debug("[api] API_ROOT", { API_ROOT });
