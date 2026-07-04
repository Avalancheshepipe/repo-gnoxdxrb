"use client";

import { ArrowRight01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button, Chip, buttonVariants } from "@heroui/react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/providers/i18n-provider";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="px-6 pb-16 pt-12 md:pb-24 md:pt-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
        <Chip size="sm" variant="soft" className="mb-6 julow-landing-enter">
          {t("landing.hero.badge")}
        </Chip>

        <h1 className="julow-landing-enter julow-landing-enter--delay max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          {t("landing.hero.title")}
        </h1>

        <p className="julow-landing-enter julow-landing-enter--delay-2 mt-6 max-w-xl text-pretty text-base leading-relaxed text-julow-muted md:text-lg">
          {t("landing.hero.subtitle")}
        </p>

        <div className="julow-landing-enter julow-landing-enter--delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className={buttonVariants({
              size: "lg",
              variant: "primary",
              className: "inline-flex items-center",
            })}
          >
            {t("landing.hero.startBuilding")}
            <Icon icon={ArrowRight01Icon} size={18} />
          </Link>
          <Button size="lg" variant="outline">
            <Icon icon={PlayIcon} size={18} />
            {t("landing.hero.watchDemo")}
          </Button>
        </div>
      </div>
    </section>
  );
}
