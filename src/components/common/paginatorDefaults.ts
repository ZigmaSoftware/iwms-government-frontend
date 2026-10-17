// Shared paginator layout for every list page:
//   "1–10 of 115 records   « ‹ 1 2 3 › »   [10 ▾]"
// Applied by default in SafeDataTable; standalone <Paginator>s reuse it too.
export const PAGINATOR_TEMPLATE =
  "CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown";

export const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// i18n key + English fallback for the "1–10 of 115 records" report. The
// {first}/{last}/{totalRecords} placeholders are filled in by PrimeReact.
export const PAGE_REPORT_KEY = "common.page_report";
export const PAGE_REPORT_FALLBACK = "{first}–{last} of {totalRecords} records";
