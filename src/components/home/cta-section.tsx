"use client";

import { Button, buttonVariants } from "@heroui/react";
import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";

export function CtaSection() {
  const { t } = useI18n();

  return (
    <section className="px-6 pb-20">
      <div className="glass-panel julow-landing-enter mx-auto max-w-6xl rounded-3xl px-8 py-14 text-center md:px-16">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-julow-muted">
          {t("landing.cta.subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "lg", variant: "primary" })}
          >
            {t("landing.cta.openWorkspace")}
          </Link>
          <Button size="lg" variant="ghost">
            {t("landing.cta.readVision")}
          </Button>
        </div>
      </div>
    </section>
  );
}
