"use client";

import { useI18n } from "@/components/providers/i18n-provider";

export function LandingFooter() {
  const { t } = useI18n();

  return (
    <footer className="px-6 py-8 text-center text-xs text-julow-muted">
      {t("landing.footer")}
    </footer>
  );
}
