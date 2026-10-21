import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import Swal from "@/lib/notify";

type Result<T> = { request: string; data: T | null; error: number | null };

/** GET `url` whenever `params` change; stale responses are dropped. While a
 * request is in flight the previous data stays on screen. */
export function useDashboardData<T>(url: string, params: Record<string, string>) {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result<T>>({ request: "", data: null, error: null });
  const latest = useRef("");
  const paramsKey = JSON.stringify(params);
  const request = `${url}|${paramsKey}|${reload}`;

  useEffect(() => {
    latest.current = request;
    api
      .get<T>(url, { params: JSON.parse(paramsKey) })
      .then(({ data }) => {
        if (latest.current === request) setResult({ request, data, error: null });
      })
      .catch((err) => {
        if (latest.current !== request) return;
        const status = err?.response?.status ?? 0;
        setResult((prev) => ({ request, data: prev.data, error: status }));
        // 403 is rendered as "no access" by the page.
        if (status !== 403) Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
      });
  }, [url, paramsKey, request, t]);

  return {
    data: result.data,
    error: result.error,
    loading: result.request !== request,
    refresh: () => setReload((n) => n + 1),
  };
}
