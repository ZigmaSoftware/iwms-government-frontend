import { Search } from "lucide-react";
import type { ChangeEventHandler } from "react";

type SearchInputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  className?: string;
};

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className = "",
}: SearchInputProps) {
  return (
    <div
      className={`flex h-[52px] w-full max-w-[346px] items-center gap-4 rounded-md border border-gray-300 bg-white px-4 shadow-md shadow-gray-200/70 ${className}`}
    >
      <Search className="h-5 w-5 shrink-0 text-gray-500" strokeWidth={2} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-500 focus:ring-0"
      />
    </div>
  );
}
