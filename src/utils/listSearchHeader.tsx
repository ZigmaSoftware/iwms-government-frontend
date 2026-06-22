import type { ChangeEventHandler } from "react";
import SearchInput from "@/components/common/SearchInput";

type ListSearchHeaderOptions = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
};

export function renderListSearchHeader({
  value,
  onChange,
  placeholder,
}: ListSearchHeaderOptions) {
  return (
    <div className="flex items-center justify-end gap-3">
      <SearchInput value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
