const DATA_KEYS = [
  "data",
  "date_wise_data",
  "day_wise_data",
  "records",
  "result",
  "payload",
  "rows",
  "items",
] as const;

const API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";

const RAW_PROXY_TEMPLATES = "";

const DEFAULT_PROXY_TEMPLATES = [
  "https://cors.isomorphic-git.org/{url}",
  "https://thingproxy.freeboard.io/fetch/{url}",
  "https://corsproxy.io/?",
];

export type WasteReportAction = "date_wise_data" | "day_wise_data";

export type WasteApiRow = {
  date: string;
  Start_Time?: string | null;
  End_Time?: string | null;
  total_trip?: number;
  dry_weight?: number;
  wet_weight?: number;
  mix_weight?: number;
  total_net_weight?: number;
  average_weight_per_trip?: number;
  [key: string]: any;
};

export type WasteFetchResult<T = WasteApiRow> = {
  rows: T[];
  message?: string;
};

const pickMessage = (payload: any): string | undefined => {
  const candidates = [
    payload?.message,
    payload?.msg,
    payload?.statusMessage,
    payload?.responseMessage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
};

const findArray = (node: any): any[] | null => {
  if (Array.isArray(node)) return node;
  if (!node || typeof node !== "object") return null;

  for (const key of DATA_KEYS) {
    if (key in node) {
      const found = findArray(node[key]);
      if (found) return found;
    }
  }

  return null;
};

const parseProxyTemplates = (): string[] => {
  const fromEnv = RAW_PROXY_TEMPLATES.split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_PROXY_TEMPLATES;
};

const formatProxyUrl = (template: string, target: string): string => {
  const encoded = encodeURIComponent(target);
  if (/\{url\}/i.test(template)) {
    return template.replace(/\{url\}/gi, encoded);
  }

  if (template.endsWith("?") || template.endsWith("&")) {
    return `${template}${encoded}`;
  }

  if (template.includes("?")) {
    return `${template}&url=${encoded}`;
  }

  return `${template}${encoded}`;
};

const buildProxyUrls = (target: string): string[] => {
  return parseProxyTemplates().map((template) =>
    formatProxyUrl(template, target)
  );
};

const fetchWithFallback = async (url: string): Promise<string> => {
  const attempt = async (endpoint: string): Promise<string> => {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const raw = await response.text();

    if (!response.ok) {
      const snippet = raw.slice(0, 200);
      const err = new Error(`HTTP ${response.status}: ${snippet}`);
      (err as any).status = response.status;
      throw err;
    }

    return raw;
  };

  let lastError: unknown;

  try {
    return await attempt(url);
  } catch (error) {
    lastError = error;
  }

  for (const proxiedUrl of buildProxyUrls(url)) {
    try {
      console.warn("Waste report request failed, retrying via proxy.", lastError);
      return await attempt(proxiedUrl);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(
    typeof lastError === "string"
      ? lastError
      : "Unknown error fetching waste report."
  );
};

export async function fetchWasteReport<T = WasteApiRow>(
  apiUrl: string,
  action: WasteReportAction,
  fromDate: string,
  toDate: string
): Promise<WasteFetchResult<T>> {
  if (!apiUrl) return { rows: [] };

  const params = new URLSearchParams({
    action,
    from_date: fromDate,
    to_date: toDate,
    key: API_KEY,
  });

  const url = `${apiUrl}?${params.toString()}`;
  const raw = await fetchWithFallback(url);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON response: ${raw.slice(0, 200)}`);
  }

  if (payload?.status === false || payload?.success === false) {
    const message = pickMessage(payload) ?? "API rejected the request.";
    throw new Error(message);
  }

  const rows = (findArray(payload) ?? []) as T[];
  const message = pickMessage(payload);

  return { rows, message };
}
