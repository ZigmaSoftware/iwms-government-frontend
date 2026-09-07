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
 */

import commonEn from "./common/en";
import commonTa from "./common/ta";
import commonHi from "./common/hi";

import adminSuperadminEn from "./admin/superadmin/en";
import adminSuperadminTa from "./admin/superadmin/ta";
import adminSuperadminHi from "./admin/superadmin/hi";

import adminMastersEn from "./admin/masters/en";
import adminMastersTa from "./admin/masters/ta";
import adminMastersHi from "./admin/masters/hi";

import adminCoreEn from "./admin/coreModules/en";
import adminCoreTa from "./admin/coreModules/ta";
import adminCoreHi from "./admin/coreModules/hi";

import adminReportsEn from "./admin/reports/en";
import adminReportsTa from "./admin/reports/ta";
import adminReportsHi from "./admin/reports/hi";

import dashEn from "./dashboard/dashboard/en";
import dashTa from "./dashboard/dashboard/ta";
import dashHi from "./dashboard/dashboard/hi";

import grievanceEn from "./dashboard/grievance/en";
import grievanceTa from "./dashboard/grievance/ta";
import grievanceHi from "./dashboard/grievance/hi";

import dashReportsEn from "./dashboard/reports/en";
import dashReportsTa from "./dashboard/reports/ta";
import dashReportsHi from "./dashboard/reports/hi";

import weighbridgeEn from "./dashboard/weighbridge/en";
import weighbridgeTa from "./dashboard/weighbridge/ta";
import weighbridgeHi from "./dashboard/weighbridge/hi";

type Part = Record<string, unknown>;

/** Rebuilds { translation: { common, login, dashboard, admin } }. */
const assemble = (common: Part, admin: Part[], dashboard: Part[]) => ({
  translation: {
    ...common,
    dashboard: Object.assign({}, ...dashboard) as Part,
    admin: Object.assign({}, ...admin) as Part,
  },
});

export const en = assemble(
  commonEn,
  [adminSuperadminEn, adminMastersEn, adminCoreEn, adminReportsEn],
  [dashEn, grievanceEn, dashReportsEn, weighbridgeEn],
);

export const ta = assemble(
  commonTa,
  [adminSuperadminTa, adminMastersTa, adminCoreTa, adminReportsTa],
  [dashTa, grievanceTa, dashReportsTa, weighbridgeTa],
);

export const hi = assemble(
  commonHi,
  [adminSuperadminHi, adminMastersHi, adminCoreHi, adminReportsHi],
  [dashHi, grievanceHi, dashReportsHi, weighbridgeHi],
);

export default { en, ta, hi };
