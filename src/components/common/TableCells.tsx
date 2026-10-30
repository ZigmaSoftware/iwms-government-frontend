import type { ReactNode } from "react";

/** A secondary line under the main value: plain content, or with an icon / label. */
export type StackLine =
  | ReactNode
  | { value: ReactNode; icon?: string; label?: string; title?: string };

// Pages often pre-fill missing values with "-" / "—"; treat those as empty.
const isBlank = (value: ReactNode) =>
  value === null ||
  value === undefined ||
  value === false ||
  (typeof value === "string" && ["", "-", "—"].includes(value.trim())) ||
  (Array.isArray(value) && value.length === 0);

const isDetailed = (
  line: StackLine,
): line is { value: ReactNode; icon?: string; label?: string; title?: string } =>
  typeof line === "object" &&
  line !== null &&
  !Array.isArray(line) &&
  "value" in line;

/**
 * Several related fields in one table cell (e.g. name + code + phone), the
 * way Daily Trip Logs does it, so list tables fit the page without a
 * horizontal scroll. Pair it with `<DataTable fitWidth>` and percentage
 * column widths. Blank lines are skipped; an all-blank cell shows "—".
 */
export function StackCell({
  primary,
  lines = [],
}: {
  primary?: ReactNode;
  lines?: StackLine[];
}) {
  const visible = lines.filter(
    (line) => !isBlank(isDetailed(line) ? line.value : (line as ReactNode)),
  );
  if (isBlank(primary) && visible.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div className="min-w-0 space-y-0.5">
      {!isBlank(primary) && (
        <div className="break-words text-sm font-semibold text-gray-900">
          {primary}
        </div>
      )}
      {visible.map((line, index) =>
        isDetailed(line) ? (
          <div
            key={index}
            className="flex min-w-0 flex-wrap items-center gap-x-1 break-words text-xs text-gray-600"
            title={line.title}
          >
            {line.icon && (
              <i className={`pi ${line.icon} text-[10px] text-gray-400`} />
            )}
            {line.label && <span className="text-gray-500">{line.label}:</span>}
            {line.value}
          </div>
        ) : (
          <div key={index} className="break-words text-xs text-gray-600">
            {line as ReactNode}
          </div>
        ),
      )}
    </div>
  );
}
