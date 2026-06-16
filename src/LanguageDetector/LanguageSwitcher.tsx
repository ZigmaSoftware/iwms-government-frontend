import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { GIcon } from "../components/ui/gicon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { cn } from "@/lib/utils";

type LanguageCode = "en" | "ta" | "hi";

const LANGUAGES: Array<{ value: LanguageCode; labelKey: string }> = [
  { value: "en", labelKey: "common.language_en" },
  { value: "ta", labelKey: "common.language_ta" },
  { value: "hi", labelKey: "common.language_hi" },
];

const normalizeLanguageCode = (value?: string | null): LanguageCode => {
  if (!value) return "en";
  const lower = value.toLowerCase();
  if (lower.startsWith("ta") || lower.includes("tamil") || value.includes("தமிழ்")) {
    return "ta";
  }
  if (lower.startsWith("hi") || lower.includes("hindi") || value.includes("हिन्दी")) {
    return "hi";
  }
  if (lower.startsWith("en") || lower.includes("english")) {
    return "en";
  }
  return "en";
};

type LanguageSwitcherProps = {
  variant?: "buttons" | "select";
  className?: string;
  triggerClassName?: string;
  iconClassName?: string;
};

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = "buttons",
  className,
  triggerClassName,
  iconClassName,
}) => {
  const { i18n, t } = useTranslation();
  const rawLanguage = i18n.resolvedLanguage || i18n.language || "en";
  const current = normalizeLanguageCode(rawLanguage);
  const defaultIconClass = "text-white";
  const iconClass = cn("text-[16px] leading-none", iconClassName ?? defaultIconClass);
  const iconBadgeClass = cn(
    "language-icon-badge language-icon-badge--animate"
  );

  const setLang = (lang: LanguageCode) => {
    i18n.changeLanguage(lang);
  };

  if (variant === "select") {
    return (
      <div className={cn("flex items-center", className)}>
        <Select
          value={current}
          onValueChange={(value) => setLang(normalizeLanguageCode(value))}
        >
          <SelectTrigger
            className={cn(
              "rainbow-border h-10 w-full gap-2 py-2 text-xs",
              triggerClassName
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={iconBadgeClass}>
                <GIcon name="translate" className={iconClass} />
              </span>
              <SelectValue
                className="min-w-0 truncate"
                placeholder={t("common.language_en")}
              />
            </div>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((language) => (
              <SelectItem key={language.value} value={language.value}>
                {t(language.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className={iconBadgeClass}>
        <GIcon name="translate" className={iconClass} />
      </span>
      {LANGUAGES.map((language) => (
        <Button
          key={language.value}
          type="button"
          size="sm"
          variant={current === language.value ? "default" : "outline"}
          className="px-3 py-1 text-xs"
          onClick={() => setLang(language.value)}
        >
          {t(language.labelKey)}
        </Button>
      ))}
    </div>
  );
};
