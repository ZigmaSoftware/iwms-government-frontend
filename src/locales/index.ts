/**
 * Locale resources, assembled from per-module files.
 *
 * The translations used to live in three ~2,000-line files (en/ta/hi). They
 * are now split by the module they belong to, mirroring the admin sidebar —
 * same convention as the sibling private repo's `locales/`:
 *
 *   locales/
 *     common/                 shared strings + login
 *     admin/superadmin/       Super Admin (also holds the full admin.nav
 *                             dictionary — see note below)
 *     admin/masters/          Masters
 *     admin/coreModules/      Core Modules
 *     admin/reports/          Reports
 *     dashboard/dashboard/    Dashboard
 *     dashboard/grievance/    Grievance
 *     dashboard/reports/      Reports
 *     dashboard/weighbridge/  Weighbridge
 *
 * Each folder holds one file per language, so a module's three translations
 * sit side by side and a missing one is obvious (this split also caught and
 * backfilled a real pre-existing gap: `admin.staff_audit` had no Tamil/Hindi
 * entry at all before this refactor).
 *
 * IMPORTANT: translation KEYS are unchanged. This merges the pieces back
 * into exactly the shape i18n received before, so every existing
 * t("admin.staff_template.list_title") keeps working — the split is purely
 * file organisation. Verified by reassembling and deep-comparing against the
 * original monolithic files before this was committed.
 *
 * `admin.nav` is NOT split across the 4 admin group files — the merge below
 * is a shallow `Object.assign`, which would silently clobber `nav` down to
 * whichever file's copy assembled last if more than one defined it. It lives
 * whole inside admin/superadmin/, same as the private repo's own convention.
 *
 * Each language's files are behind a dynamic import() (one static entry
 * point per language, per Vite's requirement that code-split import()
 * targets be literal) so only the active language ships in the initial
 * bundle; the other two are fetched on demand when the user switches.
 */

export type LanguageCode = "en" | "ta" | "hi";

type Part = Record<string, unknown>;

/** Rebuilds { translation: { common, login, dashboard, admin } }. */
const assemble = (common: Part, admin: Part[], dashboard: Part[]) => ({
  translation: {
    ...common,
    dashboard: Object.assign({}, ...dashboard) as Part,
    admin: Object.assign({}, ...admin) as Part,
  },
});

async function loadEn() {
  const [
    commonEn,
    adminSuperadminEn,
    adminMastersEn,
    adminCoreEn,
    adminReportsEn,
    dashEn,
    grievanceEn,
    dashReportsEn,
    weighbridgeEn,
  ] = await Promise.all([
    import("./common/en").then((m) => m.default),
    import("./admin/superadmin/en").then((m) => m.default),
    import("./admin/masters/en").then((m) => m.default),
    import("./admin/coreModules/en").then((m) => m.default),
    import("./admin/reports/en").then((m) => m.default),
    import("./dashboard/dashboard/en").then((m) => m.default),
    import("./dashboard/grievance/en").then((m) => m.default),
    import("./dashboard/reports/en").then((m) => m.default),
    import("./dashboard/weighbridge/en").then((m) => m.default),
  ]);

  return assemble(
    commonEn,
    [adminSuperadminEn, adminMastersEn, adminCoreEn, adminReportsEn],
    [dashEn, grievanceEn, dashReportsEn, weighbridgeEn],
  );
}

async function loadTa() {
  const [
    commonTa,
    adminSuperadminTa,
    adminMastersTa,
    adminCoreTa,
    adminReportsTa,
    dashTa,
    grievanceTa,
    dashReportsTa,
    weighbridgeTa,
  ] = await Promise.all([
    import("./common/ta").then((m) => m.default),
    import("./admin/superadmin/ta").then((m) => m.default),
    import("./admin/masters/ta").then((m) => m.default),
    import("./admin/coreModules/ta").then((m) => m.default),
    import("./admin/reports/ta").then((m) => m.default),
    import("./dashboard/dashboard/ta").then((m) => m.default),
    import("./dashboard/grievance/ta").then((m) => m.default),
    import("./dashboard/reports/ta").then((m) => m.default),
    import("./dashboard/weighbridge/ta").then((m) => m.default),
  ]);

  return assemble(
    commonTa,
    [adminSuperadminTa, adminMastersTa, adminCoreTa, adminReportsTa],
    [dashTa, grievanceTa, dashReportsTa, weighbridgeTa],
  );
}

async function loadHi() {
  const [
    commonHi,
    adminSuperadminHi,
    adminMastersHi,
    adminCoreHi,
    adminReportsHi,
    dashHi,
    grievanceHi,
    dashReportsHi,
    weighbridgeHi,
  ] = await Promise.all([
    import("./common/hi").then((m) => m.default),
    import("./admin/superadmin/hi").then((m) => m.default),
    import("./admin/masters/hi").then((m) => m.default),
    import("./admin/coreModules/hi").then((m) => m.default),
    import("./admin/reports/hi").then((m) => m.default),
    import("./dashboard/dashboard/hi").then((m) => m.default),
    import("./dashboard/grievance/hi").then((m) => m.default),
    import("./dashboard/reports/hi").then((m) => m.default),
    import("./dashboard/weighbridge/hi").then((m) => m.default),
  ]);

  return assemble(
    commonHi,
    [adminSuperadminHi, adminMastersHi, adminCoreHi, adminReportsHi],
    [dashHi, grievanceHi, dashReportsHi, weighbridgeHi],
  );
}

/** Dynamically loads one language's assembled resource bundle. */
export function loadLocale(lang: LanguageCode) {
  switch (lang) {
    case "ta":
      return loadTa();
    case "hi":
      return loadHi();
    case "en":
    default:
      return loadEn();
  }
}
