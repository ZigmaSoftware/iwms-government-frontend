import { Fragment, type ReactNode } from "react";
import { Column, type ColumnProps } from "primereact/column";

/** One level of the location hierarchy shown inside the Location column. */
export type LocationLevel<T> = {
  label: string;
  value: (row: T) => ReactNode;
};

// Pages often pre-fill missing names with "-" / "—"; treat those as empty.
const isBlank = (value: ReactNode) =>
  value === null ||
  value === undefined ||
  value === false ||
  (typeof value === "string" && ["", "-", "—"].includes(value.trim())) ||
  (Array.isArray(value) && value.length === 0);

/**
 * Stacks a row's location levels (State, District, ... Ward) as label/value
 * pairs in one cell, skipping the levels that row doesn't have.
 */
const renderLocationCell = (items: { label: string; value: ReactNode }[]) => {
  const present = items.filter((item) => !isBlank(item.value));
  if (present.length === 0) return <span>-</span>;

  return (
    <dl className="grid min-w-0 grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5">
      {present.map((item) => (
        <Fragment key={item.label}>
          <dt className="max-w-24 break-words text-xs text-gray-500">{item.label}</dt>
          <dd className="min-w-0 break-words text-sm">{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
};

/**
 * A single "Location" column replacing separate State/District/City/Zone/
 * Ward/... columns, so list tables don't need to scroll sideways. Levels
 * hidden by column visibility can be passed as `false` (e.g.
 * `showCol("zone_name") && {...}`); returns null when none are left. Must be
 * called as a function, not rendered as a component — DataTable only reads
 * direct <Column> children.
 */
export const locationColumn = <T,>({
  levels: maybeLevels,
  ...columnProps
}: { levels: (LocationLevel<T> | false)[] } & ColumnProps) => {
  const levels = maybeLevels.filter(
    (level): level is LocationLevel<T> => level !== false,
  );
  return levels.length === 0 ? null : (
    <Column
      key="location"
      body={(row: T) =>
        renderLocationCell(
          levels.map((level) => ({ label: level.label, value: level.value(row) })),
        )
      }
      style={{ minWidth: 200 }}
      {...columnProps}
    />
  );
};
