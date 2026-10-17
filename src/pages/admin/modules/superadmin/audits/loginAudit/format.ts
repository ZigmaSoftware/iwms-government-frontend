export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

export const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Version\/(\d+).*Safari\//, "Safari"],
  [/(Dart|okhttp)/i, "Mobile app"],
];
const OPERATING_SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

// "Chrome 155 · Linux" instead of the full user-agent string (the full
// string is in the cell tooltip and the detail modal).
export const shortUserAgent = (ua?: string | null) => {
  if (!ua) return "-";
  let browser: string | null = null;
  for (const [pattern, name] of BROWSERS) {
    const match = ua.match(pattern);
    if (match) {
      browser = /^\d+$/.test(match[1] ?? "") ? `${name} ${match[1]}` : name;
      break;
    }
  }
  const os = OPERATING_SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  if (!browser && !os) return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
  return [browser, os].filter(Boolean).join(" · ");
};

// "panchayat_leader" -> "Panchayat Leader"
export const formatModuleName = (value?: string | null) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};
