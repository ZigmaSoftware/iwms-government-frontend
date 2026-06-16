import axios, { type AxiosInstance } from "axios";

/* --------------------------------------------------------
   ENV
-------------------------------------------------------- */
const IS_PROD = import.meta.env.VITE_PROD === "true";
const API_ROOT = IS_PROD
  ? import.meta.env.VITE_API_PROD
  : import.meta.env.VITE_API_LOCAL;

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
