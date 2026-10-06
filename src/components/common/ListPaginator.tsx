import { Paginator, type PaginatorProps } from "primereact/paginator";
import { useTranslation } from "react-i18next";

// Standalone paginators aren't always rendered next to a SafeDataTable, so
// load the PrimeReact theme here too (same imports as SafeDataTable).
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import {
  DEFAULT_ROWS_PER_PAGE_OPTIONS,
  PAGE_REPORT_FALLBACK,
  PAGE_REPORT_KEY,
  PAGINATOR_TEMPLATE,
} from "@/components/common/paginatorDefaults";

/** PrimeReact Paginator with the shared list-page layout as defaults. */
export function ListPaginator(props: PaginatorProps) {
  const { t } = useTranslation();
  return (
    <Paginator
      template={PAGINATOR_TEMPLATE}
      currentPageReportTemplate={t(PAGE_REPORT_KEY, PAGE_REPORT_FALLBACK)}
      rowsPerPageOptions={DEFAULT_ROWS_PER_PAGE_OPTIONS}
      {...props}
    />
  );
}
