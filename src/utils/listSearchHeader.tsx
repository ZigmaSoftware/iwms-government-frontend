import type { ChangeEventHandler } from "react";
import { InputText } from "primereact/inputtext";

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
      <div className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-1 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="p-inputtext-sm !border-0 !shadow-none !outline-none"
        />
      </div>
    </div>
  );
}
