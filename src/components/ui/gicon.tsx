type GIconProps = {
  name: string;       // e.g. "dashboard", "map", "settings"
  className?: string;
};

export function GIcon({ name, className = "" }: GIconProps) {
  return (
    <span className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}
