import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * ListPageHeader
 * ==============
 * The standard header for admin list pages, so every module reads the same
 * way instead of each page arranging its own flex row.
 *
 * Layout, top to bottom:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ Title / subtitle              [Add] [action]│  ← titleRow
 *   ├─────────────────────────────────────────────┤
 *   │ [Search] [Status] [Company] [Project] …     │  ← filters
 *   └─────────────────────────────────────────────┘
 *
 * Why this exists: SafeDataTable renders a page's `header` inside a flex
 * row next to its own Excel buttons (Download Template / Upload Excel /
 * Download All Excel). A page header that is itself a wide flex row gets
 * squeezed into a narrow column there — which is what collapsed titles to
 * one word per line and let the buttons overlap.
 *
 * Two rules keep that from happening, and both are easy to miss by hand:
 *   - `min-w-0` on the title cell, so a long title can shrink and wrap
 *     normally instead of forcing the row wider than its container.
 *   - `flex-wrap` on the row, so actions drop to the next line rather than
 *     colliding once space runs out.
 *
 * Actions belong in `actions` (Add / Create, and page-specific buttons).
 * The Excel buttons are NOT passed here — SafeDataTable owns those and
 * renders them alongside this header.
 */
export interface ListPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Primary buttons — "Add", "Create", and any page-specific action. */
  actions?: ReactNode;
  /** The filter row: search box, status, company/project dropdowns. */
  filters?: ReactNode;
  className?: string;
}

export function ListPageHeader({
  title,
  subtitle,
  actions,
  filters,
  className,
}: ListPageHeaderProps) {
  return (
    // iwms-list-header lets index.css pin PrimeReact buttons in this row
    // to the same height as the search box and dropdowns.
    <div className={cn("iwms-list-header flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        {/* min-w-0 lets the title wrap instead of forcing the row to overflow. */}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {filters ? <div className="min-w-0">{filters}</div> : null}
    </div>
  );
}

export default ListPageHeader;
