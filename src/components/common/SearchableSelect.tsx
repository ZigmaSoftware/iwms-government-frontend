import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableOption = {
  value: string;
  /** Text shown in the trigger + the list row. */
  label: string;
  /** Extra string included in fuzzy search but not necessarily displayed. */
  keywords?: string;
  /** Optional left indentation (e.g. tree depth) in rem-ish px. */
  depth?: number;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * A type-to-filter single-select combobox. Drop-in replacement for a plain
 * <Select> when the option list is long (hundreds of geo nodes, thousands of
 * staff/customers). Built on the project's existing Command + Popover ui.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  disabled = false,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading ? "Loading…" : selected ? selected.label.trim() : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue is the option's `value`; match against label+keywords.
            const opt = options.find((o) => o.value === itemValue);
            const hay = `${opt?.label ?? ""} ${opt?.keywords ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(v) => {
                    onChange(v === value ? "" : v);
                    setOpen(false);
                  }}
                  style={opt.depth ? { paddingLeft: `${0.5 + opt.depth * 0.85}rem` } : undefined}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      opt.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{opt.label.trim()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
