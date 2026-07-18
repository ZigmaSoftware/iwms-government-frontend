import axios, { type AxiosInstance } from "axios";

/* --------------------------------------------------------
   ENV
-------------------------------------------------------- */
import { API_ROOT } from "../config/configApi";
import { clearAuthSession, refreshAccessToken } from "../utils/authStorage";

const isRemovedScopeKey = (key: string): boolean => {
  const normalized = key.replace(/[^a-z]/gi, "").toLowerCase();
  if (normalized === "company" || normalized === "project") return true;
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

  // On a 401 (dead/expired access token — see JWTUserAuthentication.authenticate_header
  // on the backend for why this is 401 and not 403), try a silent refresh and retry the
  // request once before giving up. Only a failed refresh forces the user back to /auth.
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as
        | (typeof error.config & { _retry?: boolean })
        | undefined;
      const isLogin = originalRequest
        ? opts.loginPathIncludes.some((p) => originalRequest.url?.includes(p))
        : true;
      const isRefreshEndpoint = originalRequest?.url?.includes("refresh-token");

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !isLogin &&
        !isRefreshEndpoint &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();

        if (newToken) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        clearAuthSession();
        if (!window.location.pathname.startsWith("/auth")) {
          window.location.assign("/auth");
        }
      }

      return Promise.reject(error);
    }
  );

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
