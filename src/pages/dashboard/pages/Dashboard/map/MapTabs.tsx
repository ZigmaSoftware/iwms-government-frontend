import { useTranslation } from "react-i18next";
import { MAP_TABS, type MapTabKey } from "./mapUtils";

type MapTabsProps = {
  activeKey: MapTabKey;
  onChange: (key: MapTabKey) => void;
};

const MapTabButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-100/10 dark:text-gray-100"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    }`}
  >
    {label}
  </button>
);

export function MapTabs({ activeKey, onChange }: MapTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800">
      {MAP_TABS.map((tab) => (
        <MapTabButton
          key={tab.key}
          label={t(tab.labelKey)}
          active={activeKey === tab.key}
          onClick={() => onChange(tab.key)}
        />
      ))}
    </div>
  );
}
