import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KebabMenuIcon, PencilIcon, TrashBinIcon } from "@/icons";

export type RowActionsMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export type RowActionsMenuProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  extraItems?: RowActionsMenuItem[];
};

const MENU_WIDTH = 150;
const MENU_MARGIN = 4;

export function RowActionsMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  extraItems = [],
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items: RowActionsMenuItem[] = [
    ...(onEdit ? [{ label: editLabel, icon: <PencilIcon className="size-4" />, onClick: onEdit }] : []),
    ...(onDelete
      ? [{ label: deleteLabel, icon: <TrashBinIcon className="size-4" />, onClick: onDelete, danger: true }]
      : []),
    ...extraItems,
  ];

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + MENU_MARGIN,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  return (
    <div className="flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
        aria-label="Row actions"
      >
        <KebabMenuIcon className="size-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed rounded-md border border-gray-200 bg-white py-1 shadow-lg z-[1000]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                title={item.disabled ? item.disabledReason : undefined}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  item.disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : item.danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
