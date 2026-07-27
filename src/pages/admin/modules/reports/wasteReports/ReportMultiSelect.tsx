import { MultiSelect } from "@/components/form/MultiSelect";

export type ReportMultiSelectOption = {
  value: string;
  label: string;
};

type ReportMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: ReportMultiSelectOption[];
  placeholder: string;
  disabled?: boolean;
  ariaLabel: string;
};

export default function ReportMultiSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  ariaLabel,
}: ReportMultiSelectProps) {
  return (
    <MultiSelect
      value={value}
      onChange={(event) => onChange(event.value.map(String))}
      options={options}
      optionLabel="label"
      optionValue="value"
      maxSelectedLabels={1}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      filter
    />
  );
}
