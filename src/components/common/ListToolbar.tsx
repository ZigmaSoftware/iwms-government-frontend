import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, FileDown, FileSpreadsheet, FileText, FolderOpen, Loader2, QrCode, SlidersHorizontal, Upload, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* ─────────────────────────────────────────────────────────────────────
   Compact list-page toolbar pieces (first used on Customer Creation; meant
   to be rolled out to every list page):

     <FilterPanel>       "Filters (n)" button → floating panel holding the
                         page's filter fields, with Reset / Apply filters.
                         The panel stays mounted while closed, so fields that
                         keep their own state (HierarchyFilterBar) don't lose it.
     <ActiveFilterChips> "State: Tamil Nadu ✕" chips + Clear all, under the bar.
     <DocumentsMenu>     one "Documents" button → Upload Excel / Download
                         template / Download Excel / Download PDF, with icons.
   ──────────────────────────────────────────────────────────────────── */

/* ---------- Filters ---------- */

export function FilterPanel({
  activeCount,
  onApply,
  onReset,
  children,
  title = "Filters",
  width = 420,
}: {
  /** applied filters — shown as the badge on the button */
  activeCount: number;
  /** commit the panel's draft selection; the panel closes afterwards */
  onApply: () => void;
  /** clear every filter (draft and applied) */
  onReset: () => void;
  children: ReactNode;
  title?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The panel is portalled with fixed coordinates under the button, so the
  // table card's overflow can't clip it (e.g. on an empty table).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const panelWidth = Math.min(width, window.innerWidth - 32);
      const top = r.bottom + 8;
      setPos({
        top,
        left: Math.max(16, Math.min(r.left, window.innerWidth - panelWidth - 16)),
        // fill the space below the button; the fields scroll inside it
        maxHeight: Math.max(240, window.innerHeight - top - 16),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, width]);

  // Close on outside click / Escape. Dropdown lists inside the panel render
  // in portals (Radix select, MultiSelect), so clicks there count as inside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target.closest('[data-radix-popper-content-wrapper], [role="listbox"], [role="dialog"], .p-component-overlay, .fixed.z-\\[100\\]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 ${
          open || activeCount ? "border-green-600" : "border-gray-300 dark:border-gray-700"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4 text-gray-500" />
        {title}
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-700 px-1.5 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* kept mounted (hidden) so field components keep their own state */}
      {createPortal(
        <div
          ref={panelRef}
          hidden={!open}
          role="dialog"
          aria-label={title}
          style={{ width, top: pos?.top, left: pos?.left, maxHeight: pos?.maxHeight }}
          className={`${open ? "flex" : "hidden"} fixed z-50 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900`}
        >
          {/* title and Reset / Apply stay put; only the fields scroll */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close filters">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-1">{children}</div>
          <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <button type="button" onClick={onReset} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200">
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                onApply();
                setOpen(false);
              }}
              className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800"
            >
              Apply filters
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** A labelled group inside FilterPanel ("WASTE", "STATUS" …). */
export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      {children}
    </div>
  );
}

export type ActiveFilterChip = { key: string; label: string; value: string; onRemove?: () => void };

export function ActiveFilterChips({ chips, onClearAll }: { chips: ActiveFilterChip[]; onClearAll: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 py-1 pl-3 pr-1.5 text-xs text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
        >
          <span>
            {c.label}: <b className="font-semibold">{c.value}</b>
          </span>
          {c.onRemove && (
            <button
              type="button"
              onClick={c.onRemove}
              className="rounded-full p-0.5 text-green-700 hover:bg-green-100"
              aria-label={`Remove ${c.label} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="text-xs font-semibold text-blue-700 hover:underline">
        Clear all
      </button>
    </div>
  );
}

/* ---------- Documents ---------- */

export type DocAction = { onClick: () => void; busy?: boolean; disabled?: boolean; hidden?: boolean };

/** The Documents menu's actions; any left out are not shown. */
export type DocumentActions = {
  uploadExcel?: DocAction;
  downloadTemplate?: DocAction;
  downloadExcel?: DocAction;
  downloadPdf?: DocAction;
  /** only on lists whose rows carry QR codes (customers, bins, staff …) */
  downloadQr?: DocAction;
};

export function DocumentsMenu({
  uploadExcel,
  downloadTemplate,
  downloadExcel,
  downloadPdf,
  downloadQr,
  label = "Documents",
}: DocumentActions & { label?: string }) {
  const [open, setOpen] = useState(false);
  const items: Array<{ key: string; text: string; busyText: string; icon: ReactNode; action?: DocAction }> = [
    { key: "upload", text: "Upload Excel", busyText: "Uploading…", icon: <Upload className="h-4 w-4 text-sky-600" />, action: uploadExcel },
    { key: "template", text: "Download template", busyText: "Preparing…", icon: <FileDown className="h-4 w-4 text-gray-500" />, action: downloadTemplate },
    { key: "excel", text: "Download Excel", busyText: "Downloading…", icon: <FileSpreadsheet className="h-4 w-4 text-green-600" />, action: downloadExcel },
    { key: "pdf", text: "Download PDF", busyText: "Generating PDF…", icon: <FileText className="h-4 w-4 text-red-600" />, action: downloadPdf },
    { key: "qr", text: "Download QR", busyText: "Generating QR…", icon: <QrCode className="h-4 w-4 text-violet-600" />, action: downloadQr },
  ];
  const visible = items.filter((i) => i.action && !i.action.hidden);
  if (!visible.length) return null;
  const anyBusy = visible.some((i) => i.action?.busy);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {anyBusy ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <FolderOpen className="h-4 w-4 text-gray-500" />}
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {visible.map((i, idx) => {
          const a = i.action!;
          const prevGroup = idx > 0 && (visible[idx - 1].key === "upload" || visible[idx - 1].key === "template") !== (i.key === "upload" || i.key === "template");
          return (
            <div key={i.key}>
              {prevGroup && <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />}
              <button
                type="button"
                disabled={a.disabled || a.busy}
                onClick={() => {
                  a.onClick();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {a.busy ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : i.icon}
                {a.busy ? i.busyText : i.text}
                {i.key !== "upload" && !a.busy && <Download className="ml-auto h-3.5 w-3.5 text-gray-300" />}
              </button>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
