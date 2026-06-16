import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";

type DropdownProps = {
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
};

export function Dropdown({ isOpen, onClose, className, children }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={containerRef} className={clsx(className)}>
      {children}
    </div>
  );
}
