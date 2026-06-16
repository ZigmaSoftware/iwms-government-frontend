import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

type DropdownItemProps = {
  children: ReactNode;
  className?: string;
  onItemClick?: () => void;
  tag?: "button" | "a";
  to?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

export function DropdownItem({
  children,
  className,
  onItemClick,
  tag = "button",
  to,
  type = "button",
}: DropdownItemProps) {
  const handleClick = () => {
    onItemClick?.();
  };

  if (to) {
    return (
      <Link to={to} className={clsx(className)} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  if (tag === "a") {
    return (
      <a href="#" className={clsx(className)} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={clsx(className)} onClick={handleClick}>
      {children}
    </button>
  );
}
