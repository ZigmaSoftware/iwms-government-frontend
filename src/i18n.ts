import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { loadLocale, type LanguageCode } from "@/locales";

export const LANGUAGE_STORAGE_KEY = "iwms.language";

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

const initialLanguage = (() => {
  if (typeof window === "undefined") return "en";
  return normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
})();

const loadedLanguages = new Set<LanguageCode>();

/**
 * Ensures a language's resource bundle is loaded into i18next (fetched via
 * dynamic import() on first use, cached in i18next's own store afterward),
 * then switches to it. Only the initial language ships in the main bundle —
 * see locales/index.ts for why.
 */
export async function ensureLanguageLoaded(lang: LanguageCode) {
  if (!loadedLanguages.has(lang)) {
    const bundle = await loadLocale(lang);
    i18n.addResourceBundle(lang, "translation", bundle.translation, true, true);
    loadedLanguages.add(lang);
  }
}

export async function switchLanguage(lang: LanguageCode) {
  await ensureLanguageLoaded(lang);
  await i18n.changeLanguage(lang);
}

const initialBundle = await loadLocale(initialLanguage);
loadedLanguages.add(initialLanguage);

await i18n.use(initReactI18next).init({
  resources: {
    [initialLanguage]: initialBundle,
  },
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
