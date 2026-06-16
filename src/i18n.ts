import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enResource from "@/locales/en";
import taResource from "@/locales/ta";
import hiResource from "@/locales/hi";

export const LANGUAGE_STORAGE_KEY = "iwms.language";

type LanguageCode = "en" | "ta" | "hi";

const normalizeLanguageCode = (value?: string | null): LanguageCode => {
  if (!value) return "en";
  const lower = value.toLowerCase();
  if (lower.startsWith("ta") || lower.includes("tamil") || value.includes("தமிழ்")) {
    return "ta";
  }
  if (lower.startsWith("hi") || lower.includes("hindi") || value.includes("हिन्दी")) {
    return "hi";
  }
  if (lower.startsWith("en") || lower.includes("english")) {
    return "en";
  }
  return "en";
};

const resources = {
  en: enResource,
  ta: taResource,
  hi: hiResource,
} as const;

const initialLanguage = (() => {
  if (typeof window === "undefined") return "en";
  return normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
})();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "ta", "hi"],
  interpolation: {
    escapeValue: false,
  },
});

if (typeof window !== "undefined") {
  const applyLanguageAttributes = (lng: string) => {
    const normalized = normalizeLanguageCode(lng);
    document.documentElement.lang = normalized;
  };

  applyLanguageAttributes(initialLanguage);
  i18n.on("languageChanged", (lng) => {
    const normalized = normalizeLanguageCode(lng);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    applyLanguageAttributes(normalized);
  });
}

export default i18n;
