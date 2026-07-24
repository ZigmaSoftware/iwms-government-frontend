import type { ReactNode } from "react";

import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
};

interface SelectProps {
  id?: string;
  value?: string | number | null;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function Select({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  className,
  disabled,
  required,
}: SelectProps) {
  const normalizedId = id?.replace(/[^a-z]/gi, "").toLowerCase();
  if (
    normalizedId &&
    (normalizedId === "companyid" ||
      normalizedId === "projectid" ||
      normalizedId === "companyidinput" ||
      normalizedId === "projectidinput")
  ) {
    return null;
  }

  const normalizedValue = value === null || value === undefined ? "" : String(value);
  const finalPlaceholder = placeholder ?? "Select an option";
  const optionValues = options.map((option) => String(option.value));
  let placeholderValue = "__placeholder__";

  while (optionValues.includes(placeholderValue)) {
    placeholderValue = `_${placeholderValue}`;
  }

  const isEmpty = normalizedValue === "";
  const shadValue = isEmpty ? placeholderValue : normalizedValue;

  // Find the label for the currently selected value so the trigger always
  // shows it explicitly. This bypasses Radix's portal-based label mechanism,
  // which fails to display the correct text when the value is set
  // programmatically while SelectContent is rendered into a DocumentFragment
  // (Radix's closed-state optimisation).
  const selectedLabel = isEmpty
    ? null
    : (options.find((o) => String(o.value) === normalizedValue)?.label ?? null);

  return (
    <ShadSelect
      value={shadValue}
      onValueChange={(val) => {
        if (val === placeholderValue) return;
        // Radix's Select.Root can emit a spurious onValueChange("") when a
        // controlled `value` doesn't match any *currently mounted* SelectItem
        // (e.g. the popup was never opened, so items never registered). This
        // component never offers a "clear selection" affordance, so a real
        // user action can never produce an empty value — only this Radix
        // quirk can. Ignore it rather than let it wipe out a valid selection.
        if (val === "") return;
        onChange?.(val);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-required={required}>
        {selectedLabel ? (
          <span className="truncate">{selectedLabel}</span>
        ) : (
          <SelectValue placeholder={finalPlaceholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {isEmpty && (
          <SelectItem value={placeholderValue} disabled>
            {finalPlaceholder}
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadSelect>
  );
}
