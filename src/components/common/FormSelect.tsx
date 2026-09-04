import { useMemo, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT } from "@/components/common/controlSizing";

/** Radix forbids an empty item value, so the placeholder row uses this. */
const EMPTY_VALUE = "__empty__";

export type FormSelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export interface FormSelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: FormSelectOption[];

  /** Field caption. Omit to render the control on its own. */
  label?: ReactNode;
  /** Adds the red asterisk and turns on the empty/filled border colouring. */
  required?: boolean;
  /** Placeholder row text. Pass null to omit the row entirely. */
  placeholder?: string | null;

  id?: string;
  name?: string;
  disabled?: boolean;
  /** Explicit error message; overrides the required-but-empty styling. */
  error?: string;
  helpText?: ReactNode;
  className?: string;
  triggerClassName?: string;
  /**
   * Full-width (default) suits entry-form fields, which stack in a grid.
   * Pass false for toolbar/filter dropdowns that should size to their own
   * width instead of stretching across the bar.
   */
  fullWidth?: boolean;
  /**
   * Show a search box above the options.
   *
   * On by default: these dropdowns are fed from master tables (customers,
   * categories, teams, wards) that routinely run to hundreds of rows, and
   * scrolling those to find one entry is the slowest part of filling a form.
   * Pass false for a genuinely short, fixed list (a 3-option status, say)
   * where a search box is just noise.
   */
  searchable?: boolean;
}

export function FormSelect({
  value,
  onChange,
  options,
  label,
  required = false,
  placeholder,
  id,
  name,
  disabled = false,
  error,
  helpText,
  className,
  triggerClassName,
  fullWidth = true,
  searchable = true,
}: FormSelectProps) {
  // Radix treats "" as "no selection", so the trigger falls back to the
  // placeholder automatically when the form state is empty.
  const selected = value ? String(value) : "";

  const showPlaceholderRow = placeholder !== null;
  const placeholderText = placeholder ?? "";

  // A value that isn't in `options` (e.g. options still loading on an edit
  // form) would otherwise render a blank trigger. Keep it selectable so the
  // field doesn't silently appear empty and get resubmitted as cleared.
  const resolvedOptions = useMemo(() => {
    if (!selected) return options;
    return options.some((o) => String(o.value) === selected)
      ? options
      : [...options, { label: selected, value: selected }];
  }, [options, selected]);

  const isEmpty = !selected;
  const hasError = Boolean(error) || (required && isEmpty);

  return (
    <div className={cn(fullWidth && "w-full", className)}>
      {label ? (
        <Label htmlFor={id} className="mb-1 block">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </Label>
      ) : null}

      <Select
        value={selected || undefined}
        onValueChange={(next) => onChange(next === EMPTY_VALUE ? "" : next)}
        disabled={disabled || options.length === 0}
        name={name}
      >
        <SelectTrigger
          id={id}
          aria-invalid={hasError || undefined}
          aria-required={required || undefined}
          className={cn(
            fullWidth && "w-full",
            CONTROL_HEIGHT,
            "rounded-sm focus:ring-2 focus:ring-offset-0",
            // Mirrors the red-while-empty / green-once-filled convention the
            // native selects used, so validation reads the same as before.
            required
              ? hasError
                ? "border-red-400 focus:ring-red-200"
                : "border-green-400 focus:ring-green-200"
              : "focus:ring-green-200",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholderText} />
        </SelectTrigger>

        {/* The search box is rendered by `SelectContent` itself (see
            components/ui/select.tsx), so every Select in the app gets one
            without its call sites changing. `searchable` just forwards the
            caller's opt-out. */}
        <SelectContent searchable={searchable}>
          {showPlaceholderRow ? (
            <SelectItem value={EMPTY_VALUE}>{placeholderText}</SelectItem>
          ) : null}
          {resolvedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={String(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : helpText ? (
        <p className="mt-1 text-xs text-gray-400">{helpText}</p>
      ) : null}
    </div>
  );
}

export default FormSelect;
