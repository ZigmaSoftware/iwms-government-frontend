import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

/**
 * Searchable multi-select combobox, styled to match the single-select
 * `Select` (components/ui/select.tsx) — same Popover + Command shell,
 * checkmark, and accent-highlighted rows — but keeps the popover open and
 * accumulates values instead of closing on the first pick.
 */

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Max chips shown in the trigger before collapsing to "+N selected". */
  maxDisplayed?: number;
  "aria-label"?: string;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Select...",
      searchPlaceholder = "Search…",
      emptyText = "No matches",
      disabled,
      className,
      triggerClassName,
      maxDisplayed = 2,
      "aria-label": ariaLabel,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);

    const selectedSet = React.useMemo(() => new Set(value), [value]);
    const selectedOptions = React.useMemo(
      () => options.filter((o) => selectedSet.has(o.value)),
      [options, selectedSet],
    );

    const toggle = (optionValue: string) => {
      if (selectedSet.has(optionValue)) {
        onChange(value.filter((v) => v !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    };

    const clearOne = (e: React.MouseEvent, optionValue: string) => {
      e.stopPropagation();
      onChange(value.filter((v) => v !== optionValue));
    };

    const clearAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    };

    const visible = selectedOptions.slice(0, maxDisplayed);
    const hiddenCount = selectedOptions.length - visible.length;

    return (
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              "flex min-h-10 w-full items-start justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
              triggerClassName,
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {selectedOptions.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {visible.map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="gap-1 pr-1 font-normal"
                    >
                      <span className="max-w-[140px] truncate">{option.label}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => clearOne(e, option.value)}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </Badge>
                  ))}
                  {hiddenCount > 0 && (
                    <Badge variant="secondary" className="font-normal">
                      +{hiddenCount} more
                    </Badge>
                  )}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 self-center">
              {selectedOptions.length > 0 && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={clearAll}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                  aria-label="Clear all"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
          <Command
            filter={(itemValue, search) => {
              const item = options.find((o) => o.value === itemValue);
              const text = (item?.label ?? itemValue).toLowerCase();
              return text.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = selectedSet.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={() => toggle(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
MultiSelect.displayName = "MultiSelect";

export default MultiSelect;
