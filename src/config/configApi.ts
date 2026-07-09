const ENV = import.meta.env.VITE_ENV;

const API_MAP = {
  local: import.meta.env.VITE_API_LOCAL,
  uat: import.meta.env.VITE_API_UAT,
  prod: import.meta.env.VITE_API_PROD,
};

export const API_ROOT =
  API_MAP[ENV as keyof typeof API_MAP] || API_MAP.local;