import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { capitalize } from "@/utils/capitalize";

type MultiSelectChangeEvent = {
  value: unknown[];
};

type MultiSelectProps = {
  value?: unknown[] | null;
  onChange?: (event: MultiSelectChangeEvent) => void;
  options?: readonly unknown[];
  optionLabel?: string;
  optionValue?: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  filter?: boolean;
  maxSelectedLabels?: number;
  selectionLimit?: number;
  inputId?: string;
  id?: string;
  className?: string;
  pt?: unknown;
  "aria-label"?: string;
  ariaLabel?: string;
};

const readField = (item: unknown, path?: string): unknown => {
  if (!path || !item || typeof item !== "object") return item;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, item);
};

const toSearchText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return "";
};

const comparableValue = (value: unknown, optionValue?: string): string => {
  const resolved =
    optionValue && value && typeof value === "object"
      ? readField(value, optionValue)
      : value;
  return String(resolved ?? "");
};

export function MultiSelect({
  value = [],
  onChange,
  options = [],
  optionLabel = "label",
  optionValue,
  placeholder = "Select options",
  disabled = false,
  filter = true,
  maxSelectedLabels = 3,
  selectionLimit,
  inputId,
  id,
  "aria-label": ariaLabelAttribute,
  ariaLabel,
}: MultiSelectProps) {
  const generatedId = useId();
  const controlId = inputId ?? id ?? `multi-select-${generatedId}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPosition, setPanelPosition] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : []),
    [value],
  );
  const isOpen = open && !disabled;

  const normalizedOptions = useMemo(
    () =>
      options.map((option, index) => {
        const rawValue = optionValue ? readField(option, optionValue) : option;
        const rawLabel = readField(option, optionLabel);
        const displayValue = rawLabel ?? rawValue;
        return {
          option,
          rawValue,
          label:
            typeof displayValue === "string" || typeof displayValue === "number"
              ? capitalize(displayValue)
              : ((displayValue ?? "") as ReactNode),
          searchText: toSearchText(displayValue).toLowerCase(),
          key: `${comparableValue(rawValue)}-${index}`,
        };
      }),
    [optionLabel, optionValue, options],
  );

  const selectedKeys = useMemo(
    () =>
      new Set(selectedValues.map((item) => comparableValue(item, optionValue))),
    [optionValue, selectedValues],
  );
  const selectedOptions = useMemo(
    () =>
      normalizedOptions.filter((option) =>
        selectedKeys.has(comparableValue(option.rawValue)),
      ),
    [normalizedOptions, selectedKeys],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return normalizedOptions;
    return normalizedOptions.filter((option) =>
      option.searchText.includes(normalizedQuery),
    );
  }, [normalizedOptions, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    const closeOnViewportChange = () => {
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange);
    };
  }, []);

  const emit = (nextValue: unknown[]) => onChange?.({ value: nextValue });

  const toggle = (rawValue: unknown) => {
    const key = comparableValue(rawValue);
    if (selectedKeys.has(key)) {
      emit(
        selectedValues.filter(
          (item) => comparableValue(item, optionValue) !== key,
        ),
      );
      return;
    }
    if (selectionLimit && selectedValues.length >= selectionLimit) return;
    emit([...selectedValues, rawValue]);
  };

  const allValues = normalizedOptions
    .slice(0, selectionLimit ?? normalizedOptions.length)
    .map((option) =>
      rawValueForOutput(option.option, option.rawValue, optionValue),
    );

  const visibleLabels = selectedOptions.slice(
    0,
    Math.max(1, maxSelectedLabels),
  );
  const hiddenCount = selectedOptions.length - visibleLabels.length;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            setQuery("");
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            const viewportPadding = 16;
            const panelWidth = Math.min(
              Math.max(rect.width, 280),
              window.innerWidth - viewportPadding * 2,
            );
            const left = Math.min(
              Math.max(rect.left, viewportPadding),
              window.innerWidth - panelWidth - viewportPadding,
            );
            const estimatedPanelHeight = filter ? 340 : 292;
            const openAbove =
              window.innerHeight - rect.bottom < estimatedPanelHeight &&
              rect.top > window.innerHeight - rect.bottom;
            setPanelPosition({
              left,
              width: panelWidth,
              ...(openAbove
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
            });
          }
          setOpen(true);
        }}
        disabled={disabled}
        aria-label={ariaLabelAttribute ?? ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm shadow-sm outline-none transition-all ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : isOpen
              ? "border-teal-500 bg-white ring-2 ring-teal-500/15"
              : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selectedOptions.length
              ? "font-medium text-slate-800"
              : "text-slate-400"
          }`}
        >
          {selectedOptions.length === 0 ? (
            placeholder
          ) : (
            <>
              {visibleLabels.map((option, index) => (
                <span key={option.key}>
                  {index > 0 ? ", " : ""}
                  {option.label}
                </span>
              ))}
              {hiddenCount > 0 ? ` +${hiddenCount}` : ""}
            </>
          )}
        </span>
        {selectedOptions.length > 1 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 px-1.5 text-[10px] font-bold text-teal-700">
            {selectedOptions.length}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180 text-teal-600" : "text-slate-400"
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={panelPosition}
            className="fixed z-[100] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-12px_rgba(15,23,42,0.28)]"
          >
            <div className="border-b border-slate-100 p-3">
              {filter && (
                <div className="flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3">
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search options..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                      className="text-slate-400 transition-colors hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div
                className={`${filter ? "mt-2" : ""} flex items-center justify-between px-1 text-[10px]`}
              >
                <span className="font-medium text-slate-400">
                  {selectedOptions.length} of {normalizedOptions.length}{" "}
                  selected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => emit(allValues)}
                    disabled={
                      normalizedOptions.length === 0 ||
                      selectedOptions.length === allValues.length
                    }
                    className="font-bold text-teal-700 transition-colors hover:text-teal-900 disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => emit([])}
                    disabled={!selectedValues.length}
                    className="font-bold text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div
              role="listbox"
              aria-multiselectable="true"
              aria-labelledby={controlId}
              className="max-h-60 overflow-y-auto p-2"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-400">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const key = comparableValue(option.rawValue);
                  const checked = selectedKeys.has(key);
                  const atLimit =
                    !checked &&
                    Boolean(
                      selectionLimit && selectedValues.length >= selectionLimit,
                    );
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      key={option.key}
                      onClick={() =>
                        toggle(
                          rawValueForOutput(
                            option.option,
                            option.rawValue,
                            optionValue,
                          ),
                        )
                      }
                      disabled={atLimit}
                      className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition-colors last:mb-0 ${
                        checked
                          ? "bg-teal-50 font-semibold text-teal-900"
                          : "text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const rawValueForOutput = (
  option: unknown,
  rawValue: unknown,
  optionValue?: string,
): unknown => (optionValue ? rawValue : option);

export default MultiSelect;
