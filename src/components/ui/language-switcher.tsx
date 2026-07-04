"use client";

import { LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { useI18n } from "@/components/providers/i18n-provider";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

export function LanguageSwitcher({ className = "", compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-julow-glass-border bg-julow-glass-bg/60 p-0.5 ${className}`}
      role="group"
      aria-label={t("common.language")}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            locale === l
              ? "bg-accent/15 text-accent shadow-sm"
              : "text-julow-muted hover:text-julow-fg"
          }`}
          aria-pressed={locale === l}
        >
          {compact ? l.toUpperCase() : LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
