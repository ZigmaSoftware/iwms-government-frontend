import type { AxiosInstance } from "axios";
import { api } from "./index";

const attachAuthInterceptor = (api: AxiosInstance) => {
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("access_token");

      // Robust login detection
      const isLoginRequest = config.url?.includes("login-user");

      if (token && !isLoginRequest) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );
};

// Attach once per instance
attachAuthInterceptor(api);
